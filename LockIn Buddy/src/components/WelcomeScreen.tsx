import plusSvg from "../assets/Plus.svg";
import buttonsSvg from "../assets/buttons.svg";

export default function WelcomeScreen({
  onContinue,
}: {
  onContinue: () => void;
}) {
  return (
    <main className="grid h-screen w-full min-h-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-4 gap-y-6 bg-[var(--customGreen)] px-4 py-6 sm:gap-x-8 sm:px-6">
      <div className="flex min-h-0 min-w-0 justify-end">
        <img
          src={plusSvg}
          alt=""
          className="h-auto w-full min-h-20 min-w-7 max-h-48 object-contain object-right md:max-h-64 lg:max-h-80"
        />
      </div>
      <div className="flex w-full min-w-0 max-w-[min(32rem,90vw)] shrink-0 flex-col items-center px-2 text-center sm:px-4">
        <div className="flex flex-col items-center gap-y-[clamp(0.125rem,0.5vw,0.5rem)]">
          <h2 className="text-[clamp(1.5rem,2.5vw+0.75rem,2.25rem)] leading-snug text-[var(--lighterGreen)]">
            Welcome to
          </h2>
          <h1 className="text-[clamp(1.875rem,5vw+0.5rem,3rem)] leading-snug text-[var(--classicWhite)]">
            LockIn Buddy!
          </h1>
        </div>
        <p className="mt-[clamp(1rem,2.5vw,1.25rem)] text-[clamp(1rem,1.35vw+0.8rem,1.25rem)] text-[var(--lighterGreen)]">
          lock in with the help of a 'friendly' face...
        </p>
        <button
          type="button"
          onClick={onContinue}
          className="cursor-pointer mt-[clamp(1.75rem,4vw,2.5rem)] rounded-2xl bg-[var(--classicWhite)] px-[clamp(1.5rem,4vw,2rem)] py-[clamp(0.5rem,1.5vw,0.75rem)] text-[clamp(1rem,1.35vw+0.8rem,1.25rem)] font-medium text-[var(--customGreen)] shadow-md transition-[color,background-color,transform] duration-300 ease-in-out hover:scale-[1.03] hover:brightness-95 active:scale-[0.98]"
        >
          Continue
        </button>
      </div>
      <div className="flex min-h-0 min-w-0 justify-start">
        <img
          src={buttonsSvg}
          alt=""
          className="h-auto w-full min-h-20 min-w-7 max-h-48 object-contain object-left md:max-h-64 lg:max-h-80"
        />
      </div>
    </main>
  );
}

