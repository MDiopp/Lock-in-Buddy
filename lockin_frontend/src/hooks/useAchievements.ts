import { useState, useCallback } from "react";

const UNLOCKED_KEY = "lockin-buddy-unlocked";
const STATS_KEY = "lockin-buddy-achievement-stats";

type AchievementStats = {
  totalLockInSessions: number;
  longBreakCompleted: boolean;
  consecutiveDays: number;
  lastSessionDateStr: string;
};

const DEFAULT_STATS: AchievementStats = {
  totalLockInSessions: 0,
  longBreakCompleted: false,
  consecutiveDays: 0,
  lastSessionDateStr: "",
};

export type SessionResult =
  | { mode: "lockIn"; hadStrikes: boolean; hadPause: boolean }
  | { mode: "longBreak" };

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

  const recordSession = useCallback((result: SessionResult) => {
    const stats = loadStats();
    const current = loadUnlocked();
    let changed = false;

    const unlock = (id: string) => {
      if (!(id in current)) {
        current[id] = todayStr();
        changed = true;
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

    saveStats(stats);
    if (changed) {
      saveUnlocked(current);
      setUnlockedDates({ ...current });
    }
  }, []);

  return { unlockedIds, unlockedDates, recordSession };
}
