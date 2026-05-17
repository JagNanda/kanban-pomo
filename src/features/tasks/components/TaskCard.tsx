import type { TaskCollection } from "../domain/task-collection.types";
import type { Task, TaskId } from "../domain/task.types";
import { formatDurationSummary } from "../../../shared/lib/time";
import { CollectionBadge } from "./CollectionBadge";
import { OverdueIndicator } from "./OverdueIndicator";
import { StopwatchIcons } from "./StopwatchIcons";

interface TaskCardProps {
  task: Task;
  taskCollection?: TaskCollection | null;
  isSelected: boolean;
  onSelect: (taskId: TaskId) => void;
  onStartPomodoro: (taskId: TaskId) => void;
  onDeleteTask: (taskId: TaskId) => void;
}

const TaskCardIcon = ({
  name
}: {
  name: "edit" | "delete" | "calendar" | "estimated" | "completed" | "tracked" | "play";
}): JSX.Element => {
  switch (name) {
    case "edit":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="m4 20 4.5-1 10-10a2.2 2.2 0 0 0-3.1-3.1l-10 10L4 20Z" />
          <path d="m14 7 3 3" />
        </svg>
      );
    case "delete":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M9 3h6l1 2h4" />
          <path d="M4 5h16" />
          <path d="m6 8 1 13h10l1-13" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
        </svg>
      );
    case "calendar":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <rect height="15" rx="2" width="16" x="4" y="5" />
          <path d="M8 3v4" />
          <path d="M16 3v4" />
          <path d="M4 10h16" />
          <path d="M8 14h.1" />
          <path d="M12 14h.1" />
          <path d="M16 14h.1" />
        </svg>
      );
    case "estimated":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M9 2h6" />
          <path d="M12 2v3" />
          <circle cx="12" cy="13" r="7" />
          <path d="M12 9v5l3 2" />
        </svg>
      );
    case "completed":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="8" />
          <path d="m8.6 12.4 2.2 2.2 4.8-5.2" />
        </svg>
      );
    case "tracked":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M9 2h6" />
          <path d="M12 2v3" />
          <circle cx="12" cy="13" r="7" />
          <path d="M12 9v5l3 2" />
        </svg>
      );
    case "play":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="m8 5 11 7-11 7V5Z" />
        </svg>
      );
  }
};

export const TaskCard = ({
  task,
  taskCollection = null,
  isSelected,
  onSelect,
  onStartPomodoro,
  onDeleteTask
}: TaskCardProps): JSX.Element => {
  return (
    <div
      className={`task-card${isSelected ? " is-selected" : ""}`}
      draggable
      onClick={() => onSelect(task.id)}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/task-id", task.id);
      }}
    >
      <div className="task-card-body">
        <div className="task-card-priority-row">
          <div className="task-priority-wrap">
            <span className={`priority-pill priority-pill--${task.priority}`}>
              {task.priority}
            </span>
            <OverdueIndicator task={task} />
          </div>
          <div className="task-card-actions">
            <button
              aria-label="Edit task"
              className="icon-button icon-button--muted task-card-edit"
              onClick={(event) => {
                event.stopPropagation();
                onSelect(task.id);
              }}
              type="button"
            >
              <TaskCardIcon name="edit" />
            </button>
            <button
              aria-label="Delete task"
              className="icon-button icon-button--muted task-card-delete"
              onClick={(event) => {
                event.stopPropagation();
                onDeleteTask(task.id);
              }}
              type="button"
            >
              <TaskCardIcon name="delete" />
            </button>
          </div>
        </div>

        <div className="task-card-title-wrap">
          <div className="task-card-title-stack">
            {taskCollection ? (
              <CollectionBadge color={taskCollection.color} compact name={taskCollection.name} />
            ) : null}
            <h4>{task.title}</h4>
          </div>
        </div>

        <div className="task-card-fields">
          <div className="task-field-row">
            <span className="task-field-label">
              <TaskCardIcon name="calendar" />
              Due
            </span>
            <span className="task-field-value">
              {task.estimatedCompletionDate ?? "Unplanned"}
            </span>
          </div>

          <div className="task-field-row">
            <span className="task-field-label">
              <TaskCardIcon name="estimated" />
              Estimated
            </span>
            <StopwatchIcons count={task.estimatedPomodoros} size="sm" tone="estimated" />
          </div>

          <div className="task-field-row">
            <span className="task-field-label">
              <TaskCardIcon name="completed" />
              Completed
            </span>
            <StopwatchIcons count={task.pomodoroCount} size="sm" tone="completed" />
          </div>

          <div className="task-field-row">
            <span className="task-field-label">
              <TaskCardIcon name="tracked" />
              {task.isStudyProblem ? "Studied" : "Tracked"}
            </span>
            <span className="task-field-value">
              {formatDurationSummary(task.actualTrackedSeconds)}
            </span>
          </div>
        </div>
      </div>

      <div className="task-card-footer">
        <button
          className="play-button task-focus-button"
          onClick={(event) => {
            event.stopPropagation();
            onSelect(task.id);
            onStartPomodoro(task.id);
          }}
          type="button"
        >
          <TaskCardIcon name="play" />
          Focus
        </button>
      </div>
    </div>
  );
};
