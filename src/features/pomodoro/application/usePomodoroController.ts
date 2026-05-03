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

  return config.longBreakDurationSeconds;
};

const getRemainingSecondsFromEndsAt = (endsAt: string): number =>
  Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / 1000));

const getElapsedSecondsFromStartedAt = (startedAt: string, endedAt: string): number =>
  Math.max(
    0,
    Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000)
  );

export const usePomodoroController = ({
  onWorkSessionCompleted,
  onWorkSessionInterrupted,
  onBreakRecorded
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
      secondsRemaining: nextPhaseDuration,
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

        const nextSecondsRemaining = getRemainingSecondsFromEndsAt(current.endsAt);

        if (nextSecondsRemaining > 0) {
          return {
            ...current,
            secondsRemaining: nextSecondsRemaining
          };
        }

        const endedAt = new Date().toISOString();
        const plannedDurationSeconds = getPlannedDurationForPhase(
          config,
          current.phaseType
        );

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
        secondsRemaining: config.workDurationSeconds,
        cycleWorkSessionIndex: 0
      });
    },
    startShortBreakForTask: (taskId: TaskId) => {
      void ensurePomodoroAudioReady();
      setState({
        status: "running",
        taskId,
        phaseType: "short_break",
        startedAt: new Date().toISOString(),
        endsAt: new Date(Date.now() + config.shortBreakDurationSeconds * 1000).toISOString(),
        secondsRemaining: config.shortBreakDurationSeconds,
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
          remainingSeconds: getRemainingSecondsFromEndsAt(current.endsAt),
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
          startedAt: current.startedAt,
          endsAt: new Date(Date.now() + current.remainingSeconds * 1000).toISOString(),
          secondsRemaining: current.remainingSeconds,
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
        const plannedDurationSeconds = getPlannedDurationForPhase(config, "work");
        void playPomodoroCompletionChime("work", config.workCompletionChime);

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
      });
    },
    interrupt: () => {
      setState((current) => {
        if (current.status !== "running" && current.status !== "paused") {
          return current;
        }

        const endedAt = new Date().toISOString();
        const plannedDurationSeconds = getPlannedDurationForPhase(
          config,
          current.phaseType
        );
        const actualDurationSeconds =
          current.status === "running"
            ? getElapsedSecondsFromStartedAt(current.startedAt, endedAt)
            : plannedDurationSeconds - current.remainingSeconds;

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
    skipBreak: () => {
      setState((current) => {
        if (current.status !== "running" && current.status !== "paused") {
          return current;
        }

        if (current.phaseType === "work") {
          return current;
        }

        const endedAt = new Date().toISOString();
        const plannedDurationSeconds = getPlannedDurationForPhase(
          config,
          current.phaseType
        );
        const actualDurationSeconds =
          current.status === "running"
            ? getElapsedSecondsFromStartedAt(current.startedAt, endedAt)
            : plannedDurationSeconds - current.remainingSeconds;

        onBreakRecorded(
          current.taskId,
          current.phaseType,
          plannedDurationSeconds,
          Math.max(actualDurationSeconds, 0),
          "skipped",
          current.startedAt,
          endedAt
        );

        return {
          status: "running",
          taskId: current.taskId,
          phaseType: "work",
          startedAt: endedAt,
          endsAt: new Date(
            Date.now() + config.workDurationSeconds * 1000
          ).toISOString(),
          secondsRemaining: config.workDurationSeconds,
          cycleWorkSessionIndex: current.cycleWorkSessionIndex
        };
      });
    },
    reset: () => {
      setState((current) => ({
        status: "idle",
        taskId: current.taskId
      }));
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
