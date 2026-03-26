import TypeButton, { ButtonMode } from "./TypeButton";

export default function ModeSelector({
  activeMode,
  onModeChange,
}: {
  activeMode: ButtonMode;
  onModeChange: (mode: ButtonMode) => void;
}) {
  const modeButtons = [
    { text: "lock in", mode: "lockIn" as const },
    { text: "short break", mode: "shortBreak" as const },
    { text: "long break", mode: "longBreak" as const },
  ];

  return (
    <div className="flex max-w-full flex-wrap items-center justify-center gap-x-[0.85em] gap-y-[0.65em]">
      {modeButtons.map((b) => (
        <TypeButton
          key={b.mode}
          text={b.text}
          mode={b.mode}
          activeMode={activeMode}
          onClick={() => onModeChange(b.mode)}
        />
      ))}
    </div>
  );
}

