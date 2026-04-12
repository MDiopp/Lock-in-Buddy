import { useEffect, useState } from "react";

const API = import.meta.env.VITE_LOCKIN_API_URL ?? "http://localhost:8000";

export default function Calibration({ onDone }: { onDone: () => void }) {
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch(`${API}/calibration/start`, { method: "POST" });
    return () => {
      void fetch(`${API}/calibration/stop`, { method: "POST" });
    };
  }, []);

  const handleCapture = async () => {
    setCapturing(true);
    setError(null);
    try {
      const res = await fetch(`${API}/calibration/capture`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail ?? "Capture failed");
      }
      onDone();
    } catch (e: any) {
      setError(e.message ?? "Something went wrong");
    } finally {
      setCapturing(false);
    }
  };

  return (
    <main className="flex h-screen flex-col items-center justify-center gap-8 bg-[var(--customGreen)] px-6 py-8">
      <h1 className="text-[clamp(1.5rem,4vw,2.25rem)] text-[var(--classicWhite)]">
        Calibration
      </h1>

      <div className="flex w-full max-w-5xl flex-1 items-center gap-8 overflow-hidden">
        {/* Instructions */}
        <div className="flex w-1/2 flex-col gap-4 rounded-xl bg-white/90 p-6 shadow-lg">
          <h2 className="text-xl font-semibold text-[var(--customGreen)]">
            How to calibrate
          </h2>
          <ol className="list-inside list-decimal space-y-2 text-sm leading-relaxed text-gray-700">
            <li>
              Sit in the position you normally work in — the angle you want the
              camera to recognize as <strong>"locked in."</strong>
            </li>
            <li>
              When you're ready, click the{" "}
              <strong>"Lock In!"</strong> button below.
              The app will save your current head pose as the locked-in position.
            </li>
          </ol>
          <p className="text-xs text-gray-400">
            Any position outside this pose will be treated as distracted.
          </p>
        </div>

        {/* Camera preview */}
        <div className="flex w-1/2 items-center justify-center overflow-hidden rounded-xl bg-black shadow-lg">
          <img
            src={`${API}/debug/preview/stream`}
            alt="Camera preview"
            className="h-auto max-h-[60vh] w-full object-contain"
          />
        </div>
      </div>

      {error && (
        <p className="text-sm font-medium text-red-200">{error}</p>
      )}

      <button
        type="button"
        disabled={capturing}
        onClick={handleCapture}
        className="cursor-pointer rounded-2xl bg-[var(--classicWhite)] px-8 py-3 text-lg font-medium text-[var(--customGreen)] shadow-md transition-[transform,background-color] duration-200 hover:scale-[1.03] hover:brightness-95 active:scale-[0.98] disabled:opacity-50"
      >
        {capturing ? "Saving…" : "Lock In!"}
      </button>
    </main>
  );
}
