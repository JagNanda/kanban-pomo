import type { Brand } from "../../../shared/domain/brand";
import type { BoardId } from "../../board/domain/board.types";
import type { ColumnId } from "../../columns/domain/column.types";
import type { TaskCollectionId } from "./task-collection.types";
import type { TaskProjectId } from "./task-project.types";

export type TaskId = Brand<string, "TaskId">;
export type TaskPriority = "low" | "medium" | "high";
export type StudyProblemDifficulty = "easy" | "medium" | "hard";
export type StudyProblemStatus = "unstarted" | "attempted" | "solved" | "reviewing";

export interface Task {
  id: TaskId;
  boardId: BoardId;
  columnId: ColumnId;
  taskProjectId: TaskProjectId | null;
  taskCollectionId: TaskCollectionId | null;
  title: string;
  description: string;
  priority: TaskPriority;
  orderIndex: number;
  estimatedCompletionDate: string | null;
  estimatedPomodoros: number;
  actualTrackedSeconds: number;
  aiTrackedSeconds: number;
  pomodoroCount: number;
  isStudyProblem: boolean;
  studyPlatform: string;
  studyUrl: string;
  studyDifficulty: StudyProblemDifficulty | null;
  studyTopic: string;
  studyStatus: StudyProblemStatus;
  timesCompleted: number;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
