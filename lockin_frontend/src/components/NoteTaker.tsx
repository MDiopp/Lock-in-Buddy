import { useState } from "react";
import { useTranscription } from "../hooks/useTranscription";

const API_BASE = "http://localhost:8000";

type NoteStyle = "bullet" | "summary" | "cornell";

export default function NoteTaker({ onBack }: { onBack: () => void }) {
  const { phase, transcript, error, start, pause, resume, stop, reset } =
    useTranscription();

  const [generatedNotes, setGeneratedNotes] = useState<string | null>(null);
  const [noteStyle, setNoteStyle] = useState<NoteStyle>("bullet");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const handleGenerateNotes = async () => {
    setGenerating(true);
    setGenError(null);
    try {
      const res = await fetch(`${API_BASE}/notes/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript, style: noteStyle }),
      });
      if (!res.ok) throw new Error("Note generation failed");
      const data = await res.json();
      setGeneratedNotes(data.notes ?? "");
    } catch (err: any) {
      setGenError(err.message ?? "Failed to generate notes");
    } finally {
      setGenerating(false);
    }
  };

  const handleNewSession = () => {
    reset();
    setGeneratedNotes(null);
    setGenError(null);
  };

  // ── IDLE: start screen ──────────────────────────────────────────────────
  if (phase === "idle") {
    return (
      <main className="flex h-screen flex-col items-center justify-center gap-y-6 bg-[var(--customGreen)] px-4 py-6 text-center transition-colors duration-300 ease-in-out">
        <h1 className="text-[clamp(2rem,5vw,3rem)] leading-snug text-[var(--classicWhite)]">
          Note Taker
        </h1>
        <p className="max-w-md text-[clamp(1rem,1.3vw+0.7rem,1.2rem)] leading-relaxed text-[var(--lighterGreen)]">
          Start a session to transcribe audio from your microphone in real time.
          When you're done, turn it into study notes.
        </p>
        {error && (
          <p className="max-w-md text-sm text-red-200">{error}</p>
        )}
        <button
          type="button"
          onClick={start}
          className="startButton cursor-pointer rounded-2xl bg-[var(--classicWhite)] px-[clamp(2rem,5vw,3rem)] py-[clamp(0.6rem,1.5vw,1rem)] text-[clamp(1.1rem,1.5vw+0.7rem,1.4rem)] font-medium text-[var(--customGreen)] shadow-lg transition-[color,background-color,transform] duration-300 ease-in-out hover:scale-[1.03] active:scale-[0.98]"
        >
          Start Session
        </button>
        <button
          type="button"
          onClick={onBack}
          className="cursor-pointer rounded-xl bg-transparent px-4 py-2 text-[clamp(1rem,1.2vw+0.6rem,1.15rem)] text-[var(--classicWhite)] underline underline-offset-2 transition-transform duration-200 hover:scale-[1.03]"
        >
          back
        </button>
      </main>
    );
  }

  // ── RECORDING / PAUSED: live transcript ─────────────────────────────────
  if (phase === "recording" || phase === "paused") {
    return (
      <main className="flex h-screen flex-col bg-[var(--customGreen)] px-4 py-6 transition-colors duration-300 ease-in-out">
        {/* Controls */}
        <div className="flex items-center justify-center gap-x-4 pb-4">
          {phase === "recording" ? (
            <button
              type="button"
              onClick={pause}
              className="cursor-pointer rounded-xl bg-[var(--classicWhite)] px-[clamp(1rem,3vw,2rem)] py-[clamp(0.25rem,1.1vw,0.55rem)] text-[clamp(1.1rem,2.5vw,1.75rem)] font-medium text-[var(--customGreen)] shadow-lg transition-[color,background-color,transform] duration-300 ease-in-out hover:scale-[1.03]"
            >
              pause
            </button>
          ) : (
            <button
              type="button"
              onClick={resume}
              className="cursor-pointer rounded-xl bg-[var(--classicWhite)] px-[clamp(1rem,3vw,2rem)] py-[clamp(0.25rem,1.1vw,0.55rem)] text-[clamp(1.1rem,2.5vw,1.75rem)] font-medium text-[var(--customGreen)] shadow-lg transition-[color,background-color,transform] duration-300 ease-in-out hover:scale-[1.03]"
            >
              resume
            </button>
          )}
          <button
            type="button"
            onClick={stop}
            className="cursor-pointer rounded-xl bg-red-100 px-[clamp(1rem,3vw,2rem)] py-[clamp(0.25rem,1.1vw,0.55rem)] text-[clamp(1.1rem,2.5vw,1.75rem)] font-medium text-red-700 shadow-lg transition-[color,background-color,transform] duration-300 ease-in-out hover:scale-[1.03]"
          >
            stop
          </button>
        </div>

        {/* Status indicator */}
        <div className="flex items-center justify-center gap-x-2 pb-4">
          <span
            className={`inline-block h-3 w-3 rounded-full ${
              phase === "recording" ? "animate-pulse bg-red-400" : "bg-yellow-400"
            }`}
          />
          <span className="text-[clamp(0.9rem,1.2vw+0.5rem,1.1rem)] text-[var(--classicWhite)]">
            {phase === "recording" ? "Recording..." : "Paused"}
          </span>
        </div>

        {/* Live transcript box */}
        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col overflow-hidden rounded-xl bg-[var(--lighterGreen)] p-[clamp(0.75rem,2vw,1.5rem)] shadow-inner transition-colors duration-300 ease-in-out">
          <h3 className="pb-2 text-[clamp(1rem,1.5vw,1.25rem)] font-medium text-[var(--customGreen)]">
            Live Transcript
          </h3>
          <div className="flex-1 overflow-y-auto whitespace-pre-wrap text-[clamp(0.85rem,1.1vw+0.5rem,1.05rem)] leading-relaxed text-[var(--customGreen)]">
            {transcript || (
              <span className="opacity-50">Listening for audio...</span>
            )}
          </div>
        </div>

        {error && (
          <p className="mt-3 text-center text-sm text-red-200">{error}</p>
        )}
      </main>
    );
  }

  // ── STOPPED: show transcript + generate notes ───────────────────────────
  if (phase === "stopped" && generatedNotes === null) {
    return (
      <main className="flex h-screen flex-col bg-[var(--customGreen)] px-4 py-6 transition-colors duration-300 ease-in-out">
        <div className="flex items-center justify-center pb-4">
          <h2 className="text-[clamp(1.5rem,3vw,2.25rem)] text-[var(--classicWhite)]">
            Session Complete
          </h2>
        </div>

        {/* Transcript display */}
        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col overflow-hidden rounded-xl bg-[var(--lighterGreen)] p-[clamp(0.75rem,2vw,1.5rem)] shadow-inner transition-colors duration-300 ease-in-out">
          <h3 className="pb-2 text-[clamp(1rem,1.5vw,1.25rem)] font-medium text-[var(--customGreen)]">
            Your Transcript
          </h3>
          <div className="flex-1 overflow-y-auto whitespace-pre-wrap text-[clamp(0.85rem,1.1vw+0.5rem,1.05rem)] leading-relaxed text-[var(--customGreen)]">
            {transcript || (
              <span className="opacity-50">No speech was detected.</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-y-3 pt-5">
          {/* Style selector */}
          <div className="flex items-center gap-x-3">
            <span className="text-[clamp(0.9rem,1.1vw+0.5rem,1.05rem)] text-[var(--classicWhite)]">
              Note style:
            </span>
            {(["bullet", "summary", "cornell"] as NoteStyle[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setNoteStyle(s)}
                className={`cursor-pointer rounded-lg px-3 py-1 text-[clamp(0.85rem,1vw+0.4rem,1rem)] font-medium transition-[color,background-color,transform] duration-200 ${
                  noteStyle === s
                    ? "bg-[var(--customGreen)] text-[var(--classicWhite)]"
                    : "bg-[var(--classicWhite)] text-[var(--customGreen)]"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-x-4">
            <button
              type="button"
              onClick={handleGenerateNotes}
              disabled={generating || !transcript.trim()}
              className="cursor-pointer rounded-2xl bg-[var(--classicWhite)] px-[clamp(1.5rem,4vw,2.5rem)] py-[clamp(0.5rem,1.3vw,0.75rem)] text-[clamp(1rem,1.3vw+0.6rem,1.2rem)] font-medium text-[var(--customGreen)] shadow-md transition-[color,background-color,transform] duration-300 ease-in-out hover:scale-[1.03] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generating ? "Generating..." : "Generate Notes"}
            </button>
            <button
              type="button"
              onClick={handleNewSession}
              className="cursor-pointer rounded-2xl bg-transparent px-4 py-2 text-[clamp(0.95rem,1.1vw+0.5rem,1.1rem)] text-[var(--classicWhite)] underline underline-offset-2 transition-transform duration-200 hover:scale-[1.03]"
            >
              Keep Raw Transcript
            </button>
          </div>
          {genError && (
            <p className="text-sm text-red-200">{genError}</p>
          )}
        </div>

        <div className="flex items-center justify-center pt-4">
          <button
            type="button"
            onClick={() => { handleNewSession(); onBack(); }}
            className="cursor-pointer rounded-xl bg-transparent px-4 py-2 text-[clamp(1rem,1.2vw+0.6rem,1.15rem)] text-[var(--classicWhite)] underline underline-offset-2 transition-transform duration-200 hover:scale-[1.03]"
          >
            back
          </button>
        </div>
      </main>
    );
  }

  // ── GENERATED NOTES: show final result ──────────────────────────────────
  return (
    <main className="flex h-screen flex-col bg-[var(--customGreen)] px-4 py-6 transition-colors duration-300 ease-in-out">
      <div className="flex items-center justify-center pb-4">
        <h2 className="text-[clamp(1.5rem,3vw,2.25rem)] text-[var(--classicWhite)]">
          Your Notes
        </h2>
      </div>

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col overflow-hidden rounded-xl bg-[var(--lighterGreen)] p-[clamp(0.75rem,2vw,1.5rem)] shadow-inner transition-colors duration-300 ease-in-out">
        <div className="flex-1 overflow-y-auto whitespace-pre-wrap text-[clamp(0.85rem,1.1vw+0.5rem,1.05rem)] leading-relaxed text-[var(--customGreen)]">
          {generatedNotes}
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-3xl items-center justify-center gap-x-4 pt-5">
        <button
          type="button"
          onClick={handleNewSession}
          className="cursor-pointer rounded-2xl bg-[var(--classicWhite)] px-[clamp(1.5rem,4vw,2.5rem)] py-[clamp(0.5rem,1.3vw,0.75rem)] text-[clamp(1rem,1.3vw+0.6rem,1.2rem)] font-medium text-[var(--customGreen)] shadow-md transition-[color,background-color,transform] duration-300 ease-in-out hover:scale-[1.03] active:scale-[0.98]"
        >
          New Session
        </button>
        <button
          type="button"
          onClick={() => { handleNewSession(); onBack(); }}
          className="cursor-pointer rounded-xl bg-transparent px-4 py-2 text-[clamp(1rem,1.2vw+0.6rem,1.15rem)] text-[var(--classicWhite)] underline underline-offset-2 transition-transform duration-200 hover:scale-[1.03]"
        >
          back
        </button>
      </div>
    </main>
  );
}
