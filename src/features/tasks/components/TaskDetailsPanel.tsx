import { useEffect, useRef } from "react";
import type {
  FieldDefinition,
  TaskFieldValue
} from "../../custom-fields/domain/custom-fields.types";
import type { Column, ColumnId } from "../../columns/domain/column.types";
import { CalendarInput } from "../../../shared/components/CalendarInput";
import { CollectionBadge } from "./CollectionBadge";
import type {
  TaskCollection,
  TaskCollectionId
} from "../domain/task-collection.types";
import type {
  TaskProject,
  TaskProjectId
} from "../domain/task-project.types";
import type { Task, TaskId, TaskPriority } from "../domain/task.types";
import { StopwatchIcons } from "./StopwatchIcons";

interface TaskDetailsPanelProps {
  task: Task | null;
  columns: Column[];
  taskProjects: TaskProject[];
  taskCollections: TaskCollection[];
  fieldDefinitions: FieldDefinition[];
  fieldValues: TaskFieldValue[];
  onUpdateTitle: (taskId: TaskId, title: string) => void;
  onUpdateDescription: (taskId: TaskId, description: string) => void;
  onUpdateTaskProject: (taskId: TaskId, taskProjectId: TaskProjectId | null) => void;
  onUpdateTaskCollection: (taskId: TaskId, taskCollectionId: TaskCollectionId | null) => void;
  onUpdateStatus: (taskId: TaskId, columnId: ColumnId) => void;
  onUpdatePriority: (taskId: TaskId, priority: TaskPriority) => void;
  onUpdateEstimatedDate: (taskId: TaskId, estimatedCompletionDate: string) => void;
  onUpdateEstimatedPomodoros: (taskId: TaskId, estimatedPomodoros: number) => void;
  onUpdateCompletedPomodoros: (taskId: TaskId, pomodoroCount: number) => void;
  onUpdateFieldValue: (
    taskId: TaskId,
    fieldDefinitionId: FieldDefinition["id"],
    nextValue: string | number | boolean
  ) => void;
  onDeleteTask: () => void;
}

const getFieldValue = (
  fieldValues: TaskFieldValue[],
  fieldDefinitionId: FieldDefinition["id"]
): TaskFieldValue | undefined =>
  fieldValues.find((fieldValue) => fieldValue.fieldDefinitionId === fieldDefinitionId);

export const TaskDetailsPanel = ({
  task,
  columns,
  taskProjects,
  taskCollections,
  fieldDefinitions,
  fieldValues,
  onUpdateTitle,
  onUpdateDescription,
  onUpdateTaskProject,
  onUpdateTaskCollection,
  onUpdateStatus,
  onUpdatePriority,
  onUpdateEstimatedDate,
  onUpdateEstimatedPomodoros,
  onUpdateCompletedPomodoros,
  onUpdateFieldValue,
  onDeleteTask
}: TaskDetailsPanelProps): JSX.Element => {
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const focusTarget = titleInputRef.current;

    if (!focusTarget) {
      return;
    }

    const timerId = window.setTimeout(() => {
      focusTarget.focus();
      focusTarget.select();
    }, 0);

    return () => window.clearTimeout(timerId);
  }, [task?.id]);

  if (!task) {
    return (
      <section className="panel-card">
        <div className="empty-state">Select a task to edit its details.</div>
      </section>
    );
  }

  const filteredCollections = taskCollections.filter(
    (collection) => collection.taskProjectId === task.taskProjectId
  );
  const availableProjects = taskProjects.filter((project) =>
    taskCollections.some((collection) => collection.taskProjectId === project.id)
  );

  return (
    <section className="panel-card panel-stack">
      <div className="details-title">
        <div>
          <h3>Task details</h3>
          <p>Update the selected task and inspect the typed field values attached to it.</p>
          {task.taskCollectionId ? (
            <div className="task-details-badge-row">
              {taskCollections
                .filter((collection) => collection.id === task.taskCollectionId)
                .map((collection) => (
                  <CollectionBadge
                    color={collection.color}
                    key={collection.id}
                    name={collection.name}
                  />
                ))}
            </div>
          ) : null}
        </div>
        <button
          aria-label="Delete task"
          className="icon-button icon-button--muted"
          onClick={onDeleteTask}
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

      <div className="task-details-form">
        <label className="label-stack">
          <span>Title</span>
          <input
            onMouseDown={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            ref={titleInputRef}
            value={task.title}
            onChange={(event) => onUpdateTitle(task.id, event.target.value)}
          />
        </label>

        <label className="label-stack">
          <span>Description</span>
          <textarea
            className="text-area"
            onMouseDown={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            rows={4}
            value={task.description}
            onChange={(event) => onUpdateDescription(task.id, event.target.value)}
          />
        </label>

        <div className="sub-grid">
          <label className="label-stack">
            <span>Status</span>
            <select
              onMouseDown={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
              value={task.columnId}
              onChange={(event) => onUpdateStatus(task.id, event.target.value as ColumnId)}
            >
              {columns.map((column) => (
                <option key={column.id} value={column.id}>
                  {column.name}
                </option>
              ))}
            </select>
          </label>

          <label className="label-stack">
            <span>Project</span>
            <select
              onMouseDown={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
              value={task.taskProjectId ?? ""}
              onChange={(event) =>
                onUpdateTaskProject(
                  task.id,
                  event.target.value as TaskProjectId
                )
              }
            >
              {availableProjects.map((project) => (
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
              value={task.taskCollectionId ?? ""}
              onChange={(event) =>
                onUpdateTaskCollection(
                  task.id,
                  event.target.value as TaskCollectionId
                )
              }
            >
              {filteredCollections.map((collection) => (
                <option key={collection.id} value={collection.id}>
                  {collection.name}
                </option>
              ))}
            </select>
          </label>

          <label className="label-stack">
            <span>Priority</span>
            <select
              onMouseDown={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
              value={task.priority}
              onChange={(event) =>
                onUpdatePriority(task.id, event.target.value as TaskPriority)
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
              value={task.estimatedCompletionDate ?? ""}
              onChange={(nextValue) => onUpdateEstimatedDate(task.id, nextValue)}
            />
          </label>
        </div>

        <div className="sub-grid">
          <label className="label-stack">
            <span>Estimated Pomodoros</span>
            <input
              min={0}
              onMouseDown={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
              placeholder="0"
              type="number"
              value={task.estimatedPomodoros === 0 ? "" : String(task.estimatedPomodoros)}
              onChange={(event) =>
                onUpdateEstimatedPomodoros(
                  task.id,
                  event.target.value === "" ? 0 : Number(event.target.value)
                )
              }
            />
          </label>

          <label className="label-stack">
            <span>Completed Pomodoros</span>
            <input
              min={0}
              onMouseDown={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
              placeholder="0"
              type="number"
              value={task.pomodoroCount === 0 ? "" : String(task.pomodoroCount)}
              onChange={(event) =>
                onUpdateCompletedPomodoros(
                  task.id,
                  event.target.value === "" ? 0 : Number(event.target.value)
                )
              }
            />
          </label>
        </div>

        <div className="task-detail-icon-grid">
          <div className="detail-icon-card">
            <span className="task-field-label">Estimated</span>
            <StopwatchIcons count={task.estimatedPomodoros} tone="estimated" />
          </div>
          <div className="detail-icon-card">
            <span className="task-field-label">Completed</span>
            <StopwatchIcons count={task.pomodoroCount} tone="completed" />
          </div>
        </div>

        <div className="field-list-header">
          <strong>Custom fields</strong>
          <span className="subtle">{fieldDefinitions.length} applicable</span>
        </div>

        <div className="field-stack">
          {fieldDefinitions.length === 0 ? (
            <div className="empty-state">
              No applicable fields yet. Add one from the field studio.
            </div>
          ) : (
            fieldDefinitions.map((definition) => {
              const existingValue = getFieldValue(fieldValues, definition.id);

              return (
                <label className="label-stack" key={definition.id}>
                  <span>
                    {definition.name} ({definition.type})
                  </span>

                  {definition.type === "text" ? (
                    <input
                      onMouseDown={(event) => event.stopPropagation()}
                      onPointerDown={(event) => event.stopPropagation()}
                      value={existingValue?.type === "text" ? existingValue.value : ""}
                      onChange={(event) =>
                        onUpdateFieldValue(task.id, definition.id, event.target.value)
                      }
                    />
                  ) : null}

                  {definition.type === "number" ? (
                    <input
                      onMouseDown={(event) => event.stopPropagation()}
                      onPointerDown={(event) => event.stopPropagation()}
                      type="number"
                      value={
                        existingValue?.type === "number"
                          ? String(existingValue.value)
                          : ""
                      }
                      onChange={(event) =>
                        onUpdateFieldValue(
                          task.id,
                          definition.id,
                          event.target.value === "" ? 0 : Number(event.target.value)
                        )
                      }
                    />
                  ) : null}

                  {definition.type === "boolean" ? (
                    <select
                      onMouseDown={(event) => event.stopPropagation()}
                      onPointerDown={(event) => event.stopPropagation()}
                      value={
                        existingValue?.type === "boolean" && existingValue.value
                          ? "true"
                          : "false"
                      }
                      onChange={(event) =>
                        onUpdateFieldValue(
                          task.id,
                          definition.id,
                          event.target.value === "true"
                        )
                      }
                    >
                      <option value="false">No</option>
                      <option value="true">Yes</option>
                    </select>
                  ) : null}
                </label>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
};
