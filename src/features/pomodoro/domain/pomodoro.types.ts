import type { Brand } from "../../../shared/domain/brand";
import type { TaskId } from "../../tasks/domain/task.types";

export type PomodoroSessionId = Brand<string, "PomodoroSessionId">;
export type BreakRecordId = Brand<string, "BreakRecordId">;
export type ProcrastinationRecordId = Brand<string, "ProcrastinationRecordId">;
export type PomodoroPhaseType = "work" | "short_break" | "long_break" | "procrastination";
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

export interface ProcrastinationRecord {
  id: ProcrastinationRecordId;
  taskId: TaskId;
  actualDurationSeconds: number;
  note: string;
  startedAt: string;
  endedAt: string;
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
      endsAt: string | null;
      plannedDurationSeconds: number;
      secondsRemaining: number;
      secondsElapsed: number;
      cycleWorkSessionIndex: number;
    }
  | {
      status: "paused";
      taskId: TaskId;
      phaseType: PomodoroPhaseType;
      plannedDurationSeconds: number;
      remainingSeconds: number;
      elapsedSeconds: number;
      cycleWorkSessionIndex: number;
      startedAt: string;
    };
