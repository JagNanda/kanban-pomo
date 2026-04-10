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
  onConfigChange: (config: PomodoroConfig) => void;
  onFinish: () => void;
  onPause: () => void;
  onResume: () => void;
  onInterrupt: () => void;
  onSkipBreak: () => void;
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
    return 0;
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
  onConfigChange,
  onFinish,
  onPause,
  onResume,
  onInterrupt,
  onSkipBreak
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
  const recentActivity: RecentActivityItem[] = [
    ...taskSessionHistory.map((session) => ({
      id: session.id,
      startedAt: session.startedAt,
      title: session.status,
      detail: formatDurationClock(session.actualDurationSeconds),
      meta: new Date(session.startedAt).toLocaleTimeString()
    })),
    ...breakHistory.map((record) => ({
      id: record.id,
      startedAt: record.startedAt,
      title: record.phaseType.replace("_", " "),
      detail: record.action,
      meta: formatDurationClock(record.actualDurationSeconds)
    }))
  ]
    .sort(
      (left, right) => new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime()
    )
    .slice(0, 4);

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
              <button
                className="primary-button"
                onClick={() => onStart(selectedTask.id)}
                type="button"
              >
                Start focus
              </button>
            ) : null}

            {(timerState.status === "running" || timerState.status === "paused") &&
            timerState.phaseType === "work" ? (
              <button className="primary-button" onClick={onFinish} type="button">
                Finish
              </button>
            ) : null}

            {timerState.status === "running" ? (
              <button className="ghost-button" onClick={onPause} type="button">
                Pause
              </button>
            ) : null}

            {timerState.status === "paused" ? (
              <button className="primary-button" onClick={onResume} type="button">
                Continue
              </button>
            ) : null}

            {(timerState.status === "running" || timerState.status === "paused") &&
            (timerState.phaseType === "short_break" || timerState.phaseType === "long_break") ? (
              <button className="ghost-button" onClick={onSkipBreak} type="button">
                Skip break
              </button>
            ) : null}

            {timerState.status !== "idle" ? (
              <button className="danger-button" onClick={onInterrupt} type="button">
                Stop
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="focus-sidebar">
        <section className="panel-card panel-stack focus-panel-card focus-panel-card--task">
          <div className="focus-task-header">
            <div>
              <span className="eyebrow">Focus Mode</span>
              <h2>{selectedTask?.title ?? "Select a task in In Dev"}</h2>
            </div>
          </div>

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
                <span>Estimated</span>
                <StopwatchIcons
                  count={selectedTask.estimatedPomodoros}
                  size="sm"
                  tone="estimated"
                />
              </div>
              <div className="focus-meta-row">
                <span>Completed</span>
                <StopwatchIcons
                  count={selectedTask.pomodoroCount}
                  size="sm"
                  tone="completed"
                />
              </div>
            </div>
          ) : null}
        </section>

        <section className="panel-card panel-stack focus-panel-card focus-panel-card--overview">
          <div className="panel-title">
            <h3>Focus Today</h3>
            <p>Daily totals across work and breaks.</p>
          </div>

          <div className="focus-stat-grid">
            <div className="focus-stat-card">
              <span>Focused</span>
              <strong>{Math.round(todayFocusSeconds / 60)}m</strong>
            </div>
            <div className="focus-stat-card">
              <span>Pomodoros earned</span>
              <strong>{todayCompletedPomodoros}</strong>
            </div>
            <div className="focus-stat-card">
              <span>Breaks taken</span>
              <strong>{todayBreaksTaken}</strong>
            </div>
          </div>
        </section>

        <section className="panel-card panel-stack focus-panel-card focus-panel-card--deadlines">
          <div className="panel-title">
            <h3>Upcoming Due Dates</h3>
            <p>Open tasks with the nearest deadlines.</p>
          </div>

          <div className="history-stack">
            {upcomingDueTasks.map((task) => (
              <div className="history-item" key={task.id}>
                <div>
                  <strong>{task.title}</strong>
                  <span>{task.estimatedCompletionDate}</span>
                </div>
                <div className="history-meta">
                  <span>{task.priority}</span>
                </div>
              </div>
            ))}
            {upcomingDueTasks.length === 0 ? (
              <div className="empty-state">No upcoming due dates.</div>
            ) : null}
          </div>
        </section>

        <section className="panel-card panel-stack focus-panel-card focus-panel-card--completed">
          <div className="panel-title">
            <h3>Completed Today</h3>
            <p>Tasks moved into completed today.</p>
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
              <div className="empty-state">None</div>
            ) : null}
          </div>
        </section>

        <section className="panel-card panel-stack focus-panel-card focus-panel-card--history">
          <div className="panel-title">
            <h3>Task History</h3>
            <p>Recent work and break events for the selected task.</p>
          </div>

          <div className="history-stack">
            {recentActivity.map((activity) => (
              <div className="history-item" key={activity.id}>
                <div>
                  <strong>{activity.title}</strong>
                  <span>{activity.detail}</span>
                </div>
                <div className="history-meta">
                  <span>{activity.meta}</span>
                </div>
              </div>
            ))}
            {recentActivity.length === 0 ? (
              <div className="empty-state">No recorded sessions yet for this task.</div>
            ) : null}
          </div>
        </section>

        <section className="panel-card panel-stack focus-panel-card focus-panel-card--settings">
          <div className="panel-title">
            <h3>Pomodoro Settings</h3>
            <p>Saved locally on the desktop app.</p>
          </div>

          <div className="sub-grid focus-settings-grid">
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
