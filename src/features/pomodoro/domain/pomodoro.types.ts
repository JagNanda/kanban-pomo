import type { Brand } from "../../../shared/domain/brand";
import type { TaskId } from "../../tasks/domain/task.types";

export type PomodoroSessionId = Brand<string, "PomodoroSessionId">;
export type BreakRecordId = Brand<string, "BreakRecordId">;
export type ProcrastinationRecordId = Brand<string, "ProcrastinationRecordId">;
export type InterruptionRecordId = Brand<string, "InterruptionRecordId">;
export type AiWorkRecordId = Brand<string, "AiWorkRecordId">;
export type PomodoroPhaseType =
  | "work"
  | "short_break"
  | "long_break"
  | "procrastination"
  | "interruption";
export type WorkTimerMode = "pomodoro" | "study";
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

export interface InterruptionRecord {
  id: InterruptionRecordId;
  taskId: TaskId;
  actualDurationSeconds: number;
  reason: string;
  startedAt: string;
  endedAt: string;
}

export interface AiWorkRecord {
  id: AiWorkRecordId;
  taskId: TaskId;
  actualDurationSeconds: number;
  startedAt: string;
  endedAt: string;
}

interface InterruptedFocusTimerState {
  priorStatus: "running" | "paused";
  taskId: TaskId;
  phaseType: "work";
  workMode: WorkTimerMode;
  plannedDurationSeconds: number;
  remainingSeconds: number;
  elapsedSeconds: number;
  cycleWorkSessionIndex: number;
  startedAt: string;
}

export type TimerState =
  | {
      status: "idle";
      taskId: TaskId | null;
    }
  | {
      status: "running";
      taskId: TaskId;
      phaseType: Exclude<PomodoroPhaseType, "interruption">;
      startedAt: string;
      endsAt: string | null;
      plannedDurationSeconds: number;
      secondsRemaining: number;
      secondsElapsed: number;
      cycleWorkSessionIndex: number;
      workMode?: WorkTimerMode;
      suspendedTimer?: InterruptedFocusTimerState;
    }
  | {
      status: "paused";
      taskId: TaskId;
      phaseType: Exclude<PomodoroPhaseType, "interruption">;
      plannedDurationSeconds: number;
      remainingSeconds: number;
      elapsedSeconds: number;
      cycleWorkSessionIndex: number;
      startedAt: string;
      workMode?: WorkTimerMode;
      suspendedTimer?: InterruptedFocusTimerState;
    }
  | {
      status: "running";
      taskId: TaskId;
      phaseType: "interruption";
      startedAt: string;
      endsAt: null;
      plannedDurationSeconds: 0;
      secondsRemaining: 0;
      secondsElapsed: number;
      cycleWorkSessionIndex: number;
      interruptedTimer: InterruptedFocusTimerState;
    };
