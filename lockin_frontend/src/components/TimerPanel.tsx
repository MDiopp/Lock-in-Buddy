import { requestNotificationPermission } from "../hooks/notifications";

function StepChevron({ direction }: { direction: "up" | "down" }) {
  return (
    <svg
      className="size-4 shrink-0"
      viewBox="0 0 24 24"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth={2.25}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {direction === "up" ? (
        <path d="M18 15l-6-6-6 6" />
      ) : (
        <path d="M6 9l6 6 6-6" />
      )}
    </svg>
  );
}

export default function TimerPanel({
  minutes,
  seconds,
  onStart,
  durationMinutes,
  onDurationChange,
}: {
  minutes: number;
  seconds: number;
  onStart: () => void;
  durationMinutes: number;
  onDurationChange: (value: number) => void;
}) {
  return (
    <>
      <h1 className="text-center text-[6.5em] text-[var(--customGreen)] leading-none">
        {minutes}:{String(seconds).padStart(2, "0")}
      </h1>
      <label className="flex flex-col items-center gap-2 text-[var(--customGreen)]">
        <span className="text-[1.1em]">session length (minutes)</span>
        <div className="flex w-[8.25rem] items-stretch overflow-hidden rounded-xl border-3 border-[var(--customGreen)] bg-[var(--classicWhite)]">
          <input
            type="number"
            min={1}
            step={1}
            value={durationMinutes}
            onChange={(event) => onDurationChange(Number(event.target.value) || 1)}
            className="min-w-0 flex-1 border-0 bg-transparent px-3 py-2 text-center text-[1.5em] text-[var(--customGreen)] outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <div className="flex min-w-0 shrink-0 flex-col border-l border-[var(--customGreen)] bg-[var(--classicWhite)] text-[var(--customGreen)]">
            <button
              type="button"
              aria-label="Increase session length"
              className="flex flex-1 items-center justify-center px-1.5"
              onClick={() =>
                onDurationChange(Math.max(1, Math.floor(durationMinutes + 1)))
              }
            >
              <StepChevron direction="up" />
            </button>
            <button
              type="button"
              aria-label="Decrease session length"
              className="flex flex-1 items-center justify-center border-t border-[var(--customGreen)] px-1.5"
              onClick={() =>
                onDurationChange(Math.max(1, durationMinutes - 1))
              }
            >
              <StepChevron direction="down" />
            </button>
          </div>
        </div>
      </label>
      <button
        type="button"
        onClick={() => {
          void requestNotificationPermission();
          onStart();
        }}
        className="startButton cursor-pointer rounded-xl bg-[var(--classicWhite)] px-[1em] py-[0.25em] text-[2em] text-[var(--customGreen)] [box-shadow:-7px_5px_4px_0_var(--customGreen)] transition-[color,box-shadow,background-color,transform] duration-300 ease-out hover:scale-[1.03]"
      >
        start
      </button>
    </>
  );
}

