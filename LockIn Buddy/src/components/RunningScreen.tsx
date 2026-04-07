import { useEffect } from "react";
import type { CSSProperties } from "react";
import type { ButtonMode } from "./TypeButton";
import skipSvg from "../assets/skip.svg";
import lockinFaceSvg from "../assets/lockinFace.svg";
import shortbreakFaceSvg from "../assets/shortbreakFace.svg";
import longbreakFaceSvg from "../assets/longbreakFace.svg";
import youdiditFaceSvg from "../assets/youdiditFace.svg";
import mad1FaceSvg from "../assets/mad1Face.svg";
import mad2FaceSvg from "../assets/mad2Face.svg";
import mad3FaceSvg from "../assets/mad3Face.svg";
import type { TriggerEvent } from "../modes/types";

function formatTime(minutes: number, seconds: number) {
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

  // dynamic styles
const runningUiByMode: Record<
  ButtonMode,
  {
    face: string;
    faceProperties: string;
  }
> = {
  lockIn: {
    face: lockinFaceSvg,
    faceProperties: "h-[clamp(3.5rem,16cqh,7rem)] w-auto max-w-[58%] object-contain",
  },

  shortBreak: {
    face: shortbreakFaceSvg,
    faceProperties: "max-h-[min(55vh,26rem)] w-auto max-w-[90%] object-contain",
  },
  longBreak: {
    face: longbreakFaceSvg,
    faceProperties: "max-h-[min(60vh,28rem)] w-auto max-w-[95%] object-contain",
  },
};

const triggerUi: Record<
  TriggerEvent,
  {
    title: string;
    panelTint: string;
    bgTint: string;
    showTime: boolean;
    face: string;
    faceProperties: string;
  }
> = {
  success: {
    title: "you did it!",
    panelTint: "#B6FFC7",
    bgTint: "#4BBBA2",
    showTime: false,
    face: youdiditFaceSvg,
    faceProperties: "max-h-[min(25vh,26rem)] w-auto max-w-[88%] object-contain",
  },
  mad1: {
    title: "hey focus...",
    panelTint: "#FDFFB6",
    bgTint: "#B4BB4B",
    showTime: true,
    face: mad1FaceSvg,
    faceProperties: "max-h-[min(25vh,16rem)] mb-5 w-auto max-w-[90%] object-contain",
  },
  mad2: {
    title: "lock in...",
    panelTint: "#FFDCB6",
    bgTint: "#D87D33",
    showTime: true,
    face: mad2FaceSvg,
    faceProperties: "max-h-[min(35vh,16rem)] w-auto max-w-[90%] object-contain",
  },
  mad3: {
    title: "LOCK IN!!!",
    panelTint: "#FFCEB6",
    bgTint: "#BB4B4B",
    showTime: true,
    face: mad3FaceSvg,
    faceProperties: "max-h-[min(60vh,28rem)] mb-5 w-auto max-w-[95%] object-contain",
  },
};

const confettiColors = ["#FDE047", "#F97316", "#22D3EE", "#C084FC", "#FB7185", "#34D399"];
const successConfetti = Array.from({ length: 56 }, (_, i) => ({
  left: `${(i * 97) % 100}%`,
  duration: `${3 + ((i * 37) % 30) / 10}s`,
  size: `${8 + (i % 6)}px`,
  color: confettiColors[i % confettiColors.length],
  rotate: `${(i * 29) % 360}deg`,
}));

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
  trigger,
}: {
  mode: ButtonMode;
  minutes: number;
  seconds: number;
  isRunning: boolean;
  isFinished: boolean;
  onTogglePause: () => void;
  onSkip: () => void;
  onTrigger: (event: TriggerEvent) => void;
  trigger: TriggerEvent | null;
}) {
  const modeUi = runningUiByMode[mode];
  const activeTriggerUi = trigger ? triggerUi[trigger] : null;
  const displayFace = activeTriggerUi?.face ?? modeUi.face;
  const displayFaceProperties = activeTriggerUi?.faceProperties ?? modeUi.faceProperties;
  const hideControls = !!trigger;
  const showConfetti = trigger === "success";

  // if it's done, display the success screen
  useEffect(() => {
    if (isFinished == true) onTrigger("success");
  }, [isFinished]);

  return (
    <main
      className="relative grid h-screen grid-rows-[1fr_auto_1fr] bg-[var(--customGreen)] px-4 py-6 transition-colors duration-300 ease-in-out"
      style={activeTriggerUi ? { backgroundColor: activeTriggerUi.bgTint } : undefined}
    >
      {showConfetti && (
        <div className="confetti-layer" aria-hidden="true">
          {successConfetti.map((piece, index) => (
            <span
              key={index}
              className="confetti-piece"
              style={
                {
                  left: piece.left,
                  width: piece.size,
                  height: piece.size,
                  backgroundColor: piece.color,
                  rotate: piece.rotate,
                  animationDuration: piece.duration,
                } as CSSProperties
              }
            />
          ))}
        </div>
      )}
      {/* Top band: pause/skip or trigger title — pinned to bottom edge so panel stays vertically centered like MainPage */}
      <div className="row-start-1 flex min-h-0 w-full items-end justify-center pb-[clamp(0.35rem,1.2vh,0.65rem)]">
        <div className="flex w-full max-w-[min(92vw,30rem)] min-h-[clamp(2.5rem,6.5vh,3.6rem)] items-center justify-center">
          {hideControls ? (
            <div className="text-center text-[clamp(2.1rem,2.5vw,1.75rem)] leading-none text-[var(--classicWhite)]">
              {activeTriggerUi?.title}
            </div>
          ) : (
            <div className="flex items-center justify-center gap-x-6">
              <button
                type="button"
                onClick={onTogglePause}
                className="pauseButton rounded-xl px-[clamp(1rem,3vw,2rem)] py-[clamp(0.25rem,1.1vw,0.55rem)] text-[clamp(1.1rem,2.5vw,1.75rem)] font-medium transition-[color,box-shadow,background-color,transform] duration-300 ease-in-out hover:scale-[1.03] cursor-pointer bg-[var(--classicWhite)] text-[var(--customGreen)] box-shadow shadow-lg"
              >
                {isRunning ? "pause" : "resume"}
              </button>
              <button
                type="button"
                onClick={onSkip}
                className="skipButton rounded-xl px-[clamp(1rem,3vw,2rem)] py-[clamp(0.25rem,1.1vw,0.55rem)] text-[clamp(1.1rem,2.5vw,1.75rem)] font-medium transition-[color,box-shadow,background-color,transform] duration-300 ease-in-out hover:scale-[1.03] bg-transparent text-[var(--classicWhite)] cursor-pointer"
                aria-label="skip"
              >
                <img
                  src={skipSvg}
                  alt=""
                  className="h-[clamp(1.25rem,3vw,2rem)] w-[clamp(1.25rem,3vw,2rem)] object-contain"
                />
              </button>
            </div>
          )}
        </div>
      </div>

      <div
        className="row-start-2 face relative box-border flex h-[min(70vh,38rem)] w-full max-w-[min(92vw,80rem)] flex-col justify-self-center rounded-xl bg-[var(--lighterGreen)] p-[clamp(0.5rem,3cqw,1.75rem)] [container-type:inline-size] transition-colors duration-300 ease-in-out"
        style={activeTriggerUi ? { backgroundColor: activeTriggerUi.panelTint } : undefined}
      >
        {/* Face centered in the card */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-[clamp(0.5rem,3cqw,1.75rem)]">
          <img
            src={displayFace}
            alt=""
            className={`pointer-events-none ${displayFaceProperties}`}
          />
        </div>
      </div>

      {/* Bottom band: timer — pinned to top edge of lower 1fr */}
      <div className="row-start-3 flex min-h-0 w-full items-start justify-center pt-[clamp(0.85rem,5.2vh,5.65rem)]">
        {(!activeTriggerUi || activeTriggerUi.showTime) && (
          <div className="w-full max-w-[min(92vw,30rem)] text-center text-[clamp(2.4rem,8vw,5rem)] text-[var(--classicWhite)] pointer-events-none">
            {formatTime(minutes, seconds)}
          </div>
        )}
      </div>
    </main>
  );
}

