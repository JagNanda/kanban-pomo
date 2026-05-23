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
import type { PomodoroSession } from "../../pomodoro/domain/pomodoro.types";
import { formatDurationSummary } from "../../../shared/lib/time";
import { StopwatchIcons } from "./StopwatchIcons";

interface TaskDetailsPanelProps {
  task: Task | null;
  columns: Column[];
  taskProjects: TaskProject[];
  taskCollections: TaskCollection[];
  fieldDefinitions: FieldDefinition[];
  fieldValues: TaskFieldValue[];
  sessionHistory: PomodoroSession[];
  onUpdateTitle: (taskId: TaskId, title: string) => void;
  onUpdateDescription: (taskId: TaskId, description: string) => void;
  onUpdateTaskProject: (taskId: TaskId, taskProjectId: TaskProjectId | null) => void;
  onUpdateTaskCollection: (taskId: TaskId, taskCollectionId: TaskCollectionId | null) => void;
  onUpdateStatus: (taskId: TaskId, columnId: ColumnId) => void;
  onUpdatePriority: (taskId: TaskId, priority: TaskPriority) => void;
  onUpdateEstimatedDate: (taskId: TaskId, estimatedCompletionDate: string) => void;
  onUpdateEstimatedPomodoros: (taskId: TaskId, estimatedPomodoros: number) => void;
  onUpdateCompletedPomodoros: (taskId: TaskId, pomodoroCount: number) => void;
  onUpdateStudyMetadata: (
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
  sessionHistory,
  onUpdateTitle,
  onUpdateDescription,
  onUpdateTaskProject,
  onUpdateTaskCollection,
  onUpdateStatus,
  onUpdatePriority,
  onUpdateEstimatedDate,
  onUpdateEstimatedPomodoros,
  onUpdateCompletedPomodoros,
  onUpdateStudyMetadata,
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
  const taskProject =
    task.taskProjectId !== null
      ? taskProjects.find((project) => project.id === task.taskProjectId) ?? null
      : null;
  const isInheritedStudyProblem = taskProject?.isStudyProject ?? false;
  const isStudyTask = task.isStudyProblem || isInheritedStudyProblem;
  const sortedSessionHistory = sessionHistory
    .slice()
    .sort((left, right) => right.startedAt.localeCompare(left.startedAt));
  const recentStudySessions = sortedSessionHistory.slice(0, 3);
  const lastStudiedAt = sortedSessionHistory[0]?.startedAt ?? null;

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
          {!isStudyTask ? (
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
          ) : null}

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

          {!isStudyTask ? (
            <>
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
            </>
          ) : null}
        </div>

        {!isStudyTask ? (
          <>
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
          </>
        ) : null}

        {isStudyTask ? (
        <section className="study-problem-card">
          <div className="study-problem-header">
            <div>
              <strong>Study problem</strong>
              <span className="subtle">
                {isInheritedStudyProblem
                  ? "Inherited from this task's Study Project."
                  : "Track coding-practice metadata without leaving the task workflow."}
              </span>
            </div>
            {isInheritedStudyProblem ? (
              <span className="study-project-badge">Study Project</span>
            ) : (
              <label className="study-problem-toggle">
                <input
                  checked={task.isStudyProblem}
                  onChange={(event) =>
                    onUpdateStudyMetadata(task.id, {
                      isStudyProblem: event.target.checked
                    })
                  }
                  type="checkbox"
                />
                <span>{task.isStudyProblem ? "Enabled" : "Off"}</span>
              </label>
            )}
          </div>

          <div className="focus-stat-grid study-problem-summary">
            <div className="focus-stat-card">
              <span>Tracked time</span>
              <strong>{formatDurationSummary(task.actualTrackedSeconds)}</strong>
            </div>
            <div className="focus-stat-card">
              <span>AI time</span>
              <strong>{formatDurationSummary(task.aiTrackedSeconds)}</strong>
            </div>
            <div className="focus-stat-card">
              <span>Last studied</span>
              <strong>
                {lastStudiedAt
                  ? new Date(lastStudiedAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric"
                    })
                  : "Not yet"}
              </strong>
            </div>
          </div>

          {isStudyTask ? (
            <>
              <div className="sub-grid">
                <label className="label-stack">
                  <span>Platform</span>
                  <input
                    placeholder="LeetCode"
                    value={task.studyPlatform}
                    onChange={(event) =>
                      onUpdateStudyMetadata(task.id, {
                        studyPlatform: event.target.value
                      })
                    }
                  />
                </label>

                <label className="label-stack">
                  <span>Difficulty</span>
                  <select
                    value={task.studyDifficulty ?? ""}
                    onChange={(event) =>
                      onUpdateStudyMetadata(task.id, {
                        studyDifficulty:
                          event.target.value === ""
                            ? null
                            : (event.target.value as Task["studyDifficulty"])
                      })
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
                    value={task.studyStatus}
                    onChange={(event) =>
                      onUpdateStudyMetadata(task.id, {
                        studyStatus: event.target.value as Task["studyStatus"]
                      })
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
                    value={task.timesCompleted === 0 ? "" : String(task.timesCompleted)}
                    onChange={(event) =>
                      onUpdateStudyMetadata(task.id, {
                        timesCompleted:
                          event.target.value === "" ? 0 : Number(event.target.value)
                      })
                    }
                  />
                </label>
              </div>

              <label className="label-stack">
                <span>Topic</span>
                <input
                  placeholder="Graphs, DP, Two pointers..."
                  value={task.studyTopic}
                  onChange={(event) =>
                    onUpdateStudyMetadata(task.id, {
                      studyTopic: event.target.value
                    })
                  }
                />
              </label>

              <label className="label-stack">
                <span>Problem URL</span>
                <input
                  placeholder="https://leetcode.com/problems/..."
                  type="url"
                  value={task.studyUrl}
                  onChange={(event) =>
                    onUpdateStudyMetadata(task.id, {
                      studyUrl: event.target.value
                    })
                  }
                />
              </label>

              {task.studyUrl ? (
                <a
                  className="study-problem-link"
                  href={task.studyUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Open problem
                </a>
              ) : null}

              <div className="field-list-header">
                <strong>Recent study sessions</strong>
                <span className="subtle">{sessionHistory.length} total</span>
              </div>

              <div className="history-stack study-problem-history">
                {recentStudySessions.length > 0 ? (
                  recentStudySessions.map((session) => (
                    <div className="history-item" key={session.id}>
                      <strong>{formatDurationSummary(session.actualDurationSeconds)}</strong>
                      <span>
                        {new Date(session.startedAt).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit"
                        })}{" "}
                        · {session.status}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">No study sessions recorded yet.</div>
                )}
              </div>
            </>
          ) : null}
        </section>
        ) : null}

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
