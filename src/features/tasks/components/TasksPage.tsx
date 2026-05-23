import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { Column, ColumnId } from "../../columns/domain/column.types";
import type {
  FieldDefinition,
  FieldScope,
  FieldType,
  TaskFieldAssignment,
  TaskFieldValue
} from "../../custom-fields/domain/custom-fields.types";
import type { CreateTaskInput } from "../../board/application/useBoardState";
import type { PomodoroSession } from "../../pomodoro/domain/pomodoro.types";
import { CalendarInput } from "../../../shared/components/CalendarInput";
import { formatDurationSummary } from "../../../shared/lib/time";
import {
  MARKDOWN_IMPORT_TEMPLATE,
  parseMarkdownImportDocument,
  type MarkdownImportDocument,
  type MarkdownImportApplyResult,
  type MarkdownImportValidationError
} from "../application/markdown-import";
import { CollectionBadge } from "./CollectionBadge";
import { OverdueIndicator } from "./OverdueIndicator";
import { StopwatchIcons } from "./StopwatchIcons";
import { TaskDetailsPanel } from "./TaskDetailsPanel";
import type {
  TaskCollection,
  TaskCollectionId
} from "../domain/task-collection.types";
import type {
  TaskProject,
  TaskProjectId
} from "../domain/task-project.types";
import type { Task, TaskId, TaskPriority } from "../domain/task.types";

export type TasksNavigationView =
  | { type: "all" }
  | { type: "project"; projectId: TaskProjectId }
  | { type: "collection"; collectionId: TaskCollectionId }
  | { type: "completed-project"; projectId: TaskProjectId }
  | { type: "completed-collection"; collectionId: TaskCollectionId };

export type TaskView =
  | { type: "today" }
  | { type: "tomorrow" }
  | { type: "month" }
  | { type: "scheduled" }
  | TasksNavigationView;

export interface TasksNavigationIntent {
  requestId: number;
  taskId: TaskId;
  targetView: TasksNavigationView;
  openTaskDetails: boolean;
}

type ModalState =
  | "create-project"
  | "edit-project"
  | "create-collection"
  | "edit-collection"
  | "extend-due-dates"
  | "create-task"
  | "compose-markdown"
  | "edit-task"
  | null;

type TreeMenuState =
  | { type: "project"; projectId: TaskProjectId }
  | { type: "collection"; collectionId: TaskCollectionId }
  | null;

type ImportFeedback =
  | {
      kind: "success";
      fileName: string;
      summary: MarkdownImportApplyResult & { ok: true };
    }
  | {
      kind: "error";
      fileName: string;
      errors: MarkdownImportValidationError[];
    }
  | null;

type TaskSortKey =
  | "title"
  | "status"
  | "priority"
  | "estimated"
  | "completed"
  | "dueDate"
  | "studyPlatform"
  | "studyDifficulty"
  | "studyStatus"
  | "timesCompleted"
  | "studyTime";
type TaskSortDirection = "asc" | "desc";

interface TaskSortState {
  key: TaskSortKey;
  direction: TaskSortDirection;
}

interface CreateTaskDraft {
  columnId: ColumnId | "";
  title: string;
  description: string;
  priority: TaskPriority;
  taskProjectId: TaskProjectId | "";
  taskCollectionId: TaskCollectionId | "";
  estimatedCompletionDate: string;
  estimatedPomodoros: string;
  isStudyProblem: boolean;
  studyPlatform: string;
  studyUrl: string;
  studyDifficulty: Task["studyDifficulty"];
  studyTopic: string;
  studyStatus: Task["studyStatus"];
  timesCompleted: string;
}

type DueDateShiftTarget =
  | { type: "project"; projectId: TaskProjectId }
  | { type: "collection"; collectionId: TaskCollectionId };

interface TasksPageProps {
  columns: Column[];
  taskProjects: TaskProject[];
  taskCollections: TaskCollection[];
  tasks: Task[];
  pomodoroSessions: PomodoroSession[];
  selectedTaskId: TaskId | null;
  fieldDefinitions: FieldDefinition[];
  taskFieldAssignments: TaskFieldAssignment[];
  taskFieldValues: TaskFieldValue[];
  selectedView: TaskView;
  onSelectedViewChange: (view: TaskView) => void;
  navigationIntent: TasksNavigationIntent | null;
  onConsumeNavigationIntent: (requestId: number) => void;
  onFocusTask: (taskId: TaskId) => void;
  actions: {
    selectTask: (taskId: TaskId) => void;
    createTaskProject: (name: string, isStudyProject?: boolean) => void;
    renameTaskProject: (taskProjectId: TaskProjectId, name: string) => void;
    updateTaskProjectStudyMode: (
      taskProjectId: TaskProjectId,
      isStudyProject: boolean
    ) => void;
    createTaskCollection: (name: string, taskProjectId: TaskProjectId) => void;
    renameTaskCollection: (taskCollectionId: TaskCollectionId, name: string) => void;
    extendTaskProjectDueDates: (taskProjectId: TaskProjectId, dayCount: number) => void;
    extendTaskCollectionDueDates: (taskCollectionId: TaskCollectionId, dayCount: number) => void;
    deleteTaskProject: (taskProjectId: TaskProjectId) => void;
    deleteTaskCollection: (taskCollectionId: TaskCollectionId) => void;
    createTask: (input: CreateTaskInput) => void;
    importMarkdownDocument: (document: MarkdownImportDocument) => MarkdownImportApplyResult;
    moveTask: (taskId: TaskId, targetColumnId: ColumnId) => void;
    assignTaskToProject: (taskId: TaskId, taskProjectId: TaskProjectId | null) => void;
    assignTaskToCollection: (taskId: TaskId, taskCollectionId: TaskCollectionId | null) => void;
    updateTaskTitle: (taskId: TaskId, title: string) => void;
    updateTaskDescription: (taskId: TaskId, description: string) => void;
    updateTaskPriority: (taskId: TaskId, priority: TaskPriority) => void;
    updateTaskEstimatedDate: (taskId: TaskId, estimatedCompletionDate: string) => void;
    updateTaskEstimatedPomodoros: (taskId: TaskId, estimatedPomodoros: number) => void;
    updateTaskCompletedPomodoros: (taskId: TaskId, pomodoroCount: number) => void;
    updateTaskStudyMetadata: (
      taskId: TaskId,
      updates: Partial<
        Pick<
          Task,
          | "isStudyProblem"
          | "studyPlatform"
          | "studyUrl"
          | "studyDifficulty"
          | "studyTopic"
          | "studyStatus"
          | "timesCompleted"
        >
      >
    ) => void;
    updateTaskFieldValue: (
      taskId: TaskId,
      fieldDefinitionId: FieldDefinition["id"],
      nextValue: string | number | boolean
    ) => void;
    deleteTask: (taskId: TaskId) => void;
    addFieldDefinition: (
      taskId: TaskId | null,
      name: string,
      type: FieldType,
      scope: FieldScope
    ) => void;
  };
}

const getApplicableFieldDefinitions = (
  fieldDefinitions: FieldDefinition[],
  taskFieldAssignments: TaskFieldAssignment[],
  taskId: TaskId
): FieldDefinition[] =>
  fieldDefinitions.filter((definition) => {
    if (definition.scope === "global") {
      return true;
    }

    return taskFieldAssignments.some(
      (assignment) =>
        assignment.fieldDefinitionId === definition.id && assignment.taskId === taskId
    );
  });

const getStudyViewProject = (
  selectedView: TaskView,
  taskProjectsById: Map<TaskProjectId, TaskProject>,
  taskCollectionsById: Map<TaskCollectionId, TaskCollection>
): TaskProject | null => {
  if (selectedView.type === "project" || selectedView.type === "completed-project") {
    return taskProjectsById.get(selectedView.projectId) ?? null;
  }

  if (selectedView.type === "collection" || selectedView.type === "completed-collection") {
    const collection = taskCollectionsById.get(selectedView.collectionId) ?? null;

    return collection?.taskProjectId
      ? taskProjectsById.get(collection.taskProjectId) ?? null
      : null;
  }

  return null;
};

const createDefaultTaskDraft = (columnId: ColumnId | ""): CreateTaskDraft => ({
  columnId,
  title: "",
  description: "",
  priority: "medium",
  taskProjectId: "",
  taskCollectionId: "",
  estimatedCompletionDate: "",
  estimatedPomodoros: "",
  isStudyProblem: false,
  studyPlatform: "",
  studyUrl: "",
  studyDifficulty: null,
  studyTopic: "",
  studyStatus: "unstarted",
  timesCompleted: ""
});

const buildTreePillStyle = (color: string): CSSProperties =>
  ({
    "--tasks-tree-accent": color
  }) as CSSProperties;

const toLocalDateKey = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const matchesThisMonth = (dateValue: string | null, now: Date): boolean => {
  if (!dateValue) {
    return false;
  }

  const target = new Date(`${dateValue}T00:00:00`);
  return (
    target.getFullYear() === now.getFullYear() && target.getMonth() === now.getMonth()
  );
};

const isTaskCompleted = (task: Task): boolean => task.completedAt !== null;

const TASK_PRIORITY_RANK: Record<TaskPriority, number> = {
  low: 0,
  medium: 1,
  high: 2
};

const STUDY_DIFFICULTY_RANK: Record<NonNullable<Task["studyDifficulty"]>, number> = {
  easy: 0,
  medium: 1,
  hard: 2
};

const STUDY_STATUS_RANK: Record<NonNullable<Task["studyStatus"]>, number> = {
  unstarted: 0,
  attempted: 1,
  reviewing: 2,
  solved: 3
};

const compareText = (left: string, right: string): number =>
  left.localeCompare(right, undefined, { sensitivity: "base", numeric: true });

const compareOptionalDate = (
  left: string | null,
  right: string | null,
  direction: TaskSortDirection
): number => {
  if (left === right) {
    return 0;
  }

  if (left === null) {
    return 1;
  }

  if (right === null) {
    return -1;
  }

  return direction === "asc" ? compareText(left, right) : compareText(right, left);
};

const getNextTaskSortState = (
  current: TaskSortState | null,
  key: TaskSortKey
): TaskSortState | null => {
  if (!current || current.key !== key) {
    return { key, direction: "asc" };
  }

  if (current.direction === "asc") {
    return { key, direction: "desc" };
  }

  return null;
};

const SortIndicator = ({
  direction,
  isActive
}: {
  direction: TaskSortDirection | null;
  isActive: boolean;
}): JSX.Element => (
  <svg
    aria-hidden="true"
    className={`tasks-sort-icon${isActive ? " is-active" : ""}${
      direction === "desc" ? " is-desc" : ""
    }`}
    viewBox="0 0 16 16"
  >
    <path d="M5 6l3-3 3 3" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
    <path d="M11 10l-3 3-3-3" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
  </svg>
);

type TaskFilterIconName =
  | "today"
  | "tomorrow"
  | "month"
  | "scheduled"
  | "incomplete"
  | "search"
  | "plus"
  | "focus";

const TaskFilterIcon = ({ name }: { name: TaskFilterIconName }): JSX.Element => {
  switch (name) {
    case "today":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <rect x="4" y="5" width="16" height="15" rx="3" />
          <path d="M8 3v4M16 3v4M4 10h16" />
          <path d="M9 15h6" />
        </svg>
      );
    case "tomorrow":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2.8v2.1M12 19.1v2.1M4.2 4.2l1.5 1.5M18.3 18.3l1.5 1.5M2.8 12h2.1M19.1 12h2.1M4.2 19.8l1.5-1.5M18.3 5.7l1.5-1.5" />
        </svg>
      );
    case "month":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <rect x="4" y="4.8" width="16" height="15.2" rx="3" />
          <path d="M8 3v4M16 3v4M4 10h16" />
          <path d="M8 14h2M12 14h2M16 14h2M8 17h2M12 17h2" />
        </svg>
      );
    case "scheduled":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <rect x="4" y="4.8" width="16" height="15.2" rx="3" />
          <path d="M8 3v4M16 3v4M4 10h16" />
          <path d="m8 15 2.2 2.2L16 13" />
        </svg>
      );
    case "incomplete":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M12 3a9 9 0 1 0 9 9" />
          <path d="M12 3v4M21 12h-4" />
        </svg>
      );
    case "search":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="6.2" />
          <path d="m16 16 4 4" />
        </svg>
      );
    case "plus":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case "focus":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="7" />
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
        </svg>
      );
  }
};

const getViewTitle = (
  view: TaskView,
  taskCollectionsById: Map<TaskCollectionId, TaskCollection>,
  taskProjectsById: Map<TaskProjectId, TaskProject>
): string => {
  if (view.type === "today") {
    return "Today";
  }

  if (view.type === "tomorrow") {
    return "Tomorrow";
  }

  if (view.type === "month") {
    return "This Month";
  }

  if (view.type === "scheduled") {
    return "Scheduled Tasks";
  }

  if (view.type === "all") {
    return "Incomplete Tasks";
  }

  if (view.type === "project") {
    return taskProjectsById.get(view.projectId)?.name ?? "Project";
  }

  if (view.type === "completed-project") {
    return `Completed: ${taskProjectsById.get(view.projectId)?.name ?? "Project"}`;
  }

  if (view.type === "completed-collection") {
    const collection = taskCollectionsById.get(view.collectionId) ?? null;
    const project =
      collection?.taskProjectId !== null && collection?.taskProjectId !== undefined
        ? taskProjectsById.get(collection.taskProjectId) ?? null
        : null;
    return `Completed: ${project?.name ?? "Project"}`;
  }

  const collection = taskCollectionsById.get(view.collectionId) ?? null;
  const project =
    collection?.taskProjectId !== null && collection?.taskProjectId !== undefined
      ? taskProjectsById.get(collection.taskProjectId) ?? null
      : null;
  return project?.name ?? "Project";
};

export const TasksPage = ({
  columns,
  taskProjects,
  taskCollections,
  tasks,
  pomodoroSessions,
  selectedTaskId,
  fieldDefinitions,
  taskFieldAssignments,
  taskFieldValues,
  selectedView,
  onSelectedViewChange,
  navigationIntent,
  onConsumeNavigationIntent,
  onFocusTask,
  actions
}: TasksPageProps): JSX.Element => {
  const [modalState, setModalState] = useState<ModalState>(null);
  const [projectName, setProjectName] = useState("");
  const [projectIsStudyProject, setProjectIsStudyProject] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<TaskProjectId | null>(null);
  const [collectionName, setCollectionName] = useState("");
  const [collectionProjectId, setCollectionProjectId] = useState<TaskProjectId | null>(null);
  const [editingCollectionId, setEditingCollectionId] = useState<TaskCollectionId | null>(null);
  const [dueDateShiftTarget, setDueDateShiftTarget] = useState<DueDateShiftTarget | null>(null);
  const [dueDateShiftDays, setDueDateShiftDays] = useState("1");
  const [draft, setDraft] = useState<CreateTaskDraft>(() =>
    createDefaultTaskDraft(columns[0]?.id ?? "")
  );
  const [composerMarkdown, setComposerMarkdown] = useState("");
  const [composerErrors, setComposerErrors] = useState<MarkdownImportValidationError[]>([]);
  const [importFeedback, setImportFeedback] = useState<ImportFeedback>(null);
  const [isImportHelpOpen, setIsImportHelpOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [taskSort, setTaskSort] = useState<TaskSortState | null>(null);
  const [openTreeMenu, setOpenTreeMenu] = useState<TreeMenuState>(null);
  const [expandedProjectIds, setExpandedProjectIds] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(taskProjects.map((project) => [project.id, true]))
  );
  const [expandedCompletedProjectIds, setExpandedCompletedProjectIds] = useState<
    Record<string, boolean>
  >(() => Object.fromEntries(taskProjects.map((project) => [project.id, true])));
  const [pendingNavigationTaskId, setPendingNavigationTaskId] = useState<TaskId | null>(null);
  const projectNameInputRef = useRef<HTMLInputElement | null>(null);
  const collectionNameInputRef = useRef<HTMLInputElement | null>(null);
  const dueDateShiftInputRef = useRef<HTMLInputElement | null>(null);
  const handledNavigationRequestRef = useRef<number | null>(null);
  const setSelectedView = onSelectedViewChange;

  const columnsById = useMemo(
    () => new Map(columns.map((column) => [column.id, column])),
    [columns]
  );
  const taskProjectsById = useMemo(
    () => new Map(taskProjects.map((project) => [project.id, project])),
    [taskProjects]
  );
  const taskCollectionsById = useMemo(
    () => new Map(taskCollections.map((collection) => [collection.id, collection])),
    [taskCollections]
  );
  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? null;
  const selectedTaskFieldDefinitions = selectedTask
    ? getApplicableFieldDefinitions(fieldDefinitions, taskFieldAssignments, selectedTask.id)
    : [];
  const selectedTaskFieldValues = selectedTask
    ? taskFieldValues.filter((fieldValue) => fieldValue.taskId === selectedTask.id)
    : [];

  const now = new Date();
  const todayKey = toLocalDateKey(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const tomorrowKey = toLocalDateKey(tomorrow);

  const sortedTasks = useMemo(
    () =>
      tasks.slice().sort((left, right) => {
        const leftColumnIndex = columnsById.get(left.columnId)?.orderIndex ?? 0;
        const rightColumnIndex = columnsById.get(right.columnId)?.orderIndex ?? 0;

        if (leftColumnIndex !== rightColumnIndex) {
          return leftColumnIndex - rightColumnIndex;
        }

        return left.orderIndex - right.orderIndex;
      }),
    [columnsById, tasks]
  );
  const incompleteTasks = useMemo(
    () => sortedTasks.filter((task) => !isTaskCompleted(task)),
    [sortedTasks]
  );
  const collectionsByProject = useMemo(
    () =>
      new Map(
        taskProjects.map((project) => [
          project.id,
          taskCollections.filter((collection) => collection.taskProjectId === project.id)
        ])
      ),
    [taskCollections, taskProjects]
  );
  const taskCountByProject = useMemo(
    () =>
      new Map(
        taskProjects.map((project) => [
          project.id,
          incompleteTasks.filter((task) => task.taskProjectId === project.id).length
        ])
      ),
    [incompleteTasks, taskProjects]
  );
  const taskCountByCollection = useMemo(
    () =>
      new Map(
        taskCollections.map((collection) => [
          collection.id,
          incompleteTasks.filter((task) => task.taskCollectionId === collection.id).length
        ])
      ),
    [incompleteTasks, taskCollections]
  );
  const completedTasks = useMemo(
    () => sortedTasks.filter((task) => isTaskCompleted(task)),
    [sortedTasks]
  );
  const completedTaskCountByProject = useMemo(
    () =>
      new Map(
        taskProjects.map((project) => [
          project.id,
          completedTasks.filter((task) => task.taskProjectId === project.id).length
        ])
      ),
    [completedTasks, taskProjects]
  );
  const completedTaskCountByCollection = useMemo(
    () =>
      new Map(
        taskCollections.map((collection) => [
          collection.id,
          completedTasks.filter((task) => task.taskCollectionId === collection.id).length
        ])
      ),
    [completedTasks, taskCollections]
  );
  const completedProjects = useMemo(
    () =>
      taskProjects.filter((project) => (completedTaskCountByProject.get(project.id) ?? 0) > 0),
    [completedTaskCountByProject, taskProjects]
  );
  const completedCollectionsByProject = useMemo(
    () =>
      new Map(
        completedProjects.map((project) => [
          project.id,
          taskCollections.filter(
            (collection) =>
              collection.taskProjectId === project.id &&
              (completedTaskCountByCollection.get(collection.id) ?? 0) > 0
          )
        ])
      ),
    [completedProjects, completedTaskCountByCollection, taskCollections]
  );
  const availableDraftProjects = taskProjects.filter((project) =>
    taskCollections.some((collection) => collection.taskProjectId === project.id)
  );
  const availableDraftCollections = taskCollections.filter(
    (collection) => collection.taskProjectId === draft.taskProjectId
  );
  const selectedStudyViewProject = getStudyViewProject(
    selectedView,
    taskProjectsById,
    taskCollectionsById
  );
  const isStudyTableView = selectedStudyViewProject?.isStudyProject ?? false;
  const draftProject =
    draft.taskProjectId === "" ? null : taskProjectsById.get(draft.taskProjectId) ?? null;
  const isDraftStudyProject = draftProject?.isStudyProject ?? false;
  const dueDateShiftScope = useMemo(() => {
    if (!dueDateShiftTarget) {
      return null;
    }

    const scopedTasks = tasks.filter((task) =>
      dueDateShiftTarget.type === "project"
        ? task.taskProjectId === dueDateShiftTarget.projectId
        : task.taskCollectionId === dueDateShiftTarget.collectionId
    );
    const scheduledTaskCount = scopedTasks.filter(
      (task) => task.completedAt === null && task.estimatedCompletionDate !== null
    ).length;
    const unscheduledTaskCount = scopedTasks.filter(
      (task) => task.completedAt === null && task.estimatedCompletionDate === null
    ).length;
    const completedTaskCount = scopedTasks.filter((task) => task.completedAt !== null).length;

    if (dueDateShiftTarget.type === "project") {
      const project = taskProjectsById.get(dueDateShiftTarget.projectId) ?? null;

      if (!project) {
        return null;
      }

      return {
        actionLabel: "Extend project dates",
        completedTaskCount,
        scheduledTaskCount,
        subtitle: `Shift all scheduled incomplete tasks in ${project.name} forward by a fixed number of days.`,
        targetLabel: project.name,
        targetTypeLabel: "Project",
        unscheduledTaskCount
      };
    }

    const collection = taskCollectionsById.get(dueDateShiftTarget.collectionId) ?? null;
    const project =
      collection?.taskProjectId !== null && collection?.taskProjectId !== undefined
        ? taskProjectsById.get(collection.taskProjectId) ?? null
        : null;

    if (!collection) {
      return null;
    }

    return {
      actionLabel: "Extend category dates",
      completedTaskCount,
      scheduledTaskCount,
      subtitle: `Shift all scheduled incomplete tasks in ${collection.name}${
        project ? ` within ${project.name}` : ""
      } forward by a fixed number of days.`,
      targetLabel: collection.name,
      targetTypeLabel: "Category",
      unscheduledTaskCount
    };
  }, [dueDateShiftTarget, taskCollectionsById, taskProjectsById, tasks]);

  const counts = useMemo(
    () => ({
      today: incompleteTasks.filter((task) => task.estimatedCompletionDate === todayKey).length,
      tomorrow: incompleteTasks.filter((task) => task.estimatedCompletionDate === tomorrowKey).length,
      month: incompleteTasks.filter((task) => matchesThisMonth(task.estimatedCompletionDate, now))
        .length,
      scheduled: incompleteTasks.filter(
        (task) =>
          task.estimatedCompletionDate !== null && task.estimatedCompletionDate.trim() !== ""
      ).length,
      all: incompleteTasks.length
    }),
    [incompleteTasks, now, todayKey, tomorrowKey]
  );

  const visibleTasks = useMemo(() => {
    if (selectedView.type === "today") {
      return incompleteTasks.filter((task) => task.estimatedCompletionDate === todayKey);
    }

    if (selectedView.type === "tomorrow") {
      return incompleteTasks.filter((task) => task.estimatedCompletionDate === tomorrowKey);
    }

    if (selectedView.type === "month") {
      return incompleteTasks.filter((task) => matchesThisMonth(task.estimatedCompletionDate, now));
    }

    if (selectedView.type === "scheduled") {
      return incompleteTasks
        .filter(
          (task) =>
            task.estimatedCompletionDate !== null && task.estimatedCompletionDate.trim() !== ""
        )
        .slice()
        .sort((left, right) =>
          compareOptionalDate(left.estimatedCompletionDate, right.estimatedCompletionDate, "asc")
        );
    }

    if (selectedView.type === "project") {
      return incompleteTasks.filter((task) => task.taskProjectId === selectedView.projectId);
    }

    if (selectedView.type === "completed-project") {
      return sortedTasks.filter(
        (task) => task.taskProjectId === selectedView.projectId && isTaskCompleted(task)
      );
    }

    if (selectedView.type === "collection") {
      return incompleteTasks.filter((task) => task.taskCollectionId === selectedView.collectionId);
    }

    if (selectedView.type === "completed-collection") {
      return sortedTasks.filter(
        (task) => task.taskCollectionId === selectedView.collectionId && isTaskCompleted(task)
      );
    }

    return incompleteTasks;
  }, [incompleteTasks, now, selectedView, sortedTasks, todayKey, tomorrowKey]);

  const filteredVisibleTasks = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    if (normalizedQuery.length === 0) {
      return visibleTasks;
    }

    return visibleTasks.filter((task) => {
      const columnName = columnsById.get(task.columnId)?.name ?? "";
      const projectName =
        task.taskProjectId !== null
          ? taskProjectsById.get(task.taskProjectId)?.name ?? ""
          : "";
      const collectionName =
        task.taskCollectionId !== null
          ? taskCollectionsById.get(task.taskCollectionId)?.name ?? ""
          : "";

      return [
        task.title,
        task.description,
        columnName,
        projectName,
        collectionName,
        task.studyPlatform,
        task.studyTopic,
        task.studyDifficulty ?? "",
        task.studyStatus
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [
    columnsById,
    searchQuery,
    taskCollectionsById,
    taskProjectsById,
    visibleTasks
  ]);

  const sortedVisibleTasks = useMemo(() => {
    if (!taskSort) {
      return filteredVisibleTasks;
    }

    const directionMultiplier = taskSort.direction === "asc" ? 1 : -1;

    return filteredVisibleTasks.slice().sort((left, right) => {
      const leftStatus = columnsById.get(left.columnId)?.name ?? "Not Started";
      const rightStatus = columnsById.get(right.columnId)?.name ?? "Not Started";

      switch (taskSort.key) {
        case "title": {
          return directionMultiplier * compareText(left.title, right.title);
        }
        case "status": {
          return directionMultiplier * compareText(leftStatus, rightStatus);
        }
        case "priority": {
          return (
            directionMultiplier *
            (TASK_PRIORITY_RANK[left.priority] - TASK_PRIORITY_RANK[right.priority])
          );
        }
        case "estimated": {
          return directionMultiplier * (left.estimatedPomodoros - right.estimatedPomodoros);
        }
        case "completed": {
          return directionMultiplier * (left.pomodoroCount - right.pomodoroCount);
        }
        case "dueDate": {
          return compareOptionalDate(
            left.estimatedCompletionDate,
            right.estimatedCompletionDate,
            taskSort.direction
          );
        }
        case "studyPlatform": {
          return directionMultiplier * compareText(left.studyPlatform, right.studyPlatform);
        }
        case "studyDifficulty": {
          return (
            directionMultiplier *
            ((left.studyDifficulty ? STUDY_DIFFICULTY_RANK[left.studyDifficulty] : -1) -
              (right.studyDifficulty ? STUDY_DIFFICULTY_RANK[right.studyDifficulty] : -1))
          );
        }
        case "studyStatus": {
          return (
            directionMultiplier *
            (STUDY_STATUS_RANK[left.studyStatus] - STUDY_STATUS_RANK[right.studyStatus])
          );
        }
        case "timesCompleted": {
          return directionMultiplier * (left.timesCompleted - right.timesCompleted);
        }
        case "studyTime": {
          return directionMultiplier * (left.actualTrackedSeconds - right.actualTrackedSeconds);
        }
      }
    });
  }, [columnsById, filteredVisibleTasks, taskSort]);

  const openTaskModal = (taskId: TaskId): void => {
    actions.selectTask(taskId);
    setModalState("edit-task");
  };

  const openCreateProjectModal = (): void => {
    setOpenTreeMenu(null);
    setEditingProjectId(null);
    setProjectName("");
    setProjectIsStudyProject(false);
    setModalState("create-project");
  };

  const openCreateTaskModal = (): void => {
    const selectedCollection =
      selectedView.type === "collection" || selectedView.type === "completed-collection"
        ? taskCollectionsById.get(selectedView.collectionId) ?? null
        : null;
    const selectedProjectId =
      selectedView.type === "project" || selectedView.type === "completed-project"
        ? selectedView.projectId
        : selectedCollection?.taskProjectId ?? null;
    const selectedProject =
      selectedProjectId !== null
        ? taskProjectsById.get(selectedProjectId) ?? null
        : null;
    const preferredProject =
      selectedProject &&
      taskCollections.some((collection) => collection.taskProjectId === selectedProject.id)
        ? selectedProject
        : availableDraftProjects[0] ?? null;
    const preferredCollection =
      selectedCollection && selectedCollection.taskProjectId === preferredProject?.id
        ? selectedCollection
        : preferredProject
          ? collectionsByProject.get(preferredProject.id)?.[0] ?? null
          : null;

    setDraft({
      ...createDefaultTaskDraft(columns[0]?.id ?? ""),
      taskProjectId: preferredProject?.id ?? "",
      taskCollectionId: preferredCollection?.id ?? "",
      isStudyProblem: preferredProject?.isStudyProject ?? false
    });
    setModalState("create-task");
  };

  useEffect(() => {
    if (!navigationIntent || handledNavigationRequestRef.current === navigationIntent.requestId) {
      return;
    }

    handledNavigationRequestRef.current = navigationIntent.requestId;
    setOpenTreeMenu(null);
    setSelectedView(navigationIntent.targetView);

    if (
      navigationIntent.targetView.type === "project" ||
      navigationIntent.targetView.type === "collection"
    ) {
      const targetProjectId =
        navigationIntent.targetView.type === "project"
          ? navigationIntent.targetView.projectId
          : (taskCollectionsById.get(navigationIntent.targetView.collectionId)?.taskProjectId ??
            null);

      if (targetProjectId) {
        setExpandedProjectIds((current) => ({
          ...current,
          [targetProjectId]: true
        }));
      }
    }

    if (
      navigationIntent.targetView.type === "completed-project" ||
      navigationIntent.targetView.type === "completed-collection"
    ) {
      const targetProjectId =
        navigationIntent.targetView.type === "completed-project"
          ? navigationIntent.targetView.projectId
          : (taskCollectionsById.get(navigationIntent.targetView.collectionId)?.taskProjectId ??
            null);

      if (targetProjectId) {
        setExpandedCompletedProjectIds((current) => ({
          ...current,
          [targetProjectId]: true
        }));
      }
    }

    actions.selectTask(navigationIntent.taskId);
    setPendingNavigationTaskId(
      navigationIntent.openTaskDetails ? navigationIntent.taskId : null
    );
    onConsumeNavigationIntent(navigationIntent.requestId);
  }, [actions, navigationIntent, onConsumeNavigationIntent, taskCollectionsById]);

  useEffect(() => {
    if (pendingNavigationTaskId === null || selectedTaskId !== pendingNavigationTaskId) {
      return;
    }

    setModalState("edit-task");
    setPendingNavigationTaskId(null);
  }, [pendingNavigationTaskId, selectedTaskId]);

  const handleDeleteTask = (taskId: TaskId): void => {
    const task = tasks.find((candidate) => candidate.id === taskId);

    if (!task) {
      return;
    }

    const confirmed = window.confirm(
      `Delete "${task.title}"? This removes the task and its Pomodoro history.`
    );

    if (!confirmed) {
      return;
    }

    actions.deleteTask(taskId);

    if (selectedTaskId === taskId) {
      setModalState(null);
    }
  };

  const handleCreateProject = (): void => {
    const trimmedName = projectName.trim();

    if (trimmedName.length === 0) {
      return;
    }

    actions.createTaskProject(trimmedName, projectIsStudyProject);
    setProjectName("");
    setProjectIsStudyProject(false);
    setModalState(null);
  };

  const handleRenameProject = (): void => {
    const trimmedName = projectName.trim();

    if (trimmedName.length === 0 || editingProjectId === null) {
      return;
    }

    const project = taskProjectsById.get(editingProjectId);

    actions.renameTaskProject(editingProjectId, trimmedName);

    if (project && project.isStudyProject !== projectIsStudyProject) {
      actions.updateTaskProjectStudyMode(editingProjectId, projectIsStudyProject);
    }

    setEditingProjectId(null);
    setProjectName("");
    setProjectIsStudyProject(false);
    setModalState(null);
  };

  const handleCreateCollection = (): void => {
    const trimmedName = collectionName.trim();

    if (trimmedName.length === 0 || collectionProjectId === null) {
      return;
    }

    actions.createTaskCollection(trimmedName, collectionProjectId);
    setCollectionName("");
    setCollectionProjectId(null);
    setModalState(null);
  };

  const handleRenameCollection = (): void => {
    const trimmedName = collectionName.trim();

    if (trimmedName.length === 0 || editingCollectionId === null) {
      return;
    }

    actions.renameTaskCollection(editingCollectionId, trimmedName);
    setEditingCollectionId(null);
    setCollectionProjectId(null);
    setCollectionName("");
    setModalState(null);
  };

  const handleCreateTask = (): void => {
    if (!draft.columnId || !draft.taskProjectId || !draft.taskCollectionId) {
      return;
    }

    actions.createTask({
      columnId: draft.columnId,
      title: draft.title,
      description: draft.description,
      priority: draft.priority,
      taskProjectId: draft.taskProjectId,
      taskCollectionId: draft.taskCollectionId,
      estimatedCompletionDate: draft.estimatedCompletionDate || null,
      estimatedPomodoros:
        draft.estimatedPomodoros.trim() === "" ? 0 : Number(draft.estimatedPomodoros),
      isStudyProblem: isDraftStudyProject || draft.isStudyProblem,
      studyPlatform: draft.studyPlatform,
      studyUrl: draft.studyUrl,
      studyDifficulty: draft.studyDifficulty,
      studyTopic: draft.studyTopic,
      studyStatus: draft.studyStatus,
      timesCompleted:
        draft.timesCompleted.trim() === "" ? 0 : Number(draft.timesCompleted)
    });
    setModalState(null);
  };

  const handleImportMarkdownContent = (
    fileName: string,
    content: string,
    inlineErrors = false
  ): boolean => {
    const parsedImport = parseMarkdownImportDocument(content);

    if (!parsedImport.ok) {
      if (inlineErrors) {
        setComposerErrors(parsedImport.errors);
      } else {
        setImportFeedback({
          kind: "error",
          fileName,
          errors: parsedImport.errors
        });
      }

      return false;
    }

    const applyResult = actions.importMarkdownDocument(parsedImport.document);

    if (!applyResult.ok) {
      if (inlineErrors) {
        setComposerErrors(applyResult.errors);
      } else {
        setImportFeedback({
          kind: "error",
          fileName,
          errors: applyResult.errors
        });
      }

      return false;
    }

    setComposerErrors([]);
    setImportFeedback({
      kind: "success",
      fileName,
      summary: applyResult
    });
    setSelectedView({ type: "all" });
    return true;
  };

  const handleImportMarkdown = async (): Promise<void> => {
    if (typeof window.desktop?.pickMarkdownImportFile !== "function") {
      setImportFeedback({
        kind: "error",
        fileName: "Markdown import",
        errors: [
          {
            line: 1,
            message: "Markdown import is only available in the desktop app."
          }
        ]
      });
      return;
    }

    const selectedFile = await window.desktop.pickMarkdownImportFile();

    if (!selectedFile) {
      return;
    }

    handleImportMarkdownContent(selectedFile.name, selectedFile.content);
  };

  const openMarkdownComposer = (): void => {
    setComposerMarkdown("");
    setComposerErrors([]);
    setModalState("compose-markdown");
  };

  const handleComposerImport = (): void => {
    const didImport = handleImportMarkdownContent(
      "Markdown Composer",
      composerMarkdown,
      true
    );

    if (!didImport) {
      return;
    }

    setComposerMarkdown("");
    setModalState(null);
  };

  const openCreateCollectionModal = (taskProjectId: TaskProjectId): void => {
    setEditingCollectionId(null);
    setCollectionProjectId(taskProjectId);
    setCollectionName("");
    setModalState("create-collection");
  };

  const openEditProjectModal = (taskProjectId: TaskProjectId): void => {
    const project = taskProjectsById.get(taskProjectId);

    if (!project) {
      return;
    }

    setEditingProjectId(taskProjectId);
    setProjectName(project.name);
    setProjectIsStudyProject(project.isStudyProject);
    setModalState("edit-project");
  };

  const openEditCollectionModal = (taskCollectionId: TaskCollectionId): void => {
    const collection = taskCollectionsById.get(taskCollectionId);

    if (!collection) {
      return;
    }

    setEditingCollectionId(taskCollectionId);
    setCollectionProjectId(collection.taskProjectId);
    setCollectionName(collection.name);
    setModalState("edit-collection");
  };

  const openExtendProjectDueDatesModal = (taskProjectId: TaskProjectId): void => {
    if (!taskProjectsById.has(taskProjectId)) {
      return;
    }

    setDueDateShiftTarget({ type: "project", projectId: taskProjectId });
    setDueDateShiftDays("1");
    setModalState("extend-due-dates");
  };

  const openExtendCollectionDueDatesModal = (taskCollectionId: TaskCollectionId): void => {
    if (!taskCollectionsById.has(taskCollectionId)) {
      return;
    }

    setDueDateShiftTarget({ type: "collection", collectionId: taskCollectionId });
    setDueDateShiftDays("1");
    setModalState("extend-due-dates");
  };

  const handleExtendDueDates = (): void => {
    if (!dueDateShiftTarget) {
      return;
    }

    const normalizedDayCount = Math.max(1, Math.floor(Number(dueDateShiftDays)));

    if (!Number.isFinite(normalizedDayCount)) {
      return;
    }

    if (dueDateShiftTarget.type === "project") {
      actions.extendTaskProjectDueDates(dueDateShiftTarget.projectId, normalizedDayCount);
    } else {
      actions.extendTaskCollectionDueDates(dueDateShiftTarget.collectionId, normalizedDayCount);
    }

    setDueDateShiftTarget(null);
    setDueDateShiftDays("1");
    setModalState(null);
  };

  const handleDeleteProject = (taskProjectId: TaskProjectId): void => {
    const project = taskProjectsById.get(taskProjectId);

    if (!project) {
      return;
    }

    const confirmed = window.confirm(
      `Delete "${project.name}" and all of its collections, tasks, and Pomodoro history?`
    );

    if (!confirmed) {
      return;
    }

    if (
      ((selectedView.type === "project" || selectedView.type === "completed-project") &&
        selectedView.projectId === taskProjectId) ||
      (selectedView.type === "collection" &&
        taskCollectionsById.get(selectedView.collectionId)?.taskProjectId === taskProjectId) ||
      (selectedView.type === "completed-collection" &&
        taskCollectionsById.get(selectedView.collectionId)?.taskProjectId === taskProjectId)
    ) {
      setSelectedView({ type: "all" });
    }

    actions.deleteTaskProject(taskProjectId);
  };

  const handleDeleteCollection = (taskCollectionId: TaskCollectionId): void => {
    const collection = taskCollectionsById.get(taskCollectionId);

    if (!collection) {
      return;
    }

    const confirmed = window.confirm(
      `Delete "${collection.name}" and all of its tasks and Pomodoro history?`
    );

    if (!confirmed) {
      return;
    }

    if (
      (selectedView.type === "collection" ||
        selectedView.type === "completed-collection") &&
      selectedView.collectionId === taskCollectionId
    ) {
      setSelectedView({ type: "all" });
    }

    actions.deleteTaskCollection(taskCollectionId);
  };

  const toggleProjectExpanded = (taskProjectId: TaskProjectId): void => {
    setExpandedProjectIds((current) => ({
      ...current,
      [taskProjectId]: !(current[taskProjectId] ?? true)
    }));
  };

  const toggleCompletedProjectExpanded = (taskProjectId: TaskProjectId): void => {
    setExpandedCompletedProjectIds((current) => ({
      ...current,
      [taskProjectId]: !(current[taskProjectId] ?? true)
    }));
  };

  const viewTitle = getViewTitle(selectedView, taskCollectionsById, taskProjectsById);
  const activeViewBadge =
    selectedView.type === "collection" || selectedView.type === "completed-collection"
      ? taskCollectionsById.get(selectedView.collectionId) ?? null
      : null;

  useLayoutEffect(() => {
    const focusTargetRef =
      modalState === "create-project" || modalState === "edit-project"
        ? projectNameInputRef
        : modalState === "create-collection" || modalState === "edit-collection"
          ? collectionNameInputRef
          : modalState === "extend-due-dates"
            ? dueDateShiftInputRef
            : null;

    if (!focusTargetRef) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      const focusTarget = focusTargetRef.current;

      if (!focusTarget) {
        return;
      }

      focusTarget.focus();
      focusTarget.select();
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [modalState]);

  useEffect(() => {
    if (openTreeMenu === null) {
      return;
    }

    const handlePointerDown = (event: MouseEvent): void => {
      const target = event.target;

      if (target instanceof HTMLElement && target.closest("[data-tree-menu-root='true']")) {
        return;
      }

      setOpenTreeMenu(null);
    };

    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [openTreeMenu]);

  return (
    <div className="tasks-layout">
      <aside className="tasks-sidebar-card">
        <div className="tasks-sidebar-section">
          <button
            className={`tasks-sidebar-row tasks-sidebar-filter-row tasks-sidebar-filter-row--today${
              selectedView.type === "today" ? " is-active" : ""
            }`}
            onClick={() => setSelectedView({ type: "today" })}
            type="button"
          >
            <span className="tasks-sidebar-filter-label">
              <TaskFilterIcon name="today" />
              <span>Today</span>
            </span>
            <strong>{counts.today}</strong>
          </button>
          <button
            className={`tasks-sidebar-row tasks-sidebar-filter-row tasks-sidebar-filter-row--tomorrow${
              selectedView.type === "tomorrow" ? " is-active" : ""
            }`}
            onClick={() => setSelectedView({ type: "tomorrow" })}
            type="button"
          >
            <span className="tasks-sidebar-filter-label">
              <TaskFilterIcon name="tomorrow" />
              <span>Tomorrow</span>
            </span>
            <strong>{counts.tomorrow}</strong>
          </button>
          <button
            className={`tasks-sidebar-row tasks-sidebar-filter-row tasks-sidebar-filter-row--month${
              selectedView.type === "month" ? " is-active" : ""
            }`}
            onClick={() => setSelectedView({ type: "month" })}
            type="button"
          >
            <span className="tasks-sidebar-filter-label">
              <TaskFilterIcon name="month" />
              <span>This Month</span>
            </span>
            <strong>{counts.month}</strong>
          </button>
          <button
            className={`tasks-sidebar-row tasks-sidebar-filter-row tasks-sidebar-filter-row--scheduled${
              selectedView.type === "scheduled" ? " is-active" : ""
            }`}
            onClick={() => setSelectedView({ type: "scheduled" })}
            type="button"
          >
            <span className="tasks-sidebar-filter-label">
              <TaskFilterIcon name="scheduled" />
              <span>Scheduled</span>
            </span>
            <strong>{counts.scheduled}</strong>
          </button>
          <button
            className={`tasks-sidebar-row tasks-sidebar-filter-row tasks-sidebar-filter-row--all${
              selectedView.type === "all" ? " is-active" : ""
            }`}
            onClick={() => setSelectedView({ type: "all" })}
            type="button"
          >
            <span className="tasks-sidebar-filter-label">
              <TaskFilterIcon name="incomplete" />
              <span>Incomplete Tasks</span>
            </span>
            <strong>{counts.all}</strong>
          </button>
        </div>

        <div className="tasks-sidebar-divider" />

        <div className="tasks-sidebar-section">
          <div className="tasks-sidebar-section-header">
            <span>Projects</span>
            <button
              aria-label="Create project"
              className="icon-button tasks-sidebar-add"
              onClick={openCreateProjectModal}
              type="button"
            >+</button>
          </div>

          {taskProjects.map((project) => {
            const isProjectExpanded = expandedProjectIds[project.id] ?? true;
            const isProjectMenuOpen =
              openTreeMenu?.type === "project" && openTreeMenu.projectId === project.id;

            return (
              <div className="tasks-project-group" key={project.id}>
                <div className={`tasks-project-row${isProjectExpanded ? " is-expanded" : ""}`}>
                  <button
                    aria-label={
                      isProjectExpanded
                        ? `Collapse ${project.name}`
                        : `Expand ${project.name}`
                    }
                    className="icon-button tasks-project-toggle"
                    onClick={() => toggleProjectExpanded(project.id)}
                    type="button"
                  >
                    {isProjectExpanded ? "-" : "+"}
                  </button>
                  <div
                    className={`tasks-tree-pill tasks-tree-pill--project${
                      selectedView.type === "project" && selectedView.projectId === project.id
                        ? " is-active"
                        : ""
                    }${isProjectMenuOpen ? " is-menu-open" : ""}`}
                    style={buildTreePillStyle(project.color)}
                  >
                    <button
                      className="tasks-tree-pill-main"
                      onClick={() => setSelectedView({ type: "project", projectId: project.id })}
                      type="button"
                    >
                      <span className="tasks-tree-pill-label">{project.name}</span>
                      {project.isStudyProject ? (
                        <span className="study-project-badge">Study Project</span>
                      ) : null}
                    </button>
                    <div className="tasks-tree-pill-end">
                      <strong className="tasks-tree-row-count">
                        {taskCountByProject.get(project.id) ?? 0}
                      </strong>
                      <div
                        className={`tasks-tree-menu${isProjectMenuOpen ? " is-open" : ""}`}
                        data-tree-menu-root="true"
                      >
                        <button
                          aria-label={`Open actions for ${project.name}`}
                          className="icon-button icon-button--muted tasks-tree-menu-trigger"
                          onClick={() =>
                            setOpenTreeMenu((current) =>
                              current?.type === "project" && current.projectId === project.id
                                ? null
                                : { type: "project", projectId: project.id }
                            )
                          }
                          type="button"
                        >
                          <svg aria-hidden="true" viewBox="0 0 24 24">
                            <circle cx="6" cy="12" fill="currentColor" r="1.8" />
                            <circle cx="12" cy="12" fill="currentColor" r="1.8" />
                            <circle cx="18" cy="12" fill="currentColor" r="1.8" />
                          </svg>
                        </button>
                        {isProjectMenuOpen ? (
                          <div className="tasks-tree-context-menu" role="menu">
                            <button
                              className="tasks-tree-context-item"
                              onClick={() => {
                                setOpenTreeMenu(null);
                                openEditProjectModal(project.id);
                              }}
                              type="button"
                            >
                              Edit
                            </button>
                            <button
                              className="tasks-tree-context-item"
                              onClick={() => {
                                setOpenTreeMenu(null);
                                openExtendProjectDueDatesModal(project.id);
                              }}
                              type="button"
                            >
                              Extend due dates
                            </button>
                            <button
                              className="tasks-tree-context-item"
                              onClick={() => {
                                setOpenTreeMenu(null);
                                actions.updateTaskProjectStudyMode(
                                  project.id,
                                  !project.isStudyProject
                                );
                              }}
                              type="button"
                            >
                              {project.isStudyProject
                                ? "Remove Study Project"
                                : "Mark as Study Project"}
                            </button>
                            <button
                              className="tasks-tree-context-item tasks-tree-context-item--danger"
                              onClick={() => {
                                setOpenTreeMenu(null);
                                handleDeleteProject(project.id);
                            }}
                            type="button"
                          >
                            Delete
                          </button>
                        </div>
                      ) : null}
                      </div>
                    </div>
                  </div>
                </div>

                {isProjectExpanded
                  ? (
                      <div className="tasks-project-children">
                        {collectionsByProject.get(project.id)?.map((collection) => {
                          const isCollectionMenuOpen =
                            openTreeMenu?.type === "collection" &&
                            openTreeMenu.collectionId === collection.id;

                          return (
                            <div className="tasks-project-child-row" key={collection.id}>
                              <div
                                className={`tasks-tree-pill tasks-tree-pill--collection${
                                  selectedView.type === "collection" &&
                                  selectedView.collectionId === collection.id
                                    ? " is-active"
                                    : ""
                                }${isCollectionMenuOpen ? " is-menu-open" : ""}`}
                                onDragOver={(event) => event.preventDefault()}
                                onDrop={(event) => {
                                  event.preventDefault();
                                  const taskId = event.dataTransfer.getData("text/task-id") as TaskId;

                                  if (!taskId) {
                                    return;
                                  }

                                  actions.assignTaskToCollection(taskId, collection.id);
                                }}
                                style={buildTreePillStyle(collection.color)}
                              >
                                <button
                                  className="tasks-tree-pill-main"
                                  onClick={() =>
                                    setSelectedView({
                                      type: "collection",
                                      collectionId: collection.id
                                    })
                                  }
                                  type="button"
                                >
                                  <span className="tasks-tree-pill-dot" aria-hidden="true" />
                                  <span className="tasks-tree-pill-label">{collection.name}</span>
                                </button>
                                <div className="tasks-tree-pill-end">
                                  <strong className="tasks-tree-row-count">
                                    {taskCountByCollection.get(collection.id) ?? 0}
                                  </strong>
                                  <div
                                    className={`tasks-tree-menu${
                                      isCollectionMenuOpen ? " is-open" : ""
                                    }`}
                                    data-tree-menu-root="true"
                                  >
                                    <button
                                      aria-label={`Open actions for ${collection.name}`}
                                      className="icon-button icon-button--muted tasks-tree-menu-trigger"
                                      onClick={() =>
                                        setOpenTreeMenu((current) =>
                                          current?.type === "collection" &&
                                          current.collectionId === collection.id
                                            ? null
                                            : { type: "collection", collectionId: collection.id }
                                        )
                                      }
                                      type="button"
                                    >
                                      <svg aria-hidden="true" viewBox="0 0 24 24">
                                        <circle cx="6" cy="12" fill="currentColor" r="1.8" />
                                        <circle cx="12" cy="12" fill="currentColor" r="1.8" />
                                        <circle cx="18" cy="12" fill="currentColor" r="1.8" />
                                      </svg>
                                    </button>
                                   {isCollectionMenuOpen ? (
                                     <div className="tasks-tree-context-menu" role="menu">
                                       <button
                                         className="tasks-tree-context-item"
                                         onClick={() => {
                                           setOpenTreeMenu(null);
                                           openEditCollectionModal(collection.id);
                                         }}
                                         type="button"
                                       >
                                         Edit
                                       </button>
                                       <button
                                         className="tasks-tree-context-item"
                                         onClick={() => {
                                           setOpenTreeMenu(null);
                                           openExtendCollectionDueDatesModal(collection.id);
                                         }}
                                         type="button"
                                       >
                                         Extend due dates
                                       </button>
                                       <button
                                         className="tasks-tree-context-item tasks-tree-context-item--danger"
                                         onClick={() => {
                                           setOpenTreeMenu(null);
                                           handleDeleteCollection(collection.id);
                                        }}
                                        type="button"
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  ) : null}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}

                        <button
                          className="tasks-project-create-collection tasks-sidebar-row tasks-sidebar-row--child tasks-sidebar-row--action"
                          onClick={() => openCreateCollectionModal(project.id)}
                          type="button"
                        >
                          <span className="tasks-project-create-icon" aria-hidden="true">
                            +
                          </span>
                          <span>Create collection</span>
                        </button>
                      </div>
                    )
                  : null}
              </div>
            );
          })}
        </div>

        <div className="tasks-sidebar-divider" />

        <div className="tasks-sidebar-section">
          <div className="tasks-sidebar-section-header">
            <span>Completed</span>
          </div>

          {completedProjects.map((project) => {
            const isProjectExpanded = expandedCompletedProjectIds[project.id] ?? true;

            return (
              <div className="tasks-project-group" key={`completed-${project.id}`}>
                <div className={`tasks-project-row${isProjectExpanded ? " is-expanded" : ""}`}>
                  <button
                    aria-label={
                      isProjectExpanded
                        ? `Collapse completed ${project.name}`
                        : `Expand completed ${project.name}`
                    }
                    className="icon-button tasks-project-toggle"
                    onClick={() => toggleCompletedProjectExpanded(project.id)}
                    type="button"
                  >
                    {isProjectExpanded ? "-" : "+"}
                  </button>
                  <div
                    className={`tasks-tree-pill tasks-tree-pill--project${
                      selectedView.type === "completed-project" &&
                      selectedView.projectId === project.id
                        ? " is-active"
                        : ""
                    }`}
                    style={buildTreePillStyle(project.color)}
                  >
                    <button
                      className="tasks-tree-pill-main"
                      onClick={() =>
                        setSelectedView({ type: "completed-project", projectId: project.id })
                      }
                      type="button"
                      >
                        <span className="tasks-tree-pill-label">{project.name}</span>
                        {project.isStudyProject ? (
                          <span className="study-project-badge">Study Project</span>
                        ) : null}
                      </button>
                    <div className="tasks-tree-pill-end tasks-tree-pill-end--static">
                      <strong className="tasks-tree-row-count">
                        {completedTaskCountByProject.get(project.id) ?? 0}
                      </strong>
                    </div>
                  </div>
                </div>

                {isProjectExpanded ? (
                  <div className="tasks-project-children">
                    {completedCollectionsByProject.get(project.id)?.map((collection) => (
                      <div className="tasks-project-child-row" key={`completed-${collection.id}`}>
                        <div
                          className={`tasks-tree-pill tasks-tree-pill--collection${
                            selectedView.type === "completed-collection" &&
                            selectedView.collectionId === collection.id
                              ? " is-active"
                              : ""
                          }`}
                          style={buildTreePillStyle(collection.color)}
                        >
                          <button
                            className="tasks-tree-pill-main"
                            onClick={() =>
                              setSelectedView({
                                type: "completed-collection",
                                collectionId: collection.id
                              })
                            }
                            type="button"
                          >
                            <span className="tasks-tree-pill-dot" aria-hidden="true" />
                            <span className="tasks-tree-pill-label">{collection.name}</span>
                          </button>
                          <div className="tasks-tree-pill-end tasks-tree-pill-end--static">
                            <strong className="tasks-tree-row-count">
                              {completedTaskCountByCollection.get(collection.id) ?? 0}
                            </strong>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="tasks-sidebar-footer">
          <button
            aria-label="Open markdown composer"
            className="primary-button tasks-compose-button"
            onClick={openMarkdownComposer}
            type="button"
          >
            Compose
          </button>
          <div className="tasks-sidebar-footer-row">
            <button
              className="ghost-button tasks-import-button"
              onClick={() => void handleImportMarkdown()}
              type="button"
            >
              Import markdown
            </button>
            <button
              aria-label="Markdown import help"
              className="icon-button tasks-import-help"
              onClick={() => setIsImportHelpOpen(true)}
              type="button"
            >
              ?
            </button>
          </div>
        </div>
      </aside>

      <section className="tasks-main">
        <div className="tasks-main-header">
          <div className="board-title">
            <div className="tasks-title-row">
              <h2>{viewTitle}</h2>
              {activeViewBadge ? (
                <CollectionBadge color={activeViewBadge.color} compact name={activeViewBadge.name} />
              ) : null}
            </div>
            <p>
              {sortedVisibleTasks.length} task{sortedVisibleTasks.length === 1 ? "" : "s"} in
              view.
            </p>
          </div>
          <div className="tasks-main-header-actions">
            <label className="tasks-search-field">
              <span className="sr-only">Search current task list</span>
              <span className="tasks-search-icon">
                <TaskFilterIcon name="search" />
              </span>
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search tasks"
              />
            </label>
            <button className="primary-button tasks-create-button" onClick={openCreateTaskModal} type="button">
              <TaskFilterIcon name="plus" />
              Create task
            </button>
          </div>
        </div>

        {sortedVisibleTasks.length > 0 ? (
          <div className={`tasks-table${isStudyTableView ? " tasks-table--study" : ""}`}>
            <div className="tasks-table-head">
              <button
                className={`tasks-sort-button${taskSort?.key === "title" ? " is-active" : ""}`}
                onClick={() => setTaskSort((current) => getNextTaskSortState(current, "title"))}
                type="button"
              >
                <span>Task name</span>
                <SortIndicator
                  direction={taskSort?.key === "title" ? taskSort.direction : null}
                  isActive={taskSort?.key === "title"}
                />
              </button>
              {isStudyTableView ? (
                <>
                  <button
                    className={`tasks-sort-button${taskSort?.key === "studyPlatform" ? " is-active" : ""}`}
                    onClick={() =>
                      setTaskSort((current) => getNextTaskSortState(current, "studyPlatform"))
                    }
                    type="button"
                  >
                    <span>Platform</span>
                    <SortIndicator
                      direction={taskSort?.key === "studyPlatform" ? taskSort.direction : null}
                      isActive={taskSort?.key === "studyPlatform"}
                    />
                  </button>
                  <button
                    className={`tasks-sort-button${taskSort?.key === "studyDifficulty" ? " is-active" : ""}`}
                    onClick={() =>
                      setTaskSort((current) => getNextTaskSortState(current, "studyDifficulty"))
                    }
                    type="button"
                  >
                    <span>Difficulty</span>
                    <SortIndicator
                      direction={taskSort?.key === "studyDifficulty" ? taskSort.direction : null}
                      isActive={taskSort?.key === "studyDifficulty"}
                    />
                  </button>
                  <button
                    className={`tasks-sort-button${taskSort?.key === "studyStatus" ? " is-active" : ""}`}
                    onClick={() =>
                      setTaskSort((current) => getNextTaskSortState(current, "studyStatus"))
                    }
                    type="button"
                  >
                    <span>Study status</span>
                    <SortIndicator
                      direction={taskSort?.key === "studyStatus" ? taskSort.direction : null}
                      isActive={taskSort?.key === "studyStatus"}
                    />
                  </button>
                  <button
                    className={`tasks-sort-button${taskSort?.key === "timesCompleted" ? " is-active" : ""}`}
                    onClick={() =>
                      setTaskSort((current) => getNextTaskSortState(current, "timesCompleted"))
                    }
                    type="button"
                  >
                    <span>Completed</span>
                    <SortIndicator
                      direction={taskSort?.key === "timesCompleted" ? taskSort.direction : null}
                      isActive={taskSort?.key === "timesCompleted"}
                    />
                  </button>
                  <button
                    className={`tasks-sort-button${taskSort?.key === "studyTime" ? " is-active" : ""}`}
                    onClick={() =>
                      setTaskSort((current) => getNextTaskSortState(current, "studyTime"))
                    }
                    type="button"
                  >
                    <span>Study time</span>
                    <SortIndicator
                      direction={taskSort?.key === "studyTime" ? taskSort.direction : null}
                      isActive={taskSort?.key === "studyTime"}
                    />
                  </button>
                </>
              ) : (
                <>
                  <button
                    className={`tasks-sort-button${taskSort?.key === "status" ? " is-active" : ""}`}
                    onClick={() =>
                      setTaskSort((current) => getNextTaskSortState(current, "status"))
                    }
                    type="button"
                  >
                    <span>Status</span>
                    <SortIndicator
                      direction={taskSort?.key === "status" ? taskSort.direction : null}
                      isActive={taskSort?.key === "status"}
                    />
                  </button>
                  <button
                    className={`tasks-sort-button${taskSort?.key === "priority" ? " is-active" : ""}`}
                    onClick={() =>
                      setTaskSort((current) => getNextTaskSortState(current, "priority"))
                    }
                    type="button"
                  >
                    <span>Priority</span>
                    <SortIndicator
                      direction={taskSort?.key === "priority" ? taskSort.direction : null}
                      isActive={taskSort?.key === "priority"}
                    />
                  </button>
                  <button
                    className={`tasks-sort-button${taskSort?.key === "estimated" ? " is-active" : ""}`}
                    onClick={() =>
                      setTaskSort((current) => getNextTaskSortState(current, "estimated"))
                    }
                    type="button"
                  >
                    <span>Estimated</span>
                    <SortIndicator
                      direction={taskSort?.key === "estimated" ? taskSort.direction : null}
                      isActive={taskSort?.key === "estimated"}
                    />
                  </button>
                  <button
                    className={`tasks-sort-button${taskSort?.key === "completed" ? " is-active" : ""}`}
                    onClick={() =>
                      setTaskSort((current) => getNextTaskSortState(current, "completed"))
                    }
                    type="button"
                  >
                    <span>Completed</span>
                    <SortIndicator
                      direction={taskSort?.key === "completed" ? taskSort.direction : null}
                      isActive={taskSort?.key === "completed"}
                    />
                  </button>
                  <button
                    className={`tasks-sort-button${taskSort?.key === "dueDate" ? " is-active" : ""}`}
                    onClick={() =>
                      setTaskSort((current) => getNextTaskSortState(current, "dueDate"))
                    }
                    type="button"
                  >
                    <span>Due date</span>
                    <SortIndicator
                      direction={taskSort?.key === "dueDate" ? taskSort.direction : null}
                      isActive={taskSort?.key === "dueDate"}
                    />
                  </button>
                </>
              )}
              <span aria-hidden="true" />
            </div>

            <div className="tasks-table-body">
              {sortedVisibleTasks.map((task) => {
                const taskCollection =
                  task.taskCollectionId !== null
                    ? taskCollectionsById.get(task.taskCollectionId) ?? null
                    : null;

                return (
                  <div
                    className="tasks-table-row"
                    draggable
                    key={task.id}
                    onClick={() => openTaskModal(task.id)}
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/task-id", task.id);
                    }}
                  >
                    <div className="tasks-table-cell tasks-table-cell--title">
                      <strong>{task.title}</strong>
                      {taskCollection ? (
                        <div className="tasks-table-meta">
                          <CollectionBadge
                            color={taskCollection.color}
                            compact
                            name={taskCollection.name}
                          />
                        </div>
                      ) : null}
                      {isStudyTableView && task.studyTopic.trim() !== "" ? (
                        <div className="tasks-table-study-topic">{task.studyTopic}</div>
                      ) : null}
                    </div>
                    {isStudyTableView ? (
                      <>
                        <div className="tasks-table-cell">
                          <span className="tasks-table-muted-value">
                            {task.studyPlatform.trim() || "—"}
                          </span>
                        </div>
                        <div className="tasks-table-cell">
                          {task.studyDifficulty ? (
                            <span
                              className={`study-table-pill study-table-pill--${task.studyDifficulty}`}
                            >
                              {task.studyDifficulty}
                            </span>
                          ) : (
                            <span className="tasks-table-muted-value">—</span>
                          )}
                        </div>
                        <div className="tasks-table-cell">
                          <span className={`study-table-pill study-table-pill--${task.studyStatus}`}>
                            {task.studyStatus.replace("_", " ")}
                          </span>
                        </div>
                        <div className="tasks-table-cell">
                          <strong className="tasks-table-number-value">
                            x{task.timesCompleted}
                          </strong>
                        </div>
                        <div className="tasks-table-cell">
                          <strong className="tasks-table-number-value">
                            {formatDurationSummary(task.actualTrackedSeconds)}
                          </strong>
                        </div>
                      </>
                    ) : (
                      <>
                      <div className="tasks-table-cell">
                        <div className="tasks-status-select-wrap">
                          <select
                            aria-label={`Change status for ${task.title}`}
                            className="tasks-status-select"
                            onChange={(event) =>
                              actions.moveTask(task.id, event.target.value as ColumnId)
                            }
                            onClick={(event) => event.stopPropagation()}
                            onMouseDown={(event) => event.stopPropagation()}
                            value={task.columnId}
                          >
                            {columns.map((column) => (
                              <option key={column.id} value={column.id}>
                                {column.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="tasks-table-cell">
                        <div className="task-priority-wrap">
                          <span className={`priority-pill priority-pill--${task.priority}`}>
                            {task.priority}
                          </span>
                        </div>
                      </div>
                      <div className="tasks-table-cell">
                        <StopwatchIcons
                          count={task.estimatedPomodoros}
                          size="sm"
                          tone="estimated"
                        />
                      </div>
                      <div className="tasks-table-cell">
                        <StopwatchIcons count={task.pomodoroCount} size="sm" tone="completed" />
                      </div>
                      <div className="tasks-table-cell tasks-table-cell--due-date">
                        <span>{task.estimatedCompletionDate ?? "Unplanned"}</span>
                        <OverdueIndicator task={task} />
                      </div>
                      </>
                    )}
                    <div className="tasks-table-cell tasks-table-cell--actions">
                      <button
                        aria-label={`Focus ${task.title}`}
                        className="tasks-row-focus-button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onFocusTask(task.id);
                        }}
                        title="Focus task"
                        type="button"
                      >
                        <TaskFilterIcon name="focus" />
                      </button>
                      <button
                        aria-label="Delete task"
                        className="icon-button icon-button--muted"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleDeleteTask(task.id);
                        }}
                        type="button"
                      >
                        <svg aria-hidden="true" viewBox="0 0 24 24">
                          <path
                            d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-2 6h2v8H7V9Zm4 0h2v8h-2V9Zm4 0h2v8h-2V9ZM6 21l-1-14h14l-1 14H6Z"
                            fill="currentColor"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="empty-state">
            No tasks match this view yet.
          </div>
        )}
      </section>

      {modalState !== null ? (
        <div className="modal-overlay" onClick={() => setModalState(null)} role="presentation">
          <div
            className="modal-card"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            {modalState === "create-project" ? (
              <section className="panel-stack">
                <div className="modal-header">
                  <div>
                    <h3>Create Project</h3>
                    <p className="subtle">Use projects to group several collections together.</p>
                  </div>
                  <button
                    className="ghost-button"
                    onClick={() => setModalState(null)}
                    type="button"
                  >
                    Close
                  </button>
                </div>

                <label className="label-stack">
                  <span>Project title</span>
                  <input
                    autoFocus
                    ref={projectNameInputRef}
                    value={projectName}
                    onChange={(event) => setProjectName(event.target.value)}
                    placeholder="Example: Desktop App"
                  />
                </label>

                <label className="study-project-option">
                  <input
                    checked={projectIsStudyProject}
                    onChange={(event) => setProjectIsStudyProject(event.target.checked)}
                    type="checkbox"
                  />
                  <span>
                    <strong>Study project</strong>
                    <small>Tasks in this project use study-problem fields and timers.</small>
                  </span>
                </label>

                <div className="modal-footer">
                  <button
                    className="ghost-button"
                    onClick={() => setModalState(null)}
                    type="button"
                  >
                    Cancel
                  </button>
                  <button
                    className="primary-button"
                    onClick={handleCreateProject}
                    type="button"
                  >
                    Create project
                  </button>
                </div>
              </section>
            ) : null}

            {modalState === "edit-project" ? (
              <section className="panel-stack">
                <div className="modal-header">
                  <div>
                    <h3>Edit Project</h3>
                    <p className="subtle">Update the project title shown across the workspace.</p>
                  </div>
                  <button
                    className="ghost-button"
                    onClick={() => setModalState(null)}
                    type="button"
                  >
                    Close
                  </button>
                </div>

                <label className="label-stack">
                  <span>Project title</span>
                  <input
                    autoFocus
                    ref={projectNameInputRef}
                    value={projectName}
                    onChange={(event) => setProjectName(event.target.value)}
                    placeholder="Example: Desktop App"
                  />
                </label>

                <label className="study-project-option">
                  <input
                    checked={projectIsStudyProject}
                    onChange={(event) => setProjectIsStudyProject(event.target.checked)}
                    type="checkbox"
                  />
                  <span>
                    <strong>Study project</strong>
                    <small>Tasks in this project use study-problem fields and timers.</small>
                  </span>
                </label>

                <div className="modal-footer">
                  <button
                    className="ghost-button"
                    onClick={() => setModalState(null)}
                    type="button"
                  >
                    Cancel
                  </button>
                  <button
                    className="primary-button"
                    disabled={editingProjectId === null || projectName.trim().length === 0}
                    onClick={handleRenameProject}
                    type="button"
                  >
                    Save project
                  </button>
                </div>
              </section>
            ) : null}

            {modalState === "create-collection" ? (
              <section className="panel-stack">
                <div className="modal-header">
                  <div>
                    <h3>Create Collection</h3>
                    <p className="subtle">Collections are always created inside a project.</p>
                  </div>
                  <button
                    className="ghost-button"
                    onClick={() => setModalState(null)}
                    type="button"
                  >
                    Close
                  </button>
                </div>

                <label className="label-stack">
                  <span>Project</span>
                  <input
                    readOnly
                    onMouseDown={(event) => event.stopPropagation()}
                    onPointerDown={(event) => event.stopPropagation()}
                    value={
                      collectionProjectId
                        ? (taskProjectsById.get(collectionProjectId)?.name ?? "")
                        : ""
                    }
                  />
                </label>

                <label className="label-stack">
                  <span>Collection title</span>
                  <input
                    autoFocus
                    onMouseDown={(event) => event.stopPropagation()}
                    onPointerDown={(event) => event.stopPropagation()}
                    ref={collectionNameInputRef}
                    value={collectionName}
                    onChange={(event) => setCollectionName(event.target.value)}
                    placeholder="Example: Landing Page"
                  />
                </label>

                <div className="modal-footer">
                  <button
                    className="ghost-button"
                    onClick={() => setModalState(null)}
                    type="button"
                  >
                    Cancel
                  </button>
                  <button
                    className="primary-button"
                    disabled={collectionProjectId === null || collectionName.trim().length === 0}
                    onClick={handleCreateCollection}
                    type="button"
                  >
                    Create collection
                  </button>
                </div>
              </section>
            ) : null}

            {modalState === "edit-collection" ? (
              <section className="panel-stack">
                <div className="modal-header">
                  <div>
                    <h3>Edit Collection</h3>
                    <p className="subtle">Update the collection title inside its current project.</p>
                  </div>
                  <button
                    className="ghost-button"
                    onClick={() => setModalState(null)}
                    type="button"
                  >
                    Close
                  </button>
                </div>

                <label className="label-stack">
                  <span>Project</span>
                  <input
                    readOnly
                    onMouseDown={(event) => event.stopPropagation()}
                    onPointerDown={(event) => event.stopPropagation()}
                    value={
                      collectionProjectId
                        ? (taskProjectsById.get(collectionProjectId)?.name ?? "")
                        : ""
                    }
                  />
                </label>

                <label className="label-stack">
                  <span>Collection title</span>
                  <input
                    autoFocus
                    onMouseDown={(event) => event.stopPropagation()}
                    onPointerDown={(event) => event.stopPropagation()}
                    ref={collectionNameInputRef}
                    value={collectionName}
                    onChange={(event) => setCollectionName(event.target.value)}
                    placeholder="Example: Landing Page"
                  />
                </label>

                <div className="modal-footer">
                  <button
                    className="ghost-button"
                    onClick={() => setModalState(null)}
                    type="button"
                  >
                    Cancel
                  </button>
                  <button
                    className="primary-button"
                    disabled={editingCollectionId === null || collectionName.trim().length === 0}
                    onClick={handleRenameCollection}
                    type="button"
                  >
                    Save collection
                  </button>
                </div>
              </section>
            ) : null}

            {modalState === "create-task" ? (
              <section className="panel-stack">
                <div className="modal-header">
                  <div>
                    <h3>Create Task</h3>
                    <p className="subtle">Add a task directly from the Tasks page.</p>
                  </div>
                  <button
                    className="ghost-button"
                    onClick={() => setModalState(null)}
                    type="button"
                  >
                    Close
                  </button>
                </div>

                <div className="task-details-form">
                  {!isDraftStudyProject ? (
                    <label className="label-stack">
                      <span>Column</span>
                      <select
                        onMouseDown={(event) => event.stopPropagation()}
                        onPointerDown={(event) => event.stopPropagation()}
                        value={draft.columnId}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            columnId: event.target.value as ColumnId
                          }))
                        }
                      >
                        {columns.map((column) => (
                          <option key={column.id} value={column.id}>
                            {column.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}

                  <label className="label-stack">
                    <span>Project</span>
                    <select
                      onMouseDown={(event) => event.stopPropagation()}
                      onPointerDown={(event) => event.stopPropagation()}
                      value={draft.taskProjectId}
                      onChange={(event) =>
                        setDraft((current) => {
                          const nextProjectId = event.target.value as TaskProjectId | "";
                          const nextProjectCollections = taskCollections.filter(
                            (collection) => collection.taskProjectId === nextProjectId
                          );
                          const nextCollectionId =
                            current.taskCollectionId !== "" &&
                            nextProjectCollections.some(
                              (collection) => collection.id === current.taskCollectionId
                            )
                              ? current.taskCollectionId
                              : (nextProjectCollections[0]?.id ?? "");

                          return {
                            ...current,
                            taskProjectId: nextProjectId,
                            taskCollectionId: nextCollectionId,
                            isStudyProblem:
                              nextProjectId === ""
                                ? false
                                : (taskProjectsById.get(nextProjectId)?.isStudyProject ?? false)
                          };
                        })
                      }
                    >
                      <option value="" disabled>
                        Select project
                      </option>
                      {availableDraftProjects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="label-stack">
                    <span>Collection</span>
                    <select
                      onMouseDown={(event) => event.stopPropagation()}
                      onPointerDown={(event) => event.stopPropagation()}
                      value={draft.taskCollectionId}
                      onChange={(event) =>
                        setDraft((current) => {
                          const nextCollectionId = event.target.value as TaskCollectionId | "";
                          const matchedCollection =
                            nextCollectionId === ""
                              ? null
                              : taskCollections.find(
                                  (collection) => collection.id === nextCollectionId
                                ) ?? null;

                          return {
                            ...current,
                            taskProjectId: matchedCollection?.taskProjectId ?? current.taskProjectId,
                            taskCollectionId: nextCollectionId,
                            isStudyProblem:
                              matchedCollection?.taskProjectId === undefined ||
                              matchedCollection.taskProjectId === null
                                ? current.isStudyProblem
                                : (taskProjectsById.get(matchedCollection.taskProjectId)
                                    ?.isStudyProject ?? false)
                          };
                        })
                      }
                    >
                      <option value="" disabled>
                        Select collection
                      </option>
                      {availableDraftCollections.map((collection) => (
                        <option key={collection.id} value={collection.id}>
                          {collection.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="label-stack">
                    <span>Title</span>
                    <input
                      onMouseDown={(event) => event.stopPropagation()}
                      onPointerDown={(event) => event.stopPropagation()}
                      value={draft.title}
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, title: event.target.value }))
                      }
                    />
                  </label>

                  <label className="label-stack">
                    <span>Description</span>
                    <textarea
                      className="text-area"
                      onMouseDown={(event) => event.stopPropagation()}
                      onPointerDown={(event) => event.stopPropagation()}
                      rows={4}
                      value={draft.description}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          description: event.target.value
                        }))
                      }
                    />
                  </label>

                  {!isDraftStudyProject ? (
                    <>
                  <div className="sub-grid">
                    <label className="label-stack">
                      <span>Priority</span>
                      <select
                        onMouseDown={(event) => event.stopPropagation()}
                        onPointerDown={(event) => event.stopPropagation()}
                        value={draft.priority}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            priority: event.target.value as TaskPriority
                          }))
                        }
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </label>

                    <label className="label-stack">
                      <span>Estimated completion date</span>
                      <CalendarInput
                        value={draft.estimatedCompletionDate}
                        onChange={(nextValue) =>
                          setDraft((current) => ({
                            ...current,
                            estimatedCompletionDate: nextValue
                          }))
                        }
                      />
                    </label>
                  </div>

                  <label className="label-stack">
                    <span>Estimated Pomodoros</span>
                    <input
                      min={0}
                      onMouseDown={(event) => event.stopPropagation()}
                      onPointerDown={(event) => event.stopPropagation()}
                      placeholder="0"
                      type="number"
                      value={draft.estimatedPomodoros}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          estimatedPomodoros: event.target.value
                        }))
                      }
                    />
                  </label>
                    </>
                  ) : null}

                  {isDraftStudyProject ? (
                  <section className="study-problem-card">
                    <div className="study-problem-header">
                      <div>
                        <strong>Study problem</strong>
                        <span className="subtle">
                          Inherited from the selected Study Project.
                        </span>
                      </div>
                      <span className="study-project-badge">Study Project</span>
                    </div>

                    <>
                        <div className="sub-grid">
                          <label className="label-stack">
                            <span>Platform</span>
                            <input
                              onMouseDown={(event) => event.stopPropagation()}
                              onPointerDown={(event) => event.stopPropagation()}
                              placeholder="LeetCode"
                              value={draft.studyPlatform}
                              onChange={(event) =>
                                setDraft((current) => ({
                                  ...current,
                                  studyPlatform: event.target.value
                                }))
                              }
                            />
                          </label>

                          <label className="label-stack">
                            <span>Difficulty</span>
                            <select
                              onMouseDown={(event) => event.stopPropagation()}
                              onPointerDown={(event) => event.stopPropagation()}
                              value={draft.studyDifficulty ?? ""}
                              onChange={(event) =>
                                setDraft((current) => ({
                                  ...current,
                                  studyDifficulty:
                                    event.target.value === ""
                                      ? null
                                      : (event.target.value as Task["studyDifficulty"])
                                }))
                              }
                            >
                              <option value="">Unspecified</option>
                              <option value="easy">Easy</option>
                              <option value="medium">Medium</option>
                              <option value="hard">Hard</option>
                            </select>
                          </label>
                        </div>

                        <div className="sub-grid">
                          <label className="label-stack">
                            <span>Status</span>
                            <select
                              onMouseDown={(event) => event.stopPropagation()}
                              onPointerDown={(event) => event.stopPropagation()}
                              value={draft.studyStatus}
                              onChange={(event) =>
                                setDraft((current) => ({
                                  ...current,
                                  studyStatus: event.target.value as Task["studyStatus"]
                                }))
                              }
                            >
                              <option value="unstarted">Unstarted</option>
                              <option value="attempted">Attempted</option>
                              <option value="solved">Solved</option>
                              <option value="reviewing">Reviewing</option>
                            </select>
                          </label>

                          <label className="label-stack">
                            <span>Times completed</span>
                            <input
                              min={0}
                              onMouseDown={(event) => event.stopPropagation()}
                              onPointerDown={(event) => event.stopPropagation()}
                              placeholder="0"
                              type="number"
                              value={draft.timesCompleted}
                              onChange={(event) =>
                                setDraft((current) => ({
                                  ...current,
                                  timesCompleted: event.target.value
                                }))
                              }
                            />
                          </label>
                        </div>

                        <label className="label-stack">
                          <span>Topic</span>
                          <input
                            onMouseDown={(event) => event.stopPropagation()}
                            onPointerDown={(event) => event.stopPropagation()}
                            placeholder="Graphs, DP, Two pointers..."
                            value={draft.studyTopic}
                            onChange={(event) =>
                              setDraft((current) => ({
                                ...current,
                                studyTopic: event.target.value
                              }))
                            }
                          />
                        </label>

                        <label className="label-stack">
                          <span>Problem URL</span>
                          <input
                            onMouseDown={(event) => event.stopPropagation()}
                            onPointerDown={(event) => event.stopPropagation()}
                            placeholder="https://leetcode.com/problems/..."
                            type="url"
                            value={draft.studyUrl}
                            onChange={(event) =>
                              setDraft((current) => ({
                                ...current,
                                studyUrl: event.target.value
                              }))
                            }
                          />
                        </label>
                    </>
                  </section>
                  ) : null}
                </div>

                <div className="modal-footer">
                  <button
                    className="ghost-button"
                    onClick={() => setModalState(null)}
                    type="button"
                  >
                    Cancel
                  </button>
                  <button
                    className="primary-button"
                    disabled={!draft.columnId || !draft.taskProjectId || !draft.taskCollectionId}
                    onClick={handleCreateTask}
                    type="button"
                  >
                    Create task
                  </button>
                </div>
              </section>
            ) : null}

            {modalState === "extend-due-dates" && dueDateShiftScope ? (
              <section className="panel-stack">
                <div className="modal-header">
                  <div>
                    <h3>Extend Due Dates</h3>
                    <p className="subtle">{dueDateShiftScope.subtitle}</p>
                  </div>
                  <button
                    className="ghost-button"
                    onClick={() => {
                      setDueDateShiftTarget(null);
                      setDueDateShiftDays("1");
                      setModalState(null);
                    }}
                    type="button"
                  >
                    Close
                  </button>
                </div>

                <div className="focus-stat-grid tasks-shift-preview-grid">
                  <div className="focus-stat-card">
                    <span>{dueDateShiftScope.targetTypeLabel}</span>
                    <strong>{dueDateShiftScope.targetLabel}</strong>
                  </div>
                  <div className="focus-stat-card">
                    <span>Scheduled tasks</span>
                    <strong>{dueDateShiftScope.scheduledTaskCount}</strong>
                  </div>
                  <div className="focus-stat-card">
                    <span>No due date</span>
                    <strong>{dueDateShiftScope.unscheduledTaskCount}</strong>
                  </div>
                  <div className="focus-stat-card">
                    <span>Completed</span>
                    <strong>{dueDateShiftScope.completedTaskCount}</strong>
                  </div>
                </div>

                <label className="label-stack">
                  <span>Days to add</span>
                  <input
                    min={1}
                    onMouseDown={(event) => event.stopPropagation()}
                    onPointerDown={(event) => event.stopPropagation()}
                    ref={dueDateShiftInputRef}
                    type="number"
                    value={dueDateShiftDays}
                    onChange={(event) => setDueDateShiftDays(event.target.value)}
                  />
                </label>

                <div className="import-help-copy">
                  <p className="subtle">
                    Only incomplete tasks that already have a due date will be updated. Tasks
                    without a due date and completed tasks are left unchanged.
                  </p>
                </div>

                <div className="modal-footer">
                  <button
                    className="ghost-button"
                    onClick={() => {
                      setDueDateShiftTarget(null);
                      setDueDateShiftDays("1");
                      setModalState(null);
                    }}
                    type="button"
                  >
                    Cancel
                  </button>
                  <button
                    className="primary-button"
                    disabled={dueDateShiftScope.scheduledTaskCount === 0}
                    onClick={handleExtendDueDates}
                    type="button"
                  >
                    {dueDateShiftScope.actionLabel}
                  </button>
                </div>
              </section>
            ) : null}

            {modalState === "compose-markdown" ? (
              <section className="panel-stack">
                <div className="modal-header">
                  <div>
                    <h3>Compose Markdown</h3>
                    <p className="subtle">
                      Draft a structured project list here, then import it directly into the
                      workspace.
                    </p>
                  </div>
                  <button
                    className="ghost-button"
                    onClick={() => setModalState(null)}
                    type="button"
                  >
                    Close
                  </button>
                </div>

                <div className="import-help-copy">
                  <p className="subtle">
                    Use <strong># Project</strong>, <strong>## Collection</strong>, and task
                    bullets with optional <strong>EP</strong>, <strong>Date</strong>, and{" "}
                    <strong>Priority</strong> fields. Indented lines under a task become its
                    description.
                  </p>
                </div>

                <label className="label-stack">
                  <span>Markdown</span>
                  <textarea
                    autoFocus
                    className="text-area import-composer-textarea"
                    onMouseDown={(event) => event.stopPropagation()}
                    onPointerDown={(event) => event.stopPropagation()}
                    rows={18}
                    spellCheck={false}
                    value={composerMarkdown}
                    placeholder={MARKDOWN_IMPORT_TEMPLATE}
                    onChange={(event) => {
                      setComposerMarkdown(event.target.value);

                      if (composerErrors.length > 0) {
                        setComposerErrors([]);
                      }
                    }}
                  />
                </label>

                {composerErrors.length > 0 ? (
                  <div className="import-feedback-list import-feedback-list--inline">
                    {composerErrors.map((error, index) => (
                      <div className="history-item" key={`${error.line}-${index}`}>
                        <strong>Line {error.line}</strong>
                        <span>{error.message}</span>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="modal-footer">
                  <button
                    className="ghost-button"
                    onClick={() => setModalState(null)}
                    type="button"
                  >
                    Cancel
                  </button>
                  <button
                    className="primary-button"
                    onClick={handleComposerImport}
                    type="button"
                  >
                    Import
                  </button>
                </div>
              </section>
            ) : null}

            {modalState === "edit-task" && selectedTask ? (
              <TaskDetailsPanel
                task={selectedTask}
                columns={columns}
                taskProjects={taskProjects}
                taskCollections={taskCollections}
                fieldDefinitions={selectedTaskFieldDefinitions}
                fieldValues={selectedTaskFieldValues}
                sessionHistory={pomodoroSessions.filter(
                  (session) => session.taskId === selectedTask.id
                )}
                onUpdateTitle={actions.updateTaskTitle}
                onUpdateDescription={actions.updateTaskDescription}
                onUpdateTaskProject={actions.assignTaskToProject}
                onUpdateTaskCollection={actions.assignTaskToCollection}
                onUpdateStatus={actions.moveTask}
                onUpdatePriority={actions.updateTaskPriority}
                onUpdateEstimatedDate={actions.updateTaskEstimatedDate}
                onUpdateEstimatedPomodoros={actions.updateTaskEstimatedPomodoros}
                onUpdateCompletedPomodoros={actions.updateTaskCompletedPomodoros}
                onUpdateStudyMetadata={actions.updateTaskStudyMetadata}
                onUpdateFieldValue={actions.updateTaskFieldValue}
                onDeleteTask={() => handleDeleteTask(selectedTask.id)}
              />
            ) : null}
          </div>
        </div>
      ) : null}

      {isImportHelpOpen ? (
        <div
          className="modal-overlay"
          onClick={() => setIsImportHelpOpen(false)}
          role="presentation"
        >
          <div
            className="modal-card"
            onClick={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            role="dialog"
          >
            <section className="panel-stack">
              <div className="modal-header">
                <div>
                  <h3>Markdown Import Format</h3>
                  <p className="subtle">
                    Use one project heading, one collection heading, then task bullets with
                    optional inline fields.
                  </p>
                </div>
                <button
                  className="ghost-button"
                  onClick={() => setIsImportHelpOpen(false)}
                  type="button"
                >
                  Close
                </button>
              </div>

              <div className="import-help-copy">
                <p className="subtle">
                  Supported task fields are <strong>EP</strong>, <strong>Date</strong>, and{" "}
                  <strong>Priority</strong>. Indented lines under a task become its description.
                </p>
                <pre className="import-help-code">
                  <code>{MARKDOWN_IMPORT_TEMPLATE}</code>
                </pre>
              </div>

              <div className="modal-footer">
                <button
                  className="primary-button"
                  onClick={() => setIsImportHelpOpen(false)}
                  type="button"
                >
                  Done
                </button>
              </div>
            </section>
          </div>
        </div>
      ) : null}

      {importFeedback ? (
        <div
          className="modal-overlay"
          onClick={() => setImportFeedback(null)}
          role="presentation"
        >
          <div
            className="modal-card"
            onClick={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            role="dialog"
          >
            <section className="panel-stack">
              <div className="modal-header">
                <div>
                  <h3>
                    {importFeedback.kind === "success"
                      ? "Markdown Imported"
                      : "Import Issues"}
                  </h3>
                  <p className="subtle">{importFeedback.fileName}</p>
                </div>
                <button
                  className="ghost-button"
                  onClick={() => setImportFeedback(null)}
                  type="button"
                >
                  Close
                </button>
              </div>

              {importFeedback.kind === "success" ? (
                <div className="import-feedback-summary">
                  <div className="focus-stat-grid">
                    <div className="focus-stat-card">
                      <span>Projects</span>
                      <strong>
                        +{importFeedback.summary.summary.projectsCreated} /{" "}
                        {importFeedback.summary.summary.projectsUpdated} updated
                      </strong>
                    </div>
                    <div className="focus-stat-card">
                      <span>Collections</span>
                      <strong>
                        +{importFeedback.summary.summary.collectionsCreated} /{" "}
                        {importFeedback.summary.summary.collectionsUpdated} updated
                      </strong>
                    </div>
                    <div className="focus-stat-card">
                      <span>Tasks</span>
                      <strong>
                        +{importFeedback.summary.summary.tasksCreated} /{" "}
                        {importFeedback.summary.summary.tasksUpdated} updated
                      </strong>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="import-feedback-list">
                  {importFeedback.errors.map((error, index) => (
                    <div className="history-item" key={`${error.line}-${index}`}>
                      <strong>Line {error.line}</strong>
                      <span>{error.message}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="modal-footer">
                <button
                  className="primary-button"
                  onClick={() => setImportFeedback(null)}
                  type="button"
                >
                  Done
                </button>
              </div>
            </section>
          </div>
        </div>
      ) : null}
    </div>
  );
};
