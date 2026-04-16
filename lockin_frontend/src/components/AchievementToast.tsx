// -------------------------------------------------------------------------- //
// AchievementToast — slides in from the bottom-right whenever an achievement //
// is unlocked, shows trophy icon + title, then auto-dismisses after 4 s.     //
// Multiple unlocks queue up and display one after the other.                 //
// -------------------------------------------------------------------------- //
import { useEffect, useRef, useState } from "react";
import easyTrophy from "../assets/OkayTrophy.svg";
import mediumTrophy from "../assets/GoodTrophy.svg";
import hardTrophy from "../assets/BestTrophy.svg";
import { ACHIEVEMENT_BY_ID } from "../achievements";
import type { Difficulty } from "../achievements";

const TROPHY_IMG: Record<Difficulty, string> = {
  easy: easyTrophy,
  medium: mediumTrophy,
  hard: hardTrophy,
};

const DISPLAY_MS = 4000;
const EXIT_MS = 400;

type Props = {
  queue: string[]; // achievement IDs to show
  onDismiss: (id: string) => void;
};

export default function AchievementToast({ queue, onDismiss }: Props) {
  const currentId = queue[0] ?? null;
  const achievement = currentId ? ACHIEVEMENT_BY_ID[currentId] : null;

  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!currentId) return;

    // Animate in
    const enterFrame = requestAnimationFrame(() => setVisible(true));

    // After display period, animate out then dismiss
    timerRef.current = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onDismiss(currentId), EXIT_MS);
    }, DISPLAY_MS);

    return () => {
      cancelAnimationFrame(enterFrame);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [currentId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!achievement) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      onClick={() => {
        if (timerRef.current) clearTimeout(timerRef.current);
        setVisible(false);
        setTimeout(() => onDismiss(currentId!), EXIT_MS);
      }}
      style={{ transition: `opacity ${EXIT_MS}ms ease, transform ${EXIT_MS}ms ease` }}
      className={`fixed bottom-6 right-6 z-50 flex w-72 cursor-pointer items-center gap-3 rounded-2xl bg-(--customGreen) px-4 py-3 shadow-2xl ring-2 ring-(--classicWhite)/20 ${
        visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
      }`}
    >
      <img
        src={TROPHY_IMG[achievement.difficulty]}
        alt={`${achievement.difficulty} trophy`}
        className="h-10 w-10 shrink-0 object-contain"
      />
      <div className="min-w-0 flex-1">
        <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-(--classicWhite) opacity-60">
          Achievement Unlocked
        </p>
        <p className="truncate text-sm font-bold text-(--classicWhite)">
          {achievement.title}
        </p>
        <p className="line-clamp-2 text-xs text-(--classicWhite) opacity-70">
          {achievement.description}
        </p>
      </div>
    </div>
  );
}
