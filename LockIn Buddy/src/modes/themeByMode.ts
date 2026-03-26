import type { ButtonMode } from "../components/TypeButton";

// Central source of truth for each mode's theme + behavior settings.
export const themeByMode: Record<
  ButtonMode,
  {
    darkerColor: string;
    lighterColor: string;
    lightestColor: string;
    timerLength: number;
  }
> = {
  lockIn: {
    darkerColor: "#4BBBA2",
    lighterColor: "#B6FFC7",
    lightestColor: "#EBFFF0",
    timerLength: 20,
  },
  shortBreak: {
    darkerColor: "#4BAABB",
    lighterColor: "#B6FFF0",
    lightestColor: "#EBFFF0",
    timerLength: 5,
  },
  longBreak: {
    darkerColor: "#4B70BB",
    lighterColor: "#B6CEFF",
    lightestColor: "#EBFFF0",
    timerLength: 10,
  },
};

