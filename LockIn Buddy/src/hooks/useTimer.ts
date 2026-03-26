import { useEffect, useMemo, useState } from "react";

export function useTimer(timerLengthMinutes: number) {
  const totalSeconds = useMemo(
    () => Math.max(0, Math.floor(timerLengthMinutes * 60)),
    [timerLengthMinutes],
  );

  const [secondsLeft, setSecondsLeft] = useState(totalSeconds);
  const [isRunning, setIsRunning] = useState(false);

  // Reset when mode/timer length changes.
  useEffect(() => {
    setSecondsLeft(totalSeconds);
    setIsRunning(false);
  }, [totalSeconds]);

  // Countdown loop.
  useEffect(() => {
    if (!isRunning) return;
    if (secondsLeft <= 0) {
      setIsRunning(false);
      return;
    }

    const id = window.setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);

    return () => window.clearInterval(id);
  }, [isRunning, secondsLeft]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const isFinished = secondsLeft <= 0;

  const start = () => setIsRunning(true);
  const pause = () => setIsRunning(false);
  const toggle = () => setIsRunning((r) => !r);
  const reset = () => {
    setSecondsLeft(totalSeconds);
    setIsRunning(false);
  };

  return {
    minutes,
    seconds,
    secondsLeft,
    isRunning,
    isFinished,
    start,
    pause,
    toggle,
    reset,
  };
}