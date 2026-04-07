import { requestNotificationPermission } from "../hooks/notifications";

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
        <input
          type="number"
          min={1}
          step={1}
          value={durationMinutes}
          onChange={(event) => onDurationChange(Number(event.target.value) || 1)}
          className="w-[7rem] rounded-xl border-2 border-[var(--customGreen)] bg-[var(--classicWhite)] px-4 py-2 text-center text-[1.5em] text-[var(--customGreen)] outline-none"
        />
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

