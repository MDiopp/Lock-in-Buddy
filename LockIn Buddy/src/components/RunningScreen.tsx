import { useEffect } from "react";
import type { ButtonMode } from "./TypeButton";
import skipSvg from "../assets/skip.svg";
import lockinFaceSvg from "../assets/lockinFace.svg";
import shortbreakFaceSvg from "../assets/shortbreakFace.svg";
import longbreakFaceSvg from "../assets/longbreakFace.svg";
import type { TriggerEvent } from "../modes/types";

function formatTime(minutes: number, seconds: number) {
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

// Constant styles
const timeText = "absolute bottom-4 text-[clamp(3rem,9vw,6rem)] text-[var(--classicWhite)] flex";
const buttonBase =
  "rounded-xl px-8 py-1 text-[clamp(1.25rem,2.5vw,1.75rem)] font-medium transition-[color,box-shadow,background-color,transform] duration-300 ease-in-out hover:scale-[1.03]";
const pauseButton =
  "cursor-pointer bg-[var(--classicWhite)] text-[var(--customGreen)] box-shadow shadow-lg";
const skipButton =
  "bg-transparent text-[var(--classicWhite)]";

  // dynamic styles
const runningUiByMode: Record<
  ButtonMode,
  {
    container: string;
    panel: string;
    face: string;
    faceProperties: string;
    facePosition: string;
  }
> = {
  lockIn: {
    container:
      "flex h-screen flex-col items-center justify-center bg-[var(--customGreen)] px-6 transition-colors duration-300 ease-in-out",
    panel:
      "face box-border flex h-[min(70vh,38rem)] w-full max-w-[min(92vw,30rem)] flex-col rounded-xl bg-[var(--lighterGreen)] p-[clamp(0.5rem,3cqw,1.75rem)] [container-type:inline-size] transition-colors duration-300 ease-in-out",
    face: lockinFaceSvg,
    faceProperties: "w-50 h-50",
    facePosition: "top-30 left-50",
  },
  
  shortBreak: {
    container:
      "flex h-screen flex-col items-center justify-center bg-[var(--customGreen)] px-6 transition-colors duration-300 ease-in-out",
    panel:
      "face box-border flex h-[min(70vh,38rem)] w-full max-w-[min(92vw,30rem)] flex-col rounded-xl bg-[var(--lighterGreen)] p-[clamp(0.5rem,3cqw,1.75rem)] [container-type:inline-size] transition-colors duration-300 ease-in-out",
    face: shortbreakFaceSvg,
    faceProperties: "w-80 h-80",
    facePosition: "",
  },
  longBreak: {
    container:
      "flex h-screen flex-col items-center justify-center bg-[var(--customGreen)] px-6 transition-colors duration-300 ease-in-out",
    panel:
      "face box-border flex h-[min(70vh,38rem)] w-full max-w-[min(92vw,30rem)] flex-col rounded-xl bg-[var(--lighterGreen)] p-[clamp(0.5rem,3cqw,1.75rem)] [container-type:inline-size] transition-colors duration-300 ease-in-out",
    face: longbreakFaceSvg,
    faceProperties: "w-full h-full",
    facePosition: "top-40 left-0",
  },
};

// running screen itself
export default function RunningScreen({
  mode,
  minutes,
  seconds,
  isRunning,
  onTogglePause,
  onSkip,
  onTrigger,
  isFinished,
}: {
  mode: ButtonMode;
  minutes: number;
  seconds: number;
  isRunning: boolean;
  isFinished: boolean;
  onTogglePause: () => void;
  onSkip: () => void;
  onTrigger: (event: TriggerEvent) => void;
}) {
  const ui = runningUiByMode[mode];

  // if it's done, display the success screen
  useEffect(() => {
    if (isFinished == true) onTrigger("success");
  }, [isFinished]);

  // Quick keyboard triggers for testing until event wiring is added.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "s") onTrigger("success");
      if (e.key === "1") onTrigger("mad1");
      if (e.key === "2") onTrigger("mad2");
      if (e.key === "3") onTrigger("mad3");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onTrigger]);

  return (
    <main className={`${ui.container} relative`}>
      {/* Overlay controls: does not affect layout/centering */}
      <div className="absolute left-1/2 top-3 w-full max-w-[min(92vw,30rem)] -translate-x-1/2 ">
        <div className="flex w-full items-center justify-center">
          <button
            type="button"
            onClick={onTogglePause}
            className={`${buttonBase} ${pauseButton}`}
          >
            {isRunning ? "pause" : "resume"}
          </button>
          <button
            type="button"
            onClick={onSkip}
            className={`${buttonBase} ${skipButton} cursor-pointer`}
            aria-label="skip"
          >
            <img src={skipSvg} alt="" className="h-8 w-8 object-contain" />
          </button>
        </div>
      </div>

      <div className="flex w-full flex-col items-center gap-y-8">
        <div className={ui.panel} />
          <div className={`absolute ${ui.facePosition}`}>
            <img
              src={ui.face}
              className={`pointer-events-none ${ui.faceProperties}`}
            ></img>
          </div>
        <div className={timeText}>{formatTime(minutes, seconds)}</div>
      </div>
    </main>
  );
}

