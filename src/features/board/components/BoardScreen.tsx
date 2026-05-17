import { useMemo, useState, type CSSProperties } from "react";
import { CalendarInput } from "../../../shared/components/CalendarInput";
import type { ColumnId } from "../../columns/domain/column.types";
import type {
  FieldDefinition,
  FieldScope,
  FieldType
} from "../../custom-fields/domain/custom-fields.types";
import { TaskDetailsPanel } from "../../tasks/components/TaskDetailsPanel";
import type { TaskCollectionId } from "../../tasks/domain/task-collection.types";
import type { TaskProjectId } from "../../tasks/domain/task-project.types";
import type { Task, TaskId, TaskPriority } from "../../tasks/domain/task.types";
import { ColumnLane } from "./ColumnLane";
import type {
  BoardViewState,
  CreateTaskInput
} from "../application/useBoardState";

interface BoardScreenProps {
  state: BoardViewState;
  actions: {
    selectTask: (taskId: TaskId) => void;
    createTaskProject: (name: string) => void;
    createTaskCollection: (name: string, taskProjectId: TaskProjectId) => void;
    addColumn: () => void;
    deleteColumn: (columnId: ColumnId) => void;
    reorderColumns: (sourceColumnId: ColumnId, targetColumnId: ColumnId) => void;
    updateColumn: (columnId: ColumnId, updates: { name: string; color: string }) => void;
    createTask: (input: CreateTaskInput) => void;
    assignTaskToProject: (taskId: TaskId, taskProjectId: TaskProjectId | null) => void;
    assignTaskToCollection: (taskId: TaskId, taskCollectionId: TaskCollectionId | null) => void;
    moveTask: (taskId: TaskId, targetColumnId: ColumnId) => void;
    ensureTaskInDev: (taskId: TaskId) => void;
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
    deleteTask: (taskId: TaskId) => void;
    addFieldDefinition: (
      taskId: TaskId | null,
      name: string,
      type: FieldType,
      scope: FieldScope
    ) => void;
    updateTaskFieldValue: (
      taskId: TaskId,
      fieldDefinitionId: FieldDefinition["id"],
      nextValue: string | number | boolean
    ) => void;
  };
  onStartPomodoro: (taskId: TaskId) => void;
}

type ModalState = "create-task" | "column-fields" | "edit-task" | null;
type BoardProjectFilter = TaskProjectId | "all";

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

interface EditColumnDraft {
  columnId: ColumnId;
  name: string;
  color: string;
}

type TodayStatKind = "estimated" | "tasks" | "elapsed" | "completed";

interface TodayStatCard {
  kind: TodayStatKind;
  label: string;
  tone: "blue" | "violet" | "amber" | "green";
  value: string;
}

const getTodaySummary = ({
  columns,
  pomodoroSessions,
  tasks
}: Pick<BoardViewState, "columns" | "pomodoroSessions" | "tasks">) => {
  const completedColumn = columns.find((column) =>
    ["completed", "done"].includes(column.name.trim().toLowerCase())
  );

  const completedTasks = completedColumn
    ? tasks.filter((task) => task.columnId === completedColumn.id)
    : [];

  const openTasks = tasks.filter((task) => task.columnId !== completedColumn?.id);
  const taskIds = new Set(tasks.map((task) => task.id));

  const todayPomodoroSeconds = pomodoroSessions
    .filter((session) => {
      const now = new Date();
      const startedAt = new Date(session.startedAt);

      return (
        taskIds.has(session.taskId) &&
        startedAt.getFullYear() === now.getFullYear() &&
        startedAt.getMonth() === now.getMonth() &&
        startedAt.getDate() === now.getDate()
      );
    })
    .reduce((sum, session) => sum + session.actualDurationSeconds, 0);

  return {
    estimatedMinutes: openTasks.reduce(
      (sum, task) => sum + task.estimatedPomodoros * 25,
      0
    ),
    openTaskCount: openTasks.length,
    elapsedMinutes: Math.round(todayPomodoroSeconds / 60),
    completedTaskCount: completedTasks.length
  };
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

const TodayStatIcon = ({ kind }: { kind: TodayStatKind }): JSX.Element => {
  switch (kind) {
    case "estimated":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="8" />
          <path d="M12 7v5l3.5 2.1" />
        </svg>
      );
    case "tasks":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M9 7h10" />
          <path d="M9 12h10" />
          <path d="M9 17h10" />
          <path d="m4 7 .7.7L6.4 6" />
          <path d="m4 12 .7.7 1.7-1.7" />
          <path d="m4 17 .7.7 1.7-1.7" />
        </svg>
      );
    case "elapsed":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M9 2h6" />
          <path d="M12 2v3" />
          <path d="M17.5 6.5 19 5" />
          <circle cx="12" cy="13" r="7" />
          <path d="M12 9v5l3 2" />
        </svg>
      );
    case "completed":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="8" />
          <path d="m8.5 12.4 2.2 2.2 4.8-5.2" />
        </svg>
      );
  }
};

const ButtonIcon = ({ name }: { name: "sliders" | "plus" | "column" }): JSX.Element => {
  switch (name) {
    case "sliders":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M4 7h10" />
          <path d="M18 7h2" />
          <circle cx="16" cy="7" r="2" />
          <path d="M4 17h2" />
          <path d="M10 17h10" />
          <circle cx="8" cy="17" r="2" />
          <path d="M4 12h4" />
          <path d="M12 12h8" />
          <circle cx="10" cy="12" r="2" />
        </svg>
      );
    case "plus":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
      );
    case "column":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M12 5v14" />
          <path d="M5 9h14" />
          <path d="M5 15h14" />
        </svg>
      );
  }
};

export const BoardScreen = ({
  state,
  actions,
  onStartPomodoro
}: BoardScreenProps): JSX.Element => {
  const [modalState, setModalState] = useState<ModalState>(null);
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldType, setNewFieldType] = useState<FieldType>("text");
  const [newFieldScope, setNewFieldScope] = useState<FieldScope>("global");
  const [editColumnDraft, setEditColumnDraft] = useState<EditColumnDraft | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<BoardProjectFilter>("all");
  const [draft, setDraft] = useState<CreateTaskDraft>(() =>
    createDefaultTaskDraft(state.columns[0]?.id ?? "")
  );

  const selectedTask =
    state.tasks.find((task) => task.id === state.selectedTaskId) ?? null;

  const selectedTaskFieldDefinitions = selectedTask
    ? state.fieldDefinitions.filter((definition) => {
        if (definition.scope === "global") {
          return true;
        }

        return state.taskFieldAssignments.some(
          (assignment) =>
            assignment.fieldDefinitionId === definition.id &&
            assignment.taskId === selectedTask.id
        );
      })
    : [];

  const selectedTaskFieldValues = selectedTask
    ? state.taskFieldValues.filter((fieldValue) => fieldValue.taskId === selectedTask.id)
    : [];

  const sortedColumns = useMemo(
    () => state.columns.slice().sort((left, right) => left.orderIndex - right.orderIndex),
    [state.columns]
  );
  const sortedTaskProjects = useMemo(
    () =>
      state.taskProjects
        .slice()
        .sort((left, right) => left.orderIndex - right.orderIndex),
    [state.taskProjects]
  );
  const taskCollectionsById = useMemo(
    () => new Map(state.taskCollections.map((collection) => [collection.id, collection])),
    [state.taskCollections]
  );
  const activeProjectFilter =
    selectedProjectId === "all" ||
    sortedTaskProjects.some((project) => project.id === selectedProjectId)
      ? selectedProjectId
      : "all";
  const selectedProject =
    activeProjectFilter === "all"
      ? null
      : sortedTaskProjects.find((project) => project.id === activeProjectFilter) ?? null;
  const filteredTasks = useMemo(() => {
    if (activeProjectFilter === "all") {
      return state.tasks;
    }

    return state.tasks.filter((task) => {
      if (task.taskProjectId === activeProjectFilter) {
        return true;
      }

      if (!task.taskCollectionId) {
        return false;
      }

      return taskCollectionsById.get(task.taskCollectionId)?.taskProjectId === activeProjectFilter;
    });
  }, [activeProjectFilter, state.tasks, taskCollectionsById]);
  const todaySummary = useMemo(
    () =>
      getTodaySummary({
        columns: state.columns,
        pomodoroSessions: state.pomodoroSessions,
        tasks: filteredTasks
      }),
    [filteredTasks, state.columns, state.pomodoroSessions]
  );
  const boardLayoutClassName = [
    "panel-stack",
    "board-workspace",
    sortedColumns.length >= 5 ? "board-workspace--dense" : "",
    sortedColumns.length >= 6 ? "board-workspace--compact" : ""
  ]
    .filter(Boolean)
    .join(" ");
  const boardLayoutStyle = {
    "--board-column-count": String(Math.max(sortedColumns.length, 1))
  } as CSSProperties;
  const availableDraftProjects = state.taskProjects.filter((project) =>
    state.taskCollections.some((collection) => collection.taskProjectId === project.id)
  );
  const availableDraftCollections = state.taskCollections.filter(
    (collection) => collection.taskProjectId === draft.taskProjectId
  );

  const openCreateTaskModal = (
    columnId: ColumnId | "" = state.columns[0]?.id ?? ""
  ): void => {
    const firstProject = availableDraftProjects[0];
    const firstCollection =
      firstProject !== undefined
        ? state.taskCollections.find((collection) => collection.taskProjectId === firstProject.id)
        : undefined;

    setDraft({
      ...createDefaultTaskDraft(columnId || (state.columns[0]?.id ?? "")),
      taskProjectId: firstProject?.id ?? "",
      taskCollectionId: firstCollection?.id ?? ""
    });
    setEditColumnDraft(null);
    setModalState("create-task");
  };

  const openTaskModal = (taskId: TaskId): void => {
    actions.selectTask(taskId);
    setEditColumnDraft(null);
    setModalState("edit-task");
  };

  const openEditColumnModal = (columnId: ColumnId): void => {
    const column = state.columns.find((candidate) => candidate.id === columnId);

    if (!column) {
      return;
    }

    setModalState(null);
    setEditColumnDraft({
      columnId: column.id,
      name: column.name,
      color: column.color
    });
  };

  const closeModal = (): void => {
    setModalState(null);
    setEditColumnDraft(null);
  };

  const handleDeleteTaskById = (taskId: TaskId): void => {
    const task = state.tasks.find((candidate) => candidate.id === taskId);

    if (!task) {
      return;
    }

    const confirmed = window.confirm(
      `Delete "${task.title}"? This removes the task and its Pomodoro history.`
    );

    if (!confirmed) {
      return;
    }

    actions.deleteTask(task.id);

    if (selectedTask?.id === task.id) {
      closeModal();
    }
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
        draft.estimatedPomodoros.trim() === ""
          ? 0
          : Number(draft.estimatedPomodoros),
      isStudyProblem: draft.isStudyProblem,
      studyPlatform: draft.studyPlatform,
      studyUrl: draft.studyUrl,
      studyDifficulty: draft.studyDifficulty,
      studyTopic: draft.studyTopic,
      studyStatus: draft.studyStatus,
      timesCompleted:
        draft.timesCompleted.trim() === "" ? 0 : Number(draft.timesCompleted)
    });
    closeModal();
  };

  const handleFieldCreate = (): void => {
    const trimmedName = newFieldName.trim();

    if (trimmedName.length === 0) {
      return;
    }

    actions.addFieldDefinition(
      newFieldScope === "task_specific" ? state.selectedTaskId : null,
      trimmedName,
      newFieldType,
      newFieldScope
    );
    setNewFieldName("");
    setNewFieldType("text");
    setNewFieldScope("global");
  };

  const handleUpdateColumn = (): void => {
    if (!editColumnDraft) {
      return;
    }

    actions.updateColumn(editColumnDraft.columnId, {
      name: editColumnDraft.name,
      color: editColumnDraft.color
    });
    setEditColumnDraft(null);
  };

  const todayStatCards: TodayStatCard[] = [
    {
      kind: "estimated",
      label: "Estimated Time",
      tone: "blue",
      value: `${todaySummary.estimatedMinutes}m`
    },
    {
      kind: "tasks",
      label: "Tasks to be Completed",
      tone: "violet",
      value: String(todaySummary.openTaskCount)
    },
    {
      kind: "elapsed",
      label: "Elapsed Time",
      tone: "amber",
      value: `${todaySummary.elapsedMinutes}m`
    },
    {
      kind: "completed",
      label: "Completed Tasks",
      tone: "green",
      value: String(todaySummary.completedTaskCount)
    }
  ];

  return (
    <div className={boardLayoutClassName} style={boardLayoutStyle}>
      <section className="today-banner">
        <h2>Today</h2>
        <div className="today-banner-card">
          {todayStatCards.map((stat) => (
            <div className={`today-stat today-stat--${stat.tone}`} key={stat.kind}>
              <span className="today-stat-icon">
                <TodayStatIcon kind={stat.kind} />
              </span>
              <span className="today-stat-copy">
                <strong>{stat.value}</strong>
                <span>{stat.label}</span>
              </span>
            </div>
          ))}
        </div>
      </section>

      <div className="board-header">
        <div className="board-title">
          <h2>{state.board.name}</h2>
          <p>Plan work, inspect tasks in overlays, and jump straight into focus mode.</p>
        </div>
        <div className="task-actions">
          <label className="board-project-filter">
            <span className="board-project-filter-swatch-wrap" aria-hidden="true">
              <span
                className="board-project-filter-swatch"
                style={
                  {
                    "--project-filter-color": selectedProject?.color ?? "#6b9dff"
                  } as CSSProperties
                }
              />
            </span>
            <span className="board-project-filter-label">Project</span>
            <select
              aria-label="Filter board by project"
              value={activeProjectFilter}
              onChange={(event) =>
                setSelectedProjectId(event.target.value as BoardProjectFilter)
              }
            >
              <option value="all">All projects</option>
              {sortedTaskProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <button
            className="ghost-button board-action-button"
            onClick={() => setModalState("column-fields")}
            type="button"
          >
            <ButtonIcon name="sliders" />
            Column fields
          </button>
          <button
            className="ghost-button board-action-button"
            onClick={() => openCreateTaskModal()}
            type="button"
          >
            <ButtonIcon name="plus" />
            Add task
          </button>
          <button
            className="primary-button board-action-button"
            onClick={actions.addColumn}
            type="button"
          >
            <ButtonIcon name="column" />
            Add column
          </button>
        </div>
      </div>

      <div className="board-scroll">
        {sortedColumns.map((column) => (
          <ColumnLane
            key={column.id}
            column={column}
            tasks={filteredTasks
              .filter((task) => task.columnId === column.id)
              .sort((left, right) => left.orderIndex - right.orderIndex)}
            taskCollectionsById={taskCollectionsById}
            selectedTaskId={state.selectedTaskId}
            onDeleteColumn={(columnId) => {
              const taskCount = state.tasks.filter((task) => task.columnId === columnId).length;
              const confirmed = window.confirm(
                `Delete "${column.name}" and its ${taskCount} task${
                  taskCount === 1 ? "" : "s"
                }?`
              );

              if (confirmed) {
                actions.deleteColumn(columnId);
              }
            }}
            onEditColumn={openEditColumnModal}
            onSelectTask={openTaskModal}
            onMoveTask={actions.moveTask}
            onReorderColumn={actions.reorderColumns}
            onStartPomodoro={onStartPomodoro}
            onDeleteTask={handleDeleteTaskById}
            onCreateTask={openCreateTaskModal}
          />
        ))}
      </div>

      {modalState !== null || editColumnDraft !== null ? (
        <div
          className="modal-overlay"
          onClick={closeModal}
          role="presentation"
        >
          <div
            className="modal-card"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            {modalState === "create-task" ? (
              <section className="panel-stack">
                <div className="modal-header">
                  <div>
                    <h3>Create Task</h3>
                    <p className="subtle">Fill in the task details before adding it to the board.</p>
                  </div>
                  <button className="ghost-button" onClick={closeModal} type="button">
                    Close
                  </button>
                </div>

                <div className="task-details-form">
                  <label className="label-stack">
                    <span>Column</span>
                    <select
                      value={draft.columnId}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          columnId: event.target.value as ColumnId
                        }))
                      }
                    >
                      {state.columns.map((column) => (
                        <option key={column.id} value={column.id}>
                          {column.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="label-stack">
                    <span>Project</span>
                    <select
                      value={draft.taskProjectId}
                      onChange={(event) =>
                        setDraft((current) => {
                          const nextProjectId = event.target.value as TaskProjectId | "";
                          const nextProjectCollections = state.taskCollections.filter(
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
                            taskCollectionId: nextCollectionId
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
                      value={draft.taskCollectionId}
                      onChange={(event) =>
                        setDraft((current) => {
                          const nextCollectionId = event.target.value as TaskCollectionId | "";
                          const matchedCollection =
                            nextCollectionId === ""
                              ? null
                              : state.taskCollections.find(
                                  (collection) => collection.id === nextCollectionId
                                ) ?? null;

                          return {
                            ...current,
                            taskProjectId: matchedCollection?.taskProjectId ?? current.taskProjectId,
                            taskCollectionId: nextCollectionId
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

                  <div className="sub-grid">
                    <label className="label-stack">
                      <span>Priority</span>
                      <select
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

                  <section className="study-problem-card">
                    <div className="study-problem-header">
                      <div>
                        <strong>Study problem</strong>
                        <span className="subtle">
                          Mark this as a coding-practice problem while creating it.
                        </span>
                      </div>
                      <label className="study-problem-toggle">
                        <input
                          checked={draft.isStudyProblem}
                          onChange={(event) =>
                            setDraft((current) => ({
                              ...current,
                              isStudyProblem: event.target.checked
                            }))
                          }
                          type="checkbox"
                        />
                        <span>{draft.isStudyProblem ? "Enabled" : "Off"}</span>
                      </label>
                    </div>

                    {draft.isStudyProblem ? (
                      <>
                        <div className="sub-grid">
                          <label className="label-stack">
                            <span>Platform</span>
                            <input
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
                    ) : null}
                  </section>
                </div>

                <div className="modal-footer">
                  <button className="ghost-button" onClick={closeModal} type="button">
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

            {editColumnDraft ? (
              <section className="panel-stack">
                <div className="modal-header">
                  <div>
                    <h3>Edit Column</h3>
                    <p className="subtle">Rename this lane and choose its board color.</p>
                  </div>
                  <button className="ghost-button" onClick={closeModal} type="button">
                    Close
                  </button>
                </div>

                <div className="task-details-form">
                  <label className="label-stack">
                    <span>Column name</span>
                    <input
                      autoFocus
                      value={editColumnDraft.name}
                      onChange={(event) =>
                        setEditColumnDraft((current) =>
                          current
                            ? {
                                ...current,
                                name: event.target.value
                              }
                            : current
                        )
                      }
                    />
                  </label>

                  <label className="label-stack">
                    <span>Column color</span>
                    <div className="column-color-field">
                      <input
                        className="column-color-input"
                        type="color"
                        value={editColumnDraft.color}
                        onChange={(event) =>
                          setEditColumnDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  color: event.target.value
                                }
                              : current
                          )
                        }
                      />
                      <input
                        value={editColumnDraft.color}
                        onChange={(event) =>
                          setEditColumnDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  color: event.target.value
                                }
                              : current
                          )
                        }
                        placeholder="#8b74ea"
                      />
                    </div>
                  </label>
                </div>

                <div className="modal-footer">
                  <button className="ghost-button" onClick={closeModal} type="button">
                    Cancel
                  </button>
                  <button className="primary-button" onClick={handleUpdateColumn} type="button">
                    Save column
                  </button>
                </div>
              </section>
            ) : null}

            {modalState === "column-fields" ? (
              <section className="panel-stack">
                <div className="modal-header">
                  <div>
                    <h3>Column Fields</h3>
                    <p className="subtle">Manage shared and task-specific custom fields.</p>
                  </div>
                  <button className="ghost-button" onClick={closeModal} type="button">
                    Close
                  </button>
                </div>

                <label className="label-stack">
                  <span>Field name</span>
                  <input
                    value={newFieldName}
                    onChange={(event) => setNewFieldName(event.target.value)}
                    placeholder="Example: QA signoff"
                  />
                </label>

                <div className="sub-grid">
                  <label className="label-stack">
                    <span>Field type</span>
                    <select
                      value={newFieldType}
                      onChange={(event) => setNewFieldType(event.target.value as FieldType)}
                    >
                      <option value="text">Text</option>
                      <option value="number">Number</option>
                      <option value="boolean">Boolean</option>
                    </select>
                  </label>

                  <label className="label-stack">
                    <span>Field scope</span>
                    <select
                      value={newFieldScope}
                      onChange={(event) => setNewFieldScope(event.target.value as FieldScope)}
                    >
                      <option value="global">Global</option>
                      <option value="task_specific">Selected task only</option>
                    </select>
                  </label>
                </div>

                <button
                  className="primary-button"
                  disabled={newFieldScope === "task_specific" && state.selectedTaskId === null}
                  onClick={handleFieldCreate}
                  type="button"
                >
                  Add field definition
                </button>

                <div className="field-list-header">
                  <strong>Available fields</strong>
                  <span className="subtle">{state.fieldDefinitions.length} total</span>
                </div>

                <div className="field-stack">
                  {state.fieldDefinitions.map((definition) => {
                    const taskSpecificValue = selectedTaskFieldValues.find(
                      (fieldValue) => fieldValue.fieldDefinitionId === definition.id
                    );

                    return (
                      <div className="history-item" key={definition.id}>
                        <div>
                          <strong>{definition.name}</strong>
                          <span>
                            {definition.type} / {definition.scope.replace("_", " ")}
                          </span>
                        </div>
                        <div className="history-meta">
                          <span>
                            {taskSpecificValue
                              ? `Selected task value: ${
                                  taskSpecificValue.type === "boolean"
                                    ? taskSpecificValue.value
                                      ? "Yes"
                                      : "No"
                                    : taskSpecificValue.value
                                }`
                              : "No value on selected task"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {modalState === "edit-task" && selectedTask ? (
              <TaskDetailsPanel
                task={selectedTask}
                columns={state.columns}
                taskProjects={state.taskProjects}
                taskCollections={state.taskCollections}
                fieldDefinitions={selectedTaskFieldDefinitions}
                fieldValues={selectedTaskFieldValues}
                sessionHistory={state.pomodoroSessions.filter(
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
                onDeleteTask={() => handleDeleteTaskById(selectedTask.id)}
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
};
