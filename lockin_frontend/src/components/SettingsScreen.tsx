import { useState } from "react";
import Calibration from "./Calibration";

const API = import.meta.env.VITE_LOCKIN_API_URL ?? "http://localhost:8000";

type Modal = "reset" | "saved" | null;

export default function SettingsScreen({ onBack }: { onBack: () => void }) {
  const [showCalibration, setShowCalibration] = useState(false);
  const [modal, setModal] = useState<Modal>(null);

  const handleResetToDefault = async () => {
    await fetch(`${API}/calibration/reset`, { method: "POST" });
    setModal("reset");
  };

  if (showCalibration) {
    return (
      <Calibration
        onDone={() => {
          setShowCalibration(false);
          setModal("saved");
        }}
      />
    );
  }

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
        <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col items-center justify-center gap-y-[2em] [font-size:clamp(0.75rem,3.2cqw,1.125rem)]">
          <h1 className="text-[clamp(1.5rem,4cqw,2.25rem)] font-medium text-[var(--customGreen)]">
            Calibration
          </h1>
          <div className="flex flex-col items-center gap-4">
            <button
              type="button"
              onClick={handleResetToDefault}
              className="cursor-pointer rounded-xl bg-[var(--customGreen)] px-[clamp(1rem,4cqw,2rem)] py-[clamp(0.35rem,1.2cqw,0.65rem)] text-[clamp(0.9rem,2.5cqw,1.25rem)] font-medium text-[var(--classicWhite)] shadow-lg transition-[color,box-shadow,background-color,transform] duration-300 ease-in-out hover:scale-[1.03]"
            >
              Reset to Default
            </button>
            <button
              type="button"
              onClick={() => setShowCalibration(true)}
              className="cursor-pointer rounded-xl bg-[var(--customGreen)] px-[clamp(1rem,4cqw,2rem)] py-[clamp(0.35rem,1.2cqw,0.65rem)] text-[clamp(0.9rem,2.5cqw,1.25rem)] font-medium text-[var(--classicWhite)] shadow-lg transition-[color,box-shadow,background-color,transform] duration-300 ease-in-out hover:scale-[1.03]"
            >
              Change Calibration
            </button>
          </div>
        </div>
      </div>

      {/* Modal overlay */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setModal(null)}
        >
          <div
            className="rounded-2xl bg-white px-10 py-8 shadow-xl text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-lg font-medium text-[var(--customGreen)]">
              {modal === "reset"
                ? "Pose reset to default values."
                : "Calibration saved!"}
            </p>
            <button
              type="button"
              onClick={() => setModal(null)}
              className="cursor-pointer mt-5 rounded-xl bg-[var(--customGreen)] px-6 py-2 text-white shadow transition-[transform] duration-200 hover:scale-[1.03] active:scale-[0.98]"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
