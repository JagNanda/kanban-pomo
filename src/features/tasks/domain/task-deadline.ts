export interface TaskDeadlineLike {
  estimatedCompletionDate: string | null;
  completedAt: string | null;
}

const toLocalDayStart = (value: Date): Date =>
  new Date(value.getFullYear(), value.getMonth(), value.getDate());

const toDateOnlyLocal = (value: string): Date => new Date(`${value}T00:00:00`);

const getDayDiff = (later: Date, earlier: Date): number =>
  Math.max(
    0,
    Math.floor((toLocalDayStart(later).getTime() - toLocalDayStart(earlier).getTime()) / 86400000)
  );

export const getTaskDueDate = (task: TaskDeadlineLike): Date | null =>
  task.estimatedCompletionDate ? toDateOnlyLocal(task.estimatedCompletionDate) : null;

export const getTaskCompletionDate = (task: TaskDeadlineLike): Date | null =>
  task.completedAt ? new Date(task.completedAt) : null;

export const isTaskOverdue = (
  task: TaskDeadlineLike,
  referenceDate: Date = new Date()
): boolean => {
  const dueDate = getTaskDueDate(task);

  if (!dueDate) {
    return false;
  }

  const comparisonDate = getTaskCompletionDate(task) ?? referenceDate;
  return toLocalDayStart(comparisonDate).getTime() > toLocalDayStart(dueDate).getTime();
};

export const getTaskOverdueDays = (
  task: TaskDeadlineLike,
  referenceDate: Date = new Date()
): number => {
  const dueDate = getTaskDueDate(task);

  if (!dueDate) {
    return 0;
  }

  const comparisonDate = getTaskCompletionDate(task) ?? referenceDate;
  return getDayDiff(comparisonDate, dueDate);
};

export const isTaskCompletedOnTime = (task: TaskDeadlineLike): boolean => {
  const dueDate = getTaskDueDate(task);
  const completedDate = getTaskCompletionDate(task);

  if (!dueDate || !completedDate) {
    return false;
  }

  return toLocalDayStart(completedDate).getTime() <= toLocalDayStart(dueDate).getTime();
};

export const isTaskScheduledInMonth = (task: TaskDeadlineLike, month: Date): boolean => {
  const dueDate = getTaskDueDate(task);

  if (!dueDate) {
    return false;
  }

  return (
    dueDate.getFullYear() === month.getFullYear() &&
    dueDate.getMonth() === month.getMonth()
  );
};
