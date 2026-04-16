export type Difficulty = "easy" | "medium" | "hard";

export type Achievement = {
  id: string;
  title: string;
  description: string;
  difficulty: Difficulty;
};

export const ACHIEVEMENTS: Achievement[] = [
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
  { id: "note_generated", title: "Brain Dump", description: "Generate your first set of AI notes from a recording.", difficulty: "easy" },
  { id: "three_note_sessions", title: "On the Record", description: "Generate notes from 3 separate recording sessions.", difficulty: "easy" },
  { id: "five_note_sessions", title: "Scholar", description: "Generate notes from 5 recording sessions total.", difficulty: "medium" },
  { id: "cornell_notes", title: "Cornell Certified", description: "Generate notes using the Cornell style.", difficulty: "medium" },
  { id: "all_note_styles", title: "Style Master", description: "Generate notes using all three styles: bullet, summary, and Cornell.", difficulty: "hard" },
];

export const ACHIEVEMENT_BY_ID: Record<string, Achievement> = Object.fromEntries(
  ACHIEVEMENTS.map((a) => [a.id, a]),
);
