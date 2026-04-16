export default function ModeChooser({
  onLockIn,
  onNoteTaker,
  onBack,
}: {
  onLockIn: () => void;
  onNoteTaker: () => void;
  onBack: () => void;
}) {
  return (
    <main className="flex h-screen flex-col bg-[var(--customGreen)] px-4 py-6 transition-colors duration-300 ease-in-out">
      {/* Back button */}
      <div className="flex w-full items-center justify-center pb-[clamp(0.35rem,1.2vh,0.65rem)]">
        <button
          type="button"
          onClick={onBack}
          className="cursor-pointer rounded-xl bg-[var(--classicWhite)] px-[clamp(1rem,3vw,2rem)] py-[clamp(0.25rem,1.1vw,0.55rem)] text-[clamp(1.1rem,2.5vw,1.75rem)] font-medium text-[var(--customGreen)] shadow-lg transition-[color,box-shadow,background-color,transform] duration-300 ease-in-out hover:scale-[1.03]"
        >
          back
        </button>
      </div>

      {/* Two-card layout */}
      <div className="flex flex-1 items-center justify-center gap-[clamp(1rem,3vw,2.5rem)]">
        {/* Lock In card */}
        <div className="flex h-[min(60vh,32rem)] w-full max-w-[24rem] flex-col items-center justify-center gap-y-6 rounded-xl bg-[var(--lighterGreen)] p-[clamp(1rem,3vw,2rem)] text-center shadow-lg transition-colors duration-300 ease-in-out">
          <h2 className="text-[clamp(1.75rem,4vw,2.5rem)] leading-snug text-[var(--customGreen)]">
            Lock In!
          </h2>
          <p className="text-[clamp(0.9rem,1.3vw+0.6rem,1.15rem)] leading-relaxed text-[var(--customGreen)] opacity-80">
            Stay focused with timed sessions. Your buddy watches you through the
            camera and keeps you accountable. No distractions allowed!
          </p>
          <button
            type="button"
            onClick={onLockIn}
            className="welcomeNavBtn cursor-pointer rounded-2xl bg-[var(--customGreen)] px-[clamp(1.5rem,4vw,2rem)] py-[clamp(0.5rem,1.5vw,0.75rem)] text-[clamp(1rem,1.35vw+0.8rem,1.25rem)] font-medium text-[var(--classicWhite)] shadow-md transition-[color,background-color,transform] duration-300 ease-in-out hover:scale-[1.03] hover:brightness-110 active:scale-[0.98]"
          >
            Start Locking In
          </button>
        </div>

        {/* Note Taker card */}
        <div className="flex h-[min(60vh,32rem)] w-full max-w-[24rem] flex-col items-center justify-center gap-y-6 rounded-xl bg-[var(--lighterGreen)] p-[clamp(1rem,3vw,2rem)] text-center shadow-lg transition-colors duration-300 ease-in-out">
          <h2 className="text-[clamp(1.75rem,4vw,2.5rem)] leading-snug text-[var(--customGreen)]">
            Note Taker!
          </h2>
          <p className="text-[clamp(0.9rem,1.3vw+0.6rem,1.15rem)] leading-relaxed text-[var(--customGreen)] opacity-80">
            Record lectures or meetings with live transcription. When you're
            done, turn the transcript into organized study notes powered by AI.
          </p>
          <button
            type="button"
            onClick={onNoteTaker}
            className="welcomeNavBtn cursor-pointer rounded-2xl bg-[var(--customGreen)] px-[clamp(1.5rem,4vw,2rem)] py-[clamp(0.5rem,1.5vw,0.75rem)] text-[clamp(1rem,1.35vw+0.8rem,1.25rem)] font-medium text-[var(--classicWhite)] shadow-md transition-[color,background-color,transform] duration-300 ease-in-out hover:scale-[1.03] hover:brightness-110 active:scale-[0.98]"
          >
            Start Taking Notes
          </button>
        </div>
      </div>
    </main>
  );
}
