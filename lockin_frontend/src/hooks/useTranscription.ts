import { useCallback, useRef, useState } from "react";

const API_BASE = "http://localhost:8000";

type SessionPhase = "idle" | "recording" | "paused" | "stopped";

export function useTranscription() {
  const [phase, setPhase] = useState<SessionPhase>("idle");
  const [transcript, setTranscript] = useState("");
  const [latestChunk, setLatestChunk] = useState("");
  const [error, setError] = useState<string | null>(null);

  const sessionIdRef = useRef<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const cleanup = useCallback(() => {
    processorRef.current?.disconnect();
    processorRef.current = null;

    if (audioCtxRef.current) {
      void audioCtxRef.current.close();
      audioCtxRef.current = null;
    }

    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const start = useCallback(async () => {
    setError(null);
    try {
      // 1. Create session on backend
      const res = await fetch(`${API_BASE}/transcription/start`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to start transcription session");
      const data = await res.json();
      const sessionId: string = data.session_id;
      sessionIdRef.current = sessionId;

      // 2. Open WebSocket
      const ws = new WebSocket(`ws://localhost:8000/transcription/${sessionId}/stream`);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        setLatestChunk(msg.chunk ?? "");
        setTranscript(msg.full_transcript ?? "");
      };

      ws.onerror = () => setError("WebSocket connection error");

      // Wait for WS to open before starting mic
      await new Promise<void>((resolve, reject) => {
        ws.onopen = () => resolve();
        ws.onerror = () => reject(new Error("WebSocket failed to connect"));
      });

      // 3. Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
        },
      });
      mediaStreamRef.current = stream;

      // 4. Set up audio processing to send PCM chunks
      const audioCtx = new AudioContext({ sampleRate: 16000 });
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);

      // Buffer ~4 seconds of audio before sending (4 * 16000 = 64000 samples)
      const bufferSize = 4096;
      const processor = audioCtx.createScriptProcessor(bufferSize, 1, 1);
      processorRef.current = processor;

      let pcmBuffer: Float32Array[] = [];
      let sampleCount = 0;
      const CHUNK_SAMPLES = 16000 * 4; // 4 seconds

      processor.onaudioprocess = (e) => {
        if (wsRef.current?.readyState !== WebSocket.OPEN) return;

        const input = e.inputBuffer.getChannelData(0);
        pcmBuffer.push(new Float32Array(input));
        sampleCount += input.length;

        if (sampleCount >= CHUNK_SAMPLES) {
          // Merge and convert float32 → int16 PCM
          const merged = new Float32Array(sampleCount);
          let offset = 0;
          for (const chunk of pcmBuffer) {
            merged.set(chunk, offset);
            offset += chunk.length;
          }

          const int16 = new Int16Array(merged.length);
          for (let i = 0; i < merged.length; i++) {
            const s = Math.max(-1, Math.min(1, merged[i]));
            int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
          }

          wsRef.current.send(int16.buffer);
          pcmBuffer = [];
          sampleCount = 0;
        }
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);

      setPhase("recording");
    } catch (err: any) {
      setError(err.message ?? "Failed to start");
      cleanup();
    }
  }, [cleanup]);

  const pause = useCallback(async () => {
    const sessionId = sessionIdRef.current;
    if (!sessionId) return;

    try {
      await fetch(`${API_BASE}/transcription/${sessionId}/pause`, { method: "POST" });
      // Disconnect processor so we stop sending audio
      processorRef.current?.disconnect();
      setPhase("paused");
    } catch (err: any) {
      setError(err.message ?? "Failed to pause");
    }
  }, []);

  const resume = useCallback(async () => {
    const sessionId = sessionIdRef.current;
    if (!sessionId || !audioCtxRef.current || !mediaStreamRef.current) return;

    try {
      await fetch(`${API_BASE}/transcription/${sessionId}/resume`, { method: "POST" });

      // Reconnect audio processor
      const source = audioCtxRef.current.createMediaStreamSource(mediaStreamRef.current);
      const bufferSize = 4096;
      const processor = audioCtxRef.current.createScriptProcessor(bufferSize, 1, 1);
      processorRef.current = processor;

      let pcmBuffer: Float32Array[] = [];
      let sampleCount = 0;
      const CHUNK_SAMPLES = 16000 * 4;

      processor.onaudioprocess = (e) => {
        if (wsRef.current?.readyState !== WebSocket.OPEN) return;

        const input = e.inputBuffer.getChannelData(0);
        pcmBuffer.push(new Float32Array(input));
        sampleCount += input.length;

        if (sampleCount >= CHUNK_SAMPLES) {
          const merged = new Float32Array(sampleCount);
          let offset = 0;
          for (const chunk of pcmBuffer) {
            merged.set(chunk, offset);
            offset += chunk.length;
          }

          const int16 = new Int16Array(merged.length);
          for (let i = 0; i < merged.length; i++) {
            const s = Math.max(-1, Math.min(1, merged[i]));
            int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
          }

          wsRef.current.send(int16.buffer);
          pcmBuffer = [];
          sampleCount = 0;
        }
      };

      source.connect(processor);
      processor.connect(audioCtxRef.current.destination);

      setPhase("recording");
    } catch (err: any) {
      setError(err.message ?? "Failed to resume");
    }
  }, []);

  const stop = useCallback(async () => {
    const sessionId = sessionIdRef.current;
    if (!sessionId) return;

    try {
      const res = await fetch(`${API_BASE}/transcription/${sessionId}/stop`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setTranscript(data.transcript ?? "");
      }
    } catch (err: any) {
      setError(err.message ?? "Failed to stop");
    }

    cleanup();
    setPhase("stopped");
  }, [cleanup]);

  const reset = useCallback(() => {
    cleanup();
    sessionIdRef.current = null;
    setPhase("idle");
    setTranscript("");
    setLatestChunk("");
    setError(null);
  }, [cleanup]);

  return {
    phase,
    transcript,
    latestChunk,
    error,
    start,
    pause,
    resume,
    stop,
    reset,
  };
}
