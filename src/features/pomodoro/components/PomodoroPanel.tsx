import { useState } from "react";
import { formatDurationClock, formatDurationSummary } from "../../../shared/lib/time";
import {
  pomodoroChimeOptions,
  previewPomodoroChime
} from "../application/pomodoro-chimes";
import { OverdueIndicator } from "../../tasks/components/OverdueIndicator";
import type { Task } from "../../tasks/domain/task.types";
import { StopwatchIcons } from "../../tasks/components/StopwatchIcons";
import type {
  AiWorkRecord,
  BreakRecord,
  InterruptionRecord,
  PomodoroConfig,
  PomodoroSession,
  ProcrastinationRecord,
  TimerState
} from "../domain/pomodoro.types";
import { SegmentedTimerRing } from "./SegmentedTimerRing";
import type { AiTimerState } from "../application/useAiTimerController";

interface PomodoroPanelProps {
  tasksInDev: Task[];
  upcomingDueTasks: Task[];
  timerState: TimerState;
  aiTimerState: AiTimerState;
  config: PomodoroConfig;
  selectedTask: Task | null;
  allPomodoroSessions: PomodoroSession[];
  allBreakRecords: BreakRecord[];
  allProcrastinationRecords: ProcrastinationRecord[];
  allInterruptionRecords: InterruptionRecord[];
  taskSessionHistory: PomodoroSession[];
  breakHistory: BreakRecord[];
  procrastinationHistory: ProcrastinationRecord[];
  interruptionHistory: InterruptionRecord[];
  aiWorkHistory: AiWorkRecord[];
  onSelectTask: (taskId: Task["id"]) => void;
  onViewAllUpcomingDue: () => void;
  onViewAllRecentActivity: () => void;
  onStart: (taskId: Task["id"]) => void;
  onStartBreak: (taskId: Task["id"], durationSeconds: number) => void;
  onStartProcrastinating: (taskId: Task["id"]) => void;
  canCompleteTask: boolean;
  onCompleteTask: (taskId: Task["id"]) => void;
  onConfigChange: (config: PomodoroConfig) => void;
  onFinish: () => void;
  onGiveUpStudy: () => void;
  onFinishBreak: () => void;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  onStopProcrastinating: (note: string) => void;
  onStartInterruption: () => void;
  onStopInterruption: (reason: string) => void;
  onCancelInterruption: () => void;
  onReset: () => void;
  onStartAiTimer: (taskId: Task["id"]) => void;
  onStopAiTimer: () => void;
  onPauseAiTimer: () => void;
  onResumeAiTimer: () => void;
  onCancelAiTimer: () => void;
}

const describeTimerState = (
  timerState: TimerState,
  config: PomodoroConfig,
  selectedTask: Task | null
): string => {
  if (timerState.status === "idle") {
    if (selectedTask?.isStudyProblem) {
      return formatDurationClock(0);
    }

    return formatDurationClock(config.workDurationSeconds);
  }

  if (timerState.status === "paused") {
    if (timerState.phaseType === "procrastination" || timerState.workMode === "study") {
      return formatDurationClock(timerState.elapsedSeconds);
    }

    return formatDurationClock(timerState.remainingSeconds);
  }

  if (timerState.phaseType === "procrastination" || timerState.phaseType === "interruption") {
    return formatDurationClock(timerState.secondsElapsed);
  }

  if (timerState.phaseType === "work" && timerState.workMode === "study") {
    return formatDurationClock(timerState.secondsElapsed);
  }

  return formatDurationClock(timerState.secondsRemaining);
};

const getPhaseLabel = (timerState: TimerState, selectedTask: Task | null): string => {
  if (timerState.status === "idle") {
    if (selectedTask?.isStudyProblem) {
      return "Ready to study";
    }

    return "Ready for a focus block";
  }

  if (timerState.phaseType === "procrastination") {
    return "Procrastinating";
  }

  if (timerState.phaseType === "interruption") {
    return "Interruption";
  }

  if (timerState.phaseType === "work" && timerState.workMode === "study") {
    return "Study timer";
  }

  return timerState.phaseType.replace("_", " ");
};

type DisplayTone =
  | "work"
  | "short_break"
  | "long_break"
  | "procrastination"
  | "interruption"
  | "ai_work"
  | "idle";

const getPhaseTone = (
  timerState: TimerState
): DisplayTone => {
  if (timerState.status === "idle") {
    return "idle";
  }

  return timerState.phaseType;
};

const getTimerProgress = (timerState: TimerState, config: PomodoroConfig): number => {
  if (timerState.status === "idle") {
    return 0;
  }

  if (timerState.status === "paused") {
    if (timerState.phaseType === "procrastination" || timerState.workMode === "study") {
      return Math.min(timerState.elapsedSeconds / 3600, 1);
    }

    return 1 - timerState.remainingSeconds / timerState.plannedDurationSeconds;
  }

  if (timerState.phaseType === "procrastination" || timerState.phaseType === "interruption") {
    return Math.min(timerState.secondsElapsed / 3600, 1);
  }

  if (timerState.phaseType === "work" && timerState.workMode === "study") {
    return Math.min(timerState.secondsElapsed / 3600, 1);
  }

  return 1 - timerState.secondsRemaining / timerState.plannedDurationSeconds;
};

const isToday = (isoDate: string): boolean => {
  const target = new Date(isoDate);
  const now = new Date();

  return (
    target.getFullYear() === now.getFullYear() &&
    target.getMonth() === now.getMonth() &&
    target.getDate() === now.getDate()
  );
};

interface RecentActivityItem {
  id: string;
  startedAt: string;
  title: string;
  detail: string;
  meta: string;
  note?: string;
}

type PomodoroIconName =
  | "calendar"
  | "check"
  | "coffee"
  | "cup"
  | "gear"
  | "pause"
  | "play"
  | "refresh"
  | "stopwatch"
  | "timer"
  | "x";

const PomodoroIcon = ({ name }: { name: PomodoroIconName }): JSX.Element => {
  switch (name) {
    case "calendar":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <rect height="15" rx="2" width="16" x="4" y="5" />
          <path d="M8 3v4" />
          <path d="M16 3v4" />
          <path d="M4 10h16" />
        </svg>
      );
    case "check":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="8" />
          <path d="m8.6 12.4 2.2 2.2 4.8-5.2" />
        </svg>
      );
    case "coffee":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M5 8h10v5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V8Z" />
          <path d="M15 9h2a2.5 2.5 0 0 1 0 5h-2" />
          <path d="M6 20h10" />
        </svg>
      );
    case "cup":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M5 8h10v5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V8Z" />
          <path d="M15 9h2a2.5 2.5 0 0 1 0 5h-2" />
        </svg>
      );
    case "gear":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="3" />
          <path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.5-2.4 1a7.8 7.8 0 0 0-2.1-1.2L14 3h-4l-.4 2.6a7.8 7.8 0 0 0-2.1 1.2l-2.4-1-2 3.5 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.5 2.4-1a7.8 7.8 0 0 0 2.1 1.2L10 21h4l.4-2.6a7.8 7.8 0 0 0 2.1-1.2l2.4 1 2-3.5-2-1.5c.1-.4.1-.8.1-1.2Z" />
        </svg>
      );
    case "pause":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M8 5v14" />
          <path d="M16 5v14" />
        </svg>
      );
    case "play":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="m8 5 11 7-11 7V5Z" />
        </svg>
      );
    case "refresh":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M20 12a8 8 0 1 1-2.3-5.7" />
          <path d="M20 4v6h-6" />
        </svg>
      );
    case "stopwatch":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M9 2h6" />
          <path d="M12 2v3" />
          <path d="M17.5 6.5 19 5" />
          <circle cx="12" cy="13" r="7" />
          <path d="M12 9v5l3 2" />
        </svg>
      );
    case "timer":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="8" />
          <path d="M12 7v5l3.5 2.1" />
        </svg>
      );
    case "x":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M6 6l12 12" />
          <path d="M18 6 6 18" />
        </svg>
      );
  }
};

const formatActivityTitle = (value: string): string =>
  value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase())
    .replace(/\bAi\b/g, "AI");

export const PomodoroPanel = ({
  tasksInDev,
  upcomingDueTasks,
  timerState,
  aiTimerState,
  config,
  selectedTask,
  allPomodoroSessions,
  allBreakRecords,
  allProcrastinationRecords,
  allInterruptionRecords,
  taskSessionHistory,
  breakHistory,
  procrastinationHistory,
  interruptionHistory,
  aiWorkHistory,
  onSelectTask,
  onViewAllUpcomingDue,
  onViewAllRecentActivity,
  onStart,
  onStartBreak,
  onStartProcrastinating,
  canCompleteTask,
  onCompleteTask,
  onConfigChange,
  onFinish,
  onGiveUpStudy,
  onFinishBreak,
  onPause,
  onResume,
  onCancel,
  onStopProcrastinating,
  onStartInterruption,
  onStopInterruption,
  onCancelInterruption,
  onReset,
  onStartAiTimer,
  onStopAiTimer,
  onPauseAiTimer,
  onResumeAiTimer,
  onCancelAiTimer
}: PomodoroPanelProps): JSX.Element => {
  const [isProcrastinationNoteOpen, setIsProcrastinationNoteOpen] = useState(false);
  const [procrastinationNote, setProcrastinationNote] = useState("");
  const [isInterruptionReasonOpen, setIsInterruptionReasonOpen] = useState(false);
  const [interruptionReason, setInterruptionReason] = useState("");
  const [isBreakDurationOpen, setIsBreakDurationOpen] = useState(false);
  const [breakMinutes, setBreakMinutes] = useState(() =>
    String(Math.floor(config.shortBreakDurationSeconds / 60))
  );
  const isAiTimerActive = aiTimerState.status !== "idle";
  const aiTimerElapsedSeconds =
    aiTimerState.status === "running"
      ? aiTimerState.secondsElapsed
      : aiTimerState.status === "paused"
        ? aiTimerState.elapsedSeconds
        : 0;
  const phaseTone: DisplayTone = isAiTimerActive ? "ai_work" : getPhaseTone(timerState);
  const isSelectedStudyTask = selectedTask?.isStudyProblem === true;
  const phaseLabel = isAiTimerActive ? "AI work" : getPhaseLabel(timerState, selectedTask);
  const timerReadout = isAiTimerActive
    ? formatDurationClock(aiTimerElapsedSeconds)
    : describeTimerState(timerState, config, selectedTask);
  const timerProgress = isAiTimerActive
    ? Math.min(aiTimerElapsedSeconds / 3600, 1)
    : getTimerProgress(timerState, config);
  const timerSubtitle = isAiTimerActive
    ? aiTimerState.status === "paused"
      ? "AI timer paused"
      : "Tracking AI completion time"
    : timerState.status === "idle"
      ? isSelectedStudyTask
        ? "Ready to count study time up from zero"
        : "Ready to begin a focus block"
      : timerState.phaseType === "interruption"
        ? "Tracking time away from focus"
        : timerState.phaseType === "work" && timerState.workMode === "study"
          ? "Counting up study time until you finish"
          : "Track work and breaks from one place";
  const todayFocusSeconds = allPomodoroSessions
    .filter((session) => isToday(session.startedAt))
    .reduce((sum, session) => sum + session.actualDurationSeconds, 0);
  const todayCompletedPomodoros = allPomodoroSessions.filter(
    (session) => isToday(session.startedAt) && session.status === "completed"
  ).length;
  const todayBreaksTaken = allBreakRecords.filter(
    (record) => isToday(record.startedAt) && record.action === "completed"
  ).length;
  const todayBreakSeconds = allBreakRecords
    .filter((record) => isToday(record.startedAt) && record.action === "completed")
    .reduce((sum, record) => sum + record.actualDurationSeconds, 0);
  const todayProcrastinationSeconds = allProcrastinationRecords
    .filter((record) => isToday(record.startedAt))
    .reduce((sum, record) => sum + record.actualDurationSeconds, 0);
  const todayInterruptionSeconds = allInterruptionRecords
    .filter((record) => isToday(record.startedAt))
    .reduce((sum, record) => sum + record.actualDurationSeconds, 0);
  const todayInterruptions = allInterruptionRecords.filter((record) =>
    isToday(record.startedAt)
  ).length;
  const todayFocusMinutes = Math.round(todayFocusSeconds / 60);
  const todayBreakMinutes = Math.round(todayBreakSeconds / 60);
  const todayProcrastinationMinutes = Math.round(todayProcrastinationSeconds / 60);
  const todayInterruptionMinutes = Math.round(todayInterruptionSeconds / 60);
  const recentActivity: RecentActivityItem[] = [
    ...taskSessionHistory.map((session) => ({
      id: session.id,
      startedAt: session.startedAt,
      title:
        session.status === "completed"
          ? "focus session completed"
          : `focus session ${session.status}`,
      detail: formatDurationClock(session.actualDurationSeconds),
      meta: new Date(session.startedAt).toLocaleTimeString()
    })),
    ...breakHistory.map((record) => ({
      id: record.id,
      startedAt: record.startedAt,
      title: `${record.phaseType.replace("_", " ")} ${record.action}`,
      detail: formatDurationClock(record.actualDurationSeconds),
      meta: new Date(record.startedAt).toLocaleTimeString()
    })),
    ...procrastinationHistory.map((record) => ({
      id: record.id,
      startedAt: record.startedAt,
      title: "procrastinated",
      detail: formatDurationClock(record.actualDurationSeconds),
      meta: new Date(record.startedAt).toLocaleTimeString(),
      note: record.note
    })),
    ...interruptionHistory.map((record) => ({
      id: record.id,
      startedAt: record.startedAt,
      title: "interrupted",
      detail: formatDurationClock(record.actualDurationSeconds),
      meta: new Date(record.startedAt).toLocaleTimeString(),
      note: record.reason
    })),
    ...aiWorkHistory.map((record) => ({
      id: record.id,
      startedAt: record.startedAt,
      title: "ai work completed",
      detail: formatDurationClock(record.actualDurationSeconds),
      meta: new Date(record.startedAt).toLocaleTimeString()
    }))
  ]
    .sort(
      (left, right) => new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime()
    )
    .slice(0, 3);
  const activeTaskPomodoroTarget = Math.max(
    selectedTask?.estimatedPomodoros ?? config.longBreakAfterWorkSessions,
    1
  );
  const handleStopProcrastinating = (): void => {
    setProcrastinationNote("");
    setIsProcrastinationNoteOpen(true);
  };
  const openBreakDurationModal = (): void => {
    setBreakMinutes(String(Math.floor(config.shortBreakDurationSeconds / 60)));
    setIsBreakDurationOpen(true);
  };
  const startCustomBreak = (): void => {
    if (!selectedTask) {
      return;
    }

    const minutes = Number.parseInt(breakMinutes, 10);
    const safeMinutes = Number.isFinite(minutes) ? Math.min(Math.max(minutes, 1), 240) : 5;
    onStartBreak(selectedTask.id, safeMinutes * 60);
    setIsBreakDurationOpen(false);
  };
  const submitProcrastinationNote = (): void => {
    onStopProcrastinating(procrastinationNote);
    setIsProcrastinationNoteOpen(false);
    setProcrastinationNote("");
  };
  const handleEndInterruption = (): void => {
    setInterruptionReason("");
    setIsInterruptionReasonOpen(true);
  };
  const submitInterruptionReason = (): void => {
    onStopInterruption(interruptionReason);
    setIsInterruptionReasonOpen(false);
    setInterruptionReason("");
  };
  const cancelInterruption = (): void => {
    onCancelInterruption();
    setIsInterruptionReasonOpen(false);
    setInterruptionReason("");
  };
  const isInterruptionActive =
    timerState.status === "running" && timerState.phaseType === "interruption";
  const activeWorkTaskId =
    !isInterruptionActive &&
    (timerState.status === "running" || timerState.status === "paused") &&
    timerState.phaseType === "work"
      ? timerState.taskId
      : null;
  const isActiveStudyWorkTimer =
    !isInterruptionActive &&
    (timerState.status === "running" || timerState.status === "paused") &&
    timerState.phaseType === "work" &&
    timerState.workMode === "study";
  const activeAiTask =
    aiTimerState.status !== "idle"
      ? tasksInDev.find((task) => task.id === aiTimerState.taskId) ?? null
      : null;
  const isAiTimerForSelectedTask =
    aiTimerState.status !== "idle" && aiTimerState.taskId === selectedTask?.id;

  return (
    <section
      className={`focus-shell focus-shell--${phaseTone}${
        timerState.status === "paused" || aiTimerState.status === "paused" ? " is-paused" : ""
      }`}
    >
      <div className="focus-primary">
        <div className="focus-select-panel">
          <label className="focus-select-wrap focus-select-wrap--full">
            <span>Active task</span>
            <select
              value={selectedTask?.id ?? ""}
              onChange={(event) => onSelectTask(event.target.value as Task["id"])}
            >
              {tasksInDev.length === 0 ? (
                <option value="">No tasks in In Dev</option>
              ) : null}
              {tasksInDev.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.title}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="focus-timer-stage">
          <div className="focus-ring-wrap">
            <SegmentedTimerRing
              progress={timerProgress}
              tone={phaseTone}
            />
            <div className="focus-timer-center">
              <span className="timer-phase">{phaseLabel}</span>
              <strong className="timer-readout timer-readout--giant">
                {timerReadout}
              </strong>
              <span className="subtle">{timerSubtitle}</span>
            </div>
          </div>

          <div className="timer-actions timer-actions--focus">
            {aiTimerState.status === "running" ? (
              <>
                <button
                  className="primary-button focus-action-button focus-action-button--finish"
                  onClick={onStopAiTimer}
                  type="button"
                >
                  <PomodoroIcon name="check" />
                  Finish AI work
                </button>
                <button
                  aria-label="Pause AI timer"
                  className="ghost-button focus-action-button focus-action-button--icon-only"
                  onClick={onPauseAiTimer}
                  title="Pause AI timer"
                  type="button"
                >
                  <PomodoroIcon name="pause" />
                </button>
                <button
                  aria-label="Cancel AI timer"
                  className="danger-button focus-action-button focus-action-button--icon-only"
                  onClick={onCancelAiTimer}
                  title="Cancel AI timer"
                  type="button"
                >
                  <PomodoroIcon name="x" />
                </button>
              </>
            ) : null}

            {aiTimerState.status === "paused" ? (
              <>
                <button
                  aria-label="Continue AI timer"
                  className="primary-button focus-action-button focus-action-button--primary focus-action-button--icon-only"
                  onClick={onResumeAiTimer}
                  title="Continue AI timer"
                  type="button"
                >
                  <PomodoroIcon name="play" />
                </button>
                <button
                  className="primary-button focus-action-button focus-action-button--finish"
                  onClick={onStopAiTimer}
                  type="button"
                >
                  <PomodoroIcon name="check" />
                  Finish AI work
                </button>
                <button
                  aria-label="Cancel AI timer"
                  className="danger-button focus-action-button focus-action-button--icon-only"
                  onClick={onCancelAiTimer}
                  title="Cancel AI timer"
                  type="button"
                >
                  <PomodoroIcon name="x" />
                </button>
              </>
            ) : null}

            {!isAiTimerActive && isInterruptionActive ? (
              <>
                <button
                  className="primary-button focus-action-button focus-action-button--primary"
                  onClick={handleEndInterruption}
                  type="button"
                >
                  <PomodoroIcon name="check" />
                  End Interruption
                </button>
                <button
                  className="danger-button focus-action-button"
                  onClick={cancelInterruption}
                  type="button"
                >
                  <PomodoroIcon name="x" />
                  Cancel
                </button>
              </>
            ) : null}

            {!isAiTimerActive && !isInterruptionActive && timerState.status === "idle" && selectedTask ? (
              <>
                <button
                  className="primary-button focus-action-button focus-action-button--primary"
                  onClick={() => onStart(selectedTask.id)}
                  type="button"
                >
                  <PomodoroIcon name="play" />
                  {selectedTask.isStudyProblem ? "Start study" : "Start focus"}
                </button>
                {canCompleteTask ? (
                  <button
                    className="primary-button focus-action-button focus-action-button--complete"
                    onClick={() => onCompleteTask(selectedTask.id)}
                    type="button"
                  >
                    <PomodoroIcon name="check" />
                    Complete
                  </button>
                ) : null}
                <button
                  className="ghost-button focus-action-button focus-action-button--procrastinate"
                  onClick={() => onStartProcrastinating(selectedTask.id)}
                  type="button"
                >
                  <PomodoroIcon name="timer" />
                  Procrastinate
                </button>
                <button
                  className="ghost-button focus-action-button"
                  onClick={openBreakDurationModal}
                  type="button"
                >
                  <PomodoroIcon name="cup" />
                  Start break
                </button>
              </>
            ) : null}

            {!isAiTimerActive && selectedTask && !selectedTask.isStudyProblem ? (
              <button
                className="ghost-button focus-action-button focus-action-button--ai"
                onClick={() => onStartAiTimer(selectedTask.id)}
                type="button"
              >
                <PomodoroIcon name="timer" />
                Start AI timer
              </button>
            ) : null}

            {!isAiTimerActive && !isInterruptionActive && timerState.status === "running" ? (
              <button
                aria-label="Pause"
                className="ghost-button focus-action-button focus-action-button--icon-only"
                onClick={onPause}
                title="Pause"
                type="button"
              >
                <PomodoroIcon name="pause" />
              </button>
            ) : null}

            {!isAiTimerActive && !isInterruptionActive && timerState.status === "paused" ? (
              <button
                aria-label="Continue"
                className="primary-button focus-action-button focus-action-button--primary focus-action-button--icon-only"
                onClick={onResume}
                title="Continue"
                type="button"
              >
                <PomodoroIcon name="play" />
              </button>
            ) : null}

            {!isAiTimerActive &&
            !isInterruptionActive &&
            (timerState.status === "running" || timerState.status === "paused") &&
            (timerState.phaseType === "short_break" || timerState.phaseType === "long_break") ? (
              <button
                aria-label="Finish break"
                className="primary-button focus-action-button focus-action-button--finish focus-action-button--icon-only"
                onClick={onFinishBreak}
                title="Finish break"
                type="button"
              >
                <PomodoroIcon name="check" />
              </button>
            ) : null}

            {!isAiTimerActive &&
            !isInterruptionActive &&
            (timerState.status === "running" || timerState.status === "paused") &&
            timerState.phaseType === "procrastination" ? (
              <button
                aria-label="Finish procrastinating"
                className="primary-button focus-action-button focus-action-button--finish focus-action-button--icon-only"
                onClick={handleStopProcrastinating}
                title="Finish procrastinating"
                type="button"
              >
                <PomodoroIcon name="check" />
              </button>
            ) : null}

            {!isAiTimerActive && !isInterruptionActive && timerState.status !== "idle" ? (
              <button
                aria-label="Cancel"
                className="danger-button focus-action-button focus-action-button--icon-only"
                onClick={
                  timerState.phaseType === "procrastination" ||
                  timerState.phaseType === "short_break" ||
                  timerState.phaseType === "long_break"
                      ? onCancel
                      : onCancel
                }
                title="Cancel"
                type="button"
              >
                <PomodoroIcon name="x" />
              </button>
            ) : null}

            {!isAiTimerActive && !isInterruptionActive && timerState.status !== "idle" ? (
              <button
                aria-label="Reset"
                className="ghost-button focus-action-button focus-action-button--icon-only"
                onClick={onReset}
                title="Reset"
                type="button"
              >
                <PomodoroIcon name="refresh" />
              </button>
            ) : null}

            {!isAiTimerActive && activeWorkTaskId ? (
              <>
                <button
                  className="ghost-button focus-action-button focus-action-button--interruption"
                  onClick={onStartInterruption}
                  type="button"
                >
                  <PomodoroIcon name="timer" />
                  Add interruption
                </button>
                <button
                  className="ghost-button focus-action-button focus-action-button--procrastinate"
                  onClick={() => onStartProcrastinating(activeWorkTaskId)}
                  type="button"
                >
                  <PomodoroIcon name="timer" />
                  Procrastinate
                </button>
                {isActiveStudyWorkTimer ? (
                  <button
                    className="ghost-button focus-action-button"
                    onClick={onGiveUpStudy}
                    type="button"
                  >
                    <PomodoroIcon name="x" />
                    Give up
                  </button>
                ) : null}
                <button
                  aria-label="Finish"
                  className="primary-button focus-action-button focus-action-button--finish focus-action-button--icon-only"
                  onClick={onFinish}
                  title={
                    isActiveStudyWorkTimer
                      ? "Finish study problem"
                      : "Finish"
                  }
                  type="button"
                >
                  <PomodoroIcon name="check" />
                </button>
              </>
            ) : null}
          </div>

          <div className="focus-session-grid" aria-label="Pomodoro timing summary">
            <div className="focus-session-card focus-session-card--blue">
              <span className="focus-session-icon">
                <PomodoroIcon name="stopwatch" />
              </span>
              <span>
                <small>{isSelectedStudyTask ? "Study timer" : "Session length"}</small>
                <strong>
                  {isSelectedStudyTask
                    ? "0 min"
                    : `${Math.floor(config.workDurationSeconds / 60)} min`}
                </strong>
              </span>
            </div>
            <div className="focus-session-card focus-session-card--violet">
              <span className="focus-session-icon">
                <PomodoroIcon name="cup" />
              </span>
              <span>
                <small>Short break</small>
                <strong>{Math.floor(config.shortBreakDurationSeconds / 60)} min</strong>
              </span>
            </div>
            <div className="focus-session-card focus-session-card--green">
              <span className="focus-session-icon">
                <PomodoroIcon name="coffee" />
              </span>
              <span>
                <small>Long break</small>
                <strong>{Math.floor(config.longBreakDurationSeconds / 60)} min</strong>
              </span>
            </div>
            <div className="focus-session-card focus-session-card--amber">
              <span className="focus-session-icon">
                <PomodoroIcon name="timer" />
              </span>
              <span>
                <small>Interruptions today</small>
                <strong>
                  {todayInterruptions} / {todayInterruptionMinutes}m
                </strong>
              </span>
            </div>
          </div>
        </div>

        <section className="focus-plan-panel">
          <div className="focus-card-header">
            <span className="focus-section-label">Today's Focus Plan</span>
          </div>

          <div className="focus-plan-grid">
            <div className="focus-plan-card focus-plan-card--blue">
              <span className="focus-plan-icon">
                <PomodoroIcon name="stopwatch" />
              </span>
              <span>
                <small>Focused time</small>
                <strong>{todayFocusMinutes}m</strong>
                <em>Across work and breaks</em>
              </span>
            </div>
            <div className="focus-plan-card focus-plan-card--violet">
              <span className="focus-plan-icon">
                <PomodoroIcon name="check" />
              </span>
              <span>
                <small>Pomodoros earned</small>
                <strong>{todayCompletedPomodoros}</strong>
                <em>Keep it going</em>
              </span>
            </div>
            <div className="focus-plan-card focus-plan-card--green">
              <span className="focus-plan-icon">
                <PomodoroIcon name="coffee" />
              </span>
              <span>
                <small>Breaks taken</small>
                <strong>{todayBreaksTaken} / {todayBreakMinutes}m</strong>
                <em>Total break time</em>
              </span>
            </div>
            <div className="focus-plan-card focus-plan-card--amber">
              <span className="focus-plan-icon">
                <PomodoroIcon name="timer" />
              </span>
              <span>
                <small>Procrastinated</small>
                <strong>{todayProcrastinationMinutes}m</strong>
                <em>Logged honestly</em>
              </span>
            </div>
          </div>
        </section>
      </div>

      <div className="focus-sidebar">
        <section className="panel-card panel-stack focus-panel-card focus-panel-card--task">
          <div className="focus-card-header">
            <span className="focus-section-label">Focus Task</span>
            <button className="focus-icon-button" aria-label="Focus task actions" type="button">
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <circle cx="12" cy="5" r="1.7" />
                <circle cx="12" cy="12" r="1.7" />
                <circle cx="12" cy="19" r="1.7" />
              </svg>
            </button>
          </div>
          <h2 className="focus-task-title">{selectedTask?.title ?? "Select a task in In Dev"}</h2>

          {selectedTask ? (
            <div className="focus-task-meta">
              <div className="focus-meta-row">
                <span>Priority</span>
                <div className="task-priority-wrap">
                  <span className={`priority-pill priority-pill--${selectedTask.priority}`}>
                    {selectedTask.priority}
                  </span>
                  <OverdueIndicator task={selectedTask} />
                </div>
              </div>
              <div className="focus-meta-row">
                <span>Estimated pomodoros</span>
                <StopwatchIcons
                  count={selectedTask.estimatedPomodoros}
                  size="sm"
                  tone="estimated"
                />
              </div>
              <div className="focus-meta-row">
                <span>Completed pomodoros</span>
                <StopwatchIcons
                  count={selectedTask.pomodoroCount}
                  size="sm"
                  tone="completed"
                />
              </div>
              <div className="focus-meta-row">
                <span>{selectedTask.isStudyProblem ? "Study time" : "Tracked time"}</span>
                <strong>{formatDurationSummary(selectedTask.actualTrackedSeconds)}</strong>
              </div>
              <div className="focus-meta-row">
                <span>AI time</span>
                <strong>{formatDurationSummary(selectedTask.aiTrackedSeconds)}</strong>
              </div>
              {aiTimerState.status !== "idle" ? (
                <div className="focus-meta-row">
                  <span>AI timer</span>
                  <strong>
                    {isAiTimerForSelectedTask
                      ? formatDurationClock(aiTimerElapsedSeconds)
                      : `${activeAiTask?.title ?? "Another task"} · ${formatDurationClock(
                          aiTimerElapsedSeconds
                        )}`}
                  </strong>
                </div>
              ) : null}
              {selectedTask.isStudyProblem ? (
                <div className="focus-meta-row">
                  <span>Times completed</span>
                  <strong>{selectedTask.timesCompleted}</strong>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>

        <section className="panel-card panel-stack focus-panel-card focus-panel-card--deadlines">
          <div className="focus-card-header">
            <span className="focus-section-label">Upcoming Due</span>
            <button className="focus-view-link" onClick={onViewAllUpcomingDue} type="button">
              View all
            </button>
          </div>

          <div className="history-stack">
            {upcomingDueTasks.map((task) => (
              <div className="focus-due-item" key={task.id}>
                <span className="focus-row-icon">
                  <PomodoroIcon name="calendar" />
                </span>
                <div className="focus-due-copy">
                  <strong>{task.title}</strong>
                </div>
                <time>{task.estimatedCompletionDate}</time>
                <span className={`priority-pill priority-pill--${task.priority}`}>
                  {task.priority}
                </span>
              </div>
            ))}
            {upcomingDueTasks.length === 0 ? (
              <div className="empty-state">No upcoming due dates.</div>
            ) : null}
          </div>
        </section>

        <section className="panel-card panel-stack focus-panel-card focus-panel-card--history">
          <div className="focus-card-header">
            <span className="focus-section-label">Recent Activity</span>
            <button className="focus-view-link" onClick={onViewAllRecentActivity} type="button">
              View all
            </button>
          </div>

          <div className="history-stack">
            {recentActivity.map((activity) => (
              <div className="focus-activity-item" key={activity.id}>
                <span className="focus-activity-dot" />
                <div className="focus-activity-copy">
                  <strong>{formatActivityTitle(activity.title)}</strong>
                  {activity.note ? <span>{activity.note}</span> : null}
                </div>
                <time>{activity.detail}</time>
              </div>
            ))}
            {recentActivity.length === 0 ? (
              <div className="empty-state">No recorded sessions yet for this task.</div>
            ) : null}
          </div>
        </section>

        <section className="panel-card panel-stack focus-panel-card focus-panel-card--settings">
          <div className="focus-card-header">
            <span className="focus-section-label">Pomodoro Settings</span>
            <button className="focus-icon-button" aria-label="Pomodoro settings" type="button">
              <PomodoroIcon name="gear" />
            </button>
          </div>

          <div className="focus-settings-grid">
            <label className="label-stack">
              <span>Long break after sessions</span>
              <input
                type="number"
                min={2}
                value={config.longBreakAfterWorkSessions}
                onChange={(event) =>
                  onConfigChange({
                    ...config,
                    longBreakAfterWorkSessions: Math.max(2, Number(event.target.value) || 2)
                  })
                }
              />
            </label>

            <label className="label-stack">
              <span>Long break minutes</span>
              <input
                type="number"
                min={5}
                value={Math.floor(config.longBreakDurationSeconds / 60)}
                onChange={(event) =>
                  onConfigChange({
                    ...config,
                    longBreakDurationSeconds: Math.max(5, Number(event.target.value) || 5) * 60
                  })
                }
              />
            </label>
          </div>

          <div className="focus-chime-settings">
            <label className="label-stack">
              <span>Work timer chime</span>
              <div className="focus-setting-inline">
                <select
                  value={config.workCompletionChime}
                  onChange={(event) =>
                    onConfigChange({
                      ...config,
                      workCompletionChime: event.target.value as PomodoroConfig["workCompletionChime"]
                    })
                  }
                >
                  {pomodoroChimeOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <button
                  className="ghost-button"
                  onClick={() => void previewPomodoroChime(config.workCompletionChime)}
                  type="button"
                >
                  Preview
                </button>
              </div>
            </label>

            <label className="label-stack">
              <span>Break timer chime</span>
              <div className="focus-setting-inline">
                <select
                  value={config.breakCompletionChime}
                  onChange={(event) =>
                    onConfigChange({
                      ...config,
                      breakCompletionChime: event.target.value as PomodoroConfig["breakCompletionChime"]
                    })
                  }
                >
                  {pomodoroChimeOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <button
                  className="ghost-button"
                  onClick={() => void previewPomodoroChime(config.breakCompletionChime)}
                  type="button"
                >
                  Preview
                </button>
              </div>
            </label>
          </div>
        </section>
      </div>

      {isBreakDurationOpen ? (
        <div className="modal-overlay" role="presentation">
          <div
            aria-label="Start break"
            aria-modal="true"
            className="modal-card procrastination-note-modal"
            role="dialog"
          >
            <div className="details-title">
              <div>
                <h3>Start Break</h3>
                <p>How many minutes do you want?</p>
              </div>
            </div>

            <label className="label-stack procrastination-note-field">
              <span>Minutes</span>
              <input
                autoFocus
                min={1}
                max={240}
                step={1}
                type="number"
                value={breakMinutes}
                onChange={(event) => setBreakMinutes(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    startCustomBreak();
                  }
                }}
              />
            </label>

            <div className="modal-footer procrastination-note-actions">
              <button
                className="ghost-button"
                onClick={() => setIsBreakDurationOpen(false)}
                type="button"
              >
                Cancel
              </button>
              <button className="primary-button" onClick={startCustomBreak} type="button">
                Start break
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isProcrastinationNoteOpen ? (
        <div className="modal-overlay" role="presentation">
          <div
            aria-label="Procrastination note"
            aria-modal="true"
            className="modal-card procrastination-note-modal"
            role="dialog"
          >
            <div className="details-title">
              <div>
                <h3>Finish Procrastinating</h3>
                <p>What did you do?</p>
              </div>
            </div>

            <label className="label-stack procrastination-note-field">
              <span>Note</span>
              <textarea
                autoFocus
                rows={5}
                value={procrastinationNote}
                onChange={(event) => setProcrastinationNote(event.target.value)}
              />
            </label>

            <div className="modal-footer procrastination-note-actions">
              <button
                className="ghost-button"
                onClick={() => {
                  setIsProcrastinationNoteOpen(false);
                  setProcrastinationNote("");
                }}
                type="button"
              >
                Keep timing
              </button>
              <button
                className="danger-button"
                onClick={() => {
                  onCancel();
                  setIsProcrastinationNoteOpen(false);
                  setProcrastinationNote("");
                }}
                type="button"
              >
                Discard
              </button>
              <button className="primary-button" onClick={submitProcrastinationNote} type="button">
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isInterruptionReasonOpen ? (
        <div className="modal-overlay" role="presentation">
          <div
            aria-label="Interruption reason"
            aria-modal="true"
            className="modal-card procrastination-note-modal"
            role="dialog"
          >
            <div className="details-title">
              <div>
                <h3>End Interruption</h3>
                <p>What caused the interruption?</p>
              </div>
            </div>

            <label className="label-stack procrastination-note-field">
              <span>Reason</span>
              <textarea
                autoFocus
                rows={5}
                value={interruptionReason}
                onChange={(event) => setInterruptionReason(event.target.value)}
              />
            </label>

            <div className="modal-footer procrastination-note-actions">
              <button
                className="danger-button"
                onClick={cancelInterruption}
                type="button"
              >
                Discard
              </button>
              <button
                className="ghost-button"
                onClick={() => {
                  setIsInterruptionReasonOpen(false);
                  setInterruptionReason("");
                }}
                type="button"
              >
                Keep timing
              </button>
              <button className="primary-button" onClick={submitInterruptionReason} type="button">
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
};
