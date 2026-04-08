import { useMemo, useState } from "react";
import { CollectionBadge } from "../../tasks/components/CollectionBadge";
import type { ArchivedCompletedTask } from "../domain/report-history.types";
import type { TaskCollection } from "../../tasks/domain/task-collection.types";
import {
  getTaskOverdueDays,
  isTaskCompletedOnTime,
  isTaskOverdue,
  isTaskScheduledInMonth
} from "../../tasks/domain/task-deadline";
import type { Task, TaskId, TaskPriority } from "../../tasks/domain/task.types";
import type {
  BreakRecord,
  PomodoroSession
} from "../../pomodoro/domain/pomodoro.types";

interface ReportPageProps {
  tasks: Task[];
  archivedCompletedTasks: ArchivedCompletedTask[];
  taskCollections: TaskCollection[];
  pomodoroSessions: PomodoroSession[];
  archivedPomodoroSessions: PomodoroSession[];
  breakRecords: BreakRecord[];
  archivedBreakRecords: BreakRecord[];
  onOpenTask: (taskId: Task["id"], intentMode: "default" | "completed") => void;
}

interface SummaryCardMetric {
  id: string;
  tone: "focus" | "tasks";
  label: string;
  secondaryLabel: string;
  value: string;
  secondaryValue: string;
}

interface CalendarDayData {
  key: string;
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  completedPomodoros: number;
  dueTasks: ReportTaskItem[];
  completedTasks: ReportTaskItem[];
}

type ReportCalendarDayDetails = CalendarDayData | null;

interface TrendPoint {
  day: number;
  focusMinutes: number;
  breakMinutes: number;
  pomodoros: number;
}

interface MonthlyTaskSummary {
  taskCount: number;
  completedOnTimeCount: number;
  overdueDaysTotal: number;
  behindScheduleCount: number;
}

interface ReportTaskItem {
  id: string;
  taskId: TaskId | null;
  title: string;
  priority: TaskPriority;
  estimatedCompletionDate: string | null;
  completedAt: string | null;
  collectionColor: string | null;
  isArchived: boolean;
}

const priorityOrder: Record<TaskPriority, number> = {
  high: 0,
  medium: 1,
  low: 2
};

const priorityColors: Record<TaskPriority, string> = {
  high: "#ff8b8b",
  medium: "#e9c768",
  low: "#7fd6a3"
};

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const startOfDay = (value: Date): Date =>
  new Date(value.getFullYear(), value.getMonth(), value.getDate());

const startOfWeek = (value: Date): Date => {
  const start = startOfDay(value);
  start.setDate(start.getDate() - start.getDay());
  return start;
};

const startOfMonth = (value: Date): Date => new Date(value.getFullYear(), value.getMonth(), 1);

const endExclusive = (value: Date, period: "day" | "week" | "month"): Date => {
  const end = new Date(value);

  if (period === "day") {
    end.setDate(end.getDate() + 1);
    return end;
  }

  if (period === "week") {
    end.setDate(end.getDate() + 7);
    return end;
  }

  end.setMonth(end.getMonth() + 1);
  return end;
};

const formatMetricDuration = (seconds: number): string => {
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes}m`;
  }

  if (minutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}m`;
};

const formatMonthLabel = (value: Date): string =>
  value.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric"
  });

const toLocalDateKey = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const dateKeyFromIso = (value: string | null): string | null => {
  if (!value) {
    return null;
  }

  return toLocalDateKey(new Date(value));
};

const compareTasks = (left: ReportTaskItem, right: ReportTaskItem): number => {
  const priorityComparison = priorityOrder[left.priority] - priorityOrder[right.priority];

  if (priorityComparison !== 0) {
    return priorityComparison;
  }

  return left.title.localeCompare(right.title);
};

const buildReportTaskItems = (
  tasks: Task[],
  archivedCompletedTasks: ArchivedCompletedTask[],
  taskCollections: TaskCollection[]
): { active: ReportTaskItem[]; history: ReportTaskItem[] } => {
  const taskCollectionsById = new Map(taskCollections.map((collection) => [collection.id, collection]));
  const activeTasks = tasks.map<ReportTaskItem>((task) => ({
    id: task.id,
    taskId: task.id,
    title: task.title,
    priority: task.priority,
    estimatedCompletionDate: task.estimatedCompletionDate,
    completedAt: task.completedAt,
    collectionColor:
      task.taskCollectionId !== null
        ? (taskCollectionsById.get(task.taskCollectionId)?.color ?? null)
        : null,
    isArchived: false
  }));
  const archivedTasks = archivedCompletedTasks.map<ReportTaskItem>((task) => ({
    id: task.id,
    taskId: null,
    title: task.title,
    priority: task.priority,
    estimatedCompletionDate: task.estimatedCompletionDate,
    completedAt: task.completedAt,
    collectionColor: task.collectionColor,
    isArchived: true
  }));

  return {
    active: activeTasks,
    history: [...activeTasks, ...archivedTasks]
  };
};

const buildSummaryCards = (
  tasks: ReportTaskItem[],
  pomodoroSessions: PomodoroSession[],
  now: Date
): SummaryCardMetric[] => {
  const dayStart = startOfDay(now);
  const weekStart = startOfWeek(now);
  const monthStart = startOfMonth(now);
  const completedSessions = pomodoroSessions.filter((session) => session.status === "completed");

  const getFocusSeconds = (start: Date, period: "day" | "week" | "month"): number =>
    pomodoroSessions
      .filter((session) => {
        const sessionDate = new Date(session.startedAt);
        return sessionDate >= start && sessionDate < endExclusive(start, period);
      })
      .reduce((sum, session) => sum + session.actualDurationSeconds, 0);

  const getCompletedPomodoroCount = (start: Date, period: "day" | "week" | "month"): number =>
    completedSessions.filter((session) => {
      const sessionDate = new Date(session.startedAt);
      return sessionDate >= start && sessionDate < endExclusive(start, period);
    }).length;

  const getCompletedTaskCount = (start: Date, period: "day" | "week" | "month"): number =>
    tasks.filter((task) => {
      if (!task.completedAt) {
        return false;
      }

      const completedDate = new Date(task.completedAt);
      return completedDate >= start && completedDate < endExclusive(start, period);
    }).length;

  return [
    {
      id: "focus-today",
      tone: "focus",
      label: "Focus Today",
      secondaryLabel: "Pomodoros Today",
      value: formatMetricDuration(getFocusSeconds(dayStart, "day")),
      secondaryValue: String(getCompletedPomodoroCount(dayStart, "day"))
    },
    {
      id: "focus-week",
      tone: "focus",
      label: "Focus This Week",
      secondaryLabel: "Pomodoros This Week",
      value: formatMetricDuration(getFocusSeconds(weekStart, "week")),
      secondaryValue: String(getCompletedPomodoroCount(weekStart, "week"))
    },
    {
      id: "focus-month",
      tone: "focus",
      label: "Focus This Month",
      secondaryLabel: "Pomodoros This Month",
      value: formatMetricDuration(getFocusSeconds(monthStart, "month")),
      secondaryValue: String(getCompletedPomodoroCount(monthStart, "month"))
    },
    {
      id: "tasks-today",
      tone: "tasks",
      label: "Tasks Closed Today",
      secondaryLabel: "Pomodoros Today",
      value: String(getCompletedTaskCount(dayStart, "day")),
      secondaryValue: String(getCompletedPomodoroCount(dayStart, "day"))
    },
    {
      id: "tasks-week",
      tone: "tasks",
      label: "Tasks Closed This Week",
      secondaryLabel: "Pomodoros This Week",
      value: String(getCompletedTaskCount(weekStart, "week")),
      secondaryValue: String(getCompletedPomodoroCount(weekStart, "week"))
    },
    {
      id: "tasks-month",
      tone: "tasks",
      label: "Tasks Closed This Month",
      secondaryLabel: "Pomodoros This Month",
      value: String(getCompletedTaskCount(monthStart, "month")),
      secondaryValue: String(getCompletedPomodoroCount(monthStart, "month"))
    }
  ];
};

const getCalendarStart = (month: Date): Date => {
  const start = startOfMonth(month);
  start.setDate(start.getDate() - start.getDay());
  return start;
};

const getCalendarDays = (
  month: Date,
  activeTasks: ReportTaskItem[],
  completedTasks: ReportTaskItem[],
  pomodoroSessions: PomodoroSession[]
): CalendarDayData[] => {
  const currentMonth = month.getMonth();
  const currentYear = month.getFullYear();
  const calendarStart = getCalendarStart(month);
  const dueTasksByDate = new Map<string, ReportTaskItem[]>();
  const completedTasksByDate = new Map<string, ReportTaskItem[]>();
  const completedPomodorosByDate = new Map<string, number>();
  const todayKey = toLocalDateKey(new Date());

  activeTasks.forEach((task) => {
    if (task.estimatedCompletionDate && !task.completedAt) {
      const existingDueTasks = dueTasksByDate.get(task.estimatedCompletionDate) ?? [];
      existingDueTasks.push(task);
      dueTasksByDate.set(task.estimatedCompletionDate, existingDueTasks);
    }
  });

  completedTasks.forEach((task) => {
    const completedKey = dateKeyFromIso(task.completedAt);

    if (completedKey) {
      const existingCompletedTasks = completedTasksByDate.get(completedKey) ?? [];
      existingCompletedTasks.push(task);
      completedTasksByDate.set(completedKey, existingCompletedTasks);
    }
  });

  pomodoroSessions.forEach((session) => {
    if (session.status !== "completed") {
      return;
    }

    const sessionKey = dateKeyFromIso(session.startedAt);

    if (!sessionKey) {
      return;
    }

    completedPomodorosByDate.set(
      sessionKey,
      (completedPomodorosByDate.get(sessionKey) ?? 0) + 1
    );
  });

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(calendarStart);
    date.setDate(calendarStart.getDate() + index);
    const key = toLocalDateKey(date);

    return {
      key,
      date,
      isCurrentMonth: date.getMonth() === currentMonth && date.getFullYear() === currentYear,
      isToday: key === todayKey,
      completedPomodoros: completedPomodorosByDate.get(key) ?? 0,
      dueTasks: (dueTasksByDate.get(key) ?? []).slice().sort(compareTasks),
      completedTasks: (completedTasksByDate.get(key) ?? []).slice().sort(compareTasks)
    };
  });
};

const groupCalendarWeeks = (calendarDays: CalendarDayData[]): CalendarDayData[][] =>
  Array.from({ length: Math.ceil(calendarDays.length / 7) }, (_, index) =>
    calendarDays.slice(index * 7, index * 7 + 7)
  );

const addMonths = (value: Date, delta: number): Date =>
  new Date(value.getFullYear(), value.getMonth() + delta, 1);

const getDaysInMonth = (value: Date): number =>
  new Date(value.getFullYear(), value.getMonth() + 1, 0).getDate();

const roundToSingleDecimal = (value: number): number =>
  Math.round(value * 10) / 10;

const getMonthTrendData = (
  month: Date,
  pomodoroSessions: PomodoroSession[],
  breakRecords: BreakRecord[]
): TrendPoint[] => {
  const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
  const totalsByDay = new Map<number, TrendPoint>();

  Array.from({ length: getDaysInMonth(month) }, (_, index) => {
    const day = index + 1;
    totalsByDay.set(day, {
      day,
      focusMinutes: 0,
      breakMinutes: 0,
      pomodoros: 0
    });
  });

  pomodoroSessions.forEach((session) => {
    const sessionDate = new Date(session.startedAt);
    const sessionKey = `${sessionDate.getFullYear()}-${String(
      sessionDate.getMonth() + 1
    ).padStart(2, "0")}`;

    if (sessionKey !== monthKey) {
      return;
    }

    const point = totalsByDay.get(sessionDate.getDate());

    if (!point) {
      return;
    }

    point.focusMinutes = roundToSingleDecimal(
      point.focusMinutes + session.actualDurationSeconds / 60
    );

    if (session.status === "completed") {
      point.pomodoros += 1;
    }
  });

  breakRecords.forEach((record) => {
    const breakDate = new Date(record.startedAt);
    const breakKey = `${breakDate.getFullYear()}-${String(breakDate.getMonth() + 1).padStart(
      2,
      "0"
    )}`;

    if (breakKey !== monthKey) {
      return;
    }

    const point = totalsByDay.get(breakDate.getDate());

    if (!point) {
      return;
    }

    point.breakMinutes = roundToSingleDecimal(
      point.breakMinutes + record.actualDurationSeconds / 60
    );
  });

  return Array.from(totalsByDay.values());
};

const buildLinePath = (
  values: number[],
  maxValue: number,
  width: number,
  height: number,
  padding: { top: number; right: number; bottom: number; left: number }
): string => {
  const usableWidth = width - padding.left - padding.right;
  const usableHeight = height - padding.top - padding.bottom;

  if (values.length === 0) {
    return "";
  }

  if (values.length === 1) {
    const x = padding.left + usableWidth / 2;
    const y = padding.top + usableHeight / 2;
    return `M ${x} ${y}`;
  }

  return values
    .map((value, index) => {
      const x = padding.left + (usableWidth * index) / (values.length - 1);
      const y =
        padding.top + usableHeight - (Math.max(value, 0) / Math.max(maxValue, 1)) * usableHeight;
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
};

const getTaskBadgeColor = (
  task: ReportTaskItem
): string =>
  task.collectionColor ?? priorityColors[task.priority];

const buildMonthlyTaskSummary = (
  tasks: ReportTaskItem[],
  month: Date,
  referenceDate: Date
): MonthlyTaskSummary => {
  const monthTasks = tasks.filter((task) => isTaskScheduledInMonth(task, month));

  return {
    taskCount: monthTasks.length,
    completedOnTimeCount: monthTasks.filter((task) => isTaskCompletedOnTime(task)).length,
    overdueDaysTotal: monthTasks.reduce(
      (sum, task) => sum + getTaskOverdueDays(task, referenceDate),
      0
    ),
    behindScheduleCount: monthTasks.filter((task) => isTaskOverdue(task, referenceDate)).length
  };
};

export const ReportPage = ({
  tasks,
  archivedCompletedTasks,
  taskCollections,
  pomodoroSessions,
  archivedPomodoroSessions,
  breakRecords,
  archivedBreakRecords,
  onOpenTask
}: ReportPageProps): JSX.Element => {
  const [visibleMonth, setVisibleMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [viewMode, setViewMode] = useState<"calendar" | "graph">("calendar");
  const [selectedCalendarDay, setSelectedCalendarDay] =
    useState<ReportCalendarDayDetails>(null);
  const reportTasks = useMemo(
    () => buildReportTaskItems(tasks, archivedCompletedTasks, taskCollections),
    [archivedCompletedTasks, taskCollections, tasks]
  );
  const allPomodoroSessions = useMemo(
    () => [...pomodoroSessions, ...archivedPomodoroSessions],
    [archivedPomodoroSessions, pomodoroSessions]
  );
  const allBreakRecords = useMemo(
    () => [...breakRecords, ...archivedBreakRecords],
    [archivedBreakRecords, breakRecords]
  );
  const summaryCards = useMemo(
    () => buildSummaryCards(reportTasks.history, allPomodoroSessions, new Date()),
    [allPomodoroSessions, reportTasks.history]
  );
  const monthlyTaskSummary = useMemo(
    () => buildMonthlyTaskSummary(reportTasks.history, visibleMonth, new Date()),
    [reportTasks.history, visibleMonth]
  );
  const calendarDays = useMemo(
    () =>
      getCalendarDays(
        visibleMonth,
        reportTasks.active.filter((task) => !task.completedAt),
        reportTasks.history.filter((task) => task.completedAt !== null),
        allPomodoroSessions
      ),
    [allPomodoroSessions, reportTasks.active, reportTasks.history, visibleMonth]
  );
  const calendarWeeks = useMemo(() => groupCalendarWeeks(calendarDays), [calendarDays]);
  const trendData = useMemo(
    () => getMonthTrendData(visibleMonth, allPomodoroSessions, allBreakRecords),
    [allBreakRecords, allPomodoroSessions, visibleMonth]
  );
  const focusMinutesSeries = trendData.map((point) => point.focusMinutes);
  const breakMinutesSeries = trendData.map((point) => point.breakMinutes);
  const pomodoroSeries = trendData.map((point) => point.pomodoros);
  const leftAxisMax = Math.max(
    25,
    ...focusMinutesSeries,
    ...breakMinutesSeries
  );
  const rightAxisMax = Math.max(1, ...pomodoroSeries);
  const chartPadding = {
    top: 18,
    right: 44,
    bottom: 30,
    left: 44
  };
  const chartWidth = 980;
  const chartHeight = 280;
  const focusPath = buildLinePath(
    focusMinutesSeries,
    leftAxisMax,
    chartWidth,
    chartHeight,
    chartPadding
  );
  const breakPath = buildLinePath(
    breakMinutesSeries,
    leftAxisMax,
    chartWidth,
    chartHeight,
    chartPadding
  );
  const pomodoroPath = buildLinePath(
    pomodoroSeries,
    rightAxisMax,
    chartWidth,
    chartHeight,
    chartPadding
  );

  return (
    <section className="report-shell">
      <div className="report-summary-grid">
        {summaryCards.map((card) => (
          <article
            className={`report-summary-card report-summary-card--${card.tone}`}
            key={card.id}
          >
            <div className="report-summary-accent" />
            <div className="report-summary-copy">
              <span className="report-summary-label report-summary-label--primary">
                {card.label}
              </span>
              <span className="report-summary-label report-summary-label--secondary">
                {card.secondaryLabel}
              </span>
              <strong className="report-summary-value report-summary-value--primary">
                {card.value}
              </strong>
              <strong className="report-summary-value report-summary-value--secondary">
                {card.secondaryValue}
              </strong>
            </div>
          </article>
        ))}
      </div>

      <section className="report-task-summary-card">
        <div className="panel-title">
          <h3>Task Summary</h3>
          <p>How the selected month is tracking against planned due dates.</p>
        </div>

        <div className="report-task-summary-grid">
          <article className="report-task-summary-stat">
            <span className="report-task-summary-label">Tasks This Month</span>
            <strong>{monthlyTaskSummary.taskCount}</strong>
          </article>
          <article className="report-task-summary-stat">
            <span className="report-task-summary-label">Completed On Time</span>
            <strong>{monthlyTaskSummary.completedOnTimeCount}</strong>
          </article>
          <article className="report-task-summary-stat">
            <span className="report-task-summary-label">Overdue Days Passed</span>
            <strong>{monthlyTaskSummary.overdueDaysTotal}</strong>
          </article>
          <article className="report-task-summary-stat report-task-summary-stat--alert">
            <span className="report-task-summary-label">Behind Schedule</span>
            <strong>{monthlyTaskSummary.behindScheduleCount} tasks</strong>
          </article>
        </div>
      </section>

      <section className="report-calendar-card">
        <div className="report-calendar-header">
          <div className="panel-title">
            <h3>{viewMode === "calendar" ? "Monthly Calendar" : "Monthly Trends"}</h3>
            <p>
              {viewMode === "calendar"
                ? "Track due dates, completed tasks, and finished pomodoros across the month."
                : "Compare daily pomodoros, focus time, and break time across the month."}
            </p>
          </div>
          <div className="report-calendar-controls">
            <label className="report-view-select-wrap">
              <span>View</span>
              <select
                className="report-view-select"
                onChange={(event) =>
                  setViewMode(event.target.value as "calendar" | "graph")
                }
                value={viewMode}
              >
                <option value="calendar">Calendar</option>
                <option value="graph">Graph</option>
              </select>
            </label>
            <div className="report-calendar-nav">
            <button
              aria-label="Previous month"
              className="ghost-button report-calendar-arrow"
              onClick={() => setVisibleMonth((current) => addMonths(current, -1))}
              type="button"
            >
              &lt;
            </button>
            <strong>{formatMonthLabel(visibleMonth)}</strong>
            <button
              aria-label="Next month"
              className="ghost-button report-calendar-arrow"
              onClick={() => setVisibleMonth((current) => addMonths(current, 1))}
              type="button"
            >
              &gt;
            </button>
            </div>
          </div>
        </div>

        {viewMode === "calendar" ? (
          <>
            <div className="report-calendar-weekdays">
              {weekdayLabels.map((weekday) => (
                <span key={weekday}>{weekday}</span>
              ))}
            </div>

            <div className="report-calendar-grid">
              {calendarWeeks.map((week, weekIndex) => (
                <div className="report-calendar-week" key={`week-${weekIndex + 1}`}>
                  {week.map((day) => (
                    <article
                      className={[
                        "report-calendar-day",
                        day.isCurrentMonth ? "" : "is-outside",
                        day.isToday ? "is-today" : "",
                        day.completedPomodoros > 0 ? "has-pomodoros" : ""
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      key={day.key}
                      onClick={() => setSelectedCalendarDay(day)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedCalendarDay(day);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="report-calendar-day-header">
                        <span className="report-calendar-day-number">{day.date.getDate()}</span>
                        <span
                          className={`report-pomodoro-pill${
                            day.completedPomodoros > 0 ? " is-active" : ""
                          }`}
                        >
                          {day.completedPomodoros} pom
                        </span>
                      </div>

                      {day.dueTasks.length > 0 ? (
                        <div className="report-calendar-section">
                          <span className="report-calendar-section-label">Due</span>
                          <div className="report-calendar-badge-list">
                            {day.dueTasks.slice(0, 2).map((task) => (
                              <button
                                className="report-task-badge-row report-task-badge-row--due"
                                key={task.id}
                                onClick={(event) => {
                                  event.stopPropagation();

                                  if (task.taskId) {
                                    onOpenTask(task.taskId, "default");
                                  }
                                }}
                                type="button"
                              >
                                <CollectionBadge
                                  color={getTaskBadgeColor(task)}
                                  compact
                                  name={task.title}
                                />
                              </button>
                            ))}
                            {day.dueTasks.length > 2 ? (
                              <span className="report-calendar-more">
                                +{day.dueTasks.length - 2} more
                              </span>
                            ) : null}
                          </div>
                        </div>
                      ) : null}

                      {day.completedTasks.length > 0 ? (
                        <div className="report-calendar-section">
                          <span className="report-calendar-section-label report-calendar-section-label--success">
                            Closed
                          </span>
                          <div className="report-calendar-badge-list">
                            {day.completedTasks.slice(0, 2).map((task) => (
                              <button
                                className="report-task-badge-row report-task-badge-row--completed"
                                key={task.id}
                                onClick={(event) => {
                                  event.stopPropagation();

                                  if (task.taskId) {
                                    onOpenTask(task.taskId, "completed");
                                  }
                                }}
                                type="button"
                              >
                                <span className="report-task-check">✓</span>
                                <CollectionBadge
                                  color={getTaskBadgeColor(task)}
                                  compact
                                  name={task.title}
                                />
                              </button>
                            ))}
                            {day.completedTasks.length > 2 ? (
                              <span className="report-calendar-more">
                                +{day.completedTasks.length - 2} more
                              </span>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="report-graph-card">
            <div className="report-graph-legend">
              <div className="report-graph-legend-item report-graph-legend-item--focus">
                <span className="report-graph-dot" />
                <div>
                  <strong>Focus time</strong>
                  <span>
                    {formatMetricDuration(
                      Math.round(trendData.reduce((sum, point) => sum + point.focusMinutes, 0) * 60)
                    )}
                  </span>
                </div>
              </div>
              <div className="report-graph-legend-item report-graph-legend-item--pomodoros">
                <span className="report-graph-dot" />
                <div>
                  <strong>Pomodoros</strong>
                  <span>{trendData.reduce((sum, point) => sum + point.pomodoros, 0)}</span>
                </div>
              </div>
              <div className="report-graph-legend-item report-graph-legend-item--breaks">
                <span className="report-graph-dot" />
                <div>
                  <strong>Break time</strong>
                  <span>
                    {formatMetricDuration(
                      Math.round(trendData.reduce((sum, point) => sum + point.breakMinutes, 0) * 60)
                    )}
                  </span>
                </div>
              </div>
            </div>

            <div className="report-graph-canvas">
              <svg
                aria-label="Monthly activity trends"
                className="report-trend-chart"
                role="img"
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              >
                {Array.from({ length: 5 }, (_, index) => {
                  const y =
                    chartPadding.top +
                    ((chartHeight - chartPadding.top - chartPadding.bottom) * index) / 4;
                  const leftAxisValue = Math.round(leftAxisMax - (leftAxisMax * index) / 4);
                  const rightAxisValue = Math.round(rightAxisMax - (rightAxisMax * index) / 4);

                  return (
                    <g key={`grid-${index}`}>
                      <line
                        className="report-trend-grid-line"
                        x1={chartPadding.left}
                        x2={chartWidth - chartPadding.right}
                        y1={y}
                        y2={y}
                      />
                      <text className="report-trend-axis-label" x={12} y={y + 4}>
                        {leftAxisValue}m
                      </text>
                      <text
                        className="report-trend-axis-label report-trend-axis-label--right"
                        textAnchor="end"
                        x={chartWidth - 8}
                        y={y + 4}
                      >
                        {rightAxisValue}
                      </text>
                    </g>
                  );
                })}

                {trendData.map((point, index) => {
                  const usableWidth = chartWidth - chartPadding.left - chartPadding.right;
                  const x =
                    chartPadding.left +
                    (usableWidth * index) / Math.max(trendData.length - 1, 1);
                  const shouldLabel =
                    point.day === 1 ||
                    point.day === trendData.length ||
                    point.day % 5 === 0;

                  return shouldLabel ? (
                    <text
                      className="report-trend-axis-label"
                      key={`day-${point.day}`}
                      textAnchor="middle"
                      x={x}
                      y={chartHeight - 8}
                    >
                      {point.day}
                    </text>
                  ) : null;
                })}

                <path className="report-trend-line report-trend-line--focus" d={focusPath} />
                <path
                  className="report-trend-line report-trend-line--pomodoros"
                  d={pomodoroPath}
                />
                <path className="report-trend-line report-trend-line--breaks" d={breakPath} />

                {trendData.map((point, index) => {
                  const usableWidth = chartWidth - chartPadding.left - chartPadding.right;
                  const usableHeight = chartHeight - chartPadding.top - chartPadding.bottom;
                  const x =
                    chartPadding.left +
                    (usableWidth * index) / Math.max(trendData.length - 1, 1);
                  const focusY =
                    chartPadding.top +
                    usableHeight -
                    (point.focusMinutes / Math.max(leftAxisMax, 1)) * usableHeight;
                  const breakY =
                    chartPadding.top +
                    usableHeight -
                    (point.breakMinutes / Math.max(leftAxisMax, 1)) * usableHeight;
                  const pomodoroY =
                    chartPadding.top +
                    usableHeight -
                    (point.pomodoros / Math.max(rightAxisMax, 1)) * usableHeight;

                  return (
                    <g key={`point-${point.day}`}>
                      <circle className="report-trend-point report-trend-point--focus" cx={x} cy={focusY} r="3.4" />
                      <circle className="report-trend-point report-trend-point--pomodoros" cx={x} cy={pomodoroY} r="3.4" />
                      <circle className="report-trend-point report-trend-point--breaks" cx={x} cy={breakY} r="3.4" />
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        )}
      </section>

      {selectedCalendarDay ? (
        <div
          className="modal-overlay"
          onClick={() => setSelectedCalendarDay(null)}
          role="presentation"
        >
          <div
            className="modal-card panel-card report-day-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Calendar day details"
          >
            <div className="details-title">
              <div>
                <h3>
                  {selectedCalendarDay.date.toLocaleDateString(undefined, {
                    month: "long",
                    day: "numeric",
                    year: "numeric"
                  })}
                </h3>
                <p>
                  {selectedCalendarDay.completedPomodoros} pomodoro
                  {selectedCalendarDay.completedPomodoros === 1 ? "" : "s"} completed
                </p>
              </div>
              <button
                className="ghost-button"
                onClick={() => setSelectedCalendarDay(null)}
                type="button"
              >
                Close
              </button>
            </div>

            <div className="report-day-modal-stack">
              <section className="report-day-modal-section">
                <div className="panel-title">
                  <h3>Due</h3>
                  <p>{selectedCalendarDay.dueTasks.length} task(s)</p>
                </div>
                {selectedCalendarDay.dueTasks.length > 0 ? (
                  <div className="report-day-modal-list">
                    {selectedCalendarDay.dueTasks.map((task) => (
                      <button
                        className="report-day-modal-item"
                        key={`due-${task.id}`}
                        onClick={() => {
                          if (task.taskId) {
                            onOpenTask(task.taskId, "default");
                          }
                        }}
                        type="button"
                      >
                        <CollectionBadge color={getTaskBadgeColor(task)} compact name={task.title} />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">No due tasks on this day.</div>
                )}
              </section>

              <section className="report-day-modal-section">
                <div className="panel-title">
                  <h3>Completed</h3>
                  <p>{selectedCalendarDay.completedTasks.length} task(s)</p>
                </div>
                {selectedCalendarDay.completedTasks.length > 0 ? (
                  <div className="report-day-modal-list">
                    {selectedCalendarDay.completedTasks.map((task) => (
                      <button
                        className="report-day-modal-item report-day-modal-item--completed"
                        key={`completed-${task.id}`}
                        onClick={() => {
                          if (task.taskId) {
                            onOpenTask(task.taskId, "completed");
                          }
                        }}
                        type="button"
                      >
                        <span className="report-task-check">✓</span>
                        <CollectionBadge color={getTaskBadgeColor(task)} compact name={task.title} />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">No completed tasks on this day.</div>
                )}
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
};
