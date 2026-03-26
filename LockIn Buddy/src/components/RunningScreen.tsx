import type { ButtonMode } from "./TypeButton";

function formatTime(minutes: number, seconds: number) {
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

const runningUiByMode: Record<
  ButtonMode,
  {
    container: string;
    panel: string;
    timeText: string;
    buttonBase: string;
    pauseButton: string;
    skipButton: string;
  }
> = {
  lockIn: {
    container:
      "flex h-screen flex-col items-center justify-center bg-[var(--customGreen)] px-6 transition-colors duration-300 ease-in-out",
    panel:
      "w-full max-w-xl rounded-3xl bg-[var(--lighterGreen)] p-10 shadow-lg transition-colors duration-300 ease-in-out",
    timeText: "text-[clamp(3rem,9vw,6rem)] text-[var(--customGreen)] leading-none",
    buttonBase:
      "rounded-2xl px-8 py-3 text-[clamp(1.25rem,2.5vw,1.75rem)] font-medium transition-[color,box-shadow,background-color] duration-300 ease-in-out",
    pauseButton:
      "bg-[var(--classicWhite)] text-[var(--customGreen)] [box-shadow:-7px_5px_4px_0_var(--customGreen)]",
    skipButton:
      "bg-transparent text-[var(--customGreen)] ring-2 ring-[var(--customGreen)]/50",
  },
  shortBreak: {
    container:
      "flex h-screen flex-col items-center justify-center bg-[var(--customGreen)] px-6 transition-colors duration-300 ease-in-out",
    panel:
      "w-full max-w-xl rounded-3xl bg-[var(--lighterGreen)] p-10 shadow-lg transition-colors duration-300 ease-in-out",
    timeText: "text-[clamp(3rem,9vw,6rem)] text-[var(--customGreen)] leading-none",
    buttonBase:
      "rounded-2xl px-8 py-3 text-[clamp(1.25rem,2.5vw,1.75rem)] font-medium transition-[color,box-shadow,background-color] duration-300 ease-in-out",
    pauseButton:
      "bg-[var(--classicWhite)] text-[var(--customGreen)] [box-shadow:-7px_5px_4px_0_var(--customGreen)]",
    skipButton:
      "bg-transparent text-[var(--customGreen)] ring-2 ring-[var(--customGreen)]/50",
  },
  longBreak: {
    container:
      "flex h-screen flex-col items-center justify-center bg-[var(--customGreen)] px-6 transition-colors duration-300 ease-in-out",
    panel:
      "w-full max-w-xl rounded-3xl bg-[var(--lighterGreen)] p-10 shadow-lg transition-colors duration-300 ease-in-out",
    timeText: "text-[clamp(3rem,9vw,6rem)] text-[var(--customGreen)] leading-none",
    buttonBase:
      "rounded-2xl px-8 py-3 text-[clamp(1.25rem,2.5vw,1.75rem)] font-medium transition-[color,box-shadow,background-color] duration-300 ease-in-out",
    pauseButton:
      "bg-[var(--classicWhite)] text-[var(--customGreen)] [box-shadow:-7px_5px_4px_0_var(--customGreen)]",
    skipButton:
      "bg-transparent text-[var(--customGreen)] ring-2 ring-[var(--customGreen)]/50",
  },
};

export default function RunningScreen({
  mode,
  minutes,
  seconds,
  isRunning,
  onTogglePause,
  onSkip,
}: {
  mode: ButtonMode;
  minutes: number;
  seconds: number;
  isRunning: boolean;
  onTogglePause: () => void;
  onSkip: () => void;
}) {
  const ui = runningUiByMode[mode];

  return (
    <main className={ui.container}>
      <div className={ui.panel}>
        <div className="flex flex-col items-center gap-y-10 text-center">
          <div className={ui.timeText}>{formatTime(minutes, seconds)}</div>

          <div className="flex w-full items-center justify-center gap-x-6">
            <button
              type="button"
              onClick={onTogglePause}
              className={`${ui.buttonBase} ${ui.pauseButton}`}
            >
              {isRunning ? "pause" : "resume"}
            </button>
            <button
              type="button"
              onClick={onSkip}
              className={`${ui.buttonBase} ${ui.skipButton}`}
            >
              skip
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

