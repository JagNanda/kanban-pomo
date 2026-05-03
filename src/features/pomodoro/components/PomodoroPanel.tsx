import { formatDurationClock } from "../../../shared/lib/time";
import {
  pomodoroChimeOptions,
  previewPomodoroChime
} from "../application/pomodoro-chimes";
import { OverdueIndicator } from "../../tasks/components/OverdueIndicator";
import type { Task } from "../../tasks/domain/task.types";
import { StopwatchIcons } from "../../tasks/components/StopwatchIcons";
import type {
  BreakRecord,
  PomodoroConfig,
  PomodoroSession,
  TimerState
} from "../domain/pomodoro.types";
import { SegmentedTimerRing } from "./SegmentedTimerRing";

interface PomodoroPanelProps {
  tasksInDev: Task[];
  upcomingDueTasks: Task[];
  completedTodayTasks: Task[];
  timerState: TimerState;
  config: PomodoroConfig;
  selectedTask: Task | null;
  allPomodoroSessions: PomodoroSession[];
  allBreakRecords: BreakRecord[];
  taskSessionHistory: PomodoroSession[];
  breakHistory: BreakRecord[];
  onSelectTask: (taskId: Task["id"]) => void;
  onOpenCompletedTask: (taskId: Task["id"]) => void;
  onStart: (taskId: Task["id"]) => void;
  onStartShortBreak: (taskId: Task["id"]) => void;
  onConfigChange: (config: PomodoroConfig) => void;
  onFinish: () => void;
  onPause: () => void;
  onResume: () => void;
  onInterrupt: () => void;
  onSkipBreak: () => void;
  onReset: () => void;
}

const describeTimerState = (timerState: TimerState, config: PomodoroConfig): string => {
  if (timerState.status === "idle") {
    return formatDurationClock(config.workDurationSeconds);
  }

  if (timerState.status === "paused") {
    return formatDurationClock(timerState.remainingSeconds);
  }

  return formatDurationClock(timerState.secondsRemaining);
};

const getPhaseLabel = (timerState: TimerState): string => {
  if (timerState.status === "idle") {
    return "Ready for a focus block";
  }

  return timerState.phaseType.replace("_", " ");
};

const getPhaseTone = (timerState: TimerState): "work" | "short_break" | "long_break" | "idle" => {
  if (timerState.status === "idle") {
    return "idle";
  }

  return timerState.phaseType;
};

const getTimerProgress = (timerState: TimerState, config: PomodoroConfig): number => {
  if (timerState.status === "idle") {
    return 0.26;
  }

  if (timerState.status === "paused") {
    const plannedDurationSeconds =
      timerState.phaseType === "work"
        ? config.workDurationSeconds
        : timerState.phaseType === "short_break"
          ? config.shortBreakDurationSeconds
          : config.longBreakDurationSeconds;

    return 1 - timerState.remainingSeconds / plannedDurationSeconds;
  }

  const plannedDurationSeconds =
    timerState.phaseType === "work"
      ? config.workDurationSeconds
      : timerState.phaseType === "short_break"
        ? config.shortBreakDurationSeconds
        : config.longBreakDurationSeconds;

  return 1 - timerState.secondsRemaining / plannedDurationSeconds;
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
}

type PomodoroIconName =
  | "calendar"
  | "check"
  | "coffee"
  | "cup"
  | "gear"
  | "play"
  | "refresh"
  | "stopwatch"
  | "timer";

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
  }
};

const formatActivityTitle = (value: string): string =>
  value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

export const PomodoroPanel = ({
  tasksInDev,
  upcomingDueTasks,
  completedTodayTasks,
  timerState,
  config,
  selectedTask,
  allPomodoroSessions,
  allBreakRecords,
  taskSessionHistory,
  breakHistory,
  onSelectTask,
  onOpenCompletedTask,
  onStart,
  onStartShortBreak,
  onConfigChange,
  onFinish,
  onPause,
  onResume,
  onInterrupt,
  onSkipBreak,
  onReset
}: PomodoroPanelProps): JSX.Element => {
  const phaseTone = getPhaseTone(timerState);
  const phaseLabel = getPhaseLabel(timerState);
  const todayFocusSeconds = allPomodoroSessions
    .filter((session) => isToday(session.startedAt))
    .reduce((sum, session) => sum + session.actualDurationSeconds, 0);
  const todayCompletedPomodoros = allPomodoroSessions.filter(
    (session) => isToday(session.startedAt) && session.status === "completed"
  ).length;
  const todayBreaksTaken = allBreakRecords.filter(
    (record) => isToday(record.startedAt) && record.action === "completed"
  ).length;
  const todayFocusMinutes = Math.round(todayFocusSeconds / 60);
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
    }))
  ]
    .sort(
      (left, right) => new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime()
    )
    .slice(0, 4);
  const activeTaskPomodoroTarget = Math.max(
    selectedTask?.estimatedPomodoros ?? config.longBreakAfterWorkSessions,
    1
  );

  return (
    <section
      className={`focus-shell focus-shell--${phaseTone}${
        timerState.status === "paused" ? " is-paused" : ""
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
              progress={getTimerProgress(timerState, config)}
              tone={phaseTone}
            />
            <div className="focus-timer-center">
              <span className="timer-phase">{phaseLabel}</span>
              <strong className="timer-readout timer-readout--giant">
                {describeTimerState(timerState, config)}
              </strong>
              <span className="subtle">
                {timerState.status === "idle"
                  ? "Ready to begin a focus block"
                  : "Track work and breaks from one place"}
              </span>
            </div>
          </div>

          <div className="timer-actions timer-actions--focus">
            {timerState.status === "idle" && selectedTask ? (
              <>
                <button
                  className="primary-button focus-action-button focus-action-button--primary"
                  onClick={() => onStart(selectedTask.id)}
                  type="button"
                >
                  <PomodoroIcon name="play" />
                  Start focus
                </button>
                <button
                  className="ghost-button focus-action-button"
                  onClick={() => onStartShortBreak(selectedTask.id)}
                  type="button"
                >
                  <PomodoroIcon name="cup" />
                  Start short break
                </button>
              </>
            ) : null}

            {(timerState.status === "running" || timerState.status === "paused") &&
            timerState.phaseType === "work" ? (
              <button
                className="primary-button focus-action-button focus-action-button--primary"
                onClick={onFinish}
                type="button"
              >
                <PomodoroIcon name="check" />
                Finish
              </button>
            ) : null}

            {timerState.status === "running" ? (
              <button className="ghost-button focus-action-button" onClick={onPause} type="button">
                Pause
              </button>
            ) : null}

            {timerState.status === "paused" ? (
              <button
                className="primary-button focus-action-button focus-action-button--primary"
                onClick={onResume}
                type="button"
              >
                <PomodoroIcon name="play" />
                Continue
              </button>
            ) : null}

            {(timerState.status === "running" || timerState.status === "paused") &&
            (timerState.phaseType === "short_break" || timerState.phaseType === "long_break") ? (
              <button className="ghost-button focus-action-button" onClick={onSkipBreak} type="button">
                Skip break
              </button>
            ) : null}

            {timerState.status !== "idle" ? (
              <button className="danger-button focus-action-button" onClick={onInterrupt} type="button">
                Stop
              </button>
            ) : null}

            <button className="ghost-button focus-action-button" onClick={onReset} type="button">
              <PomodoroIcon name="refresh" />
              Reset
            </button>
          </div>

          <div className="focus-session-grid" aria-label="Pomodoro timing summary">
            <div className="focus-session-card focus-session-card--blue">
              <span className="focus-session-icon">
                <PomodoroIcon name="stopwatch" />
              </span>
              <span>
                <small>Session length</small>
                <strong>{Math.floor(config.workDurationSeconds / 60)} min</strong>
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
                <small>Pomodoros today</small>
                <strong>
                  {todayCompletedPomodoros} / {activeTaskPomodoroTarget}
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
                <strong>{todayBreaksTaken}</strong>
                <em>You've got this</em>
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
            </div>
          ) : null}
        </section>

        <section className="panel-card panel-stack focus-panel-card focus-panel-card--deadlines">
          <div className="focus-card-header">
            <span className="focus-section-label">Upcoming Due</span>
            <button className="focus-view-link" type="button">
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

        <section className="panel-card panel-stack focus-panel-card focus-panel-card--completed">
          <div className="focus-card-header">
            <span className="focus-section-label">Completed Today</span>
          </div>

          <div className="history-stack">
            {completedTodayTasks.map((task) => (
              <button
                className="history-item history-item-button"
                key={task.id}
                onClick={() => onOpenCompletedTask(task.id)}
                type="button"
              >
                <div>
                  <strong>{task.title}</strong>
                  <span>{task.updatedAt ? new Date(task.updatedAt).toLocaleTimeString() : ""}</span>
                </div>
                <div className="history-meta">
                  <span>{task.pomodoroCount} done</span>
                </div>
              </button>
            ))}
            {completedTodayTasks.length === 0 ? (
              <div className="focus-empty-compact">
                <span className="focus-empty-icon">
                  <PomodoroIcon name="check" />
                </span>
                <strong>None</strong>
                <span>No tasks completed yet today.</span>
              </div>
            ) : null}
          </div>
        </section>

        <section className="panel-card panel-stack focus-panel-card focus-panel-card--history">
          <div className="focus-card-header">
            <span className="focus-section-label">Recent Activity</span>
            <button className="focus-view-link" type="button">
              View all
            </button>
          </div>

          <div className="history-stack">
            {recentActivity.map((activity) => (
              <div className="focus-activity-item" key={activity.id}>
                <span className="focus-activity-dot" />
                <strong>{formatActivityTitle(activity.title)}</strong>
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
    </section>
  );
};
