# Kanban + Pomodoro App Planning

## Product Goal

Build a single application that combines:

- A flexible Kanban board for organizing work
- A Pomodoro timer workflow tied directly to individual tasks

The app should let users manage tasks visually, customize task structure, and track focused work sessions from inside the board.

## Core Concept

Each task lives inside a Kanban column and can be moved between columns as work progresses. A task can also launch a Pomodoro session. Pomodoro progress and completed session counts should be stored with the task so planning and time tracking stay connected.

## Kanban Board Requirements

### Columns

The board must support customizable columns.

Users should be able to:

- Add a new column
- Rename a column
- Remove a column
- Reorder columns

When a column is deleted, all tasks inside that column should also be deleted.

Example default columns:

- Not Yet Started
- In Dev
- Code Review
- Completed

These are only examples. The system should support any user-defined column structure.

### Tasks

Each column can contain multiple tasks.

Users should be able to:

- Add a task to a column
- Edit a task
- Delete a task
- Move a task from one column to another
- Reorder tasks within a column

### Drag and Drop

Tasks should support drag-and-drop interactions.

Users should be able to:

- Drag a task within the same column to reorder it
- Drag a task into a different column

## Task Field System Requirements

Tasks should support both default fields and user-defined fields.

### Default Task Fields

The initial expected task fields include:

- Title
- Estimated date of completion
- Actual hours taken
- Pomodoro count

### Custom Fields

Users should be able to define additional fields and remove fields they do not want.

For each field, the user should be able to configure:

- Field name
- Field type
- Whether the field is active on tasks
- Whether the field applies globally or only to selected tasks

The system should support fields that apply only to certain tasks rather than forcing one universal schema across the entire board.

### Supported Field Types

Initial field type support should include:

- Text
- Number
- Boolean

This system should be designed so more field types can be added later if needed.

## Pomodoro Integration Requirements

Each task should include a play button that launches a Pomodoro screen for that specific task.

### Pomodoro Flow

The Pomodoro timer should follow the basic Pomodoro cycle described in the requirements:

1. Work for 25 minutes
2. Break for 5 minutes
3. Work for 25 minutes
4. Break for 5 minutes
5. Work for 25 minutes
6. Long break for 15 minutes

This flow should repeat in a consistent, easy-to-follow way.

The long-break timing should be configurable so the app can support future customization without changing the core timer model.

### Pomodoro Session Tracking

After each completed Pomodoro work session, the app should record the completion.

The system should track:

- Number of completed Pomodoro sessions for the task
- Historical record of Pomodoro completions
- Interrupted Pomodoro sessions
- Skipped breaks

The Pomodoro count should also be available as a task field.

Pomodoro history should capture more than just success states so users can review focus patterns and incomplete cycles.

## Relationships Between Kanban and Pomodoro Features

The Kanban board and Pomodoro system should not be separate tools. They should be connected through the task model.

Each task should:

- Belong to one column
- Store its own field values
- Store or reference its Pomodoro completion history
- Display a play button to begin focused work
- Automatically calculate actual hours taken from tracked Pomodoro work time

## MVP Scope

The first version should prioritize:

- Customizable Kanban columns
- Task creation and editing
- Drag-and-drop task movement between columns
- User-defined task fields with text, number, and boolean types
- Optional task-specific field applicability
- Task-level Pomodoro launch
- Standard Pomodoro cycle handling
- Pomodoro completion recording
- Interrupted session and skipped break recording
- Pomodoro count stored on each task
- Automatically calculated actual hours taken

## Post-MVP Ideas

Possible future improvements, not required for the first version:

- Editable Pomodoro durations
- Notifications or alarms
- Daily and weekly productivity summaries
- Filtering and searching tasks
- Due date reminders
- Tags or labels
- Task notes or descriptions
- Recurring tasks
- Multi-user collaboration
- Data export

## Resolved Product Decisions

The following product decisions have now been set:

- Deleting a column also deletes every task inside that column
- Custom fields can apply globally or only to certain tasks
- Pomodoro history should record completions, interruptions, and skipped breaks
- Actual hours taken should be automatically calculated from tracked work sessions
- Long break behavior should be configurable

## Recommended Tech Stack

### Language

Recommended primary language:

- TypeScript

Reason:

- Strong fit for desktop UI development
- Excellent support for drag-and-drop interfaces
- Fast iteration for product-style apps
- Easier shared typing between UI, task models, and persistence layers

### Desktop GUI Framework

Recommended framework:

- Electron + React

Reason:

- Best balance of mature desktop tooling and modern UI flexibility
- Strong ecosystem for Kanban-style drag-and-drop interfaces
- Easy to build a polished Pomodoro timer experience
- Large library support for local state, forms, tables, and persistence

Suggested UI layer:

- React for the interface
- A lightweight component system or custom design system rather than a heavy enterprise UI kit

### Database Recommendation

Recommended default database for the first version:

- SQLite

Reason:

- Better fit for a desktop-first single-user application
- No separate database server required
- Simple installation and local persistence
- Easier packaging and onboarding

### When to Use Postgres Instead

Postgres becomes the better choice if the product later needs:

- Multi-user collaboration
- Shared boards across devices
- Server-hosted sync
- Team accounts or permissions
- Remote backups managed by the app

### Recommended Storage Direction

For the initial desktop application:

- Use SQLite as the app database
- Design the data model so migration to Postgres is possible later

This approach keeps the first version simpler while preserving a path to a synced or collaborative architecture in the future.

## Summary

This app is a unified productivity tool that combines:

- A flexible Kanban board
- Custom task metadata
- Task-driven Pomodoro tracking

The main principle is that focused work sessions happen directly from tasks, and the results of those sessions are stored back on the task for planning and review.
