import type { CSSProperties } from "react";
import type { Column, ColumnId } from "../../columns/domain/column.types";
import type { TaskCollection } from "../../tasks/domain/task-collection.types";
import { TaskCard } from "../../tasks/components/TaskCard";
import type { Task, TaskId } from "../../tasks/domain/task.types";
import { getColumnTheme } from "./column-theme";

interface ColumnLaneProps {
  column: Column;
  tasks: Task[];
  taskCollectionsById: Map<string, TaskCollection>;
  selectedTaskId: TaskId | null;
  onDeleteColumn: (columnId: ColumnId) => void;
  onEditColumn: (columnId: ColumnId) => void;
  onDeleteTask: (taskId: TaskId) => void;
  onReorderColumn: (sourceColumnId: ColumnId, targetColumnId: ColumnId) => void;
  onSelectTask: (taskId: TaskId) => void;
  onMoveTask: (taskId: TaskId, targetColumnId: ColumnId) => void;
  onStartPomodoro: (taskId: TaskId) => void;
  onCreateTask: (columnId: ColumnId) => void;
}

export const ColumnLane = ({
  column,
  tasks,
  taskCollectionsById,
  selectedTaskId,
  onDeleteColumn,
  onEditColumn,
  onDeleteTask,
  onReorderColumn,
  onSelectTask,
  onMoveTask,
  onStartPomodoro,
  onCreateTask
}: ColumnLaneProps): JSX.Element => {
  const theme = getColumnTheme(column.name, column.orderIndex, column.color);
  const style = {
    "--column-accent": theme.accent,
    "--column-background": theme.background,
    "--column-border": theme.border,
    "--column-dot": theme.dot
  } as CSSProperties;

  return (
    <article
      className="column-card"
      style={style}
      onDragOver={(event) => {
        event.preventDefault();
      }}
      onDrop={(event) => {
        event.preventDefault();

        const sourceColumnId = event.dataTransfer.getData("text/column-id") as ColumnId;

        if (sourceColumnId) {
          onReorderColumn(sourceColumnId, column.id);
          return;
        }

        const taskId = event.dataTransfer.getData("text/task-id") as TaskId;

        if (taskId) {
          onMoveTask(taskId, column.id);
        }
      }}
    >
      <div
        className="column-header"
        draggable
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/column-id", column.id);
        }}
      >
        <div>
          <div className="column-title-row">
            <h3>
              <span className="column-dot" />
              {column.name}
            </h3>
            <span className="column-count">{tasks.length}</span>
          </div>
        </div>
        <details
          className="column-menu"
          onClick={(event) => event.stopPropagation()}
          onDragStart={(event) => event.preventDefault()}
        >
          <summary
            aria-label={`Column actions for ${column.name}`}
            className="column-menu-trigger"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <circle cx="12" cy="5" r="1.8" />
              <circle cx="12" cy="12" r="1.8" />
              <circle cx="12" cy="19" r="1.8" />
            </svg>
          </summary>
          <div className="column-menu-panel">
            <button onClick={() => onEditColumn(column.id)} type="button">
              Edit column
            </button>
            <button
              className="column-menu-danger"
              onClick={() => onDeleteColumn(column.id)}
              type="button"
            >
              Delete column
            </button>
          </div>
        </details>
      </div>

      <div className="column-body">
        {tasks.length === 0 ? (
          <div className="empty-state">
            <svg className="empty-state-icon" aria-hidden="true" viewBox="0 0 24 24">
              <path d="M5 9.5h14" />
              <path d="M7.5 6h9l2.5 3.5v7A1.5 1.5 0 0 1 17.5 18h-11A1.5 1.5 0 0 1 5 16.5v-7L7.5 6Z" />
              <path d="M9 13h6" />
            </svg>
            <span>
              Drop a task here
              <br />
              or create a new one.
            </span>
            <button
              className="empty-state-button"
              onClick={(event) => {
                event.stopPropagation();
                onCreateTask(column.id);
              }}
              type="button"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <path d="M12 5v14" />
                <path d="M5 12h14" />
              </svg>
              Add task
            </button>
          </div>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              taskCollection={
                task.taskCollectionId ? taskCollectionsById.get(task.taskCollectionId) ?? null : null
              }
              isSelected={selectedTaskId === task.id}
              onSelect={onSelectTask}
              onStartPomodoro={onStartPomodoro}
              onDeleteTask={onDeleteTask}
            />
          ))
        )}
      </div>
    </article>
  );
};
