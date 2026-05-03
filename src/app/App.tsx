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
type SidebarIconName = "timer" | "tasks" | "board" | "focus" | "report" | "settings" | "moon";

interface SidebarItem {
  icon: SidebarIconName;
  label: string;
  page: AppPage;
}

const sidebarItems: SidebarItem[] = [
  { icon: "tasks", label: "Tasks", page: "tasks" },
  { icon: "board", label: "Board", page: "board" },
  { icon: "focus", label: "Focus", page: "focus" },
  { icon: "report", label: "Report", page: "report" }
];

const SidebarIcon = ({ name }: { name: SidebarIconName }): JSX.Element => {
  switch (name) {
    case "timer":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M9 2h6" />
          <path d="M12 2v3" />
          <path d="M17.5 6.5 19 5" />
          <circle cx="12" cy="13" r="7" />
          <path d="M12 9v5l3 2" />
        </svg>
      );
    case "tasks":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M8 6h12" />
          <path d="M8 12h12" />
          <path d="M8 18h12" />
          <path d="m3.5 6 .9.9 1.8-2" />
          <path d="m3.5 12 .9.9 1.8-2" />
          <path d="m3.5 18 .9.9 1.8-2" />
        </svg>
      );
    case "board":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <rect height="7" rx="1.4" width="7" x="4" y="4" />
          <rect height="7" rx="1.4" width="7" x="13" y="4" />
          <rect height="7" rx="1.4" width="7" x="4" y="13" />
          <rect height="7" rx="1.4" width="7" x="13" y="13" />
        </svg>
      );
    case "focus":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="7" />
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v3" />
          <path d="M12 19v3" />
          <path d="M2 12h3" />
          <path d="M19 12h3" />
        </svg>
      );
    case "report":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M4 19V9" />
          <path d="M10 19V5" />
          <path d="M16 19v-7" />
          <path d="M22 19H2" />
          <path d="m4 9 6-4 6 7 4-5" />
        </svg>
      );
    case "settings":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="3" />
          <path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.5-2.4 1a7.8 7.8 0 0 0-2.1-1.2L14 3h-4l-.4 2.6a7.8 7.8 0 0 0-2.1 1.2l-2.4-1-2 3.5 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.5 2.4-1a7.8 7.8 0 0 0 2.1 1.2L10 21h4l.4-2.6a7.8 7.8 0 0 0 2.1-1.2l2.4 1 2-3.5-2-1.5c.1-.4.1-.8.1-1.2Z" />
        </svg>
      );
    case "moon":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M20 15.5A8.5 8.5 0 0 1 8.5 4 7 7 0 1 0 20 15.5Z" />
        </svg>
      );
  }
};

export const App = (): JSX.Element => {
  const boardState = useBoardState();
  const [currentPage, setCurrentPage] = useState<AppPage>("board");
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
      <div className="app-shell app-shell--loading">
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
      <aside className="app-sidebar" aria-label="Workspace shortcuts">
        <button
          aria-label="Open board"
          className="sidebar-brand-button"
          onClick={() => setCurrentPage("board")}
          type="button"
        >
          <SidebarIcon name="timer" />
        </button>

        <nav className="sidebar-nav" aria-label="Section shortcuts">
          {sidebarItems.map((item) => (
            <button
              aria-label={item.label}
              className={`sidebar-nav-button${currentPage === item.page ? " is-active" : ""}`}
              key={item.page}
              onClick={() => setCurrentPage(item.page)}
              title={item.label}
              type="button"
            >
              <SidebarIcon name={item.icon} />
            </button>
          ))}
          <button
            aria-disabled="true"
            aria-label="Settings"
            className="sidebar-nav-button"
            title="Settings"
            type="button"
          >
            <SidebarIcon name="settings" />
          </button>
        </nav>

        <button aria-label="Dark mode" className="sidebar-theme-button" type="button">
          <SidebarIcon name="moon" />
        </button>
      </aside>

      <div className="app-main">
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
              onStartShortBreak={(taskId) => pomodoro.actions.startShortBreakForTask(taskId)}
              onConfigChange={pomodoro.actions.updateConfig}
              onFinish={pomodoro.actions.finish}
              onPause={pomodoro.actions.pause}
              onResume={pomodoro.actions.resume}
              onInterrupt={pomodoro.actions.interrupt}
              onSkipBreak={pomodoro.actions.skipBreak}
              onReset={pomodoro.actions.reset}
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
    </div>
  );
};
