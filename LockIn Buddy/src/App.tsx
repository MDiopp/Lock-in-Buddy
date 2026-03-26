import { useState } from "react";
import plusSvg from "./assets/Plus.svg";
import buttonsSvg from "./assets/buttons.svg";
import "./App.css";
import TypeButton from "./components/TypeButton";

function MainPage() {
  return (
    <main className="flex h-screen flex-col items-center justify-center bg-[var(--customGreen)] px-4 py-6">
      <div className="face box-border flex h-[min(70vh,38rem)] w-full max-w-[min(92vw,30rem)] flex-col rounded-xl bg-[var(--lighterGreen)] p-[clamp(0.5rem,3cqw,1.75rem)] [container-type:inline-size]">
        <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col items-center justify-center gap-y-[2em] [font-size:clamp(0.75rem,3.2cqw,1.125rem)]">
          <div className="flex max-w-full flex-wrap items-center justify-center gap-x-[0.85em] gap-y-[0.65em]">
            <TypeButton text="lock in" onClick={() => {}} />
            <TypeButton text="short break" onClick={() => {}} />
            <TypeButton text="long break" onClick={() => {}} />
          </div>
          <h1 className="text-center text-[6.5em] text-[var(--black)] leading-none">
            20:00
          </h1>
          <button
            type="button"
            className="cursor-pointer rounded-xl bg-[var(--classicWhite)] px-[1em] py-[0.25em] text-[2em] text-[var(--customGreen)] [box-shadow:-5px_5px_4px_0_#4BBBA2]"
          >
            start
          </button>
        </div>
      </div>
    </main>
  );
}

function App() {
  const [showWelcome, setShowWelcome] = useState(true);

  if (!showWelcome) {
    return <MainPage />;
  }

  // Welcome screen
  return (
    <main className="grid h-screen w-full min-h-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-4 gap-y-6 bg-[var(--customGreen)] px-4 py-6 sm:gap-x-8 sm:px-6">
      <div className="flex min-h-0 min-w-0 justify-end">
        <img
          src={plusSvg}
          alt=""
          className="h-auto w-full max-h-48 object-contain object-right md:max-h-64 lg:max-h-80"
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
          onClick={() => setShowWelcome(false)}
          className="cursor-pointer mt-[clamp(1.75rem,4vw,2.5rem)] rounded-2xl bg-[var(--classicWhite)] px-[clamp(1.5rem,4vw,2rem)] py-[clamp(0.5rem,1.5vw,0.75rem)] text-[clamp(1rem,1.35vw+0.8rem,1.25rem)] font-medium text-[var(--customGreen)] shadow-md transition hover:brightness-95 active:scale-[0.98]"
        >
          Continue
        </button>
      </div>
      <div className="flex min-h-0 min-w-0 justify-start">
        <img
          src={buttonsSvg}
          alt=""
          className="h-auto w-full max-h-48 object-contain object-left md:max-h-64 lg:max-h-80"
        />
      </div>
    </main>
  );
}

export default App;
