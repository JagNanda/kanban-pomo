import { type CSSProperties, useMemo, useState } from "react";
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

type ReportViewMode = "overview" | "calendar" | "trends";
type ReportIconName = "clock" | "check" | "rate" | "break" | "flame" | "warning" | "calendar" | "external";
type MetricDirection = "up" | "down" | "neutral";

interface SummaryCardMetric {
  id: string;
  icon: ReportIconName;
  tone: "blue" | "violet" | "green" | "amber" | "cyan" | "red";
  label: string;
  value: string;
  detail: string;
  delta: string;
  direction: MetricDirection;
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

interface TrendPoint {
  day: number;
  key: string;
  focusMinutes: number;
  breakMinutes: number;
  pomodoros: number;
}

interface MonthlyTaskSummary {
  taskCount: number;
  completedOnTimeCount: number;
  overdueDaysTotal: number;
  behindScheduleCount: number;
  completedLateCount: number;
  notStartedCount: number;
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

interface ActivityInsight {
  id: string;
  icon: ReportIconName;
  label: string;
  value: string;
  detail: string;
  tone: "violet" | "blue" | "green";
}

const priorityOrder: Record<TaskPriority, number> = {
  high: 0,
  medium: 1,
  low: 2
};

const priorityColors: Record<TaskPriority, string> = {
  high: "#ff7070",
  medium: "#f3a438",
  low: "#3fc978"
};

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const weekdayLongLabels = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const ReportIcon = ({ name }: { name: ReportIconName }): JSX.Element => {
  switch (name) {
    case "clock":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="8" />
          <path d="M12 7v6l4 2" />
        </svg>
      );
    case "check":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="8" />
          <path d="m8 12 2.6 2.6L16 9" />
        </svg>
      );
    case "rate":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="m5 13 4 4L19 7" />
          <path d="M19 12a7 7 0 1 1-2.1-5" />
        </svg>
      );
    case "break":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M7 8h10v4a5 5 0 0 1-5 5 5 5 0 0 1-5-5Z" />
          <path d="M17 9h1.5a2 2 0 0 1 0 4H17" />
          <path d="M6 20h12" />
          <path d="M9 4v1" />
          <path d="M13 4v1" />
        </svg>
      );
    case "flame":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M12 21a7 7 0 0 1-7-7c0-3.7 2.8-6 4.2-8.4.2 2.2 1.1 3.7 2.7 4.7.2-2.2 1.4-4 3-5.3.4 3.4 4.1 5.4 4.1 9A7 7 0 0 1 12 21Z" />
          <path d="M12 18a3 3 0 0 1-3-3c0-1.4 1-2.4 1.7-3.2.3 1.1.9 1.9 1.8 2.4.3-1 .9-1.8 1.6-2.4.5 1.3.9 2.2.9 3.2a3 3 0 0 1-3 3Z" />
        </svg>
      );
    case "warning":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M12 4 3.5 19h17Z" />
          <path d="M12 9v4" />
          <path d="M12 16h.01" />
        </svg>
      );
    case "calendar":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <rect height="16" rx="2" width="16" x="4" y="5" />
          <path d="M8 3v4" />
          <path d="M16 3v4" />
          <path d="M4 10h16" />
        </svg>
      );
    case "external":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M14 5h5v5" />
          <path d="m10 14 9-9" />
          <path d="M19 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4" />
        </svg>
      );
  }
};

const startOfDay = (value: Date): Date =>
  new Date(value.getFullYear(), value.getMonth(), value.getDate());

const startOfMonth = (value: Date): Date => new Date(value.getFullYear(), value.getMonth(), 1);

const addMonths = (value: Date, delta: number): Date =>
  new Date(value.getFullYear(), value.getMonth() + delta, 1);

const getDaysInMonth = (value: Date): number =>
  new Date(value.getFullYear(), value.getMonth() + 1, 0).getDate();

const getMonthEndExclusive = (value: Date): Date =>
  new Date(value.getFullYear(), value.getMonth() + 1, 1);

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

const formatMinutesDuration = (minutes: number): string => formatMetricDuration(minutes * 60);

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

const isInMonth = (value: string, month: Date): boolean => {
  const date = new Date(value);

  return date >= startOfMonth(month) && date < getMonthEndExclusive(month);
};

const getPercentDelta = (current: number, previous: number): number => {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }

  return Math.round(((current - previous) / previous) * 100);
};

const formatPercentDelta = (current: number, previous: number): string =>
  `${Math.abs(getPercentDelta(current, previous))}% vs last month`;

const formatCountDelta = (current: number, previous: number, unit: string): string =>
  `${Math.abs(current - previous)} ${unit} vs last month`;

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

const getMonthTrendData = (
  month: Date,
  pomodoroSessions: PomodoroSession[],
  breakRecords: BreakRecord[]
): TrendPoint[] => {
  const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
  const totalsByDay = new Map<number, TrendPoint>();

  Array.from({ length: getDaysInMonth(month) }, (_, index) => {
    const day = index + 1;
    const date = new Date(month.getFullYear(), month.getMonth(), day);
    totalsByDay.set(day, {
      day,
      key: toLocalDateKey(date),
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

    point.focusMinutes = Math.round(point.focusMinutes + session.actualDurationSeconds / 60);

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

    point.breakMinutes = Math.round(point.breakMinutes + record.actualDurationSeconds / 60);
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
  const behindScheduleCount = monthTasks.filter((task) => isTaskOverdue(task, referenceDate)).length;
  const completedLateCount = monthTasks.filter(
    (task) => task.completedAt !== null && isTaskOverdue(task, referenceDate)
  ).length;

  return {
    taskCount: monthTasks.length,
    completedOnTimeCount: monthTasks.filter((task) => isTaskCompletedOnTime(task)).length,
    overdueDaysTotal: monthTasks.reduce(
      (sum, task) => sum + getTaskOverdueDays(task, referenceDate),
      0
    ),
    behindScheduleCount,
    completedLateCount,
    notStartedCount: monthTasks.filter((task) => task.completedAt === null && !isTaskOverdue(task, referenceDate)).length
  };
};

const countCompletedTasksInMonth = (tasks: ReportTaskItem[], month: Date): number =>
  tasks.filter((task) => task.completedAt !== null && isInMonth(task.completedAt, month)).length;

const sumFocusSecondsInMonth = (sessions: PomodoroSession[], month: Date): number =>
  sessions
    .filter((session) => isInMonth(session.startedAt, month))
    .reduce((sum, session) => sum + session.actualDurationSeconds, 0);

const countCompletedPomodorosInMonth = (sessions: PomodoroSession[], month: Date): number =>
  sessions.filter((session) => session.status === "completed" && isInMonth(session.startedAt, month)).length;

const sumBreakSecondsInMonth = (records: BreakRecord[], month: Date): number =>
  records
    .filter((record) => isInMonth(record.startedAt, month))
    .reduce((sum, record) => sum + record.actualDurationSeconds, 0);

const getCompletedSessionDayKeys = (sessions: PomodoroSession[]): Set<string> => {
  const keys = new Set<string>();

  sessions.forEach((session) => {
    if (session.status === "completed") {
      keys.add(toLocalDateKey(new Date(session.startedAt)));
    }
  });

  return keys;
};

const getCurrentStreak = (sessions: PomodoroSession[], referenceDate: Date): number => {
  const activeDays = getCompletedSessionDayKeys(sessions);
  const cursor = startOfDay(referenceDate);
  let streak = 0;

  while (activeDays.has(toLocalDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
};

const getBestStreak = (sessions: PomodoroSession[]): number => {
  const sortedKeys = Array.from(getCompletedSessionDayKeys(sessions)).sort();
  let best = 0;
  let current = 0;
  let previousDate: Date | null = null;

  sortedKeys.forEach((key) => {
    const date = new Date(`${key}T00:00:00`);
    const expectedPrevious = previousDate ? new Date(previousDate) : null;

    if (expectedPrevious) {
      expectedPrevious.setDate(expectedPrevious.getDate() + 1);
    }

    current =
      expectedPrevious && toLocalDateKey(expectedPrevious) === key
        ? current + 1
        : 1;
    best = Math.max(best, current);
    previousDate = date;
  });

  return best;
};

const getActivityIntensity = (pomodoros: number, maxPomodoros: number): number => {
  if (pomodoros === 0) {
    return 0;
  }

  if (maxPomodoros <= 1) {
    return 1;
  }

  if (pomodoros >= Math.ceil(maxPomodoros * 0.7)) {
    return 3;
  }

  if (pomodoros >= Math.ceil(maxPomodoros * 0.35)) {
    return 2;
  }

  return 1;
};

const buildInsights = (
  month: Date,
  trendData: TrendPoint[],
  monthSessions: PomodoroSession[],
  priorMonthSessions: PomodoroSession[]
): ActivityInsight[] => {
  const bestPoint = trendData.reduce<TrendPoint | null>(
    (best, point) => (!best || point.focusMinutes > best.focusMinutes ? point : best),
    null
  );
  const bestActivePoint = bestPoint && bestPoint.focusMinutes > 0 ? bestPoint : null;
  const weekdayTotals = new Map<number, { focusMinutes: number; activeDays: Set<string> }>();

  monthSessions.forEach((session) => {
    const date = new Date(session.startedAt);
    const weekday = date.getDay();
    const existing = weekdayTotals.get(weekday) ?? {
      focusMinutes: 0,
      activeDays: new Set<string>()
    };
    existing.focusMinutes += Math.round(session.actualDurationSeconds / 60);
    existing.activeDays.add(toLocalDateKey(date));
    weekdayTotals.set(weekday, existing);
  });

  const bestWeekday = Array.from(weekdayTotals.entries()).reduce<{
    weekday: number;
    average: number;
  } | null>((best, [weekday, total]) => {
    const average = total.focusMinutes / Math.max(total.activeDays.size, 1);

    if (!best || average > best.average) {
      return { weekday, average };
    }

    return best;
  }, null);
  const completedMonthSessions = monthSessions.filter((session) => session.status === "completed");
  const completedPriorSessions = priorMonthSessions.filter((session) => session.status === "completed");
  const averageSessionMinutes =
    completedMonthSessions.length > 0
      ? Math.round(
          completedMonthSessions.reduce((sum, session) => sum + session.actualDurationSeconds, 0) /
            completedMonthSessions.length /
            60
        )
      : 0;
  const priorAverageSessionMinutes =
    completedPriorSessions.length > 0
      ? Math.round(
          completedPriorSessions.reduce((sum, session) => sum + session.actualDurationSeconds, 0) /
            completedPriorSessions.length /
            60
        )
      : 0;
  const averageDelta = averageSessionMinutes - priorAverageSessionMinutes;

  return [
    {
      id: "best-day",
      icon: "rate",
      label: "Best focus day",
      value: bestActivePoint
        ? `${month.toLocaleDateString(undefined, { month: "short" })} ${bestActivePoint.day}`
        : "No activity",
      detail: bestActivePoint
        ? `${formatMinutesDuration(bestActivePoint.focusMinutes)} focus time - ${bestActivePoint.pomodoros} pomodoros`
        : "Start a session to build history",
      tone: "violet"
    },
    {
      id: "weekday",
      icon: "calendar",
      label: "Most productive weekday",
      value: bestWeekday
        ? (weekdayLongLabels[bestWeekday.weekday] ?? "No pattern yet")
        : "No pattern yet",
      detail: bestWeekday
        ? `Avg ${formatMinutesDuration(Math.round(bestWeekday.average))} focus time`
        : "More sessions will surface a pattern",
      tone: "blue"
    },
    {
      id: "average",
      icon: "clock",
      label: "Average session length",
      value: `${averageSessionMinutes} min`,
      detail:
        averageDelta === 0
          ? "Flat vs last month"
          : `${Math.abs(averageDelta)} min ${averageDelta > 0 ? "longer" : "shorter"} vs last month`,
      tone: "green"
    }
  ];
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
  const [viewMode, setViewMode] = useState<ReportViewMode>("overview");
  const [selectedCalendarDay, setSelectedCalendarDay] =
    useState<CalendarDayData | null>(null);
  const [behindScheduleDetails, setBehindScheduleDetails] =
    useState<ReportTaskItem[] | null>(null);
  const [selectedTrendDay, setSelectedTrendDay] = useState<number>(() =>
    Math.min(14, getDaysInMonth(new Date()))
  );
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
  const priorMonth = addMonths(visibleMonth, -1);
  const referenceDate = new Date();
  const monthlyTaskSummary = useMemo(
    () => buildMonthlyTaskSummary(reportTasks.history, visibleMonth, referenceDate),
    [reportTasks.history, visibleMonth]
  );
  const priorMonthlyTaskSummary = useMemo(
    () => buildMonthlyTaskSummary(reportTasks.history, priorMonth, referenceDate),
    [priorMonth, reportTasks.history]
  );
  const behindScheduleTasks = useMemo(
    () =>
      reportTasks.history
        .filter(
          (task) =>
            isTaskScheduledInMonth(task, visibleMonth) && isTaskOverdue(task, referenceDate)
        )
        .slice()
        .sort((left, right) => {
          const leftDue = left.estimatedCompletionDate ?? "9999-12-31";
          const rightDue = right.estimatedCompletionDate ?? "9999-12-31";

          if (leftDue !== rightDue) {
            return leftDue.localeCompare(rightDue);
          }

          return compareTasks(left, right);
        }),
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
  const monthSessions = useMemo(
    () => allPomodoroSessions.filter((session) => isInMonth(session.startedAt, visibleMonth)),
    [allPomodoroSessions, visibleMonth]
  );
  const priorMonthSessions = useMemo(
    () => allPomodoroSessions.filter((session) => isInMonth(session.startedAt, priorMonth)),
    [allPomodoroSessions, priorMonth]
  );
  const focusSeconds = sumFocusSecondsInMonth(allPomodoroSessions, visibleMonth);
  const priorFocusSeconds = sumFocusSecondsInMonth(allPomodoroSessions, priorMonth);
  const completedPomodoros = countCompletedPomodorosInMonth(allPomodoroSessions, visibleMonth);
  const completedTasks = countCompletedTasksInMonth(reportTasks.history, visibleMonth);
  const priorCompletedTasks = countCompletedTasksInMonth(reportTasks.history, priorMonth);
  const completionRate =
    monthlyTaskSummary.taskCount > 0
      ? Math.round((monthlyTaskSummary.completedOnTimeCount / monthlyTaskSummary.taskCount) * 100)
      : 0;
  const priorCompletionRate =
    priorMonthlyTaskSummary.taskCount > 0
      ? Math.round(
          (priorMonthlyTaskSummary.completedOnTimeCount / priorMonthlyTaskSummary.taskCount) * 100
        )
      : 0;
  const breakSeconds = sumBreakSecondsInMonth(allBreakRecords, visibleMonth);
  const priorBreakSeconds = sumBreakSecondsInMonth(allBreakRecords, priorMonth);
  const currentStreak = getCurrentStreak(allPomodoroSessions, referenceDate);
  const bestStreak = getBestStreak(allPomodoroSessions);
  const priorStreak = getCurrentStreak(allPomodoroSessions, addMonths(referenceDate, -1));
  const summaryCards: SummaryCardMetric[] = [
    {
      id: "focus-time",
      icon: "clock",
      tone: "blue",
      label: "Focus time",
      value: formatMetricDuration(focusSeconds),
      detail: `${completedPomodoros} pomodoros`,
      delta: formatPercentDelta(focusSeconds, priorFocusSeconds),
      direction: focusSeconds >= priorFocusSeconds ? "up" : "down"
    },
    {
      id: "tasks",
      icon: "check",
      tone: "violet",
      label: "Tasks completed",
      value: String(completedTasks),
      detail: `${completionRate}% on time`,
      delta: formatPercentDelta(completedTasks, priorCompletedTasks),
      direction: completedTasks >= priorCompletedTasks ? "up" : "down"
    },
    {
      id: "completion-rate",
      icon: "rate",
      tone: "green",
      label: "Completion rate",
      value: `${completionRate}%`,
      detail: `${monthlyTaskSummary.completedOnTimeCount} on-time tasks`,
      delta: formatCountDelta(completionRate, priorCompletionRate, "pts"),
      direction: completionRate >= priorCompletionRate ? "up" : "down"
    },
    {
      id: "break-time",
      icon: "break",
      tone: "amber",
      label: "Break time",
      value: formatMetricDuration(breakSeconds),
      detail: "Healthy pacing",
      delta: formatPercentDelta(breakSeconds, priorBreakSeconds),
      direction: breakSeconds >= priorBreakSeconds ? "up" : "down"
    },
    {
      id: "streak",
      icon: "flame",
      tone: "cyan",
      label: "Streak",
      value: `${currentStreak}`,
      detail: `Best: ${bestStreak} days`,
      delta: formatCountDelta(currentStreak, priorStreak, "days"),
      direction: currentStreak >= priorStreak ? "up" : "down"
    },
    {
      id: "overdue",
      icon: "warning",
      tone: "red",
      label: "Overdue tasks",
      value: String(monthlyTaskSummary.behindScheduleCount),
      detail:
        monthlyTaskSummary.behindScheduleCount < priorMonthlyTaskSummary.behindScheduleCount
          ? `${priorMonthlyTaskSummary.behindScheduleCount - monthlyTaskSummary.behindScheduleCount} improved this month`
          : `${monthlyTaskSummary.behindScheduleCount - priorMonthlyTaskSummary.behindScheduleCount} added this month`,
      delta: formatCountDelta(
        monthlyTaskSummary.behindScheduleCount,
        priorMonthlyTaskSummary.behindScheduleCount,
        "tasks"
      ),
      direction:
        monthlyTaskSummary.behindScheduleCount <= priorMonthlyTaskSummary.behindScheduleCount
          ? "up"
          : "down"
    }
  ];
  const focusMinutesSeries = trendData.map((point) => point.focusMinutes);
  const breakMinutesSeries = trendData.map((point) => point.breakMinutes);
  const pomodoroSeries = trendData.map((point) => point.pomodoros);
  const leftAxisMax = Math.max(60, ...focusMinutesSeries, ...breakMinutesSeries);
  const rightAxisMax = Math.max(1, ...pomodoroSeries);
  const chartPadding = {
    top: 24,
    right: 52,
    bottom: 32,
    left: 48
  };
  const chartWidth = 980;
  const chartHeight = 300;
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
  const selectedTrendPoint =
    trendData.find((point) => point.day === selectedTrendDay) ?? trendData[0] ?? null;
  const selectedTrendIndex = selectedTrendPoint ? trendData.indexOf(selectedTrendPoint) : 0;
  const usableWidth = chartWidth - chartPadding.left - chartPadding.right;
  const usableHeight = chartHeight - chartPadding.top - chartPadding.bottom;
  const selectedTrendX =
    chartPadding.left + (usableWidth * selectedTrendIndex) / Math.max(trendData.length - 1, 1);
  const selectedTrendFocusY =
    selectedTrendPoint === null
      ? chartPadding.top
      : chartPadding.top +
        usableHeight -
        (selectedTrendPoint.focusMinutes / Math.max(leftAxisMax, 1)) * usableHeight;
  const monthActivityDays = calendarDays.filter((day) => day.isCurrentMonth);
  const maxPomodoros = Math.max(1, ...monthActivityDays.map((day) => day.completedPomodoros));
  const insights = buildInsights(visibleMonth, trendData, monthSessions, priorMonthSessions);
  const totalHealth = Math.max(monthlyTaskSummary.taskCount, 1);
  const onTimePercent = Math.round((monthlyTaskSummary.completedOnTimeCount / totalHealth) * 100);
  const behindPercent = Math.round((monthlyTaskSummary.behindScheduleCount / totalHealth) * 100);
  const overduePercent = Math.round((monthlyTaskSummary.completedLateCount / totalHealth) * 100);
  const notStartedPercent = Math.max(0, 100 - onTimePercent - behindPercent - overduePercent);
  const donutStyle = {
    "--on-time-deg": `${onTimePercent * 3.6}deg`,
    "--behind-deg": `${(onTimePercent + behindPercent) * 3.6}deg`,
    "--overdue-deg": `${(onTimePercent + behindPercent + overduePercent) * 3.6}deg`
  } as CSSProperties;

  const chartSection = (
    <section className="report-panel report-trends-panel">
      <div className="report-section-header">
        <div>
          <h2>Monthly Trends</h2>
          <p>Daily overview of your focus, pomodoros, and break time.</p>
        </div>
        <div className="report-graph-legend">
          <div className="report-graph-legend-item report-graph-legend-item--focus">
            <span className="report-graph-dot" />
            <strong>Focus time</strong>
          </div>
          <div className="report-graph-legend-item report-graph-legend-item--pomodoros">
            <span className="report-graph-dot" />
            <strong>Pomodoros</strong>
          </div>
          <div className="report-graph-legend-item report-graph-legend-item--breaks">
            <span className="report-graph-dot" />
            <strong>Break time</strong>
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
            const leftAxisValue = Math.round((leftAxisMax - (leftAxisMax * index) / 4) / 60);
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
                  {leftAxisValue}h
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
            const x =
              chartPadding.left +
              (usableWidth * index) / Math.max(trendData.length - 1, 1);
            const shouldLabel = point.day === 1 || point.day === trendData.length || point.day % 5 === 0;

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

          {selectedTrendPoint ? (
            <g>
              <line
                className="report-trend-highlight-line"
                x1={selectedTrendX}
                x2={selectedTrendX}
                y1={chartPadding.top}
                y2={chartHeight - chartPadding.bottom}
              />
              <foreignObject
                className="report-trend-tooltip-wrap"
                height="88"
                width="170"
                x={Math.min(selectedTrendX + 16, chartWidth - 220)}
                y={Math.max(8, selectedTrendFocusY - 74)}
              >
                <div className="report-trend-tooltip">
                  <strong>
                    {visibleMonth.toLocaleDateString(undefined, { month: "short" })}{" "}
                    {selectedTrendPoint.day}
                  </strong>
                  <span>Focus time {formatMinutesDuration(selectedTrendPoint.focusMinutes)}</span>
                  <span>Pomodoros {selectedTrendPoint.pomodoros}</span>
                  <span>Break time {formatMinutesDuration(selectedTrendPoint.breakMinutes)}</span>
                </div>
              </foreignObject>
            </g>
          ) : null}

          <path className="report-trend-line report-trend-line--focus" d={focusPath} />
          <path className="report-trend-line report-trend-line--pomodoros" d={pomodoroPath} />
          <path className="report-trend-line report-trend-line--breaks" d={breakPath} />

          {trendData.map((point, index) => {
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
              <g key={`point-${point.day}`} onMouseEnter={() => setSelectedTrendDay(point.day)}>
                <circle className="report-trend-point report-trend-point--focus" cx={x} cy={focusY} r="4" />
                <circle className="report-trend-point report-trend-point--pomodoros" cx={x} cy={pomodoroY} r="4" />
                <circle className="report-trend-point report-trend-point--breaks" cx={x} cy={breakY} r="4" />
                <rect
                  className="report-trend-hit-area"
                  height={chartHeight - chartPadding.top - chartPadding.bottom}
                  width={usableWidth / Math.max(trendData.length, 1)}
                  x={x - usableWidth / Math.max(trendData.length, 1) / 2}
                  y={chartPadding.top}
                />
              </g>
            );
          })}
        </svg>
      </div>
    </section>
  );

  return (
    <section className="report-shell">
      <div className="report-controls-row">
        <div className="report-calendar-nav report-calendar-nav--month">
          <button className="report-month-button" type="button">
            <ReportIcon name="calendar" />
            <span>{formatMonthLabel(visibleMonth)}</span>
          </button>
          <button
            aria-label="Previous month"
            className="report-arrow-button"
            onClick={() => {
              setVisibleMonth((current) => addMonths(current, -1));
              setSelectedTrendDay(1);
            }}
            type="button"
          >
            &lt;
          </button>
          <button
            aria-label="Next month"
            className="report-arrow-button"
            onClick={() => {
              setVisibleMonth((current) => addMonths(current, 1));
              setSelectedTrendDay(1);
            }}
            type="button"
          >
            &gt;
          </button>
        </div>

        <div className="report-segmented" role="tablist" aria-label="Report view">
          {(["overview", "calendar", "trends"] as const).map((mode) => (
            <button
              aria-selected={viewMode === mode}
              className={`report-segmented-button${viewMode === mode ? " is-active" : ""}`}
              key={mode}
              onClick={() => setViewMode(mode)}
              role="tab"
              type="button"
            >
              {mode[0]?.toUpperCase()}{mode.slice(1)}
            </button>
          ))}
        </div>

        <button className="report-range-button" type="button">
          This month
          <span aria-hidden="true">v</span>
        </button>
      </div>

      <div className="report-summary-grid">
        {summaryCards.map((card) => (
          <article
            className={`report-summary-card report-summary-card--${card.tone}`}
            key={card.id}
          >
            <div className="report-summary-accent" />
            <span className="report-summary-icon">
              <ReportIcon name={card.icon} />
            </span>
            <div className="report-summary-copy">
              <span className="report-summary-label">{card.label}</span>
              <strong className="report-summary-value">{card.value}</strong>
              <span className="report-summary-detail">{card.detail}</span>
              <span className={`report-summary-delta report-summary-delta--${card.direction}`}>
                {card.delta}
              </span>
            </div>
          </article>
        ))}
      </div>

      {viewMode === "calendar" ? (
        <section className="report-panel report-calendar-panel">
          <div className="report-section-header">
            <div>
              <h2>Monthly Calendar</h2>
              <p>Track due dates, completed tasks, and finished pomodoros across the month.</p>
            </div>
          </div>
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
                      <span className={`report-pomodoro-pill${day.completedPomodoros > 0 ? " is-active" : ""}`}>
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
                              <CollectionBadge color={getTaskBadgeColor(task)} compact name={task.title} />
                            </button>
                          ))}
                          {day.dueTasks.length > 2 ? (
                            <span className="report-calendar-more">+{day.dueTasks.length - 2} more</span>
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
                              <CollectionBadge color={getTaskBadgeColor(task)} compact name={task.title} />
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            ))}
          </div>
        </section>
      ) : viewMode === "trends" ? (
        chartSection
      ) : (
        <>
          <div className="report-main-grid">
            {chartSection}

            <section className="report-panel report-performance-panel">
              <div className="report-section-header">
                <div>
                  <h2>Performance Snapshot</h2>
                  <p>Task outcomes for this month.</p>
                </div>
              </div>

              <div className="report-snapshot-grid">
                <article className="report-snapshot-card report-snapshot-card--blue">
                  <span>Tasks this month</span>
                  <strong>{monthlyTaskSummary.taskCount}</strong>
                  <em>{formatPercentDelta(monthlyTaskSummary.taskCount, priorMonthlyTaskSummary.taskCount)}</em>
                </article>
                <article className="report-snapshot-card report-snapshot-card--green">
                  <span>Completed on time</span>
                  <strong>{monthlyTaskSummary.completedOnTimeCount}</strong>
                  <em>{formatPercentDelta(monthlyTaskSummary.completedOnTimeCount, priorMonthlyTaskSummary.completedOnTimeCount)}</em>
                </article>
                <article className="report-snapshot-card report-snapshot-card--amber">
                  <span>Overdue days passed</span>
                  <strong>{monthlyTaskSummary.overdueDaysTotal} days</strong>
                  <em>{formatPercentDelta(monthlyTaskSummary.overdueDaysTotal, priorMonthlyTaskSummary.overdueDaysTotal)}</em>
                </article>
                <button
                  className="report-snapshot-card report-snapshot-card--red"
                  onClick={() => setBehindScheduleDetails(behindScheduleTasks)}
                  type="button"
                >
                  <span>Behind schedule</span>
                  <strong>{monthlyTaskSummary.behindScheduleCount} tasks</strong>
                  <em>{formatCountDelta(monthlyTaskSummary.behindScheduleCount, priorMonthlyTaskSummary.behindScheduleCount, "tasks")}</em>
                </button>
              </div>

              <div className="report-health-card">
                <h3>Task health</h3>
                <div className="report-health-content">
                  <div className="report-health-donut" style={donutStyle}>
                    <strong>{monthlyTaskSummary.taskCount}</strong>
                    <span>Total tasks</span>
                  </div>
                  <div className="report-health-list">
                    {[
                      ["On time", monthlyTaskSummary.completedOnTimeCount, onTimePercent, "green"],
                      ["Behind schedule", monthlyTaskSummary.behindScheduleCount, behindPercent, "red"],
                      ["Overdue", monthlyTaskSummary.completedLateCount, overduePercent, "amber"],
                      ["Not started", monthlyTaskSummary.notStartedCount, notStartedPercent, "muted"]
                    ].map(([label, value, percent, tone]) => (
                      <div className={`report-health-row report-health-row--${tone}`} key={String(label)}>
                        <span>{label}</span>
                        <div className="report-health-bar">
                          <i style={{ width: `${percent}%` }} />
                        </div>
                        <strong>
                          {value} ({percent}%)
                        </strong>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </div>

          <div className="report-lower-grid">
            <section className="report-panel report-activity-panel">
              <div className="report-activity-header">
                <div className="report-section-header">
                  <div>
                    <h2>Activity Calendar</h2>
                    <p>Daily activity intensity based on focus time.</p>
                  </div>
                </div>
                <div className="report-activity-month">
                  <strong>{formatMonthLabel(visibleMonth)}</strong>
                  <button
                    aria-label="Previous month"
                    className="report-arrow-button"
                    onClick={() => setVisibleMonth((current) => addMonths(current, -1))}
                    type="button"
                  >
                    &lt;
                  </button>
                  <button
                    aria-label="Next month"
                    className="report-arrow-button"
                    onClick={() => setVisibleMonth((current) => addMonths(current, 1))}
                    type="button"
                  >
                    &gt;
                  </button>
                </div>
              </div>

              <div className="report-activity-body">
                <div className="report-activity-legend">
                  {[
                    ["High activity", 3],
                    ["Medium activity", 2],
                    ["Low activity", 1],
                    ["No activity", 0]
                  ].map(([label, intensity]) => (
                    <span className={`report-activity-legend-item intensity-${intensity}`} key={String(label)}>
                      <i />
                      {label}
                    </span>
                  ))}
                </div>

                <div className="report-heatmap" style={{ "--day-count": getDaysInMonth(visibleMonth) } as CSSProperties}>
                  <div className="report-heatmap-day-header" />
                  {Array.from({ length: getDaysInMonth(visibleMonth) }, (_, index) => (
                    <span className="report-heatmap-day-number" key={`header-${index + 1}`}>
                      {index + 1}
                    </span>
                  ))}
                  {weekdayLabels.map((weekday, weekdayIndex) => (
                    <div className="report-heatmap-row" key={weekday}>
                      <span className="report-heatmap-weekday">{weekday.toUpperCase()}</span>
                      {monthActivityDays.map((day) => {
                        const intensity = getActivityIntensity(day.completedPomodoros, maxPomodoros);
                        const isActiveWeekday = day.date.getDay() === weekdayIndex;

                        return (
                          <button
                            aria-label={`${day.date.toLocaleDateString()} activity`}
                            className={[
                              "report-heatmap-cell",
                              `intensity-${isActiveWeekday ? intensity : "empty"}`,
                              day.isToday && isActiveWeekday ? "is-today" : ""
                            ].join(" ")}
                            disabled={!isActiveWeekday}
                            key={`${weekday}-${day.key}`}
                            onClick={() => setSelectedCalendarDay(day)}
                            type="button"
                          >
                            {isActiveWeekday && day.completedPomodoros > 0 ? (
                              <span>{day.completedPomodoros}</span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <aside className="report-panel report-insights-panel">
              <div className="report-insights-title">
                <ReportIcon name="rate" />
                <h2>Insights</h2>
              </div>
              <div className="report-insight-list">
                {insights.map((insight) => (
                  <article className={`report-insight-card report-insight-card--${insight.tone}`} key={insight.id}>
                    <div>
                      <span>{insight.label}</span>
                      <strong>{insight.value}</strong>
                      <p>{insight.detail}</p>
                    </div>
                    <span className="report-insight-icon">
                      <ReportIcon name={insight.icon} />
                    </span>
                  </article>
                ))}
              </div>
              <button className="report-analytics-button" type="button">
                View full analytics
                <ReportIcon name="external" />
              </button>
            </aside>
          </div>
        </>
      )}

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

      {behindScheduleDetails ? (
        <div
          className="modal-overlay"
          onClick={() => setBehindScheduleDetails(null)}
          role="presentation"
        >
          <div
            className="modal-card panel-card report-day-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Behind schedule tasks"
          >
            <div className="details-title">
              <div>
                <h3>Behind Schedule</h3>
                <p>
                  {formatMonthLabel(visibleMonth)} - {behindScheduleDetails.length} overdue task
                  {behindScheduleDetails.length === 1 ? "" : "s"}
                </p>
              </div>
              <button
                className="ghost-button"
                onClick={() => setBehindScheduleDetails(null)}
                type="button"
              >
                Close
              </button>
            </div>

            {behindScheduleDetails.length > 0 ? (
              <div className="report-day-modal-list">
                {behindScheduleDetails.map((task) => (
                  <button
                    className="report-day-modal-item"
                    key={`behind-${task.id}`}
                    onClick={() => {
                      if (task.taskId) {
                        onOpenTask(task.taskId, task.completedAt ? "completed" : "default");
                      }
                    }}
                    type="button"
                  >
                    <CollectionBadge color={getTaskBadgeColor(task)} compact name={task.title} />
                    <span className="report-day-modal-meta">
                      Due {task.estimatedCompletionDate ?? "Unplanned"}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="empty-state">No overdue tasks in this month.</div>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
};
