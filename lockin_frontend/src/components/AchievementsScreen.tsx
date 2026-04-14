import { useState } from "react";
import easyTrophy from "../assets/easy-trophy.png";
import mediumTrophy from "../assets/medium-trophy.png";
import hardTrophy from "../assets/hard-trophy.png";

type Difficulty = "easy" | "medium" | "hard";

const TROPHY_IMG: Record<Difficulty, string> = {
  easy: easyTrophy,
  medium: mediumTrophy,
  hard: hardTrophy,
};

const ACHIEVEMENTS: { id: string; title: string; difficulty: Difficulty }[] = [
  { id: "first_session", title: "First Lock-In", difficulty: "easy" },
  { id: "three_sessions", title: "On a Roll", difficulty: "medium" },
  { id: "perfect_session", title: "Laser Focused", difficulty: "hard" },
  { id: "five_sessions", title: "Getting Serious", difficulty: "easy" },
  { id: "no_strikes", title: "Clean Slate", difficulty: "medium" },
  { id: "long_break", title: "Well Rested", difficulty: "easy" },
  { id: "ten_sessions", title: "Dedicated", difficulty: "medium" },
  { id: "no_pause", title: "No Distractions", difficulty: "hard" },
  { id: "daily_streak", title: "Day One", difficulty: "hard" },
];

function AchievementCard({ title, difficulty }: { title: string; difficulty: Difficulty }) {
  return (
    <div className="flex flex-col items-center gap-[0.5em] rounded-xl bg-[var(--customGreen)] p-[0.75em]">
      <div className="flex w-full items-center justify-center rounded-lg bg-[var(--lighterGreen)] p-[0.75em]">
        <img
          src={TROPHY_IMG[difficulty]}
          alt={`${difficulty} trophy`}
          className="h-[clamp(3rem,8cqw,5rem)] w-auto object-contain"
        />
      </div>
      <span className="text-center text-[0.95em] font-medium text-[var(--classicWhite)]">
        {title}
      </span>
    </div>
  );
}

export default function AchievementsScreen({ onBack }: { onBack: () => void }) {
  const PAGE_SIZE = 6;
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(ACHIEVEMENTS.length / PAGE_SIZE);
  const pageItems = ACHIEVEMENTS.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

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
        <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col items-center justify-between gap-[1em] [font-size:clamp(0.75rem,3.2cqw,1.125rem)]">
          <div className="grid w-full grid-cols-3 gap-[1em]">
            {pageItems.map((a) => (
              <AchievementCard key={a.id} title={a.title} difficulty={a.difficulty} />
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
