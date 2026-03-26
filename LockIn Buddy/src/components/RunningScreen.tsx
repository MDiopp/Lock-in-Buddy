import type { ButtonMode } from "./TypeButton";
import skipSvg from "../assets/skip.svg";
import lockinFaceSvg from "../assets/lockinFace.svg";
import shortbreakFaceSvg from "../assets/shortbreakFace.svg";
import longbreakFaceSvg from "../assets/longbreakFace.svg";

function formatTime(minutes: number, seconds: number) {
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

const timeText = "absolute bottom-4 text-[clamp(3rem,9vw,6rem)] text-[var(--classicWhite)] flex";
const buttonBase =
  "rounded-xl px-8 py-1 text-[clamp(1.25rem,2.5vw,1.75rem)] font-medium transition-[color,box-shadow,background-color] duration-300 ease-in-out";
const pauseButton =
  "cursor-pointer bg-[var(--classicWhite)] text-[var(--customGreen)] box-shadow shadow-lg";
const skipButton =
  "bg-transparent text-[var(--classicWhite)]";

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

export default function RunningScreen({
  mode,
  minutes,
  seconds,
  isRunning,
  onTogglePause,
  onSkip,
}: {
  mode: ButtonMode;
  minutes: number;
  seconds: number;
  isRunning: boolean;
  onTogglePause: () => void;
  onSkip: () => void;
}) {
  const ui = runningUiByMode[mode];

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

