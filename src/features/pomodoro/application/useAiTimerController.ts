import { useEffect, useState } from "react";
import type { TaskId } from "../../tasks/domain/task.types";

export type AiTimerState =
  | {
      status: "idle";
    }
  | {
      status: "running";
      taskId: TaskId;
      startedAt: string;
      resumedAt: string;
      accumulatedSeconds: number;
      secondsElapsed: number;
    }
  | {
      status: "paused";
      taskId: TaskId;
      startedAt: string;
      elapsedSeconds: number;
    };

interface UseAiTimerControllerOptions {
  onAiWorkRecorded: (
    taskId: TaskId,
    actualDurationSeconds: number,
    startedAt: string,
    endedAt: string
  ) => void;
}

const getElapsedSeconds = (startedAt: string, endedAt: string): number =>
  Math.max(
    0,
    Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000)
  );

export const useAiTimerController = ({
  onAiWorkRecorded
}: UseAiTimerControllerOptions) => {
  const [state, setState] = useState<AiTimerState>({ status: "idle" });

  useEffect(() => {
    if (state.status !== "running") {
      return undefined;
    }

    const interval = window.setInterval(() => {
      setState((current) =>
        current.status === "running"
          ? {
              ...current,
              secondsElapsed:
                current.accumulatedSeconds +
                getElapsedSeconds(current.resumedAt, new Date().toISOString())
            }
          : current
      );
    }, 1000);

    return () => window.clearInterval(interval);
  }, [state.status]);

  const actions = {
    startForTask: (taskId: TaskId) => {
      setState((current) =>
        current.status === "running"
          ? current
          : {
              status: "running",
              taskId,
              startedAt: new Date().toISOString(),
              resumedAt: new Date().toISOString(),
              accumulatedSeconds: 0,
              secondsElapsed: 0
            }
      );
    },
    stop: () => {
      setState((current) => {
        if (current.status === "idle") {
          return current;
        }

        const endedAt = new Date().toISOString();
        const actualDurationSeconds =
          current.status === "running"
            ? current.accumulatedSeconds + getElapsedSeconds(current.resumedAt, endedAt)
            : current.elapsedSeconds;

        onAiWorkRecorded(
          current.taskId,
          actualDurationSeconds,
          current.startedAt,
          endedAt
        );

        return { status: "idle" };
      });
    },
    pause: () => {
      setState((current) => {
        if (current.status !== "running") {
          return current;
        }

        const endedAt = new Date().toISOString();
        const elapsedSeconds =
          current.accumulatedSeconds + getElapsedSeconds(current.resumedAt, endedAt);

        return {
          status: "paused",
          taskId: current.taskId,
          startedAt: current.startedAt,
          elapsedSeconds
        };
      });
    },
    resume: () => {
      setState((current) => {
        if (current.status !== "paused") {
          return current;
        }

        return {
          status: "running",
          taskId: current.taskId,
          startedAt: current.startedAt,
          resumedAt: new Date().toISOString(),
          accumulatedSeconds: current.elapsedSeconds,
          secondsElapsed: current.elapsedSeconds
        };
      });
    },
    cancel: () => {
      setState((current) => (current.status === "idle" ? current : { status: "idle" }));
    }
  };

  return {
    state,
    actions
  };
};
