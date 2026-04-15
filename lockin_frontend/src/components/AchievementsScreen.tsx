import { useState } from "react";
import easyTrophy from "../assets/trophy-easy.png";
import mediumTrophy from "../assets/trophy-medium.png";
import hardTrophy from "../assets/trophy-hard.png";

type Difficulty = "easy" | "medium" | "hard";

const TROPHY_IMG: Record<Difficulty, string> = {
  easy: easyTrophy,
  medium: mediumTrophy,
  hard: hardTrophy,
};

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

const ACHIEVEMENTS: { id: string; title: string; description: string; difficulty: Difficulty }[] = [
  { id: "welcome", title: "Welcome!", description: "You opened Lock-in Buddy. The journey begins here.", difficulty: "easy" },
  { id: "first_session", title: "First Lock-In", description: "Complete your very first lock-in session.", difficulty: "easy" },
  { id: "three_sessions", title: "On a Roll", description: "Complete 3 lock-in sessions total.", difficulty: "medium" },
  { id: "perfect_session", title: "Laser Focused", description: "Finish a session with zero strikes and no pauses.", difficulty: "hard" },
  { id: "five_sessions", title: "Getting Serious", description: "Complete 5 lock-in sessions total.", difficulty: "easy" },
  { id: "no_strikes", title: "Clean Slate", description: "Finish a session without getting a single strike.", difficulty: "medium" },
  { id: "long_break", title: "Well Rested", description: "Complete a full long break session.", difficulty: "easy" },
  { id: "ten_sessions", title: "Dedicated", description: "Complete 10 lock-in sessions total.", difficulty: "medium" },
  { id: "no_pause", title: "No Distractions", description: "Finish a session without ever pausing.", difficulty: "hard" },
  { id: "daily_streak", title: "Day One", description: "Use Lock-in Buddy on two consecutive days.", difficulty: "hard" },
];

type Achievement = (typeof ACHIEVEMENTS)[number];

function AchievementModal({
  achievement,
  unlocked,
  unlockedDate,
  onClose,
}: {
  achievement: Achievement;
  unlocked: boolean;
  unlockedDate: string | undefined;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl bg-[var(--customGreen)] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={TROPHY_IMG[achievement.difficulty]}
          alt={`${achievement.difficulty} trophy`}
          className={`h-20 w-auto object-contain${unlocked ? "" : " grayscale opacity-40"}`}
        />
        {unlocked ? (
          <>
            <h2 className="text-center text-xl font-bold text-[var(--classicWhite)]">
              {achievement.title}
            </h2>
            <p className="text-center text-sm text-[var(--classicWhite)] opacity-85">
              {achievement.description}
            </p>
            <span className="rounded-full bg-[var(--customGreen)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--classicWhite)]">
              {DIFFICULTY_LABEL[achievement.difficulty]}
            </span>
            {unlockedDate && (
              <p className="text-center text-xs text-[var(--classicWhite)] opacity-60">
                Unlocked {new Date(unlockedDate).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
              </p>
            )}
          </>
        ) : (
          <p className="text-center text-lg font-semibold text-[var(--classicWhite)] opacity-60">
            Not Unlocked Yet!
          </p>
        )}
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer rounded-xl bg-[var(--classicWhite)] px-6 py-2 text-sm font-medium text-[var(--customGreen)] shadow-md transition-transform duration-200 hover:scale-[1.04]"
        >
          close
        </button>
      </div>
    </div>
  );
}

function AchievementCard({
  achievement,
  unlocked,
  onClick,
}: {
  achievement: Achievement;
  unlocked: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full flex-col items-center gap-[0.5em] rounded-xl bg-[var(--customGreen)] p-[0.75em] transition-[opacity,transform] duration-300 hover:scale-[1.04]${unlocked ? "" : " opacity-40"}`}
    >
      <div className="flex w-full items-center justify-center rounded-lg bg-[var(--lighterGreen)] p-[0.75em]">
        <img
          src={TROPHY_IMG[achievement.difficulty]}
          alt={`${achievement.difficulty} trophy`}
          className={`h-[clamp(3rem,8cqw,5rem)] w-auto object-contain transition-[filter] duration-300${unlocked ? "" : " grayscale"}`}
        />
      </div>
      <span className="text-center text-[0.95em] font-medium text-[var(--classicWhite)]">
        {achievement.title}
      </span>
    </button>
  );
}

export default function AchievementsScreen({
  onBack,
  unlockedIds,
  unlockedDates,
}: {
  onBack: () => void;
  unlockedIds: Set<string>;
  unlockedDates: Record<string, string>;
}) {
  const PAGE_SIZE = 6;
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Achievement | null>(null);
  const totalPages = Math.ceil(ACHIEVEMENTS.length / PAGE_SIZE);
  const pageItems = ACHIEVEMENTS.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <main className="grid h-screen grid-rows-[1fr_auto_1fr] bg-[var(--customGreen)] px-4 py-6 transition-colors duration-300 ease-in-out">
      {selected && (
        <AchievementModal
          achievement={selected}
          unlocked={unlockedIds.has(selected.id)}
          unlockedDate={unlockedDates[selected.id]}
          onClose={() => setSelected(null)}
        />
      )}
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
        <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col items-center justify-between gap-[1em] [font-size:clamp(0.75rem,3.2cqw,1.125rem)]">
          <div className="grid w-full grid-cols-3 gap-[1em]">
            {pageItems.map((a) => (
              <AchievementCard
                key={a.id}
                achievement={a}
                unlocked={unlockedIds.has(a.id)}
                onClick={() => setSelected(a)}
              />
            ))}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-[1.5em]">
              <button
                type="button"
                onClick={() => setPage((p) => p - 1)}
                disabled={page === 0}
                className="cursor-pointer rounded-xl bg-[var(--customGreen)] px-[1em] py-[0.4em] text-[1.1em] font-bold text-[var(--classicWhite)] shadow-md transition-[opacity,transform] duration-200 hover:scale-[1.06] disabled:cursor-default disabled:opacity-30"
              >
                ←
              </button>
              <span className="text-[0.95em] font-medium text-[var(--customGreen)]">
                {page + 1} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={page === totalPages - 1}
                className="cursor-pointer rounded-xl bg-[var(--customGreen)] px-[1em] py-[0.4em] text-[1.1em] font-bold text-[var(--classicWhite)] shadow-md transition-[opacity,transform] duration-200 hover:scale-[1.06] disabled:cursor-default disabled:opacity-30"
              >
                →
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
