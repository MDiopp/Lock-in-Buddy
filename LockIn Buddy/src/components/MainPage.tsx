import { useEffect, useState } from "react";
import ModeSelector from "./ModeSelector";
import TimerPanel from "./TimerPanel";
import RunningScreen from "./RunningScreen";
import TriggerScreen from "./TriggerScreen";
import { ButtonMode } from "./TypeButton";
import { themeByMode } from "../modes/themeByMode";
import { useTimer } from "../hooks/useTimer";
import type { TriggerEvent } from "../triggers/types";

export default function MainPage({
  activeMode,
  onModeChange,
}: {
  activeMode: ButtonMode;
  onModeChange: (mode: ButtonMode) => void;
}) {
  const [isRunningScreen, setIsRunningScreen] = useState(false);
  const [activeTrigger, setActiveTrigger] = useState<TriggerEvent | null>(null);
  const [resumeAfterTrigger, setResumeAfterTrigger] = useState(false);

  const { minutes, seconds, isRunning, isFinished, start, pause, toggle, reset } = useTimer(
    themeByMode[activeMode].timerLength,
  );

  // When the timer finishes, return to the main page.
  useEffect(() => {
    if (!isRunningScreen) return;
    if (!isFinished) return;
    setIsRunningScreen(false);
    reset();
  }, [isFinished, isRunningScreen, reset]);

  const handleStart = () => {
    setIsRunningScreen(true);
    start();
  };

  const handleSkip = () => {
    setActiveTrigger(null);
    setIsRunningScreen(false);
    reset();
  };

  const handleTrigger = (event: TriggerEvent) => {
    setResumeAfterTrigger(isRunning);
    pause();
    setActiveTrigger(event);
  };

  useEffect(() => {
    if (!activeTrigger) return;

    const ms = themeByMode[activeMode].triggerDurationMs[activeTrigger];
    const id = window.setTimeout(() => {
      setActiveTrigger(null);
      if (resumeAfterTrigger) start();
      setResumeAfterTrigger(false);
    }, ms);

    return () => window.clearTimeout(id);
  }, [activeMode, activeTrigger, resumeAfterTrigger, start]);

  if (isRunningScreen) {
    if (activeTrigger) {
      return (
        <TriggerScreen
          mode={activeMode}
          trigger={activeTrigger}
          minutes={minutes}
          seconds={seconds}
        />
      );
    }

    return (
      <RunningScreen
        mode={activeMode}
        minutes={minutes}
        seconds={seconds}
        isRunning={isRunning}
        onTogglePause={toggle}
        onSkip={handleSkip}
        onTrigger={handleTrigger}
      />
    );
  }

  return (
    <main className="flex h-screen flex-col items-center justify-center bg-[var(--customGreen)] px-4 py-6 transition-colors duration-300 ease-in-out">
      <div className="face box-border flex h-[min(70vh,38rem)] w-full max-w-[min(92vw,30rem)] flex-col rounded-xl bg-[var(--lighterGreen)] p-[clamp(0.5rem,3cqw,1.75rem)] [container-type:inline-size] transition-colors duration-300 ease-in-out">
        <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col items-center justify-center gap-y-[2em] [font-size:clamp(0.75rem,3.2cqw,1.125rem)]">
          <ModeSelector activeMode={activeMode} onModeChange={onModeChange} />
          <TimerPanel minutes={minutes} seconds={seconds} onStart={handleStart} />
        </div>
      </div>
    </main>
  );
}

