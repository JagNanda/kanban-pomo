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
import type { TaskId, TaskPriority } from "../../tasks/domain/task.types";
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

interface CreateTaskDraft {
  columnId: ColumnId | "";
  title: string;
  description: string;
  priority: TaskPriority;
  taskProjectId: TaskProjectId | "";
  taskCollectionId: TaskCollectionId | "";
  estimatedCompletionDate: string;
  estimatedPomodoros: string;
}

const getTodaySummary = (state: BoardViewState) => {
  const completedColumn = state.columns.find((column) =>
    ["completed", "done"].includes(column.name.trim().toLowerCase())
  );

  const completedTasks = completedColumn
    ? state.tasks.filter((task) => task.columnId === completedColumn.id)
    : [];

  const openTasks = state.tasks.filter((task) => task.columnId !== completedColumn?.id);

  const todayPomodoroSeconds = state.pomodoroSessions
    .filter((session) => {
      const now = new Date();
      const startedAt = new Date(session.startedAt);

      return (
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
  estimatedPomodoros: ""
});

export const BoardScreen = ({
  state,
  actions,
  onStartPomodoro
}: BoardScreenProps): JSX.Element => {
  const [modalState, setModalState] = useState<ModalState>(null);
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldType, setNewFieldType] = useState<FieldType>("text");
  const [newFieldScope, setNewFieldScope] = useState<FieldScope>("global");
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

  const todaySummary = useMemo(() => getTodaySummary(state), [state]);
  const sortedColumns = useMemo(
    () => state.columns.slice().sort((left, right) => left.orderIndex - right.orderIndex),
    [state.columns]
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
  const taskCollectionsById = useMemo(
    () => new Map(state.taskCollections.map((collection) => [collection.id, collection])),
    [state.taskCollections]
  );
  const availableDraftProjects = state.taskProjects.filter((project) =>
    state.taskCollections.some((collection) => collection.taskProjectId === project.id)
  );
  const availableDraftCollections = state.taskCollections.filter(
    (collection) => collection.taskProjectId === draft.taskProjectId
  );

  const openCreateTaskModal = (): void => {
    const firstProject = availableDraftProjects[0];
    const firstCollection =
      firstProject !== undefined
        ? state.taskCollections.find((collection) => collection.taskProjectId === firstProject.id)
        : undefined;

    setDraft({
      ...createDefaultTaskDraft(state.columns[0]?.id ?? ""),
      taskProjectId: firstProject?.id ?? "",
      taskCollectionId: firstCollection?.id ?? ""
    });
    setModalState("create-task");
  };

  const openTaskModal = (taskId: TaskId): void => {
    actions.selectTask(taskId);
    setModalState("edit-task");
  };

  const closeModal = (): void => {
    setModalState(null);
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
          : Number(draft.estimatedPomodoros)
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

  return (
    <div className={boardLayoutClassName} style={boardLayoutStyle}>
      <section className="today-banner">
        <h2>Today</h2>
        <div className="today-banner-card">
          <div className="today-stat">
            <strong>{todaySummary.estimatedMinutes}m</strong>
            <span>Estimated Time</span>
          </div>
          <div className="today-stat">
            <strong>{todaySummary.openTaskCount}</strong>
            <span>Tasks to be Completed</span>
          </div>
          <div className="today-stat">
            <strong>{todaySummary.elapsedMinutes}m</strong>
            <span>Elapsed Time</span>
          </div>
          <div className="today-stat">
            <strong>{todaySummary.completedTaskCount}</strong>
            <span>Completed Tasks</span>
          </div>
        </div>
      </section>

      <div className="board-header">
        <div className="board-title">
          <h2>{state.board.name}</h2>
          <p>Plan work, inspect tasks in overlays, and jump straight into focus mode.</p>
        </div>
        <div className="task-actions">
          <button className="ghost-button" onClick={() => setModalState("column-fields")} type="button">
            Column fields
          </button>
          <button className="ghost-button" onClick={openCreateTaskModal} type="button">
            Add task
          </button>
          <button className="primary-button" onClick={actions.addColumn} type="button">
            Add column
          </button>
        </div>
      </div>

      <div className="board-scroll">
        {sortedColumns.map((column) => (
            <ColumnLane
              key={column.id}
              column={column}
              tasks={state.tasks
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
              onSelectTask={openTaskModal}
              onMoveTask={actions.moveTask}
              onReorderColumn={actions.reorderColumns}
              onStartPomodoro={onStartPomodoro}
              onDeleteTask={handleDeleteTaskById}
            />
          ))}
      </div>

      {modalState !== null ? (
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
                onUpdateTitle={actions.updateTaskTitle}
                onUpdateDescription={actions.updateTaskDescription}
                onUpdateTaskProject={actions.assignTaskToProject}
                onUpdateTaskCollection={actions.assignTaskToCollection}
                onUpdateStatus={actions.moveTask}
                onUpdatePriority={actions.updateTaskPriority}
                onUpdateEstimatedDate={actions.updateTaskEstimatedDate}
                onUpdateEstimatedPomodoros={actions.updateTaskEstimatedPomodoros}
                onUpdateCompletedPomodoros={actions.updateTaskCompletedPomodoros}
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
