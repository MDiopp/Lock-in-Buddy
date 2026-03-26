export type ButtonMode = "lockIn" | "shortBreak" | "longBreak";

function TypeButton({
  text,
  mode,
  activeMode,
  onClick,
}: {
  text: string;
  mode: ButtonMode;
  activeMode: ButtonMode;
  onClick: () => void;
}) {
  const isActive = mode === activeMode;

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "cursor-pointer rounded-xl px-[1em] py-[0.25em] text-[1.3em] transition",
        isActive
          ? "bg-[var(--customGreen)] text-[var(--classicWhite)]"
          : "bg-hidden text-[var(--customGreen)]",
      ].join(" ")}
    >
      {text}
    </button>
  );
}

export default TypeButton;