// ------------------------------------------------------------------------ //
// useAchievements — manages the full achievement lifecycle: loading/saving //
// unlocked IDs and stats from localStorage, unlocking trophies based on    //
// session results (lockIn / longBreak / noteTaking), and returning newly-  //
// unlocked IDs so callers can display a toast. Also auto-unlocks "welcome" //
// on first load. Exposes { unlockedIds, unlockedDates, recordSession }.    //
// ------------------------------------------------------------------------ //
import { useState, useCallback } from "react";

const UNLOCKED_KEY = "lockin-buddy-unlocked";
const STATS_KEY = "lockin-buddy-achievement-stats";

type AchievementStats = {
  totalLockInSessions: number;
  longBreakCompleted: boolean;
  consecutiveDays: number;
  lastSessionDateStr: string;
  totalNoteSessions: number;
  noteStylesUsed: string[];
};

const DEFAULT_STATS: AchievementStats = {
  totalLockInSessions: 0,
  longBreakCompleted: false,
  consecutiveDays: 0,
  lastSessionDateStr: "",
  totalNoteSessions: 0,
  noteStylesUsed: [],
};

export type SessionResult =
  | { mode: "lockIn"; hadStrikes: boolean; hadPause: boolean }
  | { mode: "longBreak" }
  | { mode: "noteTaking"; noteStyle: "bullet" | "summary" | "cornell" };

function loadUnlocked(): Record<string, string> {
  try {
    const raw = localStorage.getItem(UNLOCKED_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    // Migrate old format (array of ids) to new format (id -> date)
    if (Array.isArray(parsed)) {
      return Object.fromEntries((parsed as string[]).map((id) => [id, ""]));
    }
    return parsed as Record<string, string>;
  } catch {
    return {};
  }
}

function saveUnlocked(dates: Record<string, string>) {
  localStorage.setItem(UNLOCKED_KEY, JSON.stringify(dates));
}

function loadStats(): AchievementStats {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return { ...DEFAULT_STATS };
    return { ...DEFAULT_STATS, ...(JSON.parse(raw) as Partial<AchievementStats>) };
  } catch {
    return { ...DEFAULT_STATS };
  }
}

function saveStats(stats: AchievementStats) {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayStr(): string {
  return new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
}

export function useAchievements() {
  const [unlockedDates, setUnlockedDates] = useState<Record<string, string>>(() => {
    const dates = loadUnlocked();
    if (!("welcome" in dates)) {
      dates["welcome"] = todayStr();
      saveUnlocked(dates);
    }
    return dates;
  });

  const unlockedIds = new Set(Object.keys(unlockedDates));

  const recordSession = useCallback((result: SessionResult): string[] => {
    const stats = loadStats();
    const current = loadUnlocked();
    const newlyUnlocked: string[] = [];

    const unlock = (id: string) => {
      if (!(id in current)) {
        current[id] = todayStr();
        newlyUnlocked.push(id);
      }
    };

    if (result.mode === "longBreak") {
      stats.longBreakCompleted = true;
      unlock("long_break");
    }

    if (result.mode === "lockIn") {
      stats.totalLockInSessions += 1;

      const today = todayStr();
      if (stats.lastSessionDateStr === yesterdayStr()) {
        stats.consecutiveDays += 1;
      } else if (stats.lastSessionDateStr !== today) {
        stats.consecutiveDays = 1;
      }
      stats.lastSessionDateStr = today;

      if (stats.totalLockInSessions >= 1) unlock("first_session");
      if (stats.totalLockInSessions >= 3) unlock("three_sessions");
      if (stats.totalLockInSessions >= 5) unlock("five_sessions");
      if (stats.totalLockInSessions >= 10) unlock("ten_sessions");

      if (!result.hadStrikes) unlock("no_strikes");
      if (!result.hadStrikes && !result.hadPause) unlock("perfect_session");
      if (!result.hadPause) unlock("no_pause");

      if (stats.consecutiveDays >= 2) unlock("daily_streak");
    }

    if (result.mode === "noteTaking") {
      stats.totalNoteSessions += 1;

      if (!stats.noteStylesUsed.includes(result.noteStyle)) {
        stats.noteStylesUsed = [...stats.noteStylesUsed, result.noteStyle];
      }

      if (stats.totalNoteSessions >= 1) unlock("note_generated");
      if (stats.totalNoteSessions >= 3) unlock("three_note_sessions");
      if (stats.totalNoteSessions >= 5) unlock("five_note_sessions");

      if (stats.noteStylesUsed.includes("cornell")) unlock("cornell_notes");
      if (
        stats.noteStylesUsed.includes("bullet") &&
        stats.noteStylesUsed.includes("summary") &&
        stats.noteStylesUsed.includes("cornell")
      ) {
        unlock("all_note_styles");
      }
    }

    saveStats(stats);
    if (newlyUnlocked.length > 0) {
      saveUnlocked(current);
      setUnlockedDates({ ...current });
    }
    return newlyUnlocked;
  }, []);

  return { unlockedIds, unlockedDates, recordSession };
}
