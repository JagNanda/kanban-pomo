import type { PomodoroConfig } from "./pomodoro.types";

export const defaultPomodoroConfig: PomodoroConfig = {
  workDurationSeconds: 25 * 60,
  shortBreakDurationSeconds: 5 * 60,
  longBreakDurationSeconds: 15 * 60,
  longBreakAfterWorkSessions: 3,
  workCompletionChime: "bright-bells",
  breakCompletionChime: "soft-bloom"
};
