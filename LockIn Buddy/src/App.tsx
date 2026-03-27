import { useEffect, useRef, useState } from "react";
import "./App.css";

import WelcomeScreen from "./components/WelcomeScreen";
import MainPage from "./components/MainPage";
import type { ButtonMode } from "./components/TypeButton";
import { themeByMode } from "./modes/themeByMode";
import type { TriggerEvent } from "./modes/types";
import buttonClickMp3 from "./assets/ButtonClick.mp3";
import startPressMp3 from "./assets/startPress.mp3";
import successSoundMp3 from "./assets/successSound.mp3";
import mad1SoundMp3 from "./assets/mad1Sound.mp3";
import mad2SoundMp3 from "./assets/mad2Sound.mp3";
import mad3SoundMp3 from "./assets/mad3Sound.mp3";

type SoundKey =
  | "buttonClick"
  | "startPress"
  | "triggerSuccess"
  | "triggerMad1"
  | "triggerMad2"
  | "triggerMad3";

const SOUND_CONFIG: Record<SoundKey, { src: string; volume: number }> = {
  buttonClick: { src: buttonClickMp3, volume: 0.35 },
  startPress: { src: startPressMp3, volume: 0.52 },
  triggerSuccess: { src: successSoundMp3, volume: 0.5 },
  triggerMad1: { src: mad1SoundMp3, volume: 0.5 },
  triggerMad2: { src: mad2SoundMp3, volume: 0.5 },
  triggerMad3: { src: mad3SoundMp3, volume: 0.5 },
};

const TRIGGER_SOUND_BY_EVENT: Record<TriggerEvent, SoundKey> = {
  success: "triggerSuccess",
  mad1: "triggerMad1",
  mad2: "triggerMad2",
  mad3: "triggerMad3",
};

function App() {
  const [showWelcome, setShowWelcome] = useState(true);
  const [activeMode, setActiveMode] = useState<ButtonMode>("lockIn");
  const audioCtxRef = useRef<AudioContext | null>(null);
  const soundBuffersRef = useRef<Partial<Record<SoundKey, AudioBuffer>>>({});

  const playSound = (soundKey: SoundKey) => {
    const audioCtx = audioCtxRef.current;
    const soundBuffer = soundBuffersRef.current[soundKey];
    if (!audioCtx || !soundBuffer) return;

    if (audioCtx.state === "suspended") {
      void audioCtx.resume();
    }

    const source = audioCtx.createBufferSource();
    source.buffer = soundBuffer;
    const gain = audioCtx.createGain();
    gain.gain.value = SOUND_CONFIG[soundKey].volume;
    source.connect(gain);
    gain.connect(audioCtx.destination);
    source.start(0);
  };

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
      const entries = Object.entries(SOUND_CONFIG) as Array<[SoundKey, { src: string }]>;
      const loaded = await Promise.all(entries.map(async ([key, config]) => [key, await loadBuffer(config.src)] as const));
      if (disposed) return;
      soundBuffersRef.current = Object.fromEntries(
        loaded.filter(([, buffer]) => !!buffer),
      ) as Partial<Record<SoundKey, AudioBuffer>>;
    };

    void loadAllBuffers();

    return () => {
      disposed = true;
      soundBuffersRef.current = {};
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

      const isStartButton = clickedButton.classList.contains("startButton");
      playSound(isStartButton ? "startPress" : "buttonClick");
    };

    window.addEventListener("pointerdown", handlePointerDown, true);
    return () => window.removeEventListener("pointerdown", handlePointerDown, true);
  }, []);

  const handleTriggerInitiated = (trigger: TriggerEvent) => {
    playSound(TRIGGER_SOUND_BY_EVENT[trigger]);
  };

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
        <MainPage
          activeMode={activeMode}
          onModeChange={setActiveMode}
          onTriggerInitiated={handleTriggerInitiated}
        />
      )}
    </div>
  );
}

export default App;
