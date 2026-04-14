export default function AchievementsScreen({ onBack }: { onBack: () => void }) {
  return (
    <main className="grid h-screen grid-rows-[1fr_auto_1fr] bg-[var(--customGreen)] px-4 py-6 transition-colors duration-300 ease-in-out">
      <div className="row-start-1 flex min-h-0 w-full items-end justify-center pb-[clamp(0.35rem,1.2vh,0.65rem)]">
        <div className="flex w-full max-w-[min(92vw,30rem)] min-h-[clamp(2.5rem,6.5vh,3.6rem)] items-center justify-center">
          <button
            type="button"
            onClick={onBack}
            className="cursor-pointer rounded-xl bg-[var(--classicWhite)] px-[clamp(1rem,3vw,2rem)] py-[clamp(0.25rem,1.1vw,0.55rem)] text-[clamp(1.1rem,2.5vw,1.75rem)] font-medium text-[var(--customGreen)] shadow-lg transition-[color,box-shadow,background-color,transform] duration-300 ease-in-out hover:scale-[1.03]"
          >
            back
          </button>
        </div>
      </div>
      <div className="row-start-2 face box-border flex h-[min(70vh,38rem)] w-full max-w-[min(92vw,80rem)] flex-col justify-self-center rounded-xl bg-[var(--lighterGreen)] p-[clamp(0.5rem,3cqw,1.75rem)] [container-type:inline-size] transition-colors duration-300 ease-in-out">
        <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col items-center justify-center [font-size:clamp(0.75rem,3.2cqw,1.125rem)]">
        </div>
      </div>
    </main>
  );
}
