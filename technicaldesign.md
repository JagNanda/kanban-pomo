# Technical Design

## Purpose

This document translates the product plan into an implementation-ready technical design for a desktop Kanban + Pomodoro application.

The design priorities are:

- Strong typing across the entire app
- Clear domain models
- Reliable desktop packaging
- Simple local-first persistence
- A clean upgrade path to sync or multi-user support later

## Recommended Stack

### Preferred Stack

- Desktop shell: Electron
- Frontend: React
- Frontend language: TypeScript
- Main process language: TypeScript
- Preload bridge: TypeScript
- Local database: SQLite
- Typed SQL layer: Drizzle ORM or a similarly strict typed query layer
- Validation: Zod at all app boundaries

### Why Electron for This Project

Electron is the better choice for this project because it gives us:

- A fully TypeScript and Node-based desktop stack
- A lower learning curve because Rust is not required
- Mature packaging and update tooling
- Strong ecosystem support for desktop integrations
- A straightforward architecture built around renderer, preload, and main layers

Tradeoffs to accept:

- Larger bundles than Tauri
- Higher runtime memory usage
- More responsibility on us to keep the security model tight

Those tradeoffs are reasonable here because familiarity and implementation speed are more important than minimizing binary size in v1.

### Database Recommendation

Recommended database for v1:

- SQLite

Reason:

- Best fit for a local desktop-first single-user app
- No server setup
- Easy packaging
- Fast local reads and writes
- Straightforward migrations

Postgres should be treated as a future upgrade path rather than the starting point. It is a better fit once the app needs shared boards, user accounts, cloud sync, or multi-device collaboration.

## Architecture Overview

The application should be designed as a local-first desktop app using a feature-first structure with clear internal layering inside each feature.

Top-level organization should be by feature, not by technical layer.

Primary features for v1:

1. Board
2. Columns
3. Tasks
4. Custom fields
5. Pomodoro
6. Settings

Within each feature, code should still respect these logical layers:

1. Presentation layer
2. Application layer
3. Domain layer
4. Persistence layer
5. Desktop integration layer

This gives us two benefits:

- The repo is easier to navigate because related code lives together
- Each feature can still preserve clean boundaries and strong typing

### Layer Responsibilities

In a feature-first design, these responsibilities usually live inside each feature folder rather than in one global layer directory.

#### Presentation Layer

Responsible for:

- Rendering Kanban columns and tasks
- Drag-and-drop interactions
- Task edit forms
- Field definition management
- Pomodoro timer UI
- Confirmation dialogs and notifications

This layer should contain no direct database logic.

#### Application Layer

Responsible for:

- Use-case orchestration
- Input validation
- Coordinating domain rules
- Mapping UI requests to persistence operations
- Emitting state changes to the UI

Examples:

- CreateTask
- MoveTask
- DeleteColumnAndTasks
- StartPomodoroForTask
- CompletePomodoroSession
- SkipBreak
- InterruptPomodoro

#### Domain Layer

Responsible for:

- Typed business entities
- Enums and value objects
- Rules for task fields
- Pomodoro cycle logic
- Derived values like actual hours and pomodoro count

This layer should be framework-agnostic and testable in isolation.

#### Persistence Layer

Responsible for:

- Database schema
- Repositories
- Transactions
- Migrations
- Query optimization

#### Desktop Integration Layer

Responsible for:

- Window management
- Native notifications
- File system access if needed later
- Auto-update integration if added later
- Secure renderer-to-main IPC bridging

## Core Technical Principles

### Strong Typing Rules

Strong typing is a hard requirement.

The project should follow these rules:

- TypeScript `strict` mode enabled
- `noImplicitAny` enabled
- `noUncheckedIndexedAccess` enabled
- `exactOptionalPropertyTypes` enabled
- Avoid `any`
- Avoid untyped JSON flowing through the app
- Validate all persisted and cross-process payloads
- Prefer discriminated unions for timer states and field types
- Prefer branded IDs or dedicated ID types over plain strings where practical

### Type Boundaries

There are three important boundaries that must always be validated:

- UI form input to application layer
- Renderer to preload and main-process IPC boundary
- Database rows to domain models

Never trust raw input from those boundaries, even in a desktop app.

## Domain Model

### ID Types

These IDs should be distinct types in TypeScript, even if stored as strings in the database.

```ts
type BoardId = string & { readonly __brand: "BoardId" };
type ColumnId = string & { readonly __brand: "ColumnId" };
type TaskId = string & { readonly __brand: "TaskId" };
type FieldDefinitionId = string & { readonly __brand: "FieldDefinitionId" };
type TaskFieldValueId = string & { readonly __brand: "TaskFieldValueId" };
type PomodoroSessionId = string & { readonly __brand: "PomodoroSessionId" };
```

### Enums and Literal Types

```ts
type FieldType = "text" | "number" | "boolean";

type PomodoroPhaseType = "work" | "short_break" | "long_break";

type PomodoroSessionStatus =
  | "completed"
  | "interrupted"
  | "abandoned";

type BreakAction = "completed" | "skipped";
```

### Board Model

```ts
interface Board {
  id: BoardId;
  name: string;
  createdAt: string;
  updatedAt: string;
}
```

### Column Model

```ts
interface Column {
  id: ColumnId;
  boardId: BoardId;
  name: string;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
}
```

### Task Model

```ts
interface Task {
  id: TaskId;
  boardId: BoardId;
  columnId: ColumnId;
  title: string;
  orderIndex: number;
  estimatedCompletionDate: string | null;
  actualTrackedSeconds: number;
  pomodoroCount: number;
  createdAt: string;
  updatedAt: string;
}
```

### Field Definition Model

Field definitions must support both global usage and task-specific usage.

```ts
interface FieldDefinition {
  id: FieldDefinitionId;
  boardId: BoardId;
  name: string;
  type: FieldType;
  scope: "global" | "task_specific";
  createdAt: string;
  updatedAt: string;
}
```

### Task Field Assignment Model

This model maps a field definition to the tasks it applies to when the field is task-specific.

```ts
interface TaskFieldAssignment {
  fieldDefinitionId: FieldDefinitionId;
  taskId: TaskId;
}
```

### Task Field Value Model

This should use a discriminated union rather than loose optional values.

```ts
type TaskFieldValue =
  | {
      id: TaskFieldValueId;
      taskId: TaskId;
      fieldDefinitionId: FieldDefinitionId;
      type: "text";
      value: string;
    }
  | {
      id: TaskFieldValueId;
      taskId: TaskId;
      fieldDefinitionId: FieldDefinitionId;
      type: "number";
      value: number;
    }
  | {
      id: TaskFieldValueId;
      taskId: TaskId;
      fieldDefinitionId: FieldDefinitionId;
      type: "boolean";
      value: boolean;
    };
```

### Pomodoro Configuration Model

This allows the standard cycle to be configurable without changing the rest of the system.

```ts
interface PomodoroConfig {
  workDurationSeconds: number;
  shortBreakDurationSeconds: number;
  longBreakDurationSeconds: number;
  longBreakAfterWorkSessions: number;
}
```

Default values:

- Work: 1500 seconds
- Short break: 300 seconds
- Long break: 900 seconds
- Long break after: 3 work sessions

### Pomodoro Session Model

Pomodoro history should record work sessions as first-class records.

```ts
interface PomodoroSession {
  id: PomodoroSessionId;
  taskId: TaskId;
  phaseType: PomodoroPhaseType;
  plannedDurationSeconds: number;
  actualDurationSeconds: number;
  status: PomodoroSessionStatus;
  startedAt: string;
  endedAt: string | null;
}
```

### Break History Model

Break outcomes should be tracked separately so skipped breaks are explicit.

```ts
interface BreakRecord {
  id: string;
  taskId: TaskId;
  phaseType: "short_break" | "long_break";
  plannedDurationSeconds: number;
  actualDurationSeconds: number;
  action: BreakAction;
  startedAt: string;
  endedAt: string | null;
}
```

## Derived Values

These values should be treated as derived from history, even if cached on `Task` for fast UI reads.

### Actual Hours Taken

Source of truth:

- Sum of completed or partially tracked work-session seconds

Display:

- Convert to decimal hours for UI display

Internal storage:

- Store duration as integer seconds
- Never store floating-point hours as the source of truth

### Pomodoro Count

Source of truth:

- Count of completed work sessions

Optional optimization:

- Cache on the `Task` row and keep it transactionally updated

## Database Design

### Tables

The initial schema should include:

- `boards`
- `columns`
- `tasks`
- `field_definitions`
- `task_field_assignments`
- `task_field_values`
- `pomodoro_sessions`
- `break_records`
- `app_settings`

### Key Database Rules

- Foreign keys enabled
- Cascade delete from board to columns to tasks
- Cascade delete from column to tasks
- Cascade delete from task to task field values, assignments, sessions, and breaks
- Unique ordering constraints within board or column where needed
- Timestamps stored in ISO UTC format
- Durations stored as integer seconds

### Suggested Relational Behavior

- Deleting a column must delete all tasks in that column
- Deleting a task must delete its custom values and Pomodoro history
- Reordering columns and tasks should happen inside transactions
- Field definitions with `global` scope apply to all tasks on the board
- Field definitions with `task_specific` scope apply only through `task_field_assignments`

## Application State Design

### State Buckets

The frontend should keep state in clearly separated buckets:

- Board structure state
- Task and field data state
- Timer runtime state
- UI interaction state
- Persisted settings state

State ownership should also be feature-first:

- Board feature owns board and column presentation state
- Task feature owns task detail and field value state
- Pomodoro feature owns timer runtime and session history state
- Settings feature owns persisted configuration state

### Timer State Model

The timer should use a discriminated union instead of multiple booleans.

```ts
type TimerState =
  | {
      status: "idle";
      taskId: TaskId | null;
    }
  | {
      status: "running";
      taskId: TaskId;
      phaseType: PomodoroPhaseType;
      startedAt: string;
      endsAt: string;
      cycleWorkSessionIndex: number;
    }
  | {
      status: "paused";
      taskId: TaskId;
      phaseType: PomodoroPhaseType;
      remainingSeconds: number;
      cycleWorkSessionIndex: number;
    }
  | {
      status: "completed";
      taskId: TaskId;
      phaseType: PomodoroPhaseType;
      completedAt: string;
    };
```

This avoids invalid states like:

- Timer running and idle at the same time
- No active task but an active work phase
- Break phase without a cycle position

## UI Design Structure

### Main Screens

The first version should include:

1. Board screen
2. Task editor panel or modal
3. Field definition manager
4. Pomodoro screen or focused timer panel
5. Settings screen

### Board Screen

Contains:

- Horizontal list of columns
- Task cards inside each column
- Drag-and-drop for tasks
- Add column button
- Add task button
- Quick play button on each task

### Task Editor

Contains:

- Title
- Estimated completion date
- Read-only calculated actual hours
- Read-only Pomodoro count
- Dynamic custom fields based on field definitions and assignments

### Pomodoro Screen

Contains:

- Active task title
- Current phase
- Countdown timer
- Start, pause, resume, and stop controls
- Skip break action
- Session history summary for the task

## Best Practices for Desktop Delivery

### Electron Best Practices

- Keep the UI as a standard SPA rendered inside the desktop shell
- Keep Node and OS access in the main process only
- Use a narrow preload bridge with explicit typed APIs
- Do not let raw SQL or filesystem logic leak into React components
- Use one application-service layer between React and persistence
- Prefer small typed IPC methods over a large generic bridge
- Turn on `contextIsolation`
- Turn off `nodeIntegration` in renderer windows
- Avoid exposing raw `ipcRenderer` directly to the UI
- Keep `preload.ts` minimal and audited

### Security Best Practices

- Expose the minimum desktop APIs necessary
- Validate every payload crossing renderer, preload, and main boundaries
- Do not evaluate arbitrary code
- Avoid loading remote web content inside the app window
- Keep database access local to the application layer
- Sanitize notification text and any user-generated content shown in system surfaces
- Use a renderer content security policy
- Treat IPC channels as public interfaces with stable typed contracts

### Reliability Best Practices

- Persist board changes immediately after edits
- Use transactions for drag-and-drop reorder operations
- Save timer progress on app close or suspend
- Restore in-progress timer state on app restart
- Keep a monotonic elapsed-time strategy so clock drift does not corrupt timers
- Use optimistic UI only when rollback behavior is clearly defined

### Type-Safety Best Practices

- Define domain types once and reuse them everywhere
- Keep DTOs separate from database row types when shapes differ
- Parse unknown data into typed models before use
- Represent workflow states with unions, not booleans
- Store times and durations in normalized machine-friendly formats
- Keep feature-local types inside the feature unless they are truly shared
- Move only stable cross-feature contracts into shared modules
- Keep database row types in a top-level database model area so every feature can reference one source of truth for persisted shapes
- Do not let raw database row types become the UI or domain model by default

### UI Best Practices

- Confirm destructive actions like deleting columns
- Show the task count per column
- Keep drag-and-drop keyboard accessible if possible
- Make timer state visible from the board even when the Pomodoro screen is closed
- Prevent accidental duplicate starts of the same Pomodoro session

## Suggested Project Structure

```text
src/
  app/
    providers/
    router/
    store/
  database/
    models/
      board-row.ts
      column-row.ts
      task-row.ts
      field-definition-row.ts
      task-field-assignment-row.ts
      task-field-value-row.ts
      pomodoro-session-row.ts
      break-record-row.ts
    schema/
    migrations/
    mappers/
  features/
    board/
      components/
      application/
      domain/
      infrastructure/
      hooks/
      board.types.ts
      board.schemas.ts
    columns/
      components/
      application/
      domain/
      infrastructure/
      columns.types.ts
      columns.schemas.ts
    tasks/
      components/
      application/
      domain/
      infrastructure/
      hooks/
      tasks.types.ts
      tasks.schemas.ts
    custom-fields/
      components/
      application/
      domain/
      infrastructure/
      custom-fields.types.ts
      custom-fields.schemas.ts
    pomodoro/
      components/
      application/
      domain/
      infrastructure/
      hooks/
      pomodoro.types.ts
      pomodoro.schemas.ts
    settings/
      components/
      application/
      domain/
      infrastructure/
      settings.types.ts
      settings.schemas.ts
  shared/
    components/
    domain/
    infrastructure/
    lib/
    errors/
  lib/
    electron-api/
electron/
  main/
    windows/
    ipc/
    services/
    db/
    main.ts
  preload/
    api/
    preload.ts
```

### Feature-First Rules

- Each feature owns its UI, use cases, schemas, and persistence adapters
- Imports should point inward or to `shared`, not sideways across many features
- Cross-feature communication should happen through typed application services, not direct component reach-through
- Shared folders should stay small and contain only code that is genuinely reused
- If a module is only used by one feature, keep it in that feature even if it looks generic
- Database row types are the exception: keep them centralized under `src/database/models` so all features read the same persisted shape definitions
- Feature folders should depend on database models through repositories or mappers, not spread SQL concerns across UI code

### Example Responsibility Split

- `features/board` handles board shell rendering and board-level actions
- `features/columns` handles column creation, deletion, ordering, and column UI
- `features/tasks` handles task cards, editing, ordering, and field values on tasks
- `features/custom-fields` handles field definitions and task-specific field assignment rules
- `features/pomodoro` handles timer state, cycle logic, and session history
- `features/settings` handles Pomodoro configuration and app preferences

## Persistence Strategy

### Migrations

- Use versioned SQL migrations
- Treat schema migration as part of app startup
- Never silently drop user data during migration

### Data Access

- Use repositories or typed query services
- Keep SQL close to the persistence layer
- Do not perform persistence directly in React components
- Use top-level database row models as the persistence source of truth
- Map database rows into feature/domain models before business logic or UI consumption

### Database Models vs Domain Models

These should be treated as different things:

- Database models describe how rows are stored
- Domain models describe how the app thinks about the business concept

Example:

- A `task-row.ts` file can define persisted fields such as `column_id`, `order_index`, and `actual_tracked_seconds`
- A task domain type inside `features/tasks` can expose a cleaner strongly typed `Task` model used by the feature

This split keeps the data layer reusable across features without forcing every feature to speak in raw database row shapes.

### Sync Readiness

Even though v1 is local-first, the schema should be built with a future sync path in mind.

That means:

- Stable UUID-based identifiers
- Audit-friendly timestamps
- Clear separation between domain entities and transport DTOs
- Event-style Pomodoro records rather than only aggregate counters

## Testing Strategy

### Unit Tests

Cover:

- Pomodoro cycle rules
- Field value validation
- Derived time calculations
- Column deletion cascade behavior
- Reordering logic

### Integration Tests

Cover:

- Repository operations
- Database transactions
- Task move behavior
- Timer completion persistence
- Restore-on-restart behavior

### UI Tests

Cover:

- Drag-and-drop task movement
- Task editing flows
- Starting and completing Pomodoro sessions
- Break skipping and interruption recording

## Implementation Notes

### Recommended First Build Order

1. Define domain types and validation schemas
2. Implement SQLite schema and migrations
3. Implement repositories and application services
4. Build the board UI and drag-and-drop
5. Build task editor and custom field support
6. Build Pomodoro runtime and history recording
7. Add settings and configurable long-break rules
8. Add packaging, persistence hardening, and recovery behavior

### Non-Goals for Initial Build

- Multi-user collaboration
- Cloud sync
- Real-time networking
- Mobile support
- Plugin system

## Final Recommendation

For this project, I recommend:

- Electron
- React
- TypeScript with strict compiler settings
- SQLite for local persistence
- Strong validation and typed domain models from day one

This gives the project a fully TypeScript desktop stack, strong type discipline, simpler onboarding, and a practical local-first architecture without requiring Rust or a server database in v1.
