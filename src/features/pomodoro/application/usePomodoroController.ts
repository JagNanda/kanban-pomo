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
  TimerState
} from "../domain/pomodoro.types";
import type { TaskId } from "../../tasks/domain/task.types";

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
  onProcrastinationRecorded: (
    taskId: TaskId,
    actualDurationSeconds: number,
    note: string,
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
  if (state.phaseType === "procrastination") {
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

export const usePomodoroController = ({
  onWorkSessionCompleted,
  onWorkSessionInterrupted,
  onBreakRecorded,
  onProcrastinationRecorded
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

        if (current.phaseType === "procrastination") {
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
    startForTask: (taskId: TaskId) => {
      void ensurePomodoroAudioReady();
      setState({
        status: "running",
        taskId,
        phaseType: "work",
        startedAt: new Date().toISOString(),
        endsAt: new Date(Date.now() + config.workDurationSeconds * 1000).toISOString(),
        plannedDurationSeconds: config.workDurationSeconds,
        secondsRemaining: config.workDurationSeconds,
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
      setState({
        status: "running",
        taskId,
        phaseType: "procrastination",
        startedAt: new Date().toISOString(),
        endsAt: null,
        plannedDurationSeconds: 0,
        secondsRemaining: 0,
        secondsElapsed: 0,
        cycleWorkSessionIndex: 0
      });
    },
    pause: () => {
      setState((current) => {
        if (current.status !== "running") {
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
            current.phaseType === "procrastination"
              ? getElapsedSecondsFromStartedAt(current.startedAt, new Date().toISOString())
              : current.secondsElapsed,
          cycleWorkSessionIndex: current.cycleWorkSessionIndex,
          startedAt: current.startedAt
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
            current.phaseType === "procrastination"
              ? new Date(Date.now() - current.elapsedSeconds * 1000).toISOString()
              : current.startedAt,
          endsAt:
            current.phaseType === "procrastination"
              ? null
              : new Date(Date.now() + current.remainingSeconds * 1000).toISOString(),
          plannedDurationSeconds: current.plannedDurationSeconds,
          secondsRemaining: current.remainingSeconds,
          secondsElapsed: current.elapsedSeconds,
          cycleWorkSessionIndex: current.cycleWorkSessionIndex
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
        const actualDurationSeconds = Math.min(
          plannedDurationSeconds,
          Math.max(getActualDurationForTimerState(current, plannedDurationSeconds, endedAt), 0)
        );
        void playPomodoroCompletionChime("work", config.workCompletionChime);

        onWorkSessionCompleted(
          current.taskId,
          plannedDurationSeconds,
          actualDurationSeconds,
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
    interrupt: () => {
      setState((current) => {
        if (current.status !== "running" && current.status !== "paused") {
          return current;
        }

        if (current.phaseType === "procrastination") {
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

        if (current.phaseType === "work" || current.phaseType === "procrastination") {
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

        if (current.phaseType === "procrastination") {
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
