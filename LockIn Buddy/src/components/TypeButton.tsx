function TypeButton({ text, onClick }: { text: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="cursor-pointer rounded-xl bg-[var(--classicWhite)] px-[1em] py-[0.25em] text-[1.3em] text-[var(--customGreen)]"
    >
      {text}
    </button>
  );
}

export default TypeButton;