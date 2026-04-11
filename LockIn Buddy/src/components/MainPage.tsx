import { useEffect, useRef, useState } from "react";
import ModeSelector from "./ModeSelector";
import TimerPanel from "./TimerPanel";
import RunningScreen from "./RunningScreen";
import { ButtonMode } from "./TypeButton";
import { themeByMode } from "../modes/themeByMode";
import { useTimer } from "../hooks/useTimer";
import { useDetectionSession } from "../hooks/useDetectionSession";
import type { TriggerEvent } from "../modes/types";

type ModeDurations = Record<ButtonMode, number>;

const STORAGE_KEY = "lockin-buddy-mode-durations";

const DEFAULT_DURATIONS: ModeDurations = {
  lockIn: themeByMode.lockIn.timerLength,
  shortBreak: themeByMode.shortBreak.timerLength,
  longBreak: themeByMode.longBreak.timerLength,
};

function clampDuration(value: number) {
  return Math.max(1, Math.floor(value));
}

function loadSavedDurations(): ModeDurations {
  if (typeof window === "undefined") {
    return DEFAULT_DURATIONS;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_DURATIONS;

    const parsed = JSON.parse(raw) as Partial<Record<ButtonMode, unknown>>;
    return {
      lockIn: clampDuration(Number(parsed.lockIn ?? DEFAULT_DURATIONS.lockIn)),
      shortBreak: clampDuration(Number(parsed.shortBreak ?? DEFAULT_DURATIONS.shortBreak)),
      longBreak: clampDuration(Number(parsed.longBreak ?? DEFAULT_DURATIONS.longBreak)),
    };
  } catch {
    return DEFAULT_DURATIONS;
  }
}

export default function MainPage({
  activeMode,
  onModeChange,
  onTriggerInitiated,
  onBreakSessionStart,
  onBreakSessionEnd,
}: {
  activeMode: ButtonMode;
  onModeChange: (mode: ButtonMode) => void;
  onTriggerInitiated: (trigger: TriggerEvent) => void;
  onBreakSessionStart: (mode: "shortBreak" | "longBreak") => void;
  onBreakSessionEnd: () => void;
}) {
  const [isRunningScreen, setIsRunningScreen] = useState(false);
  const [activeTrigger, setActiveTrigger] = useState<TriggerEvent | null>(null);
  const [resumeAfterTrigger, setResumeAfterTrigger] = useState(false);
  const [endSessionAfterTrigger, setEndSessionAfterTrigger] = useState(false);
  const [modeDurations, setModeDurations] = useState<ModeDurations>(() => loadSavedDurations());
  const endBreakSoundPlayedRef = useRef(false);

  const { minutes, seconds, isRunning, isFinished, start, pause, toggle, reset } = useTimer(
    modeDurations[activeMode],
  );

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(modeDurations));
  }, [modeDurations]);

  const exitRunningSession = () => {
    setActiveTrigger(null);
    setResumeAfterTrigger(false);
    setEndSessionAfterTrigger(false);
    setIsRunningScreen(false);
    reset();
  };

  const clearAlertVisual = () => {
    if (endSessionAfterTrigger || !activeTrigger || activeTrigger === "success") return;

    setActiveTrigger(null);
    if (resumeAfterTrigger) start();
    setResumeAfterTrigger(false);
    setEndSessionAfterTrigger(false);
  };

  const triggerEvent = (event: TriggerEvent, options?: { endSessionAfter?: boolean }) => {
    const shouldEndSession = options?.endSessionAfter ?? false;
    const shouldResumeAfter = !shouldEndSession && (isRunning || resumeAfterTrigger);

    setResumeAfterTrigger(shouldResumeAfter);
    setEndSessionAfterTrigger(shouldEndSession);
    pause();
    setActiveTrigger(event);
    onTriggerInitiated(event);
  };

  useEffect(() => {
    if (!isRunningScreen) {
      endBreakSoundPlayedRef.current = false;
      return;
    }
    if (activeMode !== "shortBreak" && activeMode !== "longBreak") return;
    if (!isFinished) {
      endBreakSoundPlayedRef.current = false;
      return;
    }
    if (endBreakSoundPlayedRef.current) return;
    endBreakSoundPlayedRef.current = true;
    onBreakSessionEnd();
  }, [isRunningScreen, activeMode, isFinished, onBreakSessionEnd]);

  useDetectionSession({
    enabled: isRunningScreen && activeMode === "lockIn",
    onStrike: (strikeCount) => {
      if (strikeCount === 1) {
        triggerEvent("mad1");
      } else if (strikeCount === 2) {
        triggerEvent("mad2");
      } else if (strikeCount === 3) {
        triggerEvent("mad3", { endSessionAfter: true });
      }
    },
    onLockedIn: clearAlertVisual,
  });

  const handleStart = () => {
    if (activeMode === "shortBreak") {
      onBreakSessionStart("shortBreak");
    } else if (activeMode === "longBreak") {
      onBreakSessionStart("longBreak");
    }
    setIsRunningScreen(true);
    start();
  };

  const handleSkip = () => {
    exitRunningSession();
  };

  const handleTrigger = (event: TriggerEvent) => {
    triggerEvent(event);
  };

  const handleDurationChange = (value: number) => {
    setModeDurations((currentDurations) => ({
      ...currentDurations,
      [activeMode]: clampDuration(value),
    }));
  };

  useEffect(() => {
    if (!activeTrigger) return;

    const ms = themeByMode[activeMode].triggerDurationMs[activeTrigger];
    const id = window.setTimeout(() => {
      if (activeTrigger === "success") {
        exitRunningSession();
        return;
      }

      if (endSessionAfterTrigger) {
        exitRunningSession();
        return;
      }

      setActiveTrigger(null);
      if (resumeAfterTrigger) start();
      setResumeAfterTrigger(false);
      setEndSessionAfterTrigger(false);
    }, ms);

    return () => window.clearTimeout(id);
  }, [activeMode, activeTrigger, endSessionAfterTrigger, resumeAfterTrigger, reset, start]);

  if (isRunningScreen) {
    return (
      <RunningScreen
        mode={activeMode}
        minutes={minutes}
        seconds={seconds}
        isRunning={isRunning}
        onTogglePause={toggle}
        onSkip={handleSkip}
        onTrigger={handleTrigger}
        isFinished={isFinished}
        trigger={activeTrigger}
      />
    );
  }

  return (
    <main className="flex h-screen flex-col items-center justify-center bg-[var(--customGreen)] px-4 py-6 transition-colors duration-300 ease-in-out">
      <div className="face box-border flex h-[min(70vh,38rem)] w-full max-w-[min(92vw,80rem)] flex-col rounded-xl bg-[var(--lighterGreen)] p-[clamp(0.5rem,3cqw,1.75rem)] [container-type:inline-size] transition-colors duration-300 ease-in-out">
        <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col items-center justify-center gap-y-[2em] [font-size:clamp(0.75rem,3.2cqw,1.125rem)]">
          <ModeSelector activeMode={activeMode} onModeChange={onModeChange} />
          <TimerPanel
            minutes={minutes}
            seconds={seconds}
            onStart={handleStart}
            durationMinutes={modeDurations[activeMode]}
            onDurationChange={handleDurationChange}
          />
        </div>
      </div>
    </main>
  );
}

