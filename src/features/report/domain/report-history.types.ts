import type { Brand } from "../../../shared/domain/brand";
import type {
  StudyProblemDifficulty,
  StudyProblemStatus,
  TaskId,
  TaskPriority
} from "../../tasks/domain/task.types";

export type ArchivedCompletedTaskId = Brand<string, "ArchivedCompletedTaskId">;

export interface ArchivedCompletedTask {
  id: ArchivedCompletedTaskId;
  originalTaskId: TaskId;
  title: string;
  priority: TaskPriority;
  estimatedCompletionDate: string | null;
  completedAt: string;
  collectionName: string | null;
  collectionColor: string | null;
  projectName: string | null;
  projectColor: string | null;
  pomodoroCount: number;
  actualTrackedSeconds: number;
  aiTrackedSeconds: number;
  isStudyProblem: boolean;
  studyPlatform: string;
  studyUrl: string;
  studyDifficulty: StudyProblemDifficulty | null;
  studyTopic: string;
  studyStatus: StudyProblemStatus;
  timesCompleted: number;
  deletedAt: string;
}
