export default function TimerPanel({ timerLength }: { timerLength: number }) {
  return (
    <>
      <h1 className="text-center text-[6.5em] text-[var(--customGreen)] leading-none">
        {timerLength}:00
      </h1>
      <button
        type="button"
        className="startButton cursor-pointer rounded-xl bg-[var(--classicWhite)] px-[1em] py-[0.25em] text-[2em] text-[var(--customGreen)] [box-shadow:-7px_5px_4px_0_var(--customGreen)] transition-[color,box-shadow,background-color] duration-300 ease-in-out"
      >
        start
      </button>
    </>
  );
}

