import type { ButtonMode } from "../components/TypeButton";
import type { TriggerEvent } from "./types";

// Central source of truth for each mode's theme + behavior settings.
export const themeByMode: Record<
  ButtonMode,
  {
    darkerColor: string;
    lighterColor: string;
    lightestColor: string;
    timerLength: number;
    triggerDurationMs: Record<TriggerEvent, number>;
  }
> = {
  lockIn: {
    darkerColor: "#4BBBA2",
    lighterColor: "#B6FFC7",
    lightestColor: "#EBFFF0",
    timerLength: 25,
    triggerDurationMs: {
      success: 3000,
      mad1: 1200,
      mad2: 1200,
      mad3: 1200,
    },
  },
  shortBreak: {
    darkerColor: "#4BAABB",
    lighterColor: "#B6FFF0",
    lightestColor: "#EBFFF0",
    timerLength: 5,
    triggerDurationMs: {
      success: 0,
      mad1: 0,
      mad2: 0,
      mad3: 0,
    },
  },
  longBreak: {
    darkerColor: "#4B70BB",
    lighterColor: "#B6CEFF",
    lightestColor: "#EBFFF0",
    timerLength: 15,
    triggerDurationMs: {
      success: 0,
      mad1: 0,
      mad2: 0,
      mad3: 0,
    },
  },
};

