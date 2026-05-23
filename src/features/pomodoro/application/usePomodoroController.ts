import { useEffect, useState } from "react";
import { defaultPomodoroConfig } from "../domain/default-config";
import {
  ensurePomodoroAudioReady,
  playPomodoroCompletionChime
} from "./pomodoro-chimes";
import type {
  BreakRecord,
  PomodoroConfig,
  PomodoroPhaseType,
  TimerState,
  WorkTimerMode
} from "../domain/pomodoro.types";
import type { TaskId } from "../../tasks/domain/task.types";

type InterruptedTimerState = Extract<
  TimerState,
  { status: "running"; phaseType: "interruption" }
>["interruptedTimer"];
type RunningWorkTimerState = Extract<TimerState, { status: "running" }> & {
  phaseType: "work";
};
type PausedWorkTimerState = Extract<TimerState, { status: "paused" }> & {
  phaseType: "work";
};
type ActiveWorkTimerState = RunningWorkTimerState | PausedWorkTimerState;

const isActiveWorkTimerState = (state: TimerState): state is ActiveWorkTimerState =>
  (state.status === "running" || state.status === "paused") &&
  state.phaseType === "work";

interface UsePomodoroControllerOptions {
  onWorkSessionCompleted: (
    taskId: TaskId,
    plannedDurationSeconds: number,
    actualDurationSeconds: number,
    startedAt: string,
    endedAt: string
  ) => void;
  onWorkSessionInterrupted: (
    taskId: TaskId,
    plannedDurationSeconds: number,
    actualDurationSeconds: number,
    startedAt: string,
    endedAt: string
  ) => void;
  onBreakRecorded: (
    taskId: TaskId,
    phaseType: BreakRecord["phaseType"],
    plannedDurationSeconds: number,
    actualDurationSeconds: number,
    action: BreakRecord["action"],
    startedAt: string,
    endedAt: string
  ) => void;
  onStudySessionCompleted: (
    taskId: TaskId,
    actualDurationSeconds: number,
    startedAt: string,
    endedAt: string
  ) => void;
  onStudySessionAttempted: (
    taskId: TaskId,
    actualDurationSeconds: number,
    startedAt: string,
    endedAt: string
  ) => void;
  onProcrastinationRecorded: (
    taskId: TaskId,
    actualDurationSeconds: number,
    note: string,
    startedAt: string,
    endedAt: string
  ) => void;
  onInterruptionRecorded: (
    taskId: TaskId,
    actualDurationSeconds: number,
    reason: string,
    startedAt: string,
    endedAt: string
  ) => void;
}

const getPlannedDurationForPhase = (
  config: PomodoroConfig,
  phaseType: PomodoroPhaseType
): number => {
  if (phaseType === "work") {
    return config.workDurationSeconds;
  }

  if (phaseType === "short_break") {
    return config.shortBreakDurationSeconds;
  }

  if (phaseType === "long_break") {
    return config.longBreakDurationSeconds;
  }

  return 0;
};

const getRemainingSecondsFromEndsAt = (endsAt: string): number =>
  Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / 1000));

const getElapsedSecondsFromStartedAt = (startedAt: string, endedAt: string): number =>
  Math.max(
    0,
    Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000)
  );

const getActualDurationForTimerState = (
  state: Extract<TimerState, { status: "running" | "paused" }>,
  plannedDurationSeconds: number,
  endedAt: string
): number => {
  if (
    state.phaseType === "procrastination" ||
    (state.phaseType === "work" && state.workMode === "study")
  ) {
    return state.status === "running"
      ? getElapsedSecondsFromStartedAt(state.startedAt, endedAt)
      : state.elapsedSeconds;
  }

  const remainingSeconds =
    state.status === "running" && state.endsAt !== null
      ? getRemainingSecondsFromEndsAt(state.endsAt)
      : state.status === "running"
        ? state.secondsRemaining
        : state.remainingSeconds;

  return plannedDurationSeconds - remainingSeconds;
};

const captureInterruptedWorkTimer = (current: ActiveWorkTimerState): InterruptedTimerState => {
  const workMode = current.workMode ?? "pomodoro";
  const remainingSeconds =
    workMode === "study"
      ? 0
      : current.status === "running" && current.endsAt !== null
        ? getRemainingSecondsFromEndsAt(current.endsAt)
        : current.status === "running"
          ? current.secondsRemaining
          : current.remainingSeconds;
  const elapsedSeconds =
    workMode === "study"
      ? current.status === "running"
        ? getElapsedSecondsFromStartedAt(current.startedAt, new Date().toISOString())
        : current.elapsedSeconds
      : current.status === "running"
        ? Math.max(current.plannedDurationSeconds - remainingSeconds, 0)
        : current.elapsedSeconds;

  return {
    priorStatus: current.status,
    taskId: current.taskId,
    phaseType: "work",
    plannedDurationSeconds: current.plannedDurationSeconds,
    remainingSeconds,
    elapsedSeconds,
    cycleWorkSessionIndex: current.cycleWorkSessionIndex,
    startedAt: current.startedAt,
    workMode
  };
};

const restoreInterruptedTimer = (interruptedTimer: InterruptedTimerState): TimerState => {
  const isStudyTimer = interruptedTimer.workMode === "study";

  if (interruptedTimer.priorStatus === "paused") {
    return {
      status: "paused",
      taskId: interruptedTimer.taskId,
      phaseType: "work",
      plannedDurationSeconds: interruptedTimer.plannedDurationSeconds,
      remainingSeconds: isStudyTimer ? 0 : interruptedTimer.remainingSeconds,
      elapsedSeconds: interruptedTimer.elapsedSeconds,
      cycleWorkSessionIndex: interruptedTimer.cycleWorkSessionIndex,
      startedAt: interruptedTimer.startedAt,
      workMode: interruptedTimer.workMode
    };
  }

  return {
    status: "running",
    taskId: interruptedTimer.taskId,
    phaseType: "work",
    startedAt: isStudyTimer
      ? new Date(Date.now() - interruptedTimer.elapsedSeconds * 1000).toISOString()
      : interruptedTimer.startedAt,
    endsAt: isStudyTimer
      ? null
      : new Date(Date.now() + interruptedTimer.remainingSeconds * 1000).toISOString(),
    plannedDurationSeconds: interruptedTimer.plannedDurationSeconds,
    secondsRemaining: isStudyTimer ? 0 : interruptedTimer.remainingSeconds,
    secondsElapsed: interruptedTimer.elapsedSeconds,
    cycleWorkSessionIndex: interruptedTimer.cycleWorkSessionIndex,
    workMode: interruptedTimer.workMode
  };
};

export const usePomodoroController = ({
  onWorkSessionCompleted,
  onStudySessionCompleted,
  onStudySessionAttempted,
  onWorkSessionInterrupted,
  onBreakRecorded,
  onProcrastinationRecorded,
  onInterruptionRecorded
}: UsePomodoroControllerOptions) => {
  const [config, setConfig] = useState<PomodoroConfig>(defaultPomodoroConfig);
  const [state, setState] = useState<TimerState>({
    status: "idle",
    taskId: null
  });
  const [isLoading, setIsLoading] = useState<boolean>(
    typeof window.desktop !== "undefined"
  );
  const [hasHydrated, setHasHydrated] = useState<boolean>(
    typeof window.desktop === "undefined"
  );

  const startBreakAfterCompletedWorkSession = (
    taskId: TaskId,
    endedAt: string,
    cycleWorkSessionIndex: number
  ): TimerState => {
    const completedWorkSessions = cycleWorkSessionIndex + 1;
    const nextPhaseType: PomodoroPhaseType =
      completedWorkSessions % config.longBreakAfterWorkSessions === 0
        ? "long_break"
        : "short_break";
    const nextPhaseDuration = getPlannedDurationForPhase(config, nextPhaseType);

    return {
      status: "running",
      taskId,
      phaseType: nextPhaseType,
      startedAt: endedAt,
      endsAt: new Date(Date.now() + nextPhaseDuration * 1000).toISOString(),
      plannedDurationSeconds: nextPhaseDuration,
      secondsRemaining: nextPhaseDuration,
      secondsElapsed: 0,
      cycleWorkSessionIndex: completedWorkSessions
    };
  };

  useEffect(() => {
    if (typeof window.desktop === "undefined") {
      return;
    }

    let isMounted = true;

    void window.desktop
      .loadAppSettings()
      .then((settings) => {
        if (!isMounted) {
          return;
        }

        setConfig(settings.pomodoroConfig);
        setHasHydrated(true);
        setIsLoading(false);
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }

        setHasHydrated(true);
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hasHydrated || typeof window.desktop === "undefined") {
      return;
    }

    void window.desktop.savePomodoroConfig(config);
  }, [config, hasHydrated]);

  useEffect(() => {
    if (state.status !== "running") {
      return undefined;
    }

    const interval = window.setInterval(() => {
      setState((current) => {
        if (current.status !== "running") {
          return current;
        }

        if (current.phaseType === "procrastination" || current.phaseType === "interruption") {
          return {
            ...current,
            secondsElapsed: getElapsedSecondsFromStartedAt(
              current.startedAt,
              new Date().toISOString()
            )
          };
        }

        if (current.phaseType === "work" && current.workMode === "study") {
          return {
            ...current,
            secondsElapsed: getElapsedSecondsFromStartedAt(
              current.startedAt,
              new Date().toISOString()
            )
          };
        }

        if (current.endsAt === null) {
          return current;
        }

        const nextSecondsRemaining = getRemainingSecondsFromEndsAt(current.endsAt);

        if (nextSecondsRemaining > 0) {
          return {
            ...current,
            secondsRemaining: nextSecondsRemaining
          };
        }

        const endedAt = new Date().toISOString();
        const plannedDurationSeconds = current.plannedDurationSeconds;

        void playPomodoroCompletionChime(
          current.phaseType,
          current.phaseType === "work"
            ? config.workCompletionChime
            : config.breakCompletionChime
        );

        if (current.phaseType === "work") {
          onWorkSessionCompleted(
            current.taskId,
            plannedDurationSeconds,
            plannedDurationSeconds,
            current.startedAt,
            endedAt
          );

          return startBreakAfterCompletedWorkSession(
            current.taskId,
            endedAt,
            current.cycleWorkSessionIndex
          );
        }

        onBreakRecorded(
          current.taskId,
          current.phaseType,
          plannedDurationSeconds,
          plannedDurationSeconds,
          "completed",
          current.startedAt,
          endedAt
        );

        return {
          status: "idle",
          taskId: current.taskId,
        };
      });
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [config, onBreakRecorded, onWorkSessionCompleted, state.status]);

  const actions = {
    startForTask: (
      taskId: TaskId,
      options: { workMode?: WorkTimerMode } = {}
    ) => {
      void ensurePomodoroAudioReady();
      const workMode = options.workMode ?? "pomodoro";
      const plannedDurationSeconds =
        workMode === "study" ? 0 : config.workDurationSeconds;
      setState({
        status: "running",
        taskId,
        phaseType: "work",
        workMode,
        startedAt: new Date().toISOString(),
        endsAt:
          workMode === "study"
            ? null
            : new Date(Date.now() + plannedDurationSeconds * 1000).toISOString(),
        plannedDurationSeconds,
        secondsRemaining: plannedDurationSeconds,
        secondsElapsed: 0,
        cycleWorkSessionIndex: 0
      });
    },
    startShortBreakForTask: (taskId: TaskId, durationSeconds = config.shortBreakDurationSeconds) => {
      void ensurePomodoroAudioReady();
      const plannedDurationSeconds = Math.max(60, Math.floor(durationSeconds));
      setState({
        status: "running",
        taskId,
        phaseType: "short_break",
        startedAt: new Date().toISOString(),
        endsAt: new Date(Date.now() + plannedDurationSeconds * 1000).toISOString(),
        plannedDurationSeconds,
        secondsRemaining: plannedDurationSeconds,
        secondsElapsed: 0,
        cycleWorkSessionIndex: 0
      });
    },
    startProcrastinatingForTask: (taskId: TaskId) => {
      setState((current) => {
        const suspendedTimer =
          isActiveWorkTimerState(current) &&
          current.taskId === taskId
            ? captureInterruptedWorkTimer(current)
            : undefined;

        return {
          status: "running",
          taskId,
          phaseType: "procrastination",
          startedAt: new Date().toISOString(),
          endsAt: null,
          plannedDurationSeconds: 0,
          secondsRemaining: 0,
          secondsElapsed: 0,
          cycleWorkSessionIndex:
            suspendedTimer?.cycleWorkSessionIndex ?? 0,
          ...(suspendedTimer ? { suspendedTimer } : {})
        };
      });
    },
    startInterruption: () => {
      setState((current) => {
        if (!isActiveWorkTimerState(current)) {
          return current;
        }

        const interruptedTimer = captureInterruptedWorkTimer(current);

        return {
          status: "running",
          taskId: current.taskId,
          phaseType: "interruption",
          startedAt: new Date().toISOString(),
          endsAt: null,
          plannedDurationSeconds: 0,
          secondsRemaining: 0,
          secondsElapsed: 0,
          cycleWorkSessionIndex: current.cycleWorkSessionIndex,
          interruptedTimer
        };
      });
    },
    pause: () => {
      setState((current) => {
        if (current.status !== "running" || current.phaseType === "interruption") {
          return current;
        }

        return {
          status: "paused",
          taskId: current.taskId,
          phaseType: current.phaseType,
          plannedDurationSeconds: current.plannedDurationSeconds,
          remainingSeconds:
            current.phaseType === "procrastination" || current.endsAt === null
              ? 0
              : getRemainingSecondsFromEndsAt(current.endsAt),
          elapsedSeconds:
            current.phaseType === "procrastination" || current.workMode === "study"
              ? getElapsedSecondsFromStartedAt(current.startedAt, new Date().toISOString())
              : current.secondsElapsed,
          cycleWorkSessionIndex: current.cycleWorkSessionIndex,
          startedAt: current.startedAt,
          workMode: current.workMode ?? "pomodoro",
          ...(current.suspendedTimer
            ? { suspendedTimer: current.suspendedTimer }
            : {})
        };
      });
    },
    resume: () => {
      void ensurePomodoroAudioReady();
      setState((current) => {
        if (current.status !== "paused") {
          return current;
        }

        return {
          status: "running",
          taskId: current.taskId,
          phaseType: current.phaseType,
          startedAt:
            current.phaseType === "procrastination" || current.workMode === "study"
              ? new Date(Date.now() - current.elapsedSeconds * 1000).toISOString()
              : current.startedAt,
          endsAt:
            current.phaseType === "procrastination" || current.workMode === "study"
              ? null
              : new Date(Date.now() + current.remainingSeconds * 1000).toISOString(),
          plannedDurationSeconds: current.plannedDurationSeconds,
          secondsRemaining: current.remainingSeconds,
          secondsElapsed: current.elapsedSeconds,
          cycleWorkSessionIndex: current.cycleWorkSessionIndex,
          workMode: current.workMode ?? "pomodoro",
          ...(current.suspendedTimer
            ? { suspendedTimer: current.suspendedTimer }
            : {})
        };
      });
    },
    finish: () => {
      void ensurePomodoroAudioReady();
      setState((current) => {
        if (current.status !== "running" && current.status !== "paused") {
          return current;
        }

        if (current.phaseType !== "work") {
          return current;
        }

        const endedAt = new Date().toISOString();
        const plannedDurationSeconds = current.plannedDurationSeconds;
        const actualDurationSeconds = Math.max(
          getActualDurationForTimerState(current, plannedDurationSeconds, endedAt),
          0
        );
        void playPomodoroCompletionChime("work", config.workCompletionChime);

        if (current.workMode === "study") {
          onStudySessionCompleted(
            current.taskId,
            actualDurationSeconds,
            current.startedAt,
            endedAt
          );

          return {
            status: "idle",
            taskId: current.taskId
          };
        }

        onWorkSessionCompleted(
          current.taskId,
          plannedDurationSeconds,
          Math.min(plannedDurationSeconds, actualDurationSeconds),
          current.startedAt,
          endedAt
        );

        return startBreakAfterCompletedWorkSession(
          current.taskId,
          endedAt,
          current.cycleWorkSessionIndex
        );
      });
    },
    giveUpStudy: () => {
      setState((current) => {
        if (current.status !== "running" && current.status !== "paused") {
          return current;
        }

        if (current.phaseType !== "work" || current.workMode !== "study") {
          return current;
        }

        const endedAt = new Date().toISOString();
        const actualDurationSeconds = Math.max(
          getActualDurationForTimerState(current, current.plannedDurationSeconds, endedAt),
          0
        );

        onStudySessionAttempted(
          current.taskId,
          actualDurationSeconds,
          current.startedAt,
          endedAt
        );

        return {
          status: "idle",
          taskId: current.taskId
        };
      });
    },
    interrupt: () => {
      setState((current) => {
        if (current.status !== "running" && current.status !== "paused") {
          return current;
        }

        if (current.phaseType === "procrastination" || current.phaseType === "interruption") {
          if (current.phaseType === "procrastination" && current.suspendedTimer) {
            return restoreInterruptedTimer(current.suspendedTimer);
          }

          return {
            status: "idle",
            taskId: current.taskId
          };
        }

        const endedAt = new Date().toISOString();
        const plannedDurationSeconds = current.plannedDurationSeconds;
        const actualDurationSeconds = getActualDurationForTimerState(
          current,
          plannedDurationSeconds,
          endedAt
        );

        if (current.phaseType === "work") {
          onWorkSessionInterrupted(
            current.taskId,
            plannedDurationSeconds,
            Math.max(actualDurationSeconds, 0),
            current.startedAt,
            endedAt
          );
        } else {
          onBreakRecorded(
            current.taskId,
            current.phaseType,
            plannedDurationSeconds,
            Math.max(actualDurationSeconds, 0),
            "skipped",
            current.startedAt,
            endedAt
          );
        }

        return {
          status: "idle",
          taskId: current.taskId
        };
      });
    },
    finishBreak: () => {
      setState((current) => {
        if (current.status !== "running" && current.status !== "paused") {
          return current;
        }

        if (
          current.phaseType === "work" ||
          current.phaseType === "procrastination" ||
          current.phaseType === "interruption"
        ) {
          return current;
        }

        const endedAt = new Date().toISOString();
        const plannedDurationSeconds = current.plannedDurationSeconds;
        const actualDurationSeconds = getActualDurationForTimerState(
          current,
          plannedDurationSeconds,
          endedAt
        );

        onBreakRecorded(
          current.taskId,
          current.phaseType,
          plannedDurationSeconds,
          Math.max(actualDurationSeconds, 0),
          "completed",
          current.startedAt,
          endedAt
        );

        return {
          status: "idle",
          taskId: current.taskId
        };
      });
    },
    cancel: () => {
      setState((current) => {
        if (current.status !== "running" && current.status !== "paused") {
          return current;
        }

        if (current.phaseType === "procrastination" && current.suspendedTimer) {
          return restoreInterruptedTimer(current.suspendedTimer);
        }

        return {
          status: "idle",
          taskId: current.taskId
        };
      });
    },
    stopProcrastinating: (note: string) => {
      setState((current) => {
        if (
          (current.status !== "running" && current.status !== "paused") ||
          current.phaseType !== "procrastination"
        ) {
          return current;
        }

        const endedAt = new Date().toISOString();
        const actualDurationSeconds =
          current.status === "running"
            ? getElapsedSecondsFromStartedAt(current.startedAt, endedAt)
            : current.elapsedSeconds;

        onProcrastinationRecorded(
          current.taskId,
          Math.max(actualDurationSeconds, 0),
          note.trim(),
          current.startedAt,
          endedAt
        );

        if (current.suspendedTimer) {
          return restoreInterruptedTimer(current.suspendedTimer);
        }

        return {
          status: "idle",
          taskId: current.taskId
        };
      });
    },
    reset: () => {
      setState((current) => {
        if (current.status === "idle") {
          return current;
        }

        if (current.phaseType === "procrastination" || current.phaseType === "interruption") {
          return current.status === "running"
            ? {
                ...current,
                startedAt: new Date().toISOString(),
                secondsElapsed: 0
              }
            : {
                ...current,
                elapsedSeconds: 0,
                startedAt: new Date().toISOString()
              };
        }

        const plannedDurationSeconds = current.plannedDurationSeconds;

        if (current.workMode === "study") {
          if (current.status === "paused") {
            return {
              ...current,
              remainingSeconds: 0,
              elapsedSeconds: 0,
              plannedDurationSeconds: 0,
              startedAt: new Date().toISOString()
            };
          }

          return {
            ...current,
            startedAt: new Date().toISOString(),
            endsAt: null,
            plannedDurationSeconds: 0,
            secondsRemaining: 0,
            secondsElapsed: 0
          };
        }

        if (current.status === "paused") {
          return {
            ...current,
            remainingSeconds: plannedDurationSeconds,
            elapsedSeconds: 0,
            plannedDurationSeconds,
            startedAt: new Date().toISOString()
          };
        }

        return {
          ...current,
          startedAt: new Date().toISOString(),
          endsAt: new Date(Date.now() + plannedDurationSeconds * 1000).toISOString(),
          plannedDurationSeconds,
          secondsRemaining: plannedDurationSeconds,
          secondsElapsed: 0
        };
      });
    },
    stopInterruption: (reason: string) => {
      setState((current) => {
        if (current.status !== "running" || current.phaseType !== "interruption") {
          return current;
        }

        const endedAt = new Date().toISOString();
        const actualDurationSeconds = getElapsedSecondsFromStartedAt(
          current.startedAt,
          endedAt
        );
        const interruptedTimer = current.interruptedTimer;

        onInterruptionRecorded(
          current.taskId,
          Math.max(actualDurationSeconds, 0),
          reason.trim(),
          current.startedAt,
          endedAt
        );

        return restoreInterruptedTimer(interruptedTimer);
      });
    },
    cancelInterruption: () => {
      setState((current) => {
        if (current.status !== "running" || current.phaseType !== "interruption") {
          return current;
        }

        return restoreInterruptedTimer(current.interruptedTimer);
      });
    },
    updateConfig: (nextConfig: PomodoroConfig) => {
      setConfig(nextConfig);
    }
  };

  return {
    isLoading,
    state,
    config,
    actions
  };
};
