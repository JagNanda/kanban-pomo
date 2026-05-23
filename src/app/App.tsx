import { useRef, useState } from "react";
import { BoardScreen } from "../features/board/components/BoardScreen";
import { PomodoroPanel } from "../features/pomodoro/components/PomodoroPanel";
import { ReportPage, type ReportViewMode } from "../features/report/components/ReportPage";
import {
  TasksPage,
  type TasksNavigationIntent,
  type TaskView,
  type TasksNavigationView
} from "../features/tasks/components/TasksPage";
import { useBoardState } from "../features/board/application/useBoardState";
import { usePomodoroController } from "../features/pomodoro/application/usePomodoroController";
import { useAiTimerController } from "../features/pomodoro/application/useAiTimerController";
import type { Task, TaskId } from "../features/tasks/domain/task.types";

type AppPage = "board" | "tasks" | "focus" | "report";
type SidebarIconName = "timer" | "tasks" | "board" | "focus" | "report";

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
  }
};

export const App = (): JSX.Element => {
  const boardState = useBoardState();
  const [currentPage, setCurrentPage] = useState<AppPage>("board");
  const [tasksSelectedView, setTasksSelectedView] = useState<TaskView>({ type: "all" });
  const [reportInitialViewMode, setReportInitialViewMode] =
    useState<ReportViewMode>("overview");
  const [tasksNavigationIntent, setTasksNavigationIntent] =
    useState<TasksNavigationIntent | null>(null);
  const shouldResumeFocusAfterAiTimerRef = useRef(false);
  const completedColumnId =
    boardState.state.columns.find((column) =>
      ["completed", "done"].includes(column.name.trim().toLowerCase())
    )?.id ?? null;

  const pomodoro = usePomodoroController({
    onWorkSessionCompleted: boardState.actions.recordCompletedPomodoro,
    onStudySessionCompleted: boardState.actions.recordCompletedStudySession,
    onStudySessionAttempted: boardState.actions.recordAttemptedStudySession,
    onWorkSessionInterrupted: boardState.actions.recordInterruptedPomodoro,
    onBreakRecorded: boardState.actions.recordBreak,
    onProcrastinationRecorded: boardState.actions.recordProcrastination,
    onInterruptionRecorded: boardState.actions.recordInterruption
  });
  const aiTimer = useAiTimerController({
    onAiWorkRecorded: boardState.actions.recordAiWork
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

  const focusTaskProcrastinationHistory = focusTask
    ? boardState.state.procrastinationRecords.filter((record) => record.taskId === focusTask.id)
    : [];

  const focusTaskInterruptionHistory = focusTask
    ? boardState.state.interruptionRecords.filter((record) => record.taskId === focusTask.id)
    : [];

  const focusTaskAiWorkHistory = focusTask
    ? boardState.state.aiWorkRecords.filter((record) => record.taskId === focusTask.id)
    : [];

  const startFocusTimerForTask = (taskId: TaskId): void => {
    const task = boardState.state.tasks.find((candidate) => candidate.id === taskId);
    pomodoro.actions.startForTask(taskId, {
      workMode: task?.isStudyProblem ? "study" : "pomodoro"
    });
  };

  const handleStartFocus = (taskId: TaskId): void => {
    boardState.actions.ensureTaskInDev(taskId);
    boardState.actions.selectTask(taskId);
    setCurrentPage("focus");
    startFocusTimerForTask(taskId);
  };

  const handleFocusTaskFromTasks = (taskId: TaskId): void => {
    boardState.actions.ensureTaskInDev(taskId);
    boardState.actions.selectTask(taskId);
    setCurrentPage("focus");
  };

  const handleCompleteFocusTask = (taskId: TaskId): void => {
    if (!completedColumnId) {
      return;
    }

    boardState.actions.moveTask(taskId, completedColumnId);
  };

  const handleStartAiTimer = (taskId: TaskId): void => {
    if (pomodoro.state.status === "running" && pomodoro.state.phaseType === "work") {
      shouldResumeFocusAfterAiTimerRef.current = true;
      pomodoro.actions.pause();
    } else {
      shouldResumeFocusAfterAiTimerRef.current = false;
    }

    aiTimer.actions.startForTask(taskId);
  };

  const handleStopAiTimer = (): void => {
    aiTimer.actions.stop();

    if (shouldResumeFocusAfterAiTimerRef.current) {
      shouldResumeFocusAfterAiTimerRef.current = false;
      pomodoro.actions.resume();
    }
  };

  const handleCancelAiTimer = (): void => {
    shouldResumeFocusAfterAiTimerRef.current = false;
    aiTimer.actions.cancel();
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

  const handleViewAllUpcomingDue = (): void => {
    setTasksSelectedView({ type: "scheduled" });
    setCurrentPage("tasks");
  };

  const handleViewAllRecentActivity = (): void => {
    setReportInitialViewMode("trends");
    setCurrentPage("report");
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
          <span className="sidebar-button-label">Pomo</span>
        </button>

        <nav className="sidebar-nav" aria-label="Section shortcuts">
          {sidebarItems.map((item) => (
            <button
              aria-label={item.label}
              className={`sidebar-nav-button${currentPage === item.page ? " is-active" : ""}`}
              key={item.page}
              onClick={() => {
                if (item.page === "report") {
                  setReportInitialViewMode("overview");
                }

                setCurrentPage(item.page);
              }}
              title={item.label}
              type="button"
            >
              <SidebarIcon name={item.icon} />
              <span className="sidebar-button-label">{item.label}</span>
            </button>
          ))}
        </nav>

      </aside>

      <div className="app-main">
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
              pomodoroSessions={boardState.state.pomodoroSessions}
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
              onFocusTask={handleFocusTaskFromTasks}
              actions={boardState.actions}
            />
          ) : currentPage === "focus" ? (
            <PomodoroPanel
              tasksInDev={inDevTasks}
              upcomingDueTasks={upcomingDueTasks}
              timerState={pomodoro.state}
              aiTimerState={aiTimer.state}
              config={pomodoro.config}
              selectedTask={focusTask}
              allPomodoroSessions={boardState.state.pomodoroSessions}
              allBreakRecords={boardState.state.breakRecords}
              allProcrastinationRecords={boardState.state.procrastinationRecords}
              allInterruptionRecords={boardState.state.interruptionRecords}
              taskSessionHistory={focusTaskSessionHistory}
              breakHistory={focusTaskBreakHistory}
              procrastinationHistory={focusTaskProcrastinationHistory}
              interruptionHistory={focusTaskInterruptionHistory}
              aiWorkHistory={focusTaskAiWorkHistory}
              onSelectTask={(taskId) => boardState.actions.selectTask(taskId)}
              onViewAllUpcomingDue={handleViewAllUpcomingDue}
              onViewAllRecentActivity={handleViewAllRecentActivity}
              onStart={startFocusTimerForTask}
              onStartBreak={(taskId, durationSeconds) =>
                pomodoro.actions.startShortBreakForTask(taskId, durationSeconds)
              }
              onStartProcrastinating={(taskId) =>
                pomodoro.actions.startProcrastinatingForTask(taskId)
              }
              canCompleteTask={completedColumnId !== null}
              onCompleteTask={handleCompleteFocusTask}
              onConfigChange={pomodoro.actions.updateConfig}
              onFinish={pomodoro.actions.finish}
              onGiveUpStudy={pomodoro.actions.giveUpStudy}
              onFinishBreak={pomodoro.actions.finishBreak}
              onPause={pomodoro.actions.pause}
              onResume={pomodoro.actions.resume}
              onCancel={pomodoro.actions.cancel}
              onStopProcrastinating={pomodoro.actions.stopProcrastinating}
              onStartInterruption={pomodoro.actions.startInterruption}
              onStopInterruption={pomodoro.actions.stopInterruption}
              onCancelInterruption={pomodoro.actions.cancelInterruption}
              onReset={pomodoro.actions.reset}
              onStartAiTimer={handleStartAiTimer}
              onStopAiTimer={handleStopAiTimer}
              onPauseAiTimer={aiTimer.actions.pause}
              onResumeAiTimer={aiTimer.actions.resume}
              onCancelAiTimer={handleCancelAiTimer}
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
              procrastinationRecords={boardState.state.procrastinationRecords}
              archivedProcrastinationRecords={boardState.state.archivedProcrastinationRecords}
              interruptionRecords={boardState.state.interruptionRecords}
              archivedInterruptionRecords={boardState.state.archivedInterruptionRecords}
              aiWorkRecords={boardState.state.aiWorkRecords}
              archivedAiWorkRecords={boardState.state.archivedAiWorkRecords}
              initialViewMode={reportInitialViewMode}
              onOpenTask={handleOpenTaskInTasks}
            />
          )}
        </main>
      </div>
    </div>
  );
};
