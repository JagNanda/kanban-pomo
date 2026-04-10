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
  onStartPomodoro
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
          <h3>
            <span className="column-dot" />
            {column.name}
          </h3>
          <p className="subtle">{tasks.length} tasks</p>
        </div>
        <div className="column-header-actions">
          <button
            className="ghost-button"
            onClick={() => onEditColumn(column.id)}
            type="button"
          >
            Edit
          </button>
          <button
            className="danger-button"
            onClick={() => onDeleteColumn(column.id)}
            type="button"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="column-body">
        {tasks.length === 0 ? (
          <div className="empty-state">Drop a task here or create a new one.</div>
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
