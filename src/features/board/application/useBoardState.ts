import { useEffect, useRef, useState } from "react";
import { loadMockBoardState } from "../infrastructure/mock-board-repository";
import type { Column, ColumnId } from "../../columns/domain/column.types";
import type {
  FieldDefinition,
  FieldScope,
  FieldType,
  TaskFieldAssignment,
  TaskFieldValue
} from "../../custom-fields/domain/custom-fields.types";
import type {
  BreakRecord,
  PomodoroSession
} from "../../pomodoro/domain/pomodoro.types";
import type { ArchivedCompletedTask } from "../../report/domain/report-history.types";
import type {
  Task,
  TaskId,
  TaskPriority
} from "../../tasks/domain/task.types";
import type {
  TaskCollection,
  TaskCollectionId
} from "../../tasks/domain/task-collection.types";
import type {
  TaskProject,
  TaskProjectId
} from "../../tasks/domain/task-project.types";
import { getTaskCollectionColor } from "../../tasks/domain/task-collection-palette";
import type {
  MarkdownImportApplyResult,
  MarkdownImportDocument
} from "../../tasks/application/markdown-import";
import { normalizeImportKey } from "../../tasks/application/markdown-import";
import { shiftDateOnlyValue } from "../../tasks/domain/task-deadline";
import { formatHoursFromSeconds, toIsoNow } from "../../../shared/lib/time";
import type { BoardSnapshot } from "../../../lib/electron-api/board-snapshot";
import { getDefaultColumnColor } from "../components/column-theme";

export interface BoardViewState {
  board: ReturnType<typeof loadMockBoardState>["board"];
  columns: Column[];
  taskProjects: TaskProject[];
  taskCollections: TaskCollection[];
  tasks: Task[];
  fieldDefinitions: FieldDefinition[];
  taskFieldAssignments: TaskFieldAssignment[];
  taskFieldValues: TaskFieldValue[];
  pomodoroSessions: PomodoroSession[];
  breakRecords: BreakRecord[];
  archivedCompletedTasks: ArchivedCompletedTask[];
  archivedPomodoroSessions: PomodoroSession[];
  archivedBreakRecords: BreakRecord[];
  selectedTaskId: TaskId | null;
}

export interface CreateTaskInput {
  columnId: ColumnId;
  title: string;
  description: string;
  priority: TaskPriority;
  taskProjectId: TaskProjectId;
  taskCollectionId: TaskCollectionId;
  estimatedCompletionDate: string | null;
  estimatedPomodoros: number;
}

const createId = (prefix: string): string =>
  `${prefix}_${Math.random().toString(36).slice(2, 10)}`;

const buildProjectImportKey = (name: string): string => normalizeImportKey(name);

const buildCollectionImportKey = (projectName: string, collectionName: string): string =>
  `${buildProjectImportKey(projectName)}::${normalizeImportKey(collectionName)}`;

const buildTaskImportKey = (
  projectName: string,
  collectionName: string,
  taskTitle: string
): string =>
  `${buildCollectionImportKey(projectName, collectionName)}::${normalizeImportKey(taskTitle)}`;

const normalizeTaskOrderIndices = (tasks: Task[], columns: Column[]): Task[] =>
  columns.flatMap((column) =>
    tasks
      .filter((task) => task.columnId === column.id)
      .sort((left, right) => left.orderIndex - right.orderIndex)
      .map((task, index) => ({
        ...task,
        orderIndex: index
      }))
  );

const getDeletedFieldDefinitionIds = (
  current: BoardViewState,
  deletedTaskIds: Set<TaskId>
): Set<FieldDefinition["id"]> =>
  new Set(
    current.taskFieldAssignments
      .filter((assignment) => deletedTaskIds.has(assignment.taskId))
      .map((assignment) => assignment.fieldDefinitionId)
      .filter((fieldDefinitionId) => {
        const definition = current.fieldDefinitions.find(
          (candidate) => candidate.id === fieldDefinitionId
        );

        if (!definition || definition.scope !== "task_specific") {
          return false;
        }

        return !current.taskFieldAssignments.some(
          (assignment) =>
            !deletedTaskIds.has(assignment.taskId) &&
            assignment.fieldDefinitionId === fieldDefinitionId
        );
      })
  );

const buildArchivedDeletionState = (
  current: BoardViewState,
  deletedTaskIds: Set<TaskId>
): Pick<
  BoardViewState,
  "archivedCompletedTasks" | "archivedPomodoroSessions" | "archivedBreakRecords"
> => {
  const deletedCompletedTasks = current.tasks.filter(
    (task) => deletedTaskIds.has(task.id) && task.completedAt !== null
  );
  const deletedCompletedTaskIds = new Set(deletedCompletedTasks.map((task) => task.id));

  if (deletedCompletedTasks.length === 0) {
    return {
      archivedCompletedTasks: current.archivedCompletedTasks,
      archivedPomodoroSessions: current.archivedPomodoroSessions,
      archivedBreakRecords: current.archivedBreakRecords
    };
  }

  const taskProjectsById = new Map(current.taskProjects.map((project) => [project.id, project]));
  const taskCollectionsById = new Map(
    current.taskCollections.map((collection) => [collection.id, collection])
  );
  const deletedAt = toIsoNow();

  return {
    archivedCompletedTasks: [
      ...current.archivedCompletedTasks,
      ...deletedCompletedTasks.map((task) => {
        const collection =
          task.taskCollectionId !== null ? taskCollectionsById.get(task.taskCollectionId) ?? null : null;
        const project =
          task.taskProjectId !== null
            ? taskProjectsById.get(task.taskProjectId) ?? null
            : collection?.taskProjectId !== null && collection?.taskProjectId !== undefined
              ? taskProjectsById.get(collection.taskProjectId) ?? null
              : null;

        return {
          id: createId("archived_task") as ArchivedCompletedTask["id"],
          originalTaskId: task.id,
          title: task.title,
          priority: task.priority,
          estimatedCompletionDate: task.estimatedCompletionDate,
          completedAt: task.completedAt ?? deletedAt,
          collectionName: collection?.name ?? null,
          collectionColor: collection?.color ?? null,
          projectName: project?.name ?? null,
          projectColor: project?.color ?? null,
          pomodoroCount: task.pomodoroCount,
          actualTrackedSeconds: task.actualTrackedSeconds,
          deletedAt
        };
      })
    ],
    archivedPomodoroSessions: [
      ...current.archivedPomodoroSessions,
      ...current.pomodoroSessions.filter((session) => deletedCompletedTaskIds.has(session.taskId))
    ],
    archivedBreakRecords: [
      ...current.archivedBreakRecords,
      ...current.breakRecords.filter((record) => deletedCompletedTaskIds.has(record.taskId))
    ]
  };
};

const buildTaskDeletionState = (
  current: BoardViewState,
  remainingTasks: Task[],
  deletedTaskIds: Set<TaskId>
) => {
  const deletedFieldDefinitionIds = getDeletedFieldDefinitionIds(current, deletedTaskIds);
  const archivedDeletionState = buildArchivedDeletionState(current, deletedTaskIds);

  return {
    tasks: normalizeTaskOrderIndices(remainingTasks, current.columns),
    fieldDefinitions: current.fieldDefinitions.filter(
      (definition) => !deletedFieldDefinitionIds.has(definition.id)
    ),
    taskFieldAssignments: current.taskFieldAssignments.filter(
      (assignment) =>
        !deletedTaskIds.has(assignment.taskId) &&
        !deletedFieldDefinitionIds.has(assignment.fieldDefinitionId)
    ),
    taskFieldValues: current.taskFieldValues.filter(
      (fieldValue) =>
        !deletedTaskIds.has(fieldValue.taskId) &&
        !deletedFieldDefinitionIds.has(fieldValue.fieldDefinitionId)
    ),
    pomodoroSessions: current.pomodoroSessions.filter(
      (session) => !deletedTaskIds.has(session.taskId)
    ),
    breakRecords: current.breakRecords.filter(
      (record) => !deletedTaskIds.has(record.taskId)
    ),
    ...archivedDeletionState
  };
};

const isInDevColumnName = (name: string): boolean => {
  const normalized = name.trim().toLowerCase();
  return normalized === "in dev" || normalized === "in progress";
};

const isCompletedColumnName = (name: string): boolean => {
  const normalized = name.trim().toLowerCase();
  return normalized === "completed" || normalized === "done";
};

const ensureInDevColumnState = (
  current: BoardViewState
): { columns: Column[]; inDevColumnId: ColumnId } => {
  const existing = current.columns.find((column) => isInDevColumnName(column.name));

  if (existing) {
    return {
      columns: current.columns,
      inDevColumnId: existing.id
    };
  }

  const now = toIsoNow();
  const newColumn: Column = {
    id: createId("column") as ColumnId,
    boardId: current.board.id,
    name: "In Dev",
    color: getDefaultColumnColor(current.columns.length),
    orderIndex: current.columns.length,
    createdAt: now,
    updatedAt: now
  };

  return {
    columns: [...current.columns, newColumn],
    inDevColumnId: newColumn.id
  };
};

const shiftMatchingTaskDueDates = (
  current: BoardViewState,
  dayCount: number,
  matchesTask: (task: Task) => boolean
): BoardViewState => {
  const normalizedDayCount = Math.max(0, Math.floor(dayCount));

  if (normalizedDayCount === 0) {
    return current;
  }

  const updatedAt = toIsoNow();

  return {
    ...current,
    tasks: current.tasks.map((task) => {
      if (
        !matchesTask(task) ||
        task.completedAt !== null ||
        task.estimatedCompletionDate === null
      ) {
        return task;
      }

      return {
        ...task,
        estimatedCompletionDate: shiftDateOnlyValue(
          task.estimatedCompletionDate,
          normalizedDayCount
        ),
        updatedAt
      };
    })
  };
};

const desktopApiAvailable = (): boolean => typeof window.desktop !== "undefined";

const HIDDEN_FIELD_DEFINITION_IDS = new Set<string>([
  "field_priority",
  "field_story_points",
  "field_ready_for_demo"
]);

const toBoardViewState = (
  snapshot: BoardSnapshot,
  selectedTaskId?: TaskId | null
): BoardViewState => ({
  ...snapshot,
  fieldDefinitions: snapshot.fieldDefinitions.filter(
    (definition) => !HIDDEN_FIELD_DEFINITION_IDS.has(definition.id)
  ),
  taskFieldAssignments: snapshot.taskFieldAssignments.filter(
    (assignment) => !HIDDEN_FIELD_DEFINITION_IDS.has(assignment.fieldDefinitionId)
  ),
  taskFieldValues: snapshot.taskFieldValues.filter(
    (fieldValue) => !HIDDEN_FIELD_DEFINITION_IDS.has(fieldValue.fieldDefinitionId)
  ),
  selectedTaskId: selectedTaskId ?? snapshot.tasks[0]?.id ?? null
});

const toBoardSnapshot = (state: BoardViewState): BoardSnapshot => ({
  board: state.board,
  columns: state.columns,
  taskProjects: state.taskProjects,
  taskCollections: state.taskCollections,
  tasks: state.tasks,
  fieldDefinitions: state.fieldDefinitions,
  taskFieldAssignments: state.taskFieldAssignments,
  taskFieldValues: state.taskFieldValues,
  pomodoroSessions: state.pomodoroSessions,
  breakRecords: state.breakRecords,
  archivedCompletedTasks: state.archivedCompletedTasks,
  archivedPomodoroSessions: state.archivedPomodoroSessions,
  archivedBreakRecords: state.archivedBreakRecords
});

const getApplicableFieldDefinitions = (
  fieldDefinitions: FieldDefinition[],
  taskFieldAssignments: TaskFieldAssignment[],
  taskId: TaskId
): FieldDefinition[] =>
  fieldDefinitions.filter((definition) => {
    if (definition.scope === "global") {
      return true;
    }

    return taskFieldAssignments.some(
      (assignment) =>
        assignment.fieldDefinitionId === definition.id &&
        assignment.taskId === taskId
    );
  });

export const useBoardState = () => {
  const initialState = loadMockBoardState();
  const [state, setState] = useState<BoardViewState>({
    ...initialState,
    selectedTaskId: initialState.tasks[0]?.id ?? null
  });
  const [isLoading, setIsLoading] = useState<boolean>(desktopApiAvailable());
  const [hasHydrated, setHasHydrated] = useState<boolean>(!desktopApiAvailable());
  const pendingSnapshotRef = useRef<BoardSnapshot | null>(null);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    if (!desktopApiAvailable()) {
      return;
    }

    let isMounted = true;

    void window.desktop
      .loadBoardSnapshot()
      .then((snapshot) => {
        if (!isMounted) {
          return;
        }

        setState(toBoardViewState(snapshot));
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

  const queueBoardSave = (nextState: BoardViewState): void => {
    if (!hasHydrated || !desktopApiAvailable()) {
      return;
    }

    pendingSnapshotRef.current = toBoardSnapshot(nextState);
    saveQueueRef.current = saveQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        const snapshot = pendingSnapshotRef.current;

        if (!snapshot) {
          return;
        }

        pendingSnapshotRef.current = null;
        await window.desktop.saveBoardSnapshot(snapshot);
      });
  };

  const updateState = (updater: (current: BoardViewState) => BoardViewState): void => {
    setState((current) => {
      const nextState = updater(current);
      queueBoardSave(nextState);
      return nextState;
    });
  };

  const selectedTask =
    state.tasks.find((task) => task.id === state.selectedTaskId) ?? null;

  const selectedTaskFieldDefinitions = selectedTask
    ? getApplicableFieldDefinitions(
        state.fieldDefinitions,
        state.taskFieldAssignments,
        selectedTask.id
      )
    : [];

  const selectedTaskFieldValues = selectedTask
    ? state.taskFieldValues.filter((fieldValue) => fieldValue.taskId === selectedTask.id)
    : [];

  const selectedTaskSessionHistory = selectedTask
    ? state.pomodoroSessions
        .filter((session) => session.taskId === selectedTask.id)
        .sort((left, right) => right.startedAt.localeCompare(left.startedAt))
    : [];

  const selectedTaskBreakHistory = selectedTask
    ? state.breakRecords
        .filter((record) => record.taskId === selectedTask.id)
        .sort((left, right) => right.startedAt.localeCompare(left.startedAt))
    : [];

  const totalTrackedSeconds = state.tasks.reduce(
    (sum, task) => sum + task.actualTrackedSeconds,
    0
  );

  const metrics = {
    totalTrackedHoursLabel: formatHoursFromSeconds(totalTrackedSeconds),
    completedPomodoroCount: state.tasks.reduce(
      (sum, task) => sum + task.pomodoroCount,
      0
    )
  };

  const actions = {
    selectTask: (taskId: TaskId) => {
      updateState((current) => ({
        ...current,
        selectedTaskId: taskId
      }));
    },
    createTaskProject: (name: string) => {
      const trimmedName = name.trim();

      if (trimmedName.length === 0) {
        return;
      }

      updateState((current) => {
        const now = toIsoNow();
        const newTaskProject: TaskProject = {
          id: createId("project") as TaskProjectId,
          boardId: current.board.id,
          name: trimmedName,
          color: getTaskCollectionColor(current.taskProjects.length),
          orderIndex: current.taskProjects.length,
          createdAt: now,
          updatedAt: now
        };

        return {
          ...current,
          taskProjects: [...current.taskProjects, newTaskProject]
        };
      });
    },
    renameTaskProject: (taskProjectId: TaskProjectId, name: string) => {
      const trimmedName = name.trim();

      if (trimmedName.length === 0) {
        return;
      }

      updateState((current) => ({
        ...current,
        taskProjects: current.taskProjects.map((project) =>
          project.id === taskProjectId
            ? {
                ...project,
                name: trimmedName,
                updatedAt: toIsoNow()
              }
            : project
        )
      }));
    },
    createTaskCollection: (name: string, taskProjectId: TaskProjectId) => {
      const trimmedName = name.trim();

      if (trimmedName.length === 0) {
        return;
      }

      updateState((current) => {
        if (!current.taskProjects.some((project) => project.id === taskProjectId)) {
          return current;
        }

        const now = toIsoNow();
        const newTaskCollection: TaskCollection = {
          id: createId("collection") as TaskCollectionId,
          boardId: current.board.id,
          taskProjectId,
          name: trimmedName,
          color: getTaskCollectionColor(current.taskCollections.length),
          orderIndex: current.taskCollections.length,
          createdAt: now,
          updatedAt: now
        };

        return {
          ...current,
          taskCollections: [...current.taskCollections, newTaskCollection]
        };
      });
    },
    renameTaskCollection: (taskCollectionId: TaskCollectionId, name: string) => {
      const trimmedName = name.trim();

      if (trimmedName.length === 0) {
        return;
      }

      updateState((current) => ({
        ...current,
        taskCollections: current.taskCollections.map((collection) =>
          collection.id === taskCollectionId
            ? {
                ...collection,
                name: trimmedName,
                updatedAt: toIsoNow()
              }
            : collection
        )
      }));
    },
    extendTaskProjectDueDates: (taskProjectId: TaskProjectId, dayCount: number) => {
      updateState((current) => {
        if (!current.taskProjects.some((project) => project.id === taskProjectId)) {
          return current;
        }

        return shiftMatchingTaskDueDates(
          current,
          dayCount,
          (task) => task.taskProjectId === taskProjectId
        );
      });
    },
    extendTaskCollectionDueDates: (taskCollectionId: TaskCollectionId, dayCount: number) => {
      updateState((current) => {
        if (!current.taskCollections.some((collection) => collection.id === taskCollectionId)) {
          return current;
        }

        return shiftMatchingTaskDueDates(
          current,
          dayCount,
          (task) => task.taskCollectionId === taskCollectionId
        );
      });
    },
    deleteTaskProject: (taskProjectId: TaskProjectId) => {
      updateState((current) => {
        const project = current.taskProjects.find((candidate) => candidate.id === taskProjectId);

        if (!project) {
          return current;
        }

        const deletedCollectionIds = new Set(
          current.taskCollections
            .filter((collection) => collection.taskProjectId === taskProjectId)
            .map((collection) => collection.id)
        );
        const deletedTaskIds = new Set(
          current.tasks
            .filter(
              (task) =>
                task.taskProjectId === taskProjectId ||
                (task.taskCollectionId !== null &&
                  deletedCollectionIds.has(task.taskCollectionId))
            )
            .map((task) => task.id)
        );
        const remainingTasks = current.tasks.filter((task) => !deletedTaskIds.has(task.id));
        const deletionState = buildTaskDeletionState(
          current,
          remainingTasks,
          deletedTaskIds
        );

        return {
          ...current,
          taskProjects: current.taskProjects
            .filter((candidate) => candidate.id !== taskProjectId)
            .map((candidate, index) => ({
              ...candidate,
              orderIndex: index
            })),
          taskCollections: current.taskCollections
            .filter((collection) => !deletedCollectionIds.has(collection.id))
            .map((collection, index) => ({
              ...collection,
              orderIndex: index
            })),
          ...deletionState,
          selectedTaskId:
            current.selectedTaskId !== null && deletedTaskIds.has(current.selectedTaskId)
              ? deletionState.tasks[0]?.id ?? null
              : current.selectedTaskId
        };
      });
    },
    deleteTaskCollection: (taskCollectionId: TaskCollectionId) => {
      updateState((current) => {
        const collection = current.taskCollections.find(
          (candidate) => candidate.id === taskCollectionId
        );

        if (!collection) {
          return current;
        }

        const deletedTaskIds = new Set(
          current.tasks
            .filter((task) => task.taskCollectionId === taskCollectionId)
            .map((task) => task.id)
        );
        const remainingTasks = current.tasks.filter((task) => !deletedTaskIds.has(task.id));
        const deletionState = buildTaskDeletionState(
          current,
          remainingTasks,
          deletedTaskIds
        );

        return {
          ...current,
          taskCollections: current.taskCollections
            .filter((candidate) => candidate.id !== taskCollectionId)
            .map((candidate, index) => ({
              ...candidate,
              orderIndex: index
            })),
          ...deletionState,
          selectedTaskId:
            current.selectedTaskId !== null && deletedTaskIds.has(current.selectedTaskId)
              ? deletionState.tasks[0]?.id ?? null
              : current.selectedTaskId
        };
      });
    },
    importMarkdownDocument: (
      document: MarkdownImportDocument
    ): MarkdownImportApplyResult => {
      let applyResult: MarkdownImportApplyResult = {
        ok: false,
        errors: [{ line: 1, message: "Markdown import did not run." }]
      };

      updateState((current) => {
        const firstColumn = current.columns
          .slice()
          .sort((left, right) => left.orderIndex - right.orderIndex)[0];

        if (!firstColumn) {
          applyResult = {
            ok: false,
            errors: [
              {
                line: 1,
                message: "Cannot import because the board has no columns."
              }
            ]
          };
          return current;
        }

        const now = toIsoNow();
        const nextProjects = current.taskProjects.slice();
        const nextCollections = current.taskCollections.slice();
        const nextTasks = current.tasks.slice();
        const projectByKey = new Map(
          nextProjects.map((project) => [buildProjectImportKey(project.name), project])
        );
        const collectionByKey = new Map(
          nextCollections
            .filter((collection) => collection.taskProjectId !== null)
            .map((collection) => {
              const project = nextProjects.find(
                (candidate) => candidate.id === collection.taskProjectId
              );

              return project
                ? [buildCollectionImportKey(project.name, collection.name), collection]
                : null;
            })
            .filter(
              (
                entry
              ): entry is [string, TaskCollection] => entry !== null
            )
        );
        const taskByKey = new Map(
          nextTasks
            .map((task) => {
              if (task.taskProjectId === null || task.taskCollectionId === null) {
                return null;
              }

              const project = nextProjects.find(
                (candidate) => candidate.id === task.taskProjectId
              );
              const collection = nextCollections.find(
                (candidate) => candidate.id === task.taskCollectionId
              );

              if (!project || !collection) {
                return null;
              }

              return [
                buildTaskImportKey(project.name, collection.name, task.title),
                task
              ] as const;
            })
            .filter((entry): entry is readonly [string, Task] => entry !== null)
        );
        const summary = {
          projectsCreated: 0,
          projectsUpdated: 0,
          collectionsCreated: 0,
          collectionsUpdated: 0,
          tasksCreated: 0,
          tasksUpdated: 0
        };
        let nextOrderIndexInFirstColumn = nextTasks.filter(
          (task) => task.columnId === firstColumn.id
        ).length;

        document.projects.forEach((projectInput) => {
          const projectKey = buildProjectImportKey(projectInput.name);
          const matchedProject = projectByKey.get(projectKey);
          const project =
            matchedProject ??
            (() => {
              const newProject: TaskProject = {
                id: createId("project") as TaskProjectId,
                boardId: current.board.id,
                name: projectInput.name,
                color: getTaskCollectionColor(nextProjects.length),
                orderIndex: nextProjects.length,
                createdAt: now,
                updatedAt: now
              };

              nextProjects.push(newProject);
              projectByKey.set(projectKey, newProject);
              summary.projectsCreated += 1;
              return newProject;
            })();

          if (matchedProject) {
            summary.projectsUpdated += 1;

            if (project.name !== projectInput.name) {
              project.name = projectInput.name;
              project.updatedAt = now;
            }
          }

          projectInput.collections.forEach((collectionInput) => {
            const collectionKey = buildCollectionImportKey(project.name, collectionInput.name);
            const matchedCollection = collectionByKey.get(collectionKey);
            const collection =
              matchedCollection ??
              (() => {
                const newCollection: TaskCollection = {
                  id: createId("collection") as TaskCollectionId,
                  boardId: current.board.id,
                  taskProjectId: project.id,
                  name: collectionInput.name,
                  color: getTaskCollectionColor(nextCollections.length),
                  orderIndex: nextCollections.length,
                  createdAt: now,
                  updatedAt: now
                };

                nextCollections.push(newCollection);
                collectionByKey.set(
                  buildCollectionImportKey(project.name, collectionInput.name),
                  newCollection
                );
                summary.collectionsCreated += 1;
                return newCollection;
              })();

            if (matchedCollection) {
              summary.collectionsUpdated += 1;

              if (
                collection.name !== collectionInput.name ||
                collection.taskProjectId !== project.id
              ) {
                collection.name = collectionInput.name;
                collection.taskProjectId = project.id;
                collection.updatedAt = now;
              }
            }

            collectionInput.tasks.forEach((taskInput) => {
              const taskKey = buildTaskImportKey(project.name, collection.name, taskInput.title);
              const matchedTask = taskByKey.get(taskKey);

              if (matchedTask) {
                summary.tasksUpdated += 1;
                matchedTask.title = taskInput.title;
                matchedTask.description = taskInput.description;
                matchedTask.priority = taskInput.priority;
                matchedTask.estimatedPomodoros = taskInput.estimatedPomodoros;
                matchedTask.estimatedCompletionDate = taskInput.estimatedCompletionDate;
                matchedTask.taskProjectId = project.id;
                matchedTask.taskCollectionId = collection.id;
                matchedTask.updatedAt = now;
                return;
              }

              const newTask: Task = {
                id: createId("task") as TaskId,
                boardId: current.board.id,
                columnId: firstColumn.id,
                taskProjectId: project.id,
                taskCollectionId: collection.id,
                title: taskInput.title,
                description: taskInput.description,
                priority: taskInput.priority,
                orderIndex: nextOrderIndexInFirstColumn,
                estimatedCompletionDate: taskInput.estimatedCompletionDate,
                estimatedPomodoros: taskInput.estimatedPomodoros,
                actualTrackedSeconds: 0,
                pomodoroCount: 0,
                completedAt: null,
                createdAt: now,
                updatedAt: now
              };

              nextOrderIndexInFirstColumn += 1;
              nextTasks.push(newTask);
              taskByKey.set(taskKey, newTask);
              summary.tasksCreated += 1;
            });
          });
        });

        applyResult = { ok: true, summary };

        return {
          ...current,
          taskProjects: nextProjects,
          taskCollections: nextCollections,
          tasks: nextTasks
        };
      });

      return applyResult;
    },
    addColumn: () => {
      updateState((current) => {
        const now = toIsoNow();
        const newColumn: Column = {
          id: createId("column") as ColumnId,
          boardId: current.board.id,
          name: `Column ${current.columns.length + 1}`,
          color: getDefaultColumnColor(current.columns.length),
          orderIndex: current.columns.length,
          createdAt: now,
          updatedAt: now
        };

        return {
          ...current,
          columns: [...current.columns, newColumn]
        };
      });
    },
    deleteColumn: (columnId: ColumnId) => {
      updateState((current) => {
        const survivingTasks = current.tasks.filter(
          (task) => task.columnId !== columnId
        );
        const deletedTaskIds = new Set(
          current.tasks
            .filter((task) => task.columnId === columnId)
            .map((task) => task.id)
        );

        return {
          ...current,
          columns: current.columns
            .filter((column) => column.id !== columnId)
            .map((column, index) => ({
              ...column,
              orderIndex: index
            })),
          tasks: survivingTasks,
          taskFieldAssignments: current.taskFieldAssignments.filter(
            (assignment) => !deletedTaskIds.has(assignment.taskId)
          ),
          taskFieldValues: current.taskFieldValues.filter(
            (fieldValue) => !deletedTaskIds.has(fieldValue.taskId)
          ),
          pomodoroSessions: current.pomodoroSessions.filter(
            (session) => !deletedTaskIds.has(session.taskId)
          ),
          breakRecords: current.breakRecords.filter(
            (record) => !deletedTaskIds.has(record.taskId)
          ),
          selectedTaskId:
            current.selectedTaskId !== null && deletedTaskIds.has(current.selectedTaskId)
              ? survivingTasks[0]?.id ?? null
              : current.selectedTaskId
        };
      });
    },
    reorderColumns: (sourceColumnId: ColumnId, targetColumnId: ColumnId) => {
      if (sourceColumnId === targetColumnId) {
        return;
      }

      updateState((current) => {
        const orderedColumns = current.columns
          .slice()
          .sort((left, right) => left.orderIndex - right.orderIndex);
        const sourceIndex = orderedColumns.findIndex((column) => column.id === sourceColumnId);
        const targetIndex = orderedColumns.findIndex((column) => column.id === targetColumnId);

        if (sourceIndex === -1 || targetIndex === -1) {
          return current;
        }

        const movedColumns = orderedColumns.slice();
        const [movedColumn] = movedColumns.splice(sourceIndex, 1);

        if (!movedColumn) {
          return current;
        }

        movedColumns.splice(targetIndex, 0, movedColumn);
        const updatedAt = toIsoNow();

        return {
          ...current,
          columns: movedColumns.map((column, index) => ({
            ...column,
            orderIndex: index,
            updatedAt:
              column.id === sourceColumnId || column.id === targetColumnId
                ? updatedAt
                : column.updatedAt
          }))
        };
      });
    },
    updateColumn: (columnId: ColumnId, updates: { name: string; color: string }) => {
      const trimmedName = updates.name.trim();
      const normalizedColor = updates.color.trim();

      if (trimmedName.length === 0 || !/^#[0-9a-fA-F]{6}$/.test(normalizedColor)) {
        return;
      }

      updateState((current) => ({
        ...current,
        columns: current.columns.map((column) =>
          column.id === columnId
            ? {
                ...column,
                name: trimmedName,
                color: normalizedColor,
                updatedAt: toIsoNow()
              }
            : column
        )
      }));
    },
    createTask: ({
      columnId,
      title,
      description,
      priority,
      taskProjectId,
      taskCollectionId,
      estimatedCompletionDate,
      estimatedPomodoros
    }: CreateTaskInput) => {
      updateState((current) => {
        const matchedCollection =
          current.taskCollections.find((collection) => collection.id === taskCollectionId) ?? null;

        if (!matchedCollection || matchedCollection.taskProjectId !== taskProjectId) {
          return current;
        }

        const now = toIsoNow();
        const taskCountInColumn = current.tasks.filter(
          (task) => task.columnId === columnId
        ).length;

        const newTask: Task = {
          id: createId("task") as TaskId,
          boardId: current.board.id,
          columnId,
          taskProjectId,
          taskCollectionId,
          title: title.trim() || "New task",
          description,
          priority,
          orderIndex: taskCountInColumn,
          estimatedCompletionDate,
          estimatedPomodoros: Math.max(0, Math.floor(estimatedPomodoros)),
          actualTrackedSeconds: 0,
          pomodoroCount: 0,
          completedAt: current.columns.some(
            (column) => column.id === columnId && isCompletedColumnName(column.name)
          )
            ? now
            : null,
          createdAt: now,
          updatedAt: now
        };

        return {
          ...current,
          tasks: [...current.tasks, newTask],
          selectedTaskId: newTask.id
        };
      });
    },
    assignTaskToProject: (taskId: TaskId, taskProjectId: TaskProjectId | null) => {
      updateState((current) => {
        if (
          taskProjectId !== null &&
          !current.taskProjects.some((project) => project.id === taskProjectId)
        ) {
          return current;
        }

        return {
          ...current,
          tasks: current.tasks.map((task) => {
            if (task.id !== taskId) {
              return task;
            }

            const currentCollection =
              task.taskCollectionId !== null
                ? current.taskCollections.find(
                    (collection) => collection.id === task.taskCollectionId
                  ) ?? null
                : null;
            const projectCollections =
              taskProjectId === null
                ? []
                : current.taskCollections.filter(
                    (collection) => collection.taskProjectId === taskProjectId
                  );
            const nextCollectionId =
              currentCollection && currentCollection.taskProjectId === taskProjectId
                ? currentCollection.id
                : projectCollections[0]?.id ?? task.taskCollectionId;

            if (taskProjectId !== null && projectCollections.length === 0) {
              return task;
            }

            return {
              ...task,
              taskProjectId,
              taskCollectionId: nextCollectionId ?? null,
              updatedAt: toIsoNow()
            };
          })
        };
      });
    },
    assignTaskToCollection: (taskId: TaskId, taskCollectionId: TaskCollectionId | null) => {
      updateState((current) => {
        const matchedCollection =
          taskCollectionId !== null
            ? current.taskCollections.find((collection) => collection.id === taskCollectionId) ??
              null
            : null;

        if (taskCollectionId !== null && !matchedCollection) {
          return current;
        }

        return {
          ...current,
          tasks: current.tasks.map((task) =>
            task.id === taskId
              ? {
                  ...task,
                  taskProjectId: matchedCollection?.taskProjectId ?? task.taskProjectId,
                  taskCollectionId,
                  updatedAt: toIsoNow()
                }
              : task
          )
        };
      });
    },
    moveTask: (taskId: TaskId, targetColumnId: ColumnId) => {
      updateState((current) => {
        const nextTasks = current.tasks.map((task) => {
          if (task.id !== taskId) {
            return task;
          }

          const targetIndex = current.tasks.filter(
            (candidate) => candidate.columnId === targetColumnId && candidate.id !== task.id
          ).length;

          return {
            ...task,
            columnId: targetColumnId,
            orderIndex: targetIndex,
            completedAt: current.columns.some(
              (column) => column.id === targetColumnId && isCompletedColumnName(column.name)
            )
              ? toIsoNow()
              : task.completedAt,
            updatedAt: toIsoNow()
          };
        });

        const normalizedTasks = current.columns.flatMap((column) =>
          nextTasks
            .filter((task) => task.columnId === column.id)
            .sort((left, right) => left.orderIndex - right.orderIndex)
            .map((task, index) => ({
              ...task,
              orderIndex: index
            }))
        );

        return {
          ...current,
          tasks: normalizedTasks
        };
      });
    },
    ensureTaskInDev: (taskId: TaskId) => {
      updateState((current) => {
        const { columns, inDevColumnId } = ensureInDevColumnState(current);
        const nextTasks = current.tasks.map((task) => {
          if (task.id !== taskId) {
            return task;
          }

          const targetIndex = current.tasks.filter(
            (candidate) =>
              candidate.columnId === inDevColumnId && candidate.id !== task.id
          ).length;

          return {
            ...task,
            columnId: inDevColumnId,
            orderIndex: targetIndex,
            updatedAt: toIsoNow()
          };
        });

        const normalizedTasks = columns.flatMap((column) =>
          nextTasks
            .filter((task) => task.columnId === column.id)
            .sort((left, right) => left.orderIndex - right.orderIndex)
            .map((task, index) => ({
              ...task,
              orderIndex: index
            }))
        );

        return {
          ...current,
          columns: columns.map((column, index) => ({
            ...column,
            orderIndex: index
          })),
          tasks: normalizedTasks,
          selectedTaskId: taskId
        };
      });
    },
    updateTaskTitle: (taskId: TaskId, title: string) => {
      updateState((current) => ({
        ...current,
        tasks: current.tasks.map((task) =>
          task.id === taskId
            ? {
                ...task,
                title,
                updatedAt: toIsoNow()
              }
            : task
        )
      }));
    },
    updateTaskDescription: (taskId: TaskId, description: string) => {
      updateState((current) => ({
        ...current,
        tasks: current.tasks.map((task) =>
          task.id === taskId
            ? {
                ...task,
                description,
                updatedAt: toIsoNow()
              }
            : task
        )
      }));
    },
    updateTaskPriority: (taskId: TaskId, priority: TaskPriority) => {
      updateState((current) => ({
        ...current,
        tasks: current.tasks.map((task) =>
          task.id === taskId
            ? {
                ...task,
                priority,
                updatedAt: toIsoNow()
              }
            : task
        )
      }));
    },
    updateTaskEstimatedDate: (taskId: TaskId, estimatedCompletionDate: string) => {
      updateState((current) => ({
        ...current,
        tasks: current.tasks.map((task) =>
          task.id === taskId
            ? {
                ...task,
                estimatedCompletionDate: estimatedCompletionDate || null,
                updatedAt: toIsoNow()
              }
            : task
        )
      }));
    },
    updateTaskEstimatedPomodoros: (taskId: TaskId, estimatedPomodoros: number) => {
      updateState((current) => ({
        ...current,
        tasks: current.tasks.map((task) =>
          task.id === taskId
            ? {
                ...task,
                estimatedPomodoros: Math.max(0, Math.floor(estimatedPomodoros)),
                updatedAt: toIsoNow()
              }
            : task
        )
      }));
    },
    updateTaskCompletedPomodoros: (taskId: TaskId, pomodoroCount: number) => {
      updateState((current) => ({
        ...current,
        tasks: current.tasks.map((task) =>
          task.id === taskId
            ? {
                ...task,
                pomodoroCount: Math.max(0, Math.floor(pomodoroCount)),
                updatedAt: toIsoNow()
              }
            : task
        )
      }));
    },
    deleteTask: (taskId: TaskId) => {
      updateState((current) => {
        const deletedTask = current.tasks.find((task) => task.id === taskId);

        if (!deletedTask) {
          return current;
        }

        const deletedTaskIds = new Set<TaskId>([taskId]);
        const remainingTasks = current.tasks
          .filter((task) => task.id !== taskId)
          .map((task) =>
            task.columnId === deletedTask.columnId && task.orderIndex > deletedTask.orderIndex
              ? { ...task, orderIndex: task.orderIndex - 1 }
              : task
          );
        const deletionState = buildTaskDeletionState(current, remainingTasks, deletedTaskIds);

        return {
          ...current,
          ...deletionState,
          selectedTaskId:
            current.selectedTaskId === taskId
              ? deletionState.tasks[0]?.id ?? null
              : current.selectedTaskId
        };
      });
    },
    addFieldDefinition: (
      taskId: TaskId | null,
      name: string,
      type: FieldType,
      scope: FieldScope
    ) => {
      updateState((current) => {
        const now = toIsoNow();
        const definition: FieldDefinition = {
          id: createId("field") as FieldDefinition["id"],
          boardId: current.board.id,
          name,
          type,
          scope,
          createdAt: now,
          updatedAt: now
        };

        return {
          ...current,
          fieldDefinitions: [...current.fieldDefinitions, definition],
          taskFieldAssignments:
            scope === "task_specific" && taskId !== null
              ? [
                  ...current.taskFieldAssignments,
                  {
                    fieldDefinitionId: definition.id,
                    taskId
                  }
                ]
              : current.taskFieldAssignments
        };
      });
    },
    updateTaskFieldValue: (
      taskId: TaskId,
      fieldDefinitionId: FieldDefinition["id"],
      nextValue: string | number | boolean
    ) => {
      updateState((current) => {
        const definition = current.fieldDefinitions.find(
          (candidate) => candidate.id === fieldDefinitionId
        );

        if (!definition) {
          return current;
        }

        const filteredValues = current.taskFieldValues.filter(
          (fieldValue) =>
            !(
              fieldValue.taskId === taskId &&
              fieldValue.fieldDefinitionId === fieldDefinitionId
            )
        );

        let replacement: TaskFieldValue;

        if (definition.type === "text") {
          replacement = {
            id: createId("value") as TaskFieldValue["id"],
            taskId,
            fieldDefinitionId,
            type: "text",
            value: String(nextValue)
          };
        } else if (definition.type === "number") {
          replacement = {
            id: createId("value") as TaskFieldValue["id"],
            taskId,
            fieldDefinitionId,
            type: "number",
            value: Number(nextValue)
          };
        } else {
          replacement = {
            id: createId("value") as TaskFieldValue["id"],
            taskId,
            fieldDefinitionId,
            type: "boolean",
            value: Boolean(nextValue)
          };
        }

        return {
          ...current,
          taskFieldValues: [...filteredValues, replacement]
        };
      });
    },
    recordCompletedPomodoro: (
      taskId: TaskId,
      plannedDurationSeconds: number,
      actualDurationSeconds: number,
      startedAt: string,
      endedAt: string
    ) => {
      updateState((current) => ({
        ...current,
        tasks: current.tasks.map((task) =>
          task.id === taskId
            ? {
                ...task,
                actualTrackedSeconds: task.actualTrackedSeconds + actualDurationSeconds,
                pomodoroCount: task.pomodoroCount + 1,
                updatedAt: endedAt
              }
            : task
        ),
        pomodoroSessions: [
          ...current.pomodoroSessions,
          {
            id: createId("session") as PomodoroSession["id"],
            taskId,
            phaseType: "work",
            plannedDurationSeconds,
            actualDurationSeconds,
            status: "completed",
            startedAt,
            endedAt
          }
        ]
      }));
    },
    recordInterruptedPomodoro: (
      taskId: TaskId,
      plannedDurationSeconds: number,
      actualDurationSeconds: number,
      startedAt: string,
      endedAt: string
    ) => {
      updateState((current) => ({
        ...current,
        tasks: current.tasks.map((task) =>
          task.id === taskId
            ? {
                ...task,
                actualTrackedSeconds: task.actualTrackedSeconds + actualDurationSeconds,
                updatedAt: endedAt
              }
            : task
        ),
        pomodoroSessions: [
          ...current.pomodoroSessions,
          {
            id: createId("session") as PomodoroSession["id"],
            taskId,
            phaseType: "work",
            plannedDurationSeconds,
            actualDurationSeconds,
            status: "interrupted",
            startedAt,
            endedAt
          }
        ]
      }));
    },
    recordBreak: (
      taskId: TaskId,
      phaseType: BreakRecord["phaseType"],
      plannedDurationSeconds: number,
      actualDurationSeconds: number,
      action: BreakRecord["action"],
      startedAt: string,
      endedAt: string
    ) => {
      updateState((current) => ({
        ...current,
        breakRecords: [
          ...current.breakRecords,
          {
            id: createId("break") as BreakRecord["id"],
            taskId,
            phaseType,
            plannedDurationSeconds,
            actualDurationSeconds,
            action,
            startedAt,
            endedAt
          }
        ]
      }));
    }
  };

  return {
    isLoading,
    state,
    actions,
    selectedTask,
    selectedTaskFieldDefinitions,
    selectedTaskFieldValues,
    selectedTaskSessionHistory,
    selectedTaskBreakHistory,
    metrics
  };
};
