import { useEffect, useRef, useState } from "react";
import "./App.css";

import WelcomeScreen from "./components/WelcomeScreen";
import MainPage from "./components/MainPage";
import type { ButtonMode } from "./components/TypeButton";
import { themeByMode } from "./modes/themeByMode";
import buttonClickMp3 from "./assets/ButtonClick.mp3";
import startPressMp3 from "./assets/startPress.mp3";

const CLICK_VOLUME = 0.35;
const START_VOLUME = 0.52;

function App() {
  const [showWelcome, setShowWelcome] = useState(true);
  const [activeMode, setActiveMode] = useState<ButtonMode>("lockIn");
  const audioCtxRef = useRef<AudioContext | null>(null);
  const clickBufferRef = useRef<AudioBuffer | null>(null);
  const startBufferRef = useRef<AudioBuffer | null>(null);

  useEffect(() => {
    const audioCtx = new AudioContext();
    audioCtxRef.current = audioCtx;

    let disposed = false;

    const loadBuffer = async (src: string) => {
      try {
        const response = await fetch(src);
        const arrayBuffer = await response.arrayBuffer();
        return await audioCtx.decodeAudioData(arrayBuffer);
      } catch {
        // Ignore load errors; app remains functional without sound.
        return null;
      }
    };

    const loadAllBuffers = async () => {
      const [clickBuffer, startBuffer] = await Promise.all([
        loadBuffer(buttonClickMp3),
        loadBuffer(startPressMp3),
      ]);
      if (disposed) return;
      clickBufferRef.current = clickBuffer;
      startBufferRef.current = startBuffer;
    };

    void loadAllBuffers();

    return () => {
      disposed = true;
      clickBufferRef.current = null;
      startBufferRef.current = null;
      void audioCtx.close();
      audioCtxRef.current = null;
    };
  }, []);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const clickedButton = target.closest("button");
      if (!clickedButton || clickedButton.hasAttribute("disabled")) return;

      const audioCtx = audioCtxRef.current;
      const isStartButton = clickedButton.classList.contains("startButton");
      const soundBuffer = isStartButton ? startBufferRef.current : clickBufferRef.current;
      if (!audioCtx || !soundBuffer) return;

      if (audioCtx.state === "suspended") {
        void audioCtx.resume();
      }

      const source = audioCtx.createBufferSource();
      source.buffer = soundBuffer;
      const gain = audioCtx.createGain();
      gain.gain.value = isStartButton ? START_VOLUME : CLICK_VOLUME;
      source.connect(gain);
      gain.connect(audioCtx.destination);
      source.start(0);
    };

    window.addEventListener("pointerdown", handlePointerDown, true);
    return () => window.removeEventListener("pointerdown", handlePointerDown, true);
  }, []);

  const theme = themeByMode[activeMode];
  const themeStyle = {
    ["--customGreen" as any]: theme.darkerColor,
    ["--lighterGreen" as any]: theme.lighterColor,
    ["--classicWhite" as any]: theme.lightestColor,
  } as any;

  return (
    <div style={themeStyle}>
      {showWelcome ? (
        <WelcomeScreen onContinue={() => setShowWelcome(false)} />
      ) : (
        <MainPage activeMode={activeMode} onModeChange={setActiveMode} />
      )}
    </div>
  );
}

export default App;
