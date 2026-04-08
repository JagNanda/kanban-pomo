import type { TaskCollection } from "../domain/task-collection.types";
import type { Task, TaskId } from "../domain/task.types";
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
          <button
            aria-label="Delete task"
            className="icon-button icon-button--muted task-card-delete"
            onClick={(event) => {
              event.stopPropagation();
              onDeleteTask(task.id);
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
            <span className="task-field-label">Due</span>
            <span className="task-field-value">
              {task.estimatedCompletionDate ?? "Unplanned"}
            </span>
          </div>

          <div className="task-field-row">
            <span className="task-field-label">Estimated</span>
            <StopwatchIcons count={task.estimatedPomodoros} size="sm" tone="estimated" />
          </div>

          <div className="task-field-row">
            <span className="task-field-label">Completed</span>
            <StopwatchIcons count={task.pomodoroCount} size="sm" tone="completed" />
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
          Focus
        </button>
      </div>
    </div>
  );
};
