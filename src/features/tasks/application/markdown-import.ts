import type { TaskPriority } from "../domain/task.types";

export interface MarkdownImportValidationError {
  line: number;
  message: string;
}

export interface MarkdownImportTask {
  title: string;
  description: string;
  priority: TaskPriority;
  estimatedPomodoros: number;
  estimatedCompletionDate: string | null;
  line: number;
}

export interface MarkdownImportCollection {
  name: string;
  line: number;
  tasks: MarkdownImportTask[];
}

export interface MarkdownImportProject {
  name: string;
  line: number;
  collections: MarkdownImportCollection[];
}

export interface MarkdownImportDocument {
  projects: MarkdownImportProject[];
}

export interface MarkdownImportApplySummary {
  projectsCreated: number;
  projectsUpdated: number;
  collectionsCreated: number;
  collectionsUpdated: number;
  tasksCreated: number;
  tasksUpdated: number;
}

export type MarkdownImportApplyResult =
  | { ok: true; summary: MarkdownImportApplySummary }
  | { ok: false; errors: MarkdownImportValidationError[] };

export type MarkdownImportParseResult =
  | { ok: true; document: MarkdownImportDocument }
  | { ok: false; errors: MarkdownImportValidationError[] };

export const MARKDOWN_IMPORT_TEMPLATE = `# Marketing Site
## Landing Page
- Build hero section | EP: 2 | Date: Jan 1 2027 | Priority: high
  Add the headline, CTA, and first visual direction.
- Review analytics copy | EP: 1

## Launch Checklist
- QA final layout | Date: Jan 4 2027

# Desktop App
## Focus Flow
- Tighten timer states | EP: 3 | Priority: medium
  Keep the current board progress if this task already exists.`;

const formatDateKey = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const normalizeImportedDate = (value: string): string | null => {
  const trimmedValue = value.trim();

  if (trimmedValue.length === 0) {
    return null;
  }

  const parsedDate = new Date(trimmedValue);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return formatDateKey(parsedDate);
};

const appendDescriptionLine = (current: string, nextLine: string): string =>
  current.length > 0 ? `${current}\n${nextLine}` : nextLine;

const parseTaskLine = (
  content: string,
  line: number
): { task: MarkdownImportTask | null; errors: MarkdownImportValidationError[] } => {
  const tokens = content
    .split("|")
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
  const [rawTitle, ...rawFields] = tokens;

  if (!rawTitle) {
    return {
      task: null,
      errors: [{ line, message: "Task bullet must include a title." }]
    };
  }

  const errors: MarkdownImportValidationError[] = [];
  const seenFields = new Set<string>();
  let priority: TaskPriority = "medium";
  let estimatedPomodoros = 0;
  let estimatedCompletionDate: string | null = null;

  rawFields.forEach((fieldToken) => {
    const separatorIndex = fieldToken.indexOf(":");

    if (separatorIndex === -1) {
      errors.push({
        line,
        message: `Unsupported task field "${fieldToken}". Use "EP", "Date", or "Priority".`
      });
      return;
    }

    const fieldName = fieldToken.slice(0, separatorIndex).trim().toLowerCase();
    const fieldValue = fieldToken.slice(separatorIndex + 1).trim();

    if (fieldValue.length === 0) {
      errors.push({
        line,
        message: `Task field "${fieldName}" is missing a value.`
      });
      return;
    }

    if (seenFields.has(fieldName)) {
      errors.push({
        line,
        message: `Task field "${fieldName}" is duplicated.`
      });
      return;
    }

    seenFields.add(fieldName);

    if (fieldName === "ep") {
      const parsedValue = Number(fieldValue);

      if (!Number.isInteger(parsedValue) || parsedValue < 0) {
        errors.push({
          line,
          message: `EP must be a non-negative whole number. Received "${fieldValue}".`
        });
        return;
      }

      estimatedPomodoros = parsedValue;
      return;
    }

    if (fieldName === "date") {
      const normalizedDate = normalizeImportedDate(fieldValue);

      if (normalizedDate === null) {
        errors.push({
          line,
          message: `Date "${fieldValue}" could not be parsed.`
        });
        return;
      }

      estimatedCompletionDate = normalizedDate;
      return;
    }

    if (fieldName === "priority") {
      const normalizedPriority = fieldValue.toLowerCase();

      if (
        normalizedPriority !== "low" &&
        normalizedPriority !== "medium" &&
        normalizedPriority !== "high"
      ) {
        errors.push({
          line,
          message: `Priority must be low, medium, or high. Received "${fieldValue}".`
        });
        return;
      }

      priority = normalizedPriority;
      return;
    }

    errors.push({
      line,
      message: `Unsupported task field "${fieldToken}". Use "EP", "Date", or "Priority".`
    });
  });

  return {
    task:
      errors.length === 0
        ? {
            title: rawTitle,
            description: "",
            priority,
            estimatedPomodoros,
            estimatedCompletionDate,
            line
          }
        : null,
    errors
  };
};

export const normalizeImportKey = (value: string): string =>
  value.trim().replace(/\s+/g, " ").toLowerCase();

export const parseMarkdownImportDocument = (content: string): MarkdownImportParseResult => {
  const lines = content.replace(/\r\n?/g, "\n").split("\n");
  const projects: MarkdownImportProject[] = [];
  const errors: MarkdownImportValidationError[] = [];
  const seenProjectKeys = new Set<string>();
  const seenCollectionKeys = new Set<string>();
  const seenTaskKeys = new Set<string>();
  let currentProject: MarkdownImportProject | null = null;
  let currentCollection: MarkdownImportCollection | null = null;
  let currentTask: MarkdownImportTask | null = null;

  lines.forEach((rawLine, index) => {
    const line = index + 1;
    const trimmedLine = rawLine.trim();

    if (trimmedLine.length === 0) {
      return;
    }

    if (/^#{3,}\s+/.test(trimmedLine)) {
      errors.push({
        line,
        message: "Only # project headings and ## collection headings are supported."
      });
      currentTask = null;
      return;
    }

    const projectMatch = trimmedLine.match(/^#\s+(.+)$/);

    if (projectMatch) {
      const name = (projectMatch[1] ?? "").trim();
      const projectKey = normalizeImportKey(name);

      if (name.length === 0) {
        errors.push({ line, message: "Project heading must include a name." });
        currentProject = null;
        currentCollection = null;
        currentTask = null;
        return;
      }

      if (seenProjectKeys.has(projectKey)) {
        errors.push({
          line,
          message: `Project "${name}" appears more than once in this file.`
        });
      }

      seenProjectKeys.add(projectKey);
      currentProject = {
        name,
        line,
        collections: []
      };
      projects.push(currentProject);
      currentCollection = null;
      currentTask = null;
      return;
    }

    const collectionMatch = trimmedLine.match(/^##\s+(.+)$/);

    if (collectionMatch) {
      const name = (collectionMatch[1] ?? "").trim();

      if (!currentProject) {
        errors.push({
          line,
          message: `Collection "${name}" must be nested under a project heading.`
        });
        currentCollection = null;
        currentTask = null;
        return;
      }

      if (name.length === 0) {
        errors.push({ line, message: "Collection heading must include a name." });
        currentCollection = null;
        currentTask = null;
        return;
      }

      const collectionKey = `${normalizeImportKey(currentProject.name)}::${normalizeImportKey(name)}`;

      if (seenCollectionKeys.has(collectionKey)) {
        errors.push({
          line,
          message: `Collection "${name}" appears more than once inside project "${currentProject.name}".`
        });
      }

      seenCollectionKeys.add(collectionKey);
      currentCollection = {
        name,
        line,
        tasks: []
      };
      currentProject.collections.push(currentCollection);
      currentTask = null;
      return;
    }

    const taskMatch = rawLine.match(/^\s*-\s+(?:\[(?: |x|X)\]\s+)?(.+?)\s*$/);

    if (taskMatch) {
      if (!currentCollection || !currentProject) {
        errors.push({
          line,
          message: "Task bullets must be nested under a collection heading."
        });
        currentTask = null;
        return;
      }

      const parsedTask = parseTaskLine(taskMatch[1] ?? "", line);

      if (!parsedTask.task) {
        errors.push(...parsedTask.errors);
        currentTask = null;
        return;
      }

      const taskKey = [
        normalizeImportKey(currentProject.name),
        normalizeImportKey(currentCollection.name),
        normalizeImportKey(parsedTask.task.title)
      ].join("::");

      if (seenTaskKeys.has(taskKey)) {
        errors.push({
          line,
          message: `Task "${parsedTask.task.title}" appears more than once inside "${currentProject.name} / ${currentCollection.name}".`
        });
        currentTask = null;
        return;
      }

      seenTaskKeys.add(taskKey);
      currentCollection.tasks.push(parsedTask.task);
      currentTask = parsedTask.task;
      return;
    }

    if (/^\s+/.test(rawLine)) {
      if (!currentTask) {
        errors.push({
          line,
          message: "Indented description lines must come directly after a task bullet."
        });
        return;
      }

      currentTask.description = appendDescriptionLine(currentTask.description, trimmedLine);
      return;
    }

    errors.push({
      line,
      message: `Unsupported line "${trimmedLine}". Use #, ##, or task bullet lines.`
    });
    currentTask = null;
  });

  if (projects.length === 0) {
    errors.push({
      line: 1,
      message: "No projects were found. Start the file with a # Project heading."
    });
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, document: { projects } };
};
