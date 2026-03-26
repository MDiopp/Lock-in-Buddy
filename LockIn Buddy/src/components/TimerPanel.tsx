export default function TimerPanel({
  minutes,
  seconds,
  onStart,
}: {
  minutes: number;
  seconds: number;
  onStart: () => void;
}) {
  return (
    <>
      <h1 className="text-center text-[6.5em] text-[var(--customGreen)] leading-none">
        {minutes}:{String(seconds).padStart(2, "0")}
      </h1>
      <button
        type="button"
        onClick={onStart}
        className="startButton cursor-pointer rounded-xl bg-[var(--classicWhite)] px-[1em] py-[0.25em] text-[2em] text-[var(--customGreen)] [box-shadow:-7px_5px_4px_0_var(--customGreen)] transition-[color,box-shadow,background-color] duration-300 ease-in-out"
      >
        start
      </button>
    </>
  );
}

