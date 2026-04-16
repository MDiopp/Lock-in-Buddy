// ---------------------------------------------------------------------------- //
// useTimer — countdown timer hook that takes a length in minutes and exposes   //
// { secondsLeft, isRunning, start, pause, reset }. Fires a system notification //
// via notifications.ts exactly once when the countdown reaches zero. Resets    //
// automatically whenever timerLengthMinutes changes.                           //
// ---------------------------------------------------------------------------- //
import { useEffect, useMemo, useRef, useState } from "react";
import { notify } from "./notifications";

export function useTimer(timerLengthMinutes: number) {
  const totalSeconds = useMemo(
    () => Math.max(0, Math.floor(timerLengthMinutes * 60)),
    [timerLengthMinutes],
  );

  const [secondsLeft, setSecondsLeft] = useState(totalSeconds);
  const [isRunning, setIsRunning] = useState(false);
  const completionNotifiedRef = useRef(false);
  const prevSecondsLeftRef = useRef<number | null>(null);

  // Reset when mode/timer length changes.
  useEffect(() => {
    setSecondsLeft(totalSeconds);
    setIsRunning(false);
    completionNotifiedRef.current = false;
    prevSecondsLeftRef.current = null;
  }, [totalSeconds]);

  // Fire exactly when the countdown crosses from 1 → 0 (not on every `secondsLeft === 0` render).
  useEffect(() => {
    const prev = prevSecondsLeftRef.current;
    prevSecondsLeftRef.current = secondsLeft;

    if (secondsLeft !== 0) {
      completionNotifiedRef.current = false;
      return;
    }
    if (totalSeconds === 0) return;
    if (prev === null || prev <= 0) return;
    if (completionNotifiedRef.current) return;

    completionNotifiedRef.current = true;
    setIsRunning(false);
    void notify("Time for a break!", "Your session is done!");
  }, [secondsLeft, totalSeconds]);

  // Countdown loop.
  useEffect(() => {
    if (!isRunning || secondsLeft <= 0) return;

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
    completionNotifiedRef.current = false;
    prevSecondsLeftRef.current = null;
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