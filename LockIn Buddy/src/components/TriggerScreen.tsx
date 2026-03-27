import type { ButtonMode } from "./TypeButton";
import type { TriggerEvent } from "../modes/types";
import type { CSSProperties } from "react";

import youdiditFaceSvg from "../assets/youdiditFace.svg";
import mad1FaceSvg from "../assets/mad1Face.svg";
import mad2FaceSvg from "../assets/mad2Face.svg";
import mad3FaceSvg from "../assets/mad3Face.svg";

// confetti
const confettiColors = ["#FDE047", "#F97316", "#22D3EE", "#C084FC", "#FB7185", "#34D399"];
const successConfetti = Array.from({ length: 56 }, (_, i) => ({
  left: `${(i * 97) % 100}%`,
  duration: `${3 + ((i * 37) % 30) / 10}s`,
  size: `${8 + (i % 6)}px`,
  color: confettiColors[i % confettiColors.length],
  rotate: `${(i * 29) % 360}deg`,
}));

const triggerUi: Record<TriggerEvent, { 
  title: string; 
  panelTint: string;
  bgTint: string;
  showTime: string;
  facePosition: string;
  face: string;
  faceProperties: string;
}> = {
  success: { 
    title: "you did it!", 
    panelTint: "#B6FFC7" ,
    bgTint: "#4BBBA2",
    showTime: "hidden",
    facePosition: "left-40",
    face: youdiditFaceSvg,
    faceProperties: "w-70 h-70",
  },
  mad1: { 
    title: "hey focus...", 
    panelTint: "#FDFFB6",
    bgTint: "#B4BB4B", 
    showTime: "",
    facePosition: "left-40 bottom-20",
    face: mad1FaceSvg,
    faceProperties: "w-70 h-70",
  },
  mad2: { 
    title: "lock in...", 
    panelTint: "#FFDCB6",
    bgTint: "#D87D33", 
    showTime: "",
    facePosition: "left-42",
    face: mad2FaceSvg,
    faceProperties: "w-70 h-70",
  },
  mad3: { 
    title: "LOCK IN!!!", 
    panelTint: "#FFCEB6",
    bgTint: "#BB4B4B", 
    showTime: "",
    facePosition: "left-25 bottom-10",
    face: mad3FaceSvg,
    faceProperties: "w-100 h-100",
  },
};

export default function TriggerScreen({
  trigger,
  minutes,
  seconds,
}: {
  mode: ButtonMode;
  trigger: TriggerEvent;
  minutes: number;
  seconds: number;
}) {
  const ui = triggerUi[trigger];
  const showConfetti = trigger === "success";

  return (
    <main className={`relative flex h-screen flex-col items-center justify-cente px-6 transition-colors duration-300 ease-in-out`}
          style={{ backgroundColor: ui.bgTint }}  >
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
        <div className="text-4xl text-[var(--classicWhite)] m-3">
          {ui.title}
        </div>
        <div className={`face box-border flex h-[min(70vh,38rem)] w-full max-w-[min(92vw,30rem)] flex-col rounded-xl p-[clamp(0.5rem,3cqw,1.75rem)] [container-type:inline-size] transition-colors duration-300 ease-in-out`}
            style={{ backgroundColor: ui.panelTint }}>
          <div className={`absolute ${ui.facePosition}`}>
              <img
                src={ui.face}
                className={`pointer-events-none ${ui.faceProperties}`}
              ></img>
            </div>
        </div>
        <div className="absolute bottom-4 flex flex-col items-center text-[var(--classicWhite)]">
          <div className={`text-[clamp(3rem,9vw,6rem)] ${ui.showTime}`}>
            {minutes}:{String(seconds).padStart(2, "0")}
          </div>
        </div>
    </main>
  );
}

