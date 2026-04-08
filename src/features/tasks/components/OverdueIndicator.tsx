import { isTaskOverdue } from "../domain/task-deadline";
import type { Task } from "../domain/task.types";

interface OverdueIndicatorProps {
  task: Task;
}

export const OverdueIndicator = ({ task }: OverdueIndicatorProps): JSX.Element | null => {
  if (!isTaskOverdue(task)) {
    return null;
  }

  return (
    <span className="overdue-indicator" title="Overdue">
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path
          d="M12 3 22 20H2L12 3Z"
          fill="rgba(230, 84, 84, 0.22)"
          stroke="#ff6f6f"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path
          d="M12 8V13.5"
          stroke="#ff9c9c"
          strokeLinecap="round"
          strokeWidth="1.9"
        />
        <circle cx="12" cy="17.2" fill="#ff9c9c" r="1.15" />
      </svg>
    </span>
  );
};
