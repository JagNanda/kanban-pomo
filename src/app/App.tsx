import { useState } from "react";
import { BoardScreen } from "../features/board/components/BoardScreen";
import { PomodoroPanel } from "../features/pomodoro/components/PomodoroPanel";
import { ReportPage } from "../features/report/components/ReportPage";
import {
  TasksPage,
  type TasksNavigationIntent,
  type TaskView,
  type TasksNavigationView
} from "../features/tasks/components/TasksPage";
import { useBoardState } from "../features/board/application/useBoardState";
import { usePomodoroController } from "../features/pomodoro/application/usePomodoroController";
import type { Task, TaskId } from "../features/tasks/domain/task.types";

type AppPage = "board" | "tasks" | "focus" | "report";

export const App = (): JSX.Element => {
  const boardState = useBoardState();
  const [currentPage, setCurrentPage] = useState<AppPage>("tasks");
  const [tasksSelectedView, setTasksSelectedView] = useState<TaskView>({ type: "all" });
  const [tasksNavigationIntent, setTasksNavigationIntent] =
    useState<TasksNavigationIntent | null>(null);
  const completedColumnId =
    boardState.state.columns.find((column) =>
      ["completed", "done"].includes(column.name.trim().toLowerCase())
    )?.id ?? null;

  const pomodoro = usePomodoroController({
    onWorkSessionCompleted: boardState.actions.recordCompletedPomodoro,
    onWorkSessionInterrupted: boardState.actions.recordInterruptedPomodoro,
    onBreakRecorded: boardState.actions.recordBreak
  });

  if (boardState.isLoading || pomodoro.isLoading) {
    return (
      <div className="app-shell">
        <div className="panel-card">
          <h2>Loading workspace</h2>
          <p className="subtle">
            Hydrating the board, Pomodoro history, and saved settings from the desktop store.
          </p>
        </div>
      </div>
    );
  }

  const inDevTasks = boardState.state.tasks.filter((task) =>
    task.columnId ===
    boardState.state.columns.find((column) =>
      ["in dev", "in progress"].includes(column.name.trim().toLowerCase())
    )?.id
  );
  const upcomingDueTasks = boardState.state.tasks
    .filter(
      (task) =>
        task.columnId !== completedColumnId &&
        task.estimatedCompletionDate !== null &&
        task.estimatedCompletionDate.trim() !== ""
    )
    .slice()
    .sort((left, right) =>
      (left.estimatedCompletionDate ?? "").localeCompare(right.estimatedCompletionDate ?? "")
    )
    .slice(0, 5);
  const completedTodayTasks = boardState.state.tasks.filter((task) => {
    if (!task.completedAt) {
      return false;
    }

    const completedAt = new Date(task.completedAt);
    const now = new Date();

    return (
      completedAt.getFullYear() === now.getFullYear() &&
      completedAt.getMonth() === now.getMonth() &&
      completedAt.getDate() === now.getDate()
    );
  });

  const focusTask: Task | null =
    (boardState.selectedTask &&
    inDevTasks.some((task) => task.id === boardState.selectedTask?.id)
      ? boardState.selectedTask
      : inDevTasks[0]) ?? null;

  const focusTaskSessionHistory = focusTask
    ? boardState.state.pomodoroSessions.filter((session) => session.taskId === focusTask.id)
    : [];

  const focusTaskBreakHistory = focusTask
    ? boardState.state.breakRecords.filter((record) => record.taskId === focusTask.id)
    : [];

  const handleStartFocus = (taskId: TaskId): void => {
    boardState.actions.ensureTaskInDev(taskId);
    boardState.actions.selectTask(taskId);
    setCurrentPage("focus");
    pomodoro.actions.startForTask(taskId);
  };

  const handleOpenTaskInTasks = (
    taskId: TaskId,
    intentMode: "default" | "completed"
  ): void => {
    const task = boardState.state.tasks.find((candidate) => candidate.id === taskId);

    if (!task) {
      return;
    }

    let targetView: TasksNavigationView = { type: "all" };

    if (intentMode === "completed") {
      if (task.taskCollectionId !== null) {
        targetView = {
          type: "completed-collection",
          collectionId: task.taskCollectionId
        };
      } else if (task.taskProjectId !== null) {
        targetView = {
          type: "completed-project",
          projectId: task.taskProjectId
        };
      }
    } else if (task.taskCollectionId !== null) {
      targetView = {
        type: "collection",
        collectionId: task.taskCollectionId
      };
    } else if (task.taskProjectId !== null) {
      targetView = {
        type: "project",
        projectId: task.taskProjectId
      };
    }

    setTasksNavigationIntent({
      requestId: Date.now() + Math.random(),
      taskId,
      targetView,
      openTaskDetails: true
    });
    setCurrentPage("tasks");
  };

  return (
    <div className={`app-shell app-shell--${currentPage}`}>
      <header className="topbar">
        <div className="topbar-brand">
          <p className="eyebrow">Kanban + Pomodoro Desktop</p>
          <h1>Kanban Pomo</h1>
        </div>
        <nav className="topbar-nav" aria-label="Primary">
          <button
            className={`nav-tab${currentPage === "tasks" ? " is-active" : ""}`}
            onClick={() => setCurrentPage("tasks")}
            type="button"
          >
            Tasks
          </button>
          <button
            className={`nav-tab${currentPage === "board" ? " is-active" : ""}`}
            onClick={() => setCurrentPage("board")}
            type="button"
          >
            Board
          </button>
          <button
            className={`nav-tab${currentPage === "focus" ? " is-active" : ""}`}
            onClick={() => setCurrentPage("focus")}
            type="button"
          >
            Focus
          </button>
          <button
            className={`nav-tab${currentPage === "report" ? " is-active" : ""}`}
            onClick={() => setCurrentPage("report")}
            type="button"
          >
            Report
          </button>
        </nav>
      </header>

      <main className={`page-shell page-shell--${currentPage}`}>
        {currentPage === "board" ? (
          <section className="board-panel">
            <BoardScreen
              state={boardState.state}
              actions={boardState.actions}
              onStartPomodoro={handleStartFocus}
            />
          </section>
        ) : currentPage === "tasks" ? (
          <TasksPage
            columns={boardState.state.columns}
            taskProjects={boardState.state.taskProjects}
            taskCollections={boardState.state.taskCollections}
            tasks={boardState.state.tasks}
            selectedTaskId={boardState.state.selectedTaskId}
            fieldDefinitions={boardState.state.fieldDefinitions}
            taskFieldAssignments={boardState.state.taskFieldAssignments}
            taskFieldValues={boardState.state.taskFieldValues}
            selectedView={tasksSelectedView}
            onSelectedViewChange={setTasksSelectedView}
            navigationIntent={tasksNavigationIntent}
            onConsumeNavigationIntent={(requestId) =>
              setTasksNavigationIntent((current) =>
                current?.requestId === requestId ? null : current
              )
            }
            actions={boardState.actions}
          />
        ) : currentPage === "focus" ? (
          <PomodoroPanel
            tasksInDev={inDevTasks}
            upcomingDueTasks={upcomingDueTasks}
            completedTodayTasks={completedTodayTasks}
            timerState={pomodoro.state}
            config={pomodoro.config}
            selectedTask={focusTask}
            allPomodoroSessions={boardState.state.pomodoroSessions}
            allBreakRecords={boardState.state.breakRecords}
            taskSessionHistory={focusTaskSessionHistory}
            breakHistory={focusTaskBreakHistory}
            onSelectTask={(taskId) => boardState.actions.selectTask(taskId)}
            onOpenCompletedTask={(taskId) => handleOpenTaskInTasks(taskId, "completed")}
            onStart={(taskId) => pomodoro.actions.startForTask(taskId)}
            onConfigChange={pomodoro.actions.updateConfig}
            onFinish={pomodoro.actions.finish}
            onPause={pomodoro.actions.pause}
            onResume={pomodoro.actions.resume}
            onInterrupt={pomodoro.actions.interrupt}
            onSkipBreak={pomodoro.actions.skipBreak}
          />
        ) : (
          <ReportPage
            tasks={boardState.state.tasks}
            archivedCompletedTasks={boardState.state.archivedCompletedTasks}
            taskCollections={boardState.state.taskCollections}
            pomodoroSessions={boardState.state.pomodoroSessions}
            archivedPomodoroSessions={boardState.state.archivedPomodoroSessions}
            breakRecords={boardState.state.breakRecords}
            archivedBreakRecords={boardState.state.archivedBreakRecords}
            onOpenTask={handleOpenTaskInTasks}
          />
        )}
      </main>
    </div>
  );
};
