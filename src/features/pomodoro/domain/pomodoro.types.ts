import type { Brand } from "../../../shared/domain/brand";
import type { TaskId } from "../../tasks/domain/task.types";

export type PomodoroSessionId = Brand<string, "PomodoroSessionId">;
export type BreakRecordId = Brand<string, "BreakRecordId">;
export type PomodoroPhaseType = "work" | "short_break" | "long_break";
export type PomodoroSessionStatus = "completed" | "interrupted" | "abandoned";
export type BreakAction = "completed" | "skipped";
export type PomodoroChimeId =
  | "bright-bells"
  | "victory-ping"
  | "triple-rise"
  | "soft-bloom"
  | "gentle-glass"
  | "quiet-morning";

export interface PomodoroConfig {
  workDurationSeconds: number;
  shortBreakDurationSeconds: number;
  longBreakDurationSeconds: number;
  longBreakAfterWorkSessions: number;
  workCompletionChime: PomodoroChimeId;
  breakCompletionChime: PomodoroChimeId;
}

export interface PomodoroSession {
  id: PomodoroSessionId;
  taskId: TaskId;
  phaseType: PomodoroPhaseType;
  plannedDurationSeconds: number;
  actualDurationSeconds: number;
  status: PomodoroSessionStatus;
  startedAt: string;
  endedAt: string | null;
}

export interface BreakRecord {
  id: BreakRecordId;
  taskId: TaskId;
  phaseType: "short_break" | "long_break";
  plannedDurationSeconds: number;
  actualDurationSeconds: number;
  action: BreakAction;
  startedAt: string;
  endedAt: string | null;
}

export type TimerState =
  | {
      status: "idle";
      taskId: TaskId | null;
    }
  | {
      status: "running";
      taskId: TaskId;
      phaseType: PomodoroPhaseType;
      startedAt: string;
      endsAt: string;
      secondsRemaining: number;
      cycleWorkSessionIndex: number;
    }
  | {
      status: "paused";
      taskId: TaskId;
      phaseType: PomodoroPhaseType;
      remainingSeconds: number;
      cycleWorkSessionIndex: number;
      startedAt: string;
    };
