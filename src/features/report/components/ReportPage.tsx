import { type CSSProperties, useEffect, useMemo, useState } from "react";
import { CollectionBadge } from "../../tasks/components/CollectionBadge";
import type { ArchivedCompletedTask } from "../domain/report-history.types";
import type { TaskCollection } from "../../tasks/domain/task-collection.types";
import {
  getTaskCompletionDate,
  getTaskDueDate,
  getTaskOverdueDays,
  isTaskCompletedOnTime,
  isTaskOverdue
} from "../../tasks/domain/task-deadline";
import type { Task, TaskId, TaskPriority } from "../../tasks/domain/task.types";
import type {
  AiWorkRecord,
  BreakRecord,
  InterruptionRecord,
  PomodoroSession,
  ProcrastinationRecord
} from "../../pomodoro/domain/pomodoro.types";

export type ReportViewMode = "overview" | "calendar" | "trends";

interface ReportPageProps {
  tasks: Task[];
  archivedCompletedTasks: ArchivedCompletedTask[];
  taskCollections: TaskCollection[];
  pomodoroSessions: PomodoroSession[];
  archivedPomodoroSessions: PomodoroSession[];
  breakRecords: BreakRecord[];
  archivedBreakRecords: BreakRecord[];
  procrastinationRecords: ProcrastinationRecord[];
  archivedProcrastinationRecords: ProcrastinationRecord[];
  interruptionRecords: InterruptionRecord[];
  archivedInterruptionRecords: InterruptionRecord[];
  aiWorkRecords: AiWorkRecord[];
  archivedAiWorkRecords: AiWorkRecord[];
  initialViewMode?: ReportViewMode;
  onOpenTask: (taskId: Task["id"], intentMode: "default" | "completed") => void;
}

type ReportIconName =
  | "clock"
  | "check"
  | "rate"
  | "break"
  | "flame"
  | "warning"
  | "calendar"
  | "procrastination"
  | "interruption"
  | "external";
type MetricDirection = "up" | "down" | "neutral";
type ReportRangeMode =
  | "month"
  | "quarter"
  | "year-to-date"
  | "year"
  | "custom";
type TrendGranularity = "day" | "month";

interface DateRange {
  start: Date;
  endExclusive: Date;
}

interface ReportLogFilter {
  range: DateRange;
  label: string;
}

interface SummaryCardMetric {
  id: string;
  icon: ReportIconName;
  tone: "blue" | "violet" | "green" | "amber" | "orange" | "cyan" | "red";
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

interface CalendarMonthData {
  key: string;
  month: Date;
  days: CalendarDayData[];
  weeks: CalendarDayData[][];
}

interface TrendPoint {
  index: number;
  key: string;
  label: string;
  tooltipLabel: string;
  start: Date;
  endExclusive: Date;
  focusMinutes: number;
  breakMinutes: number;
  procrastinationMinutes: number;
  interruptionMinutes: number;
  pomodoros: number;
}

interface MonthlyTaskSummary {
  taskCount: number;
  completedCount: number;
  completedOnTimeCount: number;
  overdueDaysTotal: number;
  openOverdueCount: number;
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

interface StudyProblemReportItem {
  id: string;
  taskId: TaskId;
  title: string;
  platform: string;
  difficulty: Task["studyDifficulty"];
  topic: string;
  status: Task["studyStatus"];
  timesCompleted: number;
  totalTrackedSeconds: number;
  isArchived: boolean;
}

interface StudyProblemRangeItem extends StudyProblemReportItem {
  rangeTrackedSeconds: number;
  sessionCount: number;
}

interface ActivityInsight {
  id: string;
  icon: ReportIconName;
  label: string;
  value: string;
  detail: string;
  tone: "violet" | "blue" | "green" | "orange" | "red";
}

interface ProcrastinationReportEntry {
  id: string;
  taskTitle: string;
  dateLabel: string;
  timeLabel: string;
  durationSeconds: number;
  note: string;
  startedAt: string;
}

interface InterruptionReportEntry {
  id: string;
  taskTitle: string;
  dateLabel: string;
  timeLabel: string;
  durationSeconds: number;
  reason: string;
  startedAt: string;
}

interface TrendDetailCard {
  id: string;
  label: string;
  value: string;
  detail: string;
  tone: "blue" | "orange" | "red" | "violet";
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
    case "procrastination":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M8 3h8" />
          <path d="M8 21h8" />
          <path d="M9 3c0 4 6 5 6 9s-6 5-6 9" />
          <path d="M15 3c0 4-6 5-6 9s6 5 6 9" />
          <path d="M10 17h4" />
        </svg>
      );
    case "interruption":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M12 3v5" />
          <path d="M12 16v5" />
          <path d="M3 12h5" />
          <path d="M16 12h5" />
          <path d="m5.6 5.6 3.5 3.5" />
          <path d="m14.9 14.9 3.5 3.5" />
          <path d="m18.4 5.6-3.5 3.5" />
          <path d="m9.1 14.9-3.5 3.5" />
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

const startOfYear = (value: Date): Date => new Date(value.getFullYear(), 0, 1);

const addYears = (value: Date, delta: number): Date =>
  new Date(value.getFullYear() + delta, value.getMonth(), 1);

const shiftDateByYears = (value: Date, delta: number): Date =>
  new Date(value.getFullYear() + delta, value.getMonth(), value.getDate());

const addDays = (value: Date, delta: number): Date => {
  const nextDate = new Date(value);
  nextDate.setDate(nextDate.getDate() + delta);

  return nextDate;
};

const startOfQuarter = (value: Date): Date => {
  const quarterStartMonth = Math.floor(value.getMonth() / 3) * 3;

  return new Date(value.getFullYear(), quarterStartMonth, 1);
};

const getDaysInMonth = (value: Date): number =>
  new Date(value.getFullYear(), value.getMonth() + 1, 0).getDate();

const getMonthEndExclusive = (value: Date): Date =>
  new Date(value.getFullYear(), value.getMonth() + 1, 1);

const getYearEndExclusive = (value: Date): Date => new Date(value.getFullYear() + 1, 0, 1);

const getQuarterEndExclusive = (value: Date): Date => addMonths(startOfQuarter(value), 3);

const getYearToDateEndExclusive = (anchor: Date, referenceDate: Date): Date =>
  addDays(
    startOfDay(new Date(anchor.getFullYear(), referenceDate.getMonth(), referenceDate.getDate())),
    1
  );

const minDate = (left: Date, right: Date): Date =>
  new Date(Math.min(left.getTime(), right.getTime()));

const maxDate = (left: Date, right: Date): Date =>
  new Date(Math.max(left.getTime(), right.getTime()));

const getRangeDayCount = (range: DateRange): number =>
  Math.max(1, Math.round((range.endExclusive.getTime() - range.start.getTime()) / 86400000));

const getPriorRange = (range: DateRange, mode: ReportRangeMode): DateRange => {
  if (mode === "month") {
    const start = addMonths(range.start, -1);

    return {
      start,
      endExclusive: getMonthEndExclusive(start)
    };
  }

  if (mode === "quarter") {
    const start = addMonths(range.start, -3);

    return {
      start,
      endExclusive: getQuarterEndExclusive(start)
    };
  }

  if (mode === "year") {
    const start = startOfYear(addYears(range.start, -1));

    return {
      start,
      endExclusive: getYearEndExclusive(start)
    };
  }

  if (mode === "year-to-date") {
    return {
      start: shiftDateByYears(range.start, -1),
      endExclusive: shiftDateByYears(range.endExclusive, -1)
    };
  }

  const dayCount = getRangeDayCount(range);
  const endExclusive = new Date(range.start);

  return {
    start: addDays(range.start, -dayCount),
    endExclusive
  };
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

const formatMinutesDuration = (minutes: number): string => formatMetricDuration(minutes * 60);

const formatAxisDuration = (minutes: number): string =>
  minutes === 0 ? "0m" : formatMinutesDuration(minutes);

const formatMonthLabel = (value: Date): string =>
  value.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric"
  });

const formatDateLabel = (value: Date): string =>
  value.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });

const formatRangeLabel = (range: DateRange, mode: ReportRangeMode): string => {
  if (mode === "month") {
    return formatMonthLabel(range.start);
  }

  if (mode === "year") {
    return String(range.start.getFullYear());
  }

  if (mode === "quarter") {
    return `Q${Math.floor(range.start.getMonth() / 3) + 1} ${range.start.getFullYear()}`;
  }

  if (mode === "year-to-date") {
    return `${range.start.getFullYear()} YTD`;
  }

  const endInclusive = addDays(range.endExclusive, -1);

  if (toLocalDateKey(range.start) === toLocalDateKey(endInclusive)) {
    return formatDateLabel(range.start);
  }

  return `${formatDateLabel(range.start)} - ${formatDateLabel(endInclusive)}`;
};

const formatDateInputValue = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const dateFromInputValue = (value: string): Date | null => {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T00:00:00`);

  return Number.isNaN(date.getTime()) ? null : date;
};

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

const isInDateRange = (value: string, range: DateRange): boolean => {
  const date = new Date(value);

  return date >= range.start && date < range.endExclusive;
};

const isDateInRange = (value: Date, range: DateRange): boolean =>
  value >= range.start && value < range.endExclusive;

const getPercentDelta = (current: number, previous: number): number => {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }

  return Math.round(((current - previous) / previous) * 100);
};

const getDeltaDirection = (
  current: number,
  previous: number,
  isLowerBetter = false
): MetricDirection => {
  if (current === previous) {
    return "neutral";
  }

  const movedUp = current > previous;

  return movedUp === !isLowerBetter ? "up" : "down";
};

const formatPercentDelta = (
  current: number,
  previous: number,
  comparisonLabel = "previous period"
): string => {
  const delta = Math.abs(getPercentDelta(current, previous));

  if (delta === 0) {
    return `No change from ${comparisonLabel}`;
  }

  return `${current > previous ? "Up" : "Down"} ${delta}% from ${comparisonLabel}`;
};

const formatCountDelta = (
  current: number,
  previous: number,
  unit: string,
  comparisonLabel = "previous period"
): string => {
  const delta = Math.abs(current - previous);

  if (delta === 0) {
    return `No change from ${comparisonLabel}`;
  }

  return `${current > previous ? "Up" : "Down"} ${delta} ${unit} from ${comparisonLabel}`;
};

const formatDurationDelta = (
  current: number,
  previous: number,
  comparisonLabel = "previous period"
): string => {
  const delta = Math.abs(current - previous);

  if (delta === 0) {
    return `No change from ${comparisonLabel}`;
  }

  return `${current > previous ? "Up" : "Down"} ${formatMetricDuration(delta)} from ${comparisonLabel}`;
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

const getCalendarMonthsInRange = (
  range: DateRange,
  activeTasks: ReportTaskItem[],
  completedTasks: ReportTaskItem[],
  pomodoroSessions: PomodoroSession[]
): CalendarMonthData[] => {
  const months: CalendarMonthData[] = [];
  const endMonth = startOfMonth(addDays(range.endExclusive, -1));
  let cursor = startOfMonth(range.start);

  while (cursor <= endMonth) {
    const month = new Date(cursor);
    const days = getCalendarDays(month, activeTasks, completedTasks, pomodoroSessions);

    months.push({
      key: `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`,
      month,
      days,
      weeks: groupCalendarWeeks(days)
    });

    cursor = addMonths(cursor, 1);
  }

  return months;
};

const getTrendGranularity = (range: DateRange): TrendGranularity =>
  getRangeDayCount(range) > 92 ? "month" : "day";

const getTrendBucketKey = (value: Date, granularity: TrendGranularity): string =>
  granularity === "month"
    ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`
    : toLocalDateKey(value);

const getRangeTrendData = (
  range: DateRange,
  pomodoroSessions: PomodoroSession[],
  breakRecords: BreakRecord[],
  procrastinationRecords: ProcrastinationRecord[],
  interruptionRecords: InterruptionRecord[]
): TrendPoint[] => {
  const granularity = getTrendGranularity(range);
  const totalsByKey = new Map<string, TrendPoint>();
  const cursor =
    granularity === "month" ? startOfMonth(range.start) : startOfDay(range.start);
  let index = 0;

  while (cursor < range.endExclusive) {
    const bucketStart = new Date(cursor);
    const bucketEnd =
      granularity === "month" ? getMonthEndExclusive(bucketStart) : addDays(bucketStart, 1);
    const key = getTrendBucketKey(cursor, granularity);
    totalsByKey.set(key, {
      index,
      key,
      label:
        granularity === "month"
          ? cursor.toLocaleDateString(undefined, { month: "short" })
          : String(cursor.getDate()),
      tooltipLabel:
        granularity === "month"
          ? cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })
          : cursor.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }),
      start: maxDate(bucketStart, range.start),
      endExclusive: minDate(bucketEnd, range.endExclusive),
      focusMinutes: 0,
      breakMinutes: 0,
      procrastinationMinutes: 0,
      interruptionMinutes: 0,
      pomodoros: 0
    });

    index += 1;
    if (granularity === "month") {
      cursor.setMonth(cursor.getMonth() + 1, 1);
    } else {
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  const getPoint = (startedAt: string): TrendPoint | null => {
    if (!isInDateRange(startedAt, range)) {
      return null;
    }

    return totalsByKey.get(getTrendBucketKey(new Date(startedAt), granularity)) ?? null;
  };

  pomodoroSessions.forEach((session) => {
    const point = getPoint(session.startedAt);

    if (!point) {
      return;
    }

    point.focusMinutes = Math.round(point.focusMinutes + session.actualDurationSeconds / 60);

    if (session.status === "completed") {
      point.pomodoros += 1;
    }
  });

  breakRecords.forEach((record) => {
    const point = getPoint(record.startedAt);

    if (!point) {
      return;
    }

    point.breakMinutes = Math.round(point.breakMinutes + record.actualDurationSeconds / 60);
  });

  procrastinationRecords.forEach((record) => {
    const point = getPoint(record.startedAt);

    if (!point) {
      return;
    }

    point.procrastinationMinutes = Math.round(
      point.procrastinationMinutes + record.actualDurationSeconds / 60
    );
  });

  interruptionRecords.forEach((record) => {
    const point = getPoint(record.startedAt);

    if (!point) {
      return;
    }

    point.interruptionMinutes = Math.round(
      point.interruptionMinutes + record.actualDurationSeconds / 60
    );
  });

  return Array.from(totalsByKey.values());
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

const mergeUniqueTasks = (...taskGroups: ReportTaskItem[][]): ReportTaskItem[] => {
  const mergedTasks = new Map<string, ReportTaskItem>();

  taskGroups.flat().forEach((task) => {
    mergedTasks.set(task.id, task);
  });

  return Array.from(mergedTasks.values());
};

const isTaskScheduledInRange = (task: ReportTaskItem, range: DateRange): boolean => {
  const dueDate = getTaskDueDate(task);

  return dueDate !== null && dueDate >= range.start && dueDate < range.endExclusive;
};

const wasTaskLateDuringRange = (
  task: ReportTaskItem,
  range: DateRange,
  referenceDate: Date
): boolean => {
  const dueDate = getTaskDueDate(task);

  if (!dueDate) {
    return false;
  }

  if (dueDate >= range.endExclusive) {
    return false;
  }

  const completionDate = getTaskCompletionDate(task);

  if (completionDate) {
    return completionDate > dueDate && completionDate >= range.start;
  }

  return referenceDate >= range.start && referenceDate > dueDate;
};

const buildTaskSummaryForRange = (
  tasks: ReportTaskItem[],
  range: DateRange,
  referenceDate: Date
): MonthlyTaskSummary => {
  const rangeTasks = tasks.filter((task) => isTaskScheduledInRange(task, range));
  const lateTasksInRange = tasks.filter((task) => wasTaskLateDuringRange(task, range, referenceDate));
  const openOverdueTasks = lateTasksInRange.filter((task) => task.completedAt === null);
  const completedLateTasks = lateTasksInRange.filter((task) => task.completedAt !== null);
  const reportableTasks = mergeUniqueTasks(rangeTasks, openOverdueTasks, completedLateTasks);
  const completedTasks = reportableTasks.filter((task) => task.completedAt !== null);

  return {
    taskCount: reportableTasks.length,
    completedCount: completedTasks.length,
    completedOnTimeCount: completedTasks.filter((task) => isTaskCompletedOnTime(task)).length,
    overdueDaysTotal: lateTasksInRange.reduce(
      (sum, task) => sum + getTaskOverdueDays(task, referenceDate),
      0
    ),
    openOverdueCount: openOverdueTasks.length,
    completedLateCount: completedLateTasks.length,
    notStartedCount: reportableTasks.filter((task) => task.completedAt === null && !isTaskOverdue(task, referenceDate)).length
  };
};

const buildStudyProblemItems = (
  tasks: Task[],
  archivedCompletedTasks: ArchivedCompletedTask[]
): StudyProblemReportItem[] => [
  ...tasks
    .filter((task) => task.isStudyProblem)
    .map((task) => ({
      id: task.id,
      taskId: task.id,
      title: task.title,
      platform: task.studyPlatform,
      difficulty: task.studyDifficulty,
      topic: task.studyTopic,
      status: task.studyStatus,
      timesCompleted: task.timesCompleted,
      totalTrackedSeconds: task.actualTrackedSeconds,
      isArchived: false
    })),
  ...archivedCompletedTasks
    .filter((task) => task.isStudyProblem)
    .map((task) => ({
      id: task.id,
      taskId: task.originalTaskId,
      title: task.title,
      platform: task.studyPlatform,
      difficulty: task.studyDifficulty,
      topic: task.studyTopic,
      status: task.studyStatus,
      timesCompleted: task.timesCompleted,
      totalTrackedSeconds: task.actualTrackedSeconds,
      isArchived: true
    }))
];

const buildStudyProblemRangeItems = (
  studyProblems: StudyProblemReportItem[],
  pomodoroSessions: PomodoroSession[],
  range: DateRange
): StudyProblemRangeItem[] => {
  const sessionTotalsByTaskId = new Map<TaskId, { seconds: number; sessions: number }>();

  pomodoroSessions
    .filter((session) => isInDateRange(session.startedAt, range))
    .forEach((session) => {
      const current = sessionTotalsByTaskId.get(session.taskId) ?? {
        seconds: 0,
        sessions: 0
      };

      sessionTotalsByTaskId.set(session.taskId, {
        seconds: current.seconds + session.actualDurationSeconds,
        sessions: current.sessions + 1
      });
    });

  return studyProblems
    .map((problem) => {
      const rangeTotals = sessionTotalsByTaskId.get(problem.taskId) ?? {
        seconds: 0,
        sessions: 0
      };

      return {
        ...problem,
        rangeTrackedSeconds: rangeTotals.seconds,
        sessionCount: rangeTotals.sessions
      };
    })
    .sort((left, right) => {
      if (left.rangeTrackedSeconds !== right.rangeTrackedSeconds) {
        return right.rangeTrackedSeconds - left.rangeTrackedSeconds;
      }

      return left.title.localeCompare(right.title);
    });
};

const countCompletedTasksInRange = (tasks: ReportTaskItem[], range: DateRange): number =>
  tasks.filter((task) => task.completedAt !== null && isInDateRange(task.completedAt, range)).length;

const sumFocusSecondsInRange = (sessions: PomodoroSession[], range: DateRange): number =>
  sessions
    .filter((session) => isInDateRange(session.startedAt, range))
    .reduce((sum, session) => sum + session.actualDurationSeconds, 0);

const countCompletedPomodorosInRange = (sessions: PomodoroSession[], range: DateRange): number =>
  sessions.filter((session) => session.status === "completed" && isInDateRange(session.startedAt, range)).length;

const sumBreakSecondsInRange = (records: BreakRecord[], range: DateRange): number =>
  records
    .filter((record) => isInDateRange(record.startedAt, range))
    .reduce((sum, record) => sum + record.actualDurationSeconds, 0);

const sumProcrastinationSecondsInRange = (
  records: ProcrastinationRecord[],
  range: DateRange
): number =>
  records
    .filter((record) => isInDateRange(record.startedAt, range))
    .reduce((sum, record) => sum + record.actualDurationSeconds, 0);

const sumInterruptionSecondsInRange = (
  records: InterruptionRecord[],
  range: DateRange
): number =>
  records
    .filter((record) => isInDateRange(record.startedAt, range))
    .reduce((sum, record) => sum + record.actualDurationSeconds, 0);

const countProcrastinationRecordsInRange = (
  records: ProcrastinationRecord[],
  range: DateRange
): number => records.filter((record) => isInDateRange(record.startedAt, range)).length;

const countInterruptionRecordsInRange = (
  records: InterruptionRecord[],
  range: DateRange
): number => records.filter((record) => isInDateRange(record.startedAt, range)).length;

const sumRecordsByDay = (
  records: Array<ProcrastinationRecord | InterruptionRecord | AiWorkRecord>,
  range: DateRange
): Map<string, number> => {
  const totals = new Map<string, number>();

  records.forEach((record) => {
    if (!isInDateRange(record.startedAt, range)) {
      return;
    }

    const key = toLocalDateKey(new Date(record.startedAt));
    totals.set(key, (totals.get(key) ?? 0) + Math.round(record.actualDurationSeconds / 60));
  });

  return totals;
};

const getFocusSessionDayKeys = (sessions: PomodoroSession[]): Set<string> => {
  const keys = new Set<string>();

  sessions.forEach((session) => {
    if (session.phaseType === "work" && session.actualDurationSeconds > 0) {
      keys.add(toLocalDateKey(new Date(session.startedAt)));
    }
  });

  return keys;
};

const getCurrentStreak = (sessions: PomodoroSession[], referenceDate: Date): number => {
  const activeDays = getFocusSessionDayKeys(sessions);
  const cursor = startOfDay(referenceDate);
  let streak = 0;

  if (!activeDays.has(toLocalDateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }

  while (activeDays.has(toLocalDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
};

const getBestStreak = (sessions: PomodoroSession[]): number => {
  const sortedKeys = Array.from(getFocusSessionDayKeys(sessions)).sort();
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

const getTimedActivityIntensity = (minutes: number, maxMinutes: number): number => {
  if (minutes === 0) {
    return 0;
  }

  if (maxMinutes <= 1) {
    return 1;
  }

  if (minutes >= Math.ceil(maxMinutes * 0.7)) {
    return 3;
  }

  if (minutes >= Math.ceil(maxMinutes * 0.35)) {
    return 2;
  }

  return 1;
};

const buildInsights = (
  trendData: TrendPoint[],
  monthSessions: PomodoroSession[],
  priorMonthSessions: PomodoroSession[],
  monthlyProcrastinationEntries: ProcrastinationReportEntry[],
  monthlyInterruptionEntries: InterruptionReportEntry[],
  comparisonLabel: string
): ActivityInsight[] => {
  const bestPoint = trendData.reduce<TrendPoint | null>(
    (best, point) => (!best || point.focusMinutes > best.focusMinutes ? point : best),
    null
  );
  const bestActivePoint = bestPoint && bestPoint.focusMinutes > 0 ? bestPoint : null;
  const weekdayTotals = new Map<number, { focusMinutes: number; activeDays: Set<string> }>();
  const workMonthSessions = monthSessions.filter(
    (session) => session.phaseType === "work" && session.actualDurationSeconds > 0
  );
  const workPriorMonthSessions = priorMonthSessions.filter(
    (session) => session.phaseType === "work" && session.actualDurationSeconds > 0
  );

  workMonthSessions.forEach((session) => {
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
  const completedMonthSessions = workMonthSessions.filter((session) => session.status === "completed");
  const completedPriorSessions = workPriorMonthSessions.filter(
    (session) => session.status === "completed"
  );
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
  const totalFocusMinutes = trendData.reduce((sum, point) => sum + point.focusMinutes, 0);
  const totalProcrastinationMinutes = trendData.reduce(
    (sum, point) => sum + point.procrastinationMinutes,
    0
  );
  const totalInterruptionMinutes = trendData.reduce(
    (sum, point) => sum + point.interruptionMinutes,
    0
  );
  const totalDistractionMinutes = totalProcrastinationMinutes + totalInterruptionMinutes;
  const trackedMinutes = totalFocusMinutes + totalDistractionMinutes;
  const distractionShare =
    trackedMinutes > 0 ? Math.round((totalDistractionMinutes / trackedMinutes) * 100) : 0;
  const procrastinationDays = trendData.filter((point) => point.procrastinationMinutes > 0).length;
  const interruptionDays = trendData.filter((point) => point.interruptionMinutes > 0).length;
  const peakProcrastinationPoint = trendData.reduce<TrendPoint | null>(
    (peak, point) =>
      !peak || point.procrastinationMinutes > peak.procrastinationMinutes ? point : peak,
    null
  );
  const peakInterruptionPoint = trendData.reduce<TrendPoint | null>(
    (peak, point) =>
      !peak || point.interruptionMinutes > peak.interruptionMinutes ? point : peak,
    null
  );
  const topProcrastinationPoint =
    peakProcrastinationPoint && peakProcrastinationPoint.procrastinationMinutes > 0
      ? peakProcrastinationPoint
      : null;
  const topInterruptionPoint =
    peakInterruptionPoint && peakInterruptionPoint.interruptionMinutes > 0
      ? peakInterruptionPoint
      : null;

  return [
    {
      id: "best-day",
      icon: "rate",
      label: "Best focus day",
      value: bestActivePoint ? bestActivePoint.tooltipLabel : "No activity",
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
          ? `Flat vs ${comparisonLabel}`
          : `${Math.abs(averageDelta)} min ${averageDelta > 0 ? "longer" : "shorter"} vs ${comparisonLabel}`,
      tone: "green"
    },
    {
      id: "procrastination-load",
      icon: "procrastination",
      label: "Procrastination load",
      value: formatMinutesDuration(totalProcrastinationMinutes),
      detail:
        monthlyProcrastinationEntries.length > 0
          ? `${monthlyProcrastinationEntries.length} entries across ${procrastinationDays} days`
          : "No procrastination logged",
      tone: "orange"
    },
    {
      id: "peak-procrastination-insight",
      icon: "procrastination",
      label: "Peak procrastination",
      value: topProcrastinationPoint ? topProcrastinationPoint.tooltipLabel : "None",
      detail: topProcrastinationPoint
        ? formatMinutesDuration(topProcrastinationPoint.procrastinationMinutes)
        : "No spike in period",
      tone: "orange"
    },
    {
      id: "interruption-load",
      icon: "interruption",
      label: "Interruption load",
      value: formatMinutesDuration(totalInterruptionMinutes),
      detail:
        monthlyInterruptionEntries.length > 0
          ? `${monthlyInterruptionEntries.length} entries across ${interruptionDays} days`
          : "No interruptions logged",
      tone: "red"
    },
    {
      id: "peak-interruption-insight",
      icon: "interruption",
      label: "Peak interruptions",
      value: topInterruptionPoint ? topInterruptionPoint.tooltipLabel : "None",
      detail: topInterruptionPoint
        ? formatMinutesDuration(topInterruptionPoint.interruptionMinutes)
        : "No spike in period",
      tone: "red"
    },
    {
      id: "distraction-mix",
      icon: "warning",
      label: "Distraction mix",
      value: `${distractionShare}%`,
      detail:
        trackedMinutes > 0
          ? `${formatMinutesDuration(totalProcrastinationMinutes)} procrastination / ${formatMinutesDuration(
              totalInterruptionMinutes
            )} interruptions`
          : "Track focus to compare patterns",
      tone: "blue"
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
  procrastinationRecords,
  archivedProcrastinationRecords,
  interruptionRecords,
  archivedInterruptionRecords,
  aiWorkRecords,
  archivedAiWorkRecords,
  initialViewMode = "overview",
  onOpenTask
}: ReportPageProps): JSX.Element => {
  const [visibleMonth, setVisibleMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [rangeMode, setRangeMode] = useState<ReportRangeMode>("month");
  const [customStartValue, setCustomStartValue] = useState<string>(() =>
    formatDateInputValue(startOfMonth(new Date()))
  );
  const [customEndValue, setCustomEndValue] = useState<string>(() =>
    formatDateInputValue(new Date())
  );
  const [viewMode, setViewMode] = useState<ReportViewMode>(initialViewMode);
  const [selectedCalendarDay, setSelectedCalendarDay] =
    useState<CalendarDayData | null>(null);
  const [openOverdueDetails, setOpenOverdueDetails] =
    useState<ReportTaskItem[] | null>(null);
  const [selectedTrendKey, setSelectedTrendKey] = useState<string | null>(null);
  const [logFilter, setLogFilter] = useState<ReportLogFilter | null>(null);

  useEffect(() => {
    setViewMode(initialViewMode);
  }, [initialViewMode]);

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
  const allProcrastinationRecords = useMemo(
    () => [...procrastinationRecords, ...archivedProcrastinationRecords],
    [archivedProcrastinationRecords, procrastinationRecords]
  );
  const allInterruptionRecords = useMemo(
    () => [...interruptionRecords, ...archivedInterruptionRecords],
    [archivedInterruptionRecords, interruptionRecords]
  );
  const allAiWorkRecords = useMemo(
    () => [...aiWorkRecords, ...archivedAiWorkRecords],
    [aiWorkRecords, archivedAiWorkRecords]
  );
  const studyProblems = useMemo(
    () => buildStudyProblemItems(tasks, archivedCompletedTasks),
    [archivedCompletedTasks, tasks]
  );
  const taskTitleById = useMemo(
    () =>
      new Map(
        reportTasks.history.flatMap((task) =>
          task.taskId === null ? [] : ([[task.taskId, task.title]] as const)
        )
      ),
    [reportTasks.history]
  );
  const referenceDate = new Date();
  const customStartDate = dateFromInputValue(customStartValue) ?? startOfMonth(visibleMonth);
  const customEndDate = dateFromInputValue(customEndValue) ?? referenceDate;
  const reportRangeStart =
    customStartDate <= customEndDate ? customStartDate : customEndDate;
  const reportRangeEnd =
    customStartDate <= customEndDate ? customEndDate : customStartDate;
  const reportRange: DateRange = (() => {
    if (rangeMode === "year") {
      return {
        start: startOfYear(visibleMonth),
        endExclusive: getYearEndExclusive(visibleMonth)
      };
    }

    if (rangeMode === "quarter") {
      return {
        start: startOfQuarter(visibleMonth),
        endExclusive: getQuarterEndExclusive(visibleMonth)
      };
    }

    if (rangeMode === "year-to-date") {
      return {
        start: startOfYear(visibleMonth),
        endExclusive: getYearToDateEndExclusive(visibleMonth, referenceDate)
      };
    }

    if (rangeMode === "custom") {
      return {
        start: startOfDay(reportRangeStart),
        endExclusive: addDays(startOfDay(reportRangeEnd), 1)
      };
    }

    return {
      start: startOfMonth(visibleMonth),
      endExclusive: getMonthEndExclusive(visibleMonth)
    };
  })();
  const priorReportRange = getPriorRange(reportRange, rangeMode);
  const reportRangeLabel = formatRangeLabel(reportRange, rangeMode);
  const rangeCopy: Record<
    ReportRangeMode,
    {
      comparisonLabel: string;
      periodNoun: string;
      periodScopeLabel: string;
      periodTaskLabel: string;
    }
  > = {
    month: {
      comparisonLabel: "previous month",
      periodNoun: "month",
      periodScopeLabel: "the selected month",
      periodTaskLabel: "Tasks in selected month"
    },
    quarter: {
      comparisonLabel: "previous quarter",
      periodNoun: "quarter",
      periodScopeLabel: "the selected quarter",
      periodTaskLabel: "Tasks in selected quarter"
    },
    "year-to-date": {
      comparisonLabel: "previous year to date",
      periodNoun: "year-to-date range",
      periodScopeLabel: "the selected year-to-date range",
      periodTaskLabel: "Tasks year to date"
    },
    year: {
      comparisonLabel: "previous year",
      periodNoun: "year",
      periodScopeLabel: "the selected year",
      periodTaskLabel: "Tasks in selected year"
    },
    custom: {
      comparisonLabel: "previous period",
      periodNoun: "range",
      periodScopeLabel: "the selected range",
      periodTaskLabel: "Tasks in range"
    }
  };
  const { comparisonLabel, periodNoun, periodScopeLabel, periodTaskLabel } =
    rangeCopy[rangeMode];
  const periodDescriptor = periodScopeLabel;

  useEffect(() => {
    setSelectedTrendKey(null);
    setOpenOverdueDetails(null);
    setLogFilter(null);
  }, [rangeMode, reportRange.start.getTime(), reportRange.endExclusive.getTime()]);
  const monthlyTaskSummary = useMemo(
    () => buildTaskSummaryForRange(reportTasks.history, reportRange, referenceDate),
    [reportTasks.history, reportRange.start, reportRange.endExclusive]
  );
  const priorMonthlyTaskSummary = useMemo(
    () => buildTaskSummaryForRange(reportTasks.history, priorReportRange, referenceDate),
    [priorReportRange.start, priorReportRange.endExclusive, reportTasks.history]
  );
  const openOverdueTasks = useMemo(
    () =>
      reportTasks.history
        .filter(
          (task) =>
            task.completedAt === null && wasTaskLateDuringRange(task, reportRange, referenceDate)
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
    [reportRange.start, reportRange.endExclusive, reportTasks.history]
  );
  const activeCalendarTasks = useMemo(
    () => reportTasks.active.filter((task) => !task.completedAt),
    [reportTasks.active]
  );
  const completedCalendarTasks = useMemo(
    () => reportTasks.history.filter((task) => task.completedAt !== null),
    [reportTasks.history]
  );
  const reportCalendarMonths = useMemo(
    () =>
      getCalendarMonthsInRange(
        reportRange,
        activeCalendarTasks,
        completedCalendarTasks,
        allPomodoroSessions
      ),
    [
      activeCalendarTasks,
      allPomodoroSessions,
      completedCalendarTasks,
      reportRange.start,
      reportRange.endExclusive
    ]
  );
  const isRangeCalendarView = reportCalendarMonths.length > 1;
  const trendData = useMemo(
    () =>
      getRangeTrendData(
        reportRange,
        allPomodoroSessions,
        allBreakRecords,
        allProcrastinationRecords,
        allInterruptionRecords
      ),
    [
      allBreakRecords,
      allInterruptionRecords,
      allPomodoroSessions,
      allProcrastinationRecords,
      reportRange.start,
      reportRange.endExclusive
    ]
  );
  const monthlyProcrastinationEntries = useMemo<ProcrastinationReportEntry[]>(
    () =>
      allProcrastinationRecords
        .filter((record) => isInDateRange(record.startedAt, reportRange))
        .slice()
        .sort(
          (left, right) =>
            new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime()
        )
        .map((record) => {
          const startedAt = new Date(record.startedAt);

          return {
            id: record.id,
            taskTitle: taskTitleById.get(record.taskId) ?? "Archived task",
            dateLabel: startedAt.toLocaleDateString(undefined, {
              month: "short",
              day: "numeric"
            }),
            timeLabel: startedAt.toLocaleTimeString(undefined, {
              hour: "numeric",
              minute: "2-digit"
            }),
            durationSeconds: record.actualDurationSeconds,
            note: record.note.trim(),
            startedAt: record.startedAt
          };
        }),
    [allProcrastinationRecords, reportRange.start, reportRange.endExclusive, taskTitleById]
  );
  const monthlyInterruptionEntries = useMemo<InterruptionReportEntry[]>(
    () =>
      allInterruptionRecords
        .filter((record) => isInDateRange(record.startedAt, reportRange))
        .slice()
        .sort(
          (left, right) =>
            new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime()
        )
        .map((record) => {
          const startedAt = new Date(record.startedAt);

          return {
            id: record.id,
            taskTitle: taskTitleById.get(record.taskId) ?? "Archived task",
            dateLabel: startedAt.toLocaleDateString(undefined, {
              month: "short",
              day: "numeric"
            }),
            timeLabel: startedAt.toLocaleTimeString(undefined, {
              hour: "numeric",
              minute: "2-digit"
            }),
            durationSeconds: record.actualDurationSeconds,
            reason: record.reason.trim(),
            startedAt: record.startedAt
          };
        }),
    [allInterruptionRecords, reportRange.start, reportRange.endExclusive, taskTitleById]
  );
  const monthSessions = useMemo(
    () => allPomodoroSessions.filter((session) => isInDateRange(session.startedAt, reportRange)),
    [allPomodoroSessions, reportRange.start, reportRange.endExclusive]
  );
  const priorMonthSessions = useMemo(
    () => allPomodoroSessions.filter((session) => isInDateRange(session.startedAt, priorReportRange)),
    [allPomodoroSessions, priorReportRange.start, priorReportRange.endExclusive]
  );
  const studyProblemRangeItems = useMemo(
    () => buildStudyProblemRangeItems(studyProblems, allPomodoroSessions, reportRange),
    [allPomodoroSessions, reportRange.start, reportRange.endExclusive, studyProblems]
  );
  const studiedProblemsInRange = studyProblemRangeItems.filter(
    (problem) => problem.rangeTrackedSeconds > 0
  );
  const studySecondsInRange = studiedProblemsInRange.reduce(
    (sum, problem) => sum + problem.rangeTrackedSeconds,
    0
  );
  const totalStudyCompletions = studyProblems.reduce(
    (sum, problem) => sum + problem.timesCompleted,
    0
  );
  const topStudyProblems = studiedProblemsInRange.slice(0, 5);
  const focusSeconds = sumFocusSecondsInRange(allPomodoroSessions, reportRange);
  const priorFocusSeconds = sumFocusSecondsInRange(allPomodoroSessions, priorReportRange);
  const completedPomodoros = countCompletedPomodorosInRange(allPomodoroSessions, reportRange);
  const completedTasks = countCompletedTasksInRange(reportTasks.history, reportRange);
  const priorCompletedTasks = countCompletedTasksInRange(reportTasks.history, priorReportRange);
  const completionRate =
    monthlyTaskSummary.taskCount > 0
      ? Math.round((monthlyTaskSummary.completedCount / monthlyTaskSummary.taskCount) * 100)
      : 0;
  const priorCompletionRate =
    priorMonthlyTaskSummary.taskCount > 0
      ? Math.round(
          (priorMonthlyTaskSummary.completedCount / priorMonthlyTaskSummary.taskCount) * 100
        )
      : 0;
  const breakSeconds = sumBreakSecondsInRange(allBreakRecords, reportRange);
  const priorBreakSeconds = sumBreakSecondsInRange(allBreakRecords, priorReportRange);
  const procrastinationSeconds = sumProcrastinationSecondsInRange(
    allProcrastinationRecords,
    reportRange
  );
  const priorProcrastinationSeconds = sumProcrastinationSecondsInRange(
    allProcrastinationRecords,
    priorReportRange
  );
  const interruptionSeconds = sumInterruptionSecondsInRange(
    allInterruptionRecords,
    reportRange
  );
  const priorInterruptionSeconds = sumInterruptionSecondsInRange(
    allInterruptionRecords,
    priorReportRange
  );
  const procrastinationEntries = countProcrastinationRecordsInRange(
    allProcrastinationRecords,
    reportRange
  );
  const interruptionEntries = countInterruptionRecordsInRange(
    allInterruptionRecords,
    reportRange
  );
  const currentStreak = getCurrentStreak(allPomodoroSessions, referenceDate);
  const bestStreak = getBestStreak(allPomodoroSessions);
  const priorStreak = getCurrentStreak(
    allPomodoroSessions,
    addDays(priorReportRange.endExclusive, -1)
  );
  const summaryCards: SummaryCardMetric[] = [
    {
      id: "focus-time",
      icon: "clock",
      tone: "blue",
      label: "Focus time",
      value: formatMetricDuration(focusSeconds),
      detail: `${completedPomodoros} pomodoros`,
      delta: formatPercentDelta(focusSeconds, priorFocusSeconds, comparisonLabel),
      direction: getDeltaDirection(focusSeconds, priorFocusSeconds)
    },
    {
      id: "tasks",
      icon: "check",
      tone: "violet",
      label: "Tasks completed",
      value: String(completedTasks),
      detail: `${completionRate}% complete`,
      delta: formatPercentDelta(completedTasks, priorCompletedTasks, comparisonLabel),
      direction: getDeltaDirection(completedTasks, priorCompletedTasks)
    },
    {
      id: "completion-rate",
      icon: "rate",
      tone: "green",
      label: "Completion rate",
      value: `${completionRate}%`,
      detail: `${monthlyTaskSummary.completedCount} of ${monthlyTaskSummary.taskCount} tasks done`,
      delta: formatCountDelta(completionRate, priorCompletionRate, "pts", comparisonLabel),
      direction: getDeltaDirection(completionRate, priorCompletionRate)
    },
    {
      id: "break-time",
      icon: "break",
      tone: "amber",
      label: "Break time",
      value: formatMetricDuration(breakSeconds),
      detail: "Healthy pacing",
      delta: formatPercentDelta(breakSeconds, priorBreakSeconds, comparisonLabel),
      direction: getDeltaDirection(breakSeconds, priorBreakSeconds)
    },
    {
      id: "procrastination",
      icon: "procrastination",
      tone: "orange",
      label: "Time procrastinated",
      value: formatMetricDuration(procrastinationSeconds),
      detail: `${procrastinationEntries} ${procrastinationEntries === 1 ? "entry" : "entries"}`,
      delta: formatDurationDelta(procrastinationSeconds, priorProcrastinationSeconds, comparisonLabel),
      direction: getDeltaDirection(procrastinationSeconds, priorProcrastinationSeconds, true)
    },
    {
      id: "interruptions",
      icon: "interruption",
      tone: "red",
      label: "Interruptions",
      value: formatMetricDuration(interruptionSeconds),
      detail: `${interruptionEntries} ${interruptionEntries === 1 ? "entry" : "entries"}`,
      delta: formatDurationDelta(interruptionSeconds, priorInterruptionSeconds, comparisonLabel),
      direction: getDeltaDirection(interruptionSeconds, priorInterruptionSeconds, true)
    },
    {
      id: "streak",
      icon: "flame",
      tone: "cyan",
      label: "Focus streak",
      value: `${currentStreak}`,
      detail: `Best: ${bestStreak} days`,
      delta: formatCountDelta(currentStreak, priorStreak, "days", comparisonLabel),
      direction: getDeltaDirection(currentStreak, priorStreak)
    },
    {
      id: "overdue",
      icon: "warning",
      tone: "red",
      label: "Open overdue",
      value: String(monthlyTaskSummary.openOverdueCount),
      detail:
        monthlyTaskSummary.openOverdueCount < priorMonthlyTaskSummary.openOverdueCount
          ? `${priorMonthlyTaskSummary.openOverdueCount - monthlyTaskSummary.openOverdueCount} improved in ${periodScopeLabel}`
          : monthlyTaskSummary.openOverdueCount > priorMonthlyTaskSummary.openOverdueCount
            ? `${monthlyTaskSummary.openOverdueCount - priorMonthlyTaskSummary.openOverdueCount} added in ${periodScopeLabel}`
            : `No change in ${periodScopeLabel}`,
      delta: formatCountDelta(
        monthlyTaskSummary.openOverdueCount,
        priorMonthlyTaskSummary.openOverdueCount,
        "tasks",
        comparisonLabel
      ),
      direction: getDeltaDirection(
        monthlyTaskSummary.openOverdueCount,
        priorMonthlyTaskSummary.openOverdueCount,
        true
      )
    }
  ];
  const focusMinutesSeries = trendData.map((point) => point.focusMinutes);
  const breakMinutesSeries = trendData.map((point) => point.breakMinutes);
  const procrastinationMinutesSeries = trendData.map((point) => point.procrastinationMinutes);
  const interruptionMinutesSeries = trendData.map((point) => point.interruptionMinutes);
  const leftAxisMax = Math.max(
    60,
    ...focusMinutesSeries,
    ...breakMinutesSeries,
    ...procrastinationMinutesSeries,
    ...interruptionMinutesSeries
  );
  const chartPadding = {
    top: 24,
    right: 20,
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
  const procrastinationPath = buildLinePath(
    procrastinationMinutesSeries,
    leftAxisMax,
    chartWidth,
    chartHeight,
    chartPadding
  );
  const interruptionPath = buildLinePath(
    interruptionMinutesSeries,
    leftAxisMax,
    chartWidth,
    chartHeight,
    chartPadding
  );
  const selectedTrendPoint =
    trendData.find((point) => point.key === selectedTrendKey) ??
    trendData[Math.min(13, Math.max(trendData.length - 1, 0))] ??
    trendData[0] ??
    null;
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
  const heaviestProcrastinationPoint = trendData.reduce<TrendPoint | null>(
    (heaviest, point) =>
      !heaviest || point.procrastinationMinutes > heaviest.procrastinationMinutes
        ? point
        : heaviest,
    null
  );
  const heaviestInterruptionPoint = trendData.reduce<TrendPoint | null>(
    (heaviest, point) =>
      !heaviest || point.interruptionMinutes > heaviest.interruptionMinutes ? point : heaviest,
    null
  );
  const longestProcrastinationEntry = monthlyProcrastinationEntries.reduce<
    ProcrastinationReportEntry | null
  >(
    (longest, entry) =>
      !longest || entry.durationSeconds > longest.durationSeconds ? entry : longest,
    null
  );
  const longestInterruptionEntry = monthlyInterruptionEntries.reduce<
    InterruptionReportEntry | null
  >(
    (longest, entry) =>
      !longest || entry.durationSeconds > longest.durationSeconds ? entry : longest,
    null
  );
  const trackedWorkSeconds = focusSeconds + procrastinationSeconds + interruptionSeconds;
  const focusBalance =
    trackedWorkSeconds > 0 ? Math.round((focusSeconds / trackedWorkSeconds) * 100) : 0;
  const notesCaptured = monthlyProcrastinationEntries.filter((entry) => entry.note.length > 0).length;
  const reasonsCaptured = monthlyInterruptionEntries.filter(
    (entry) => entry.reason.length > 0
  ).length;
  const trendDetailCards: TrendDetailCard[] = [
    {
      id: "focus-balance",
      label: "Focus balance",
      value: `${focusBalance}%`,
      detail: `${formatMetricDuration(focusSeconds)} focus / ${formatMetricDuration(
        procrastinationSeconds + interruptionSeconds
      )} distracted`,
      tone: "blue"
    },
    {
      id: "peak-procrastination",
      label: "Peak procrastination day",
      value:
        heaviestProcrastinationPoint && heaviestProcrastinationPoint.procrastinationMinutes > 0
          ? heaviestProcrastinationPoint.tooltipLabel
          : "None",
      detail:
        heaviestProcrastinationPoint && heaviestProcrastinationPoint.procrastinationMinutes > 0
          ? formatMinutesDuration(heaviestProcrastinationPoint.procrastinationMinutes)
          : `No entries in ${periodScopeLabel}`,
      tone: "orange"
    },
    {
      id: "peak-interruption",
      label: "Peak interruption day",
      value:
        heaviestInterruptionPoint && heaviestInterruptionPoint.interruptionMinutes > 0
          ? heaviestInterruptionPoint.tooltipLabel
          : "None",
      detail:
        heaviestInterruptionPoint && heaviestInterruptionPoint.interruptionMinutes > 0
          ? formatMinutesDuration(heaviestInterruptionPoint.interruptionMinutes)
          : `No interruptions in ${periodScopeLabel}`,
      tone: "red"
    },
    {
      id: "longest-interruption",
      label: "Longest interruption",
      value: longestInterruptionEntry
        ? formatMetricDuration(longestInterruptionEntry.durationSeconds)
        : "0m",
      detail: longestInterruptionEntry
        ? `${longestInterruptionEntry.dateLabel} - ${longestInterruptionEntry.taskTitle}`
        : `No interruptions in ${periodScopeLabel}`,
      tone: "violet"
    },
    {
      id: "reasons-captured",
      label: "Reasons captured",
      value: `${reasonsCaptured} / ${monthlyInterruptionEntries.length}`,
      detail:
        monthlyInterruptionEntries.length > 0
          ? `${Math.round((reasonsCaptured / monthlyInterruptionEntries.length) * 100)}% with reasons`
          : `No interruptions in ${periodScopeLabel}`,
      tone: "violet"
    }
  ];
  const rangeActivityDays = reportCalendarMonths
    .flatMap((monthData) => monthData.days)
    .filter((day) => day.isCurrentMonth && isDateInRange(day.date, reportRange));
  const maxPomodoros = Math.max(1, ...rangeActivityDays.map((day) => day.completedPomodoros));
  const procrastinationMinutesByDay = useMemo(
    () => sumRecordsByDay(allProcrastinationRecords, reportRange),
    [allProcrastinationRecords, reportRange.start, reportRange.endExclusive]
  );
  const maxProcrastinationMinutes = Math.max(
    1,
    ...rangeActivityDays.map((day) => procrastinationMinutesByDay.get(day.key) ?? 0)
  );
  const interruptionMinutesByDay = useMemo(
    () => sumRecordsByDay(allInterruptionRecords, reportRange),
    [allInterruptionRecords, reportRange.start, reportRange.endExclusive]
  );
  const maxInterruptionMinutes = Math.max(
    1,
    ...rangeActivityDays.map((day) => interruptionMinutesByDay.get(day.key) ?? 0)
  );
  const aiMinutesByDay = useMemo(
    () => sumRecordsByDay(allAiWorkRecords, reportRange),
    [allAiWorkRecords, reportRange.start, reportRange.endExclusive]
  );
  const maxAiMinutes = Math.max(
    1,
    ...rangeActivityDays.map((day) => aiMinutesByDay.get(day.key) ?? 0)
  );
  const insights = buildInsights(
    trendData,
    monthSessions,
    priorMonthSessions,
    monthlyProcrastinationEntries,
    monthlyInterruptionEntries,
    comparisonLabel
  );
  const totalHealth = Math.max(monthlyTaskSummary.taskCount, 1);
  const onTimePercent = Math.round((monthlyTaskSummary.completedOnTimeCount / totalHealth) * 100);
  const openOverduePercent = Math.round((monthlyTaskSummary.openOverdueCount / totalHealth) * 100);
  const overduePercent = Math.round((monthlyTaskSummary.completedLateCount / totalHealth) * 100);
  const notStartedPercent = Math.max(0, 100 - onTimePercent - openOverduePercent - overduePercent);
  const donutStyle = {
    "--on-time-deg": `${onTimePercent * 3.6}deg`,
    "--behind-deg": `${(onTimePercent + openOverduePercent) * 3.6}deg`,
    "--overdue-deg": `${(onTimePercent + openOverduePercent + overduePercent) * 3.6}deg`
  } as CSSProperties;
  const visibleProcrastinationEntries = useMemo(
    () =>
      logFilter
        ? monthlyProcrastinationEntries.filter((entry) =>
            isInDateRange(entry.startedAt, logFilter.range)
          )
        : monthlyProcrastinationEntries,
    [logFilter, monthlyProcrastinationEntries]
  );
  const visibleInterruptionEntries = useMemo(
    () =>
      logFilter
        ? monthlyInterruptionEntries.filter((entry) =>
            isInDateRange(entry.startedAt, logFilter.range)
          )
        : monthlyInterruptionEntries,
    [logFilter, monthlyInterruptionEntries]
  );
  const visibleProcrastinationSeconds = visibleProcrastinationEntries.reduce(
    (sum, entry) => sum + entry.durationSeconds,
    0
  );
  const visibleInterruptionSeconds = visibleInterruptionEntries.reduce(
    (sum, entry) => sum + entry.durationSeconds,
    0
  );
  const visibleNotesCaptured = visibleProcrastinationEntries.filter(
    (entry) => entry.note.length > 0
  ).length;
  const visibleReasonsCaptured = visibleInterruptionEntries.filter(
    (entry) => entry.reason.length > 0
  ).length;
  const logEmptyScopeText = logFilter ? `for ${logFilter.label}` : `in ${periodScopeLabel}`;
  const drillIntoLogs = (range: DateRange, label: string): void => {
    setLogFilter({
      range: {
        start: maxDate(range.start, reportRange.start),
        endExclusive: minDate(range.endExclusive, reportRange.endExclusive)
      },
      label
    });
    setSelectedCalendarDay(null);
    setViewMode("trends");
  };
  const drillIntoLogsForDate = (date: Date): void => {
    const start = startOfDay(date);

    drillIntoLogs(
      {
        start,
        endExclusive: addDays(start, 1)
      },
      formatDateLabel(start)
    );
  };
  const renderActivityCalendar = (
    monthData: CalendarMonthData,
    metric: "focus" | "ai" | "procrastination" | "interruption"
  ): JSX.Element => {
    const title =
      metric === "focus"
        ? "Focus"
        : metric === "ai"
          ? "AI Time"
          : metric === "procrastination"
            ? "Procrastination"
            : "Interruptions";
    const metricCalendarClass = ` report-month-activity-calendar--${metric}`;
    const metricDayClass =
      metric === "focus" ? "" : ` report-month-activity-day--${metric}`;
    const maxValue =
      metric === "focus"
        ? maxPomodoros
        : metric === "ai"
          ? maxAiMinutes
        : metric === "procrastination"
          ? maxProcrastinationMinutes
          : maxInterruptionMinutes;
    const getValue = (day: CalendarDayData): number => {
      if (metric === "focus") {
        return day.completedPomodoros;
      }

      if (metric === "ai") {
        return aiMinutesByDay.get(day.key) ?? 0;
      }

      return metric === "procrastination"
        ? (procrastinationMinutesByDay.get(day.key) ?? 0)
        : (interruptionMinutesByDay.get(day.key) ?? 0);
    };

    return (
      <div className="report-activity-calendar-block" key={`${monthData.key}-${metric}`}>
        <span className="report-activity-calendar-title">{title}</span>
        <div className={`report-month-activity-calendar${metricCalendarClass}`}>
          <div className="report-month-activity-weekdays">
            {weekdayLabels.map((weekday) => (
              <span key={weekday}>{weekday[0]}</span>
            ))}
          </div>
          <div className="report-month-activity-grid">
            {monthData.weeks.flat().map((day) => {
              const isSelectableActivityDay =
                day.isCurrentMonth && isDateInRange(day.date, reportRange);
              const value = getValue(day);
              const intensity = isSelectableActivityDay
                ? metric === "focus"
                  ? getActivityIntensity(value, maxValue)
                  : getTimedActivityIntensity(value, maxValue)
                : "outside";

              return (
                <button
                  aria-label={`${day.date.toLocaleDateString()} ${metric} activity`}
                  className={[
                    "report-month-activity-day",
                    metricDayClass,
                    `intensity-${intensity}`,
                    day.isToday ? "is-today" : ""
                  ].join(" ")}
                  disabled={!isSelectableActivityDay}
                  key={`${metric}-${day.key}`}
                  onClick={() => drillIntoLogsForDate(day.date)}
                  type="button"
                >
                  {isSelectableActivityDay && value > 0 ? (
                    <strong>{metric === "focus" ? value : `${value}m`}</strong>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const chartSection = (
    <section className="report-panel report-trends-panel">
      <div className="report-section-header">
        <div>
          <h2>Period Trends</h2>
          <p>Overview of your focus, break, procrastination, and interruption time.</p>
        </div>
        <div className="report-graph-legend">
          <div className="report-graph-legend-item report-graph-legend-item--focus">
            <span className="report-graph-dot" />
            <strong>Focus time</strong>
          </div>
          <div className="report-graph-legend-item report-graph-legend-item--breaks">
            <span className="report-graph-dot" />
            <strong>Break time</strong>
          </div>
          <div className="report-graph-legend-item report-graph-legend-item--procrastination">
            <span className="report-graph-dot" />
            <strong>Procrastination</strong>
          </div>
          <div className="report-graph-legend-item report-graph-legend-item--interruption">
            <span className="report-graph-dot" />
            <strong>Interruptions</strong>
          </div>
        </div>
      </div>

      <div className="report-graph-canvas">
        <svg
          aria-label="Period activity trends"
          className="report-trend-chart"
          role="img"
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        >
          {Array.from({ length: 5 }, (_, index) => {
            const y =
              chartPadding.top +
              ((chartHeight - chartPadding.top - chartPadding.bottom) * index) / 4;
            const leftAxisValue = Math.round(leftAxisMax - (leftAxisMax * index) / 4);

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
                  {formatAxisDuration(leftAxisValue)}
                </text>
              </g>
            );
          })}

          {trendData.map((point, index) => {
            const x =
              chartPadding.left +
              (usableWidth * index) / Math.max(trendData.length - 1, 1);
            const labelEvery = Math.max(1, Math.ceil(trendData.length / 8));
            const shouldLabel =
              index === 0 || index === trendData.length - 1 || index % labelEvery === 0;

            return shouldLabel ? (
              <text
                className="report-trend-axis-label"
                key={`label-${point.key}`}
                textAnchor="middle"
                x={x}
                y={chartHeight - 8}
              >
                {point.label}
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
                height="130"
                width="170"
                x={Math.min(selectedTrendX + 16, chartWidth - 220)}
                y={Math.max(8, selectedTrendFocusY - 74)}
              >
                <div className="report-trend-tooltip">
                  <strong>{selectedTrendPoint.tooltipLabel}</strong>
                  <span>Focus time {formatMinutesDuration(selectedTrendPoint.focusMinutes)}</span>
                  <span>Pomodoros {selectedTrendPoint.pomodoros}</span>
                  <span>Break time {formatMinutesDuration(selectedTrendPoint.breakMinutes)}</span>
                  <span>
                    Procrastination{" "}
                    {formatMinutesDuration(selectedTrendPoint.procrastinationMinutes)}
                  </span>
                  <span>
                    Interruptions {formatMinutesDuration(selectedTrendPoint.interruptionMinutes)}
                  </span>
                </div>
              </foreignObject>
            </g>
          ) : null}

          <path className="report-trend-line report-trend-line--focus" d={focusPath} />
          <path className="report-trend-line report-trend-line--breaks" d={breakPath} />
          <path className="report-trend-line report-trend-line--procrastination" d={procrastinationPath} />
          <path className="report-trend-line report-trend-line--interruption" d={interruptionPath} />

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
            const procrastinationY =
              chartPadding.top +
              usableHeight -
              (point.procrastinationMinutes / Math.max(leftAxisMax, 1)) * usableHeight;
            const interruptionY =
              chartPadding.top +
              usableHeight -
              (point.interruptionMinutes / Math.max(leftAxisMax, 1)) * usableHeight;

            return (
              <g
                aria-label={`View logs for ${point.tooltipLabel}`}
                className="report-trend-point-group"
                key={`point-${point.key}`}
                onClick={() => drillIntoLogs(point, point.tooltipLabel)}
                onFocus={() => setSelectedTrendKey(point.key)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    drillIntoLogs(point, point.tooltipLabel);
                  }
                }}
                onMouseEnter={() => setSelectedTrendKey(point.key)}
                role="button"
                tabIndex={0}
              >
                <circle className="report-trend-point report-trend-point--focus" cx={x} cy={focusY} r="4" />
                <circle className="report-trend-point report-trend-point--breaks" cx={x} cy={breakY} r="4" />
                <circle className="report-trend-point report-trend-point--procrastination" cx={x} cy={procrastinationY} r="4" />
                <circle className="report-trend-point report-trend-point--interruption" cx={x} cy={interruptionY} r="4" />
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
  const shiftReportPeriod = (delta: number): void => {
    setSelectedTrendKey(null);
    setLogFilter(null);

    if (rangeMode === "year" || rangeMode === "year-to-date") {
      setVisibleMonth((current) => addYears(current, delta));
      return;
    }

    if (rangeMode === "quarter") {
      setVisibleMonth((current) => addMonths(current, delta * 3));
      return;
    }

    if (rangeMode === "custom") {
      const dayDelta = getRangeDayCount(reportRange) * delta;
      setCustomStartValue(formatDateInputValue(addDays(reportRange.start, dayDelta)));
      setCustomEndValue(formatDateInputValue(addDays(addDays(reportRange.endExclusive, -1), dayDelta)));
      return;
    }

    setVisibleMonth((current) => addMonths(current, delta));
  };
  const handleRangeModeChange = (value: ReportRangeMode): void => {
    setRangeMode(value);
    setSelectedTrendKey(null);
    setLogFilter(null);
  };
  const handleCustomStartChange = (value: string): void => {
    setCustomStartValue(value);

    if (value && customEndValue && value > customEndValue) {
      setCustomEndValue(value);
    }
  };
  const handleCustomEndChange = (value: string): void => {
    setCustomEndValue(value);

    if (value && customStartValue && value < customStartValue) {
      setCustomStartValue(value);
    }
  };

  return (
    <section className={`report-shell report-shell--${viewMode}`}>
      <div className="report-controls-row">
        <div className="report-calendar-nav report-calendar-nav--month">
          <button className="report-month-button" type="button">
            <ReportIcon name="calendar" />
            <span>{reportRangeLabel}</span>
          </button>
          <button
            aria-label={`Previous ${periodNoun}`}
            className="report-arrow-button"
            onClick={() => shiftReportPeriod(-1)}
            type="button"
          >
            &lt;
          </button>
          <button
            aria-label={`Next ${periodNoun}`}
            className="report-arrow-button"
            onClick={() => shiftReportPeriod(1)}
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
              {mode === "trends" ? "Logs" : `${mode[0]?.toUpperCase()}${mode.slice(1)}`}
            </button>
          ))}
        </div>

        <div className="report-range-control">
          <select
            aria-label="Report date range"
            className="report-range-button report-range-select"
            value={rangeMode}
            onChange={(event) => handleRangeModeChange(event.currentTarget.value as ReportRangeMode)}
          >
            <option value="month">Month</option>
            <option value="quarter">Quarter</option>
            <option value="year-to-date">Year to date</option>
            <option value="year">Year</option>
            <option value="custom">Custom range</option>
          </select>
          {rangeMode === "custom" ? (
            <div className="report-custom-range-fields">
              <input
                aria-label="Custom range start"
                type="date"
                value={customStartValue}
                onChange={(event) => handleCustomStartChange(event.currentTarget.value)}
                onInput={(event) => handleCustomStartChange(event.currentTarget.value)}
              />
              <span>to</span>
              <input
                aria-label="Custom range end"
                type="date"
                value={customEndValue}
                onChange={(event) => handleCustomEndChange(event.currentTarget.value)}
                onInput={(event) => handleCustomEndChange(event.currentTarget.value)}
              />
            </div>
          ) : null}
        </div>
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
        <section className={`report-panel report-calendar-panel${isRangeCalendarView ? " is-range-view" : ""}`}>
          <div className="report-section-header">
            <div>
              <h2>{isRangeCalendarView ? "Range Calendar" : "Monthly Calendar"}</h2>
              <p>
                {isRangeCalendarView
                  ? `${reportRangeLabel} across ${reportCalendarMonths.length} months. Days outside the selected range are dimmed.`
                  : "Track due dates, completed tasks, and finished pomodoros across the month."}
              </p>
            </div>
          </div>
          <div
            className={[
              "report-calendar-months",
              isRangeCalendarView ? "is-range-view" : "is-single-month",
              isRangeCalendarView
                ? `calendar-count-${Math.min(reportCalendarMonths.length, 4)}`
                : "",
              rangeMode === "year" ? "is-year-view" : "",
              rangeMode === "custom" ? "is-stacked-view" : ""
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {reportCalendarMonths.map((monthData) => (
              <article className="report-calendar-month-card" key={monthData.key}>
                <header className="report-calendar-month-card-header">
                  <strong>{formatMonthLabel(monthData.month)}</strong>
                </header>
                <div className="report-calendar-weekdays">
                  {weekdayLabels.map((weekday) => (
                    <span key={weekday}>{weekday}</span>
                  ))}
                </div>
                <div className="report-calendar-grid">
                  {monthData.weeks.map((week, weekIndex) => (
                    <div className="report-calendar-week" key={`${monthData.key}-week-${weekIndex + 1}`}>
                      {week.map((day) => {
                        const isSelectableCalendarDay =
                          day.isCurrentMonth && isDateInRange(day.date, reportRange);

                        return (
                          <article
                            aria-disabled={!isSelectableCalendarDay}
                            className={[
                              "report-calendar-day",
                              isSelectableCalendarDay ? "" : "is-outside",
                              day.isToday ? "is-today" : "",
                              day.completedPomodoros > 0 ? "has-pomodoros" : ""
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            key={day.key}
                            onClick={
                              isSelectableCalendarDay
                                ? () => setSelectedCalendarDay(day)
                                : undefined
                            }
                            onKeyDown={(event) => {
                              if (
                                isSelectableCalendarDay &&
                                (event.key === "Enter" || event.key === " ")
                              ) {
                                event.preventDefault();
                                setSelectedCalendarDay(day);
                              }
                            }}
                            role={isSelectableCalendarDay ? "button" : undefined}
                            tabIndex={isSelectableCalendarDay ? 0 : -1}
                          >
                            <div className="report-calendar-day-header">
                              <span className="report-calendar-day-number">{day.date.getDate()}</span>
                              {!isRangeCalendarView || day.completedPomodoros > 0 ? (
                                <span className={`report-pomodoro-pill${day.completedPomodoros > 0 ? " is-active" : ""}`}>
                                  {isRangeCalendarView ? day.completedPomodoros : `${day.completedPomodoros} pom`}
                                </span>
                              ) : null}
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
                        );
                      })}
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : viewMode === "trends" ? (
        <div className="report-trends-tab">
          {logFilter ? (
            <div className="report-log-filter-bar">
              <span>
                Showing logs for <strong>{logFilter.label}</strong>
              </span>
              <button className="ghost-button" onClick={() => setLogFilter(null)} type="button">
                Clear filter
              </button>
            </div>
          ) : null}
          <div className="report-trends-tab-grid">
            <section className="report-panel report-procrastination-panel">
              <div className="report-section-header">
                <div>
                  <h2>Procrastination Log</h2>
                  <p>
                    {logFilter ? logFilter.label : reportRangeLabel} -{" "}
                    {formatMetricDuration(visibleProcrastinationSeconds)}
                  </p>
                </div>
              </div>

              <div className="report-procrastination-summary">
                <span>
                  <strong>{visibleProcrastinationEntries.length}</strong>
                  entries
                </span>
                <span>
                  <strong>
                    {visibleProcrastinationEntries.length > 0
                      ? formatMetricDuration(
                          Math.round(
                            visibleProcrastinationSeconds / visibleProcrastinationEntries.length
                          )
                        )
                      : "0m"}
                  </strong>
                  avg
                </span>
                <span>
                  <strong>{visibleNotesCaptured}</strong>
                  notes
                </span>
              </div>

              {visibleProcrastinationEntries.length > 0 ? (
                <div className="report-procrastination-list">
                  {visibleProcrastinationEntries.map((entry) => (
                    <article className="report-procrastination-entry" key={entry.id}>
                      <div className="report-procrastination-entry-time">
                        <strong>{formatMetricDuration(entry.durationSeconds)}</strong>
                        <span>
                          {entry.dateLabel} - {entry.timeLabel}
                        </span>
                      </div>
                      <div className="report-procrastination-entry-copy">
                        <span>{entry.taskTitle}</span>
                        <p>{entry.note.length > 0 ? entry.note : "No note"}</p>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="report-procrastination-empty">
                  No procrastination recorded {logEmptyScopeText}.
                </div>
              )}
            </section>

            <section className="report-panel report-procrastination-panel report-interruption-panel">
              <div className="report-section-header">
                <div>
                  <h2>Interruption Log</h2>
                  <p>
                    {logFilter ? logFilter.label : reportRangeLabel} -{" "}
                    {formatMetricDuration(visibleInterruptionSeconds)}
                  </p>
                </div>
              </div>

              <div className="report-procrastination-summary">
                <span>
                  <strong>{visibleInterruptionEntries.length}</strong>
                  entries
                </span>
                <span>
                  <strong>
                    {visibleInterruptionEntries.length > 0
                      ? formatMetricDuration(
                          Math.round(visibleInterruptionSeconds / visibleInterruptionEntries.length)
                        )
                      : "0m"}
                  </strong>
                  avg
                </span>
                <span>
                  <strong>{visibleReasonsCaptured}</strong>
                  reasons
                </span>
              </div>

              {visibleInterruptionEntries.length > 0 ? (
                <div className="report-procrastination-list">
                  {visibleInterruptionEntries.map((entry) => (
                    <article
                      className="report-procrastination-entry report-interruption-entry"
                      key={entry.id}
                    >
                      <div className="report-procrastination-entry-time">
                        <strong>{formatMetricDuration(entry.durationSeconds)}</strong>
                        <span>
                          {entry.dateLabel} - {entry.timeLabel}
                        </span>
                      </div>
                      <div className="report-procrastination-entry-copy">
                        <span>{entry.taskTitle}</span>
                        <p>{entry.reason.length > 0 ? entry.reason : "No reason"}</p>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="report-procrastination-empty">
                  No interruptions recorded {logEmptyScopeText}.
                </div>
              )}
            </section>
          </div>

          <div className="report-trend-detail-grid">
            {trendDetailCards.map((card) => (
              <article
                className={`report-trend-detail-card report-trend-detail-card--${card.tone}`}
                key={card.id}
              >
                <span>{card.label}</span>
                <strong>{card.value}</strong>
                <p>{card.detail}</p>
              </article>
            ))}
          </div>

          <section className="report-panel report-study-panel">
            <div className="report-section-header">
              <div>
                <h2>Study Problems</h2>
                <p>Problem-focused work for {periodDescriptor}.</p>
              </div>
            </div>

            <div className="report-study-summary">
              <article>
                <span>Studied in range</span>
                <strong>{studiedProblemsInRange.length}</strong>
              </article>
              <article>
                <span>Study time</span>
                <strong>{formatMetricDuration(studySecondsInRange)}</strong>
              </article>
              <article>
                <span>Total completions</span>
                <strong>{totalStudyCompletions}</strong>
              </article>
            </div>

            {topStudyProblems.length > 0 ? (
              <div className="report-study-list">
                {topStudyProblems.map((problem) => (
                  <article className="report-study-item" key={problem.id}>
                    <div>
                      <strong>{problem.title}</strong>
                      <span>
                        {[problem.platform, problem.difficulty, problem.topic]
                          .filter((value) => value && value.length > 0)
                          .join(" · ") || "No metadata"}
                      </span>
                    </div>
                    <div className="report-study-meta">
                      <strong>{formatMetricDuration(problem.rangeTrackedSeconds)}</strong>
                      <span>
                        {problem.sessionCount} session{problem.sessionCount === 1 ? "" : "s"} ·{" "}
                        {problem.timesCompleted} complete
                        {problem.timesCompleted === 1 ? "" : "s"}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="report-study-empty">
                No study-problem sessions recorded in {periodScopeLabel}.
              </div>
            )}
          </section>
        </div>
      ) : (
        <>
          <div className="report-main-grid">
            {chartSection}

            <section className="report-panel report-performance-panel">
              <div className="report-section-header">
                <div>
                  <h2>Performance Snapshot</h2>
                  <p>Task outcomes for {periodDescriptor}.</p>
                </div>
              </div>

              <div className="report-snapshot-grid">
                <article className="report-snapshot-card report-snapshot-card--blue">
                  <span>{periodTaskLabel}</span>
                  <strong>{monthlyTaskSummary.taskCount}</strong>
                  <em>{formatPercentDelta(monthlyTaskSummary.taskCount, priorMonthlyTaskSummary.taskCount, comparisonLabel)}</em>
                </article>
                <article className="report-snapshot-card report-snapshot-card--green">
                  <span>Completed on time</span>
                  <strong>{monthlyTaskSummary.completedOnTimeCount}</strong>
                  <em>{formatPercentDelta(monthlyTaskSummary.completedOnTimeCount, priorMonthlyTaskSummary.completedOnTimeCount, comparisonLabel)}</em>
                </article>
                <article className="report-snapshot-card report-snapshot-card--amber">
                  <span>Total overdue days</span>
                  <strong>{monthlyTaskSummary.overdueDaysTotal} days</strong>
                  <em>{formatPercentDelta(monthlyTaskSummary.overdueDaysTotal, priorMonthlyTaskSummary.overdueDaysTotal, comparisonLabel)}</em>
                </article>
                <button
                  className="report-snapshot-card report-snapshot-card--red"
                  onClick={() => setOpenOverdueDetails(openOverdueTasks)}
                  type="button"
                >
                  <span>Open overdue</span>
                  <strong>{monthlyTaskSummary.openOverdueCount} tasks</strong>
                  <em>{formatCountDelta(monthlyTaskSummary.openOverdueCount, priorMonthlyTaskSummary.openOverdueCount, "tasks", comparisonLabel)}</em>
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
                      ["Open overdue", monthlyTaskSummary.openOverdueCount, openOverduePercent, "red"],
                      ["Completed late", monthlyTaskSummary.completedLateCount, overduePercent, "amber"],
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
                  </div>
                </div>
                <div className="report-activity-month">
                  <strong>{reportRangeLabel}</strong>
                  <button
                    aria-label={`Previous ${periodNoun}`}
                    className="report-arrow-button"
                    onClick={() => shiftReportPeriod(-1)}
                    type="button"
                  >
                    &lt;
                  </button>
                  <button
                    aria-label={`Next ${periodNoun}`}
                    className="report-arrow-button"
                    onClick={() => shiftReportPeriod(1)}
                    type="button"
                  >
                    &gt;
                  </button>
                </div>
              </div>

              <div className="report-activity-body">
                <div
                  className={[
                    "report-activity-calendars",
                    isRangeCalendarView ? "is-range-view" : "",
                    rangeMode === "year" ? "is-year-view" : "",
                    rangeMode === "custom" ? "is-stacked-view" : ""
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {reportCalendarMonths.map((monthData) => (
                    <section className="report-activity-range-month" key={monthData.key}>
                      {isRangeCalendarView ? (
                        <strong className="report-activity-range-month-title">
                          {formatMonthLabel(monthData.month)}
                        </strong>
                      ) : null}
                      <div className="report-activity-range-month-calendars">
                        {renderActivityCalendar(monthData, "focus")}
                        {renderActivityCalendar(monthData, "ai")}
                        {renderActivityCalendar(monthData, "procrastination")}
                        {renderActivityCalendar(monthData, "interruption")}
                      </div>
                    </section>
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
              <button
                className="report-analytics-button"
                onClick={() => setViewMode("trends")}
                type="button"
              >
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
              <div className="report-day-modal-actions">
                <button
                  className="ghost-button"
                  onClick={() => drillIntoLogsForDate(selectedCalendarDay.date)}
                  type="button"
                >
                  View logs
                </button>
                <button
                  className="ghost-button"
                  onClick={() => setSelectedCalendarDay(null)}
                  type="button"
                >
                  Close
                </button>
              </div>
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

      {openOverdueDetails ? (
        <div
          className="modal-overlay"
          onClick={() => setOpenOverdueDetails(null)}
          role="presentation"
        >
          <div
            className="modal-card panel-card report-day-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Open overdue tasks"
          >
            <div className="details-title">
              <div>
                <h3>Open Overdue</h3>
                <p>
                  {reportRangeLabel} - {openOverdueDetails.length} open overdue task
                  {openOverdueDetails.length === 1 ? "" : "s"}
                </p>
              </div>
              <button
                className="ghost-button"
                onClick={() => setOpenOverdueDetails(null)}
                type="button"
              >
                Close
              </button>
            </div>

            {openOverdueDetails.length > 0 ? (
              <div className="report-day-modal-list">
                {openOverdueDetails.map((task) => (
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
              <div className="empty-state">No open overdue tasks in {periodScopeLabel}.</div>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
};
