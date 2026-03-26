import ModeSelector from "./ModeSelector";
import TimerPanel from "./TimerPanel";
import { ButtonMode } from "./TypeButton";

export default function MainPage({
  activeMode,
  onModeChange,
  timerLength,
}: {
  activeMode: ButtonMode;
  onModeChange: (mode: ButtonMode) => void;
  timerLength: number;
}) {
  return (
    <main className="flex h-screen flex-col items-center justify-center bg-[var(--customGreen)] px-4 py-6 transition-colors duration-300 ease-in-out">
      <div className="face box-border flex h-[min(70vh,38rem)] w-full max-w-[min(92vw,30rem)] flex-col rounded-xl bg-[var(--lighterGreen)] p-[clamp(0.5rem,3cqw,1.75rem)] [container-type:inline-size] transition-colors duration-300 ease-in-out">
        <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col items-center justify-center gap-y-[2em] [font-size:clamp(0.75rem,3.2cqw,1.125rem)]">
          <ModeSelector activeMode={activeMode} onModeChange={onModeChange} />
          <TimerPanel timerLength={timerLength} />
        </div>
      </div>
    </main>
  );
}

