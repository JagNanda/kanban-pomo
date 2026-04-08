# Kanban Pomo

Kanban Pomo is a desktop productivity app that combines a Kanban board, structured task planning, a Pomodoro focus timer, and lightweight reporting in one Electron app.

It is designed for planning work at three levels:

- `Project` -> a larger body of work
- `Collection` -> a group of related tasks inside a project
- `Task` -> an individual piece of work you can estimate, schedule, focus on, and complete

The app stores everything locally on your machine using SQLite.

## What The App Does

- Manage tasks on a Kanban board with custom columns
- Organize work in the `Tasks` tab by project and collection
- Run Pomodoro sessions against active work in the `Focus` tab
- Track due dates, completed work, and Pomodoro history in the `Report` tab
- Import structured task plans from Markdown
- Keep data local to the desktop app

## Main Tabs

### Tasks

Use the `Tasks` tab to structure and manage your work.

- Create a `Project`
- Add one or more `Collections` inside that project
- Create tasks inside a collection
- Filter by `Today`, `Tomorrow`, `This Month`, `Incomplete Tasks`
- Browse active work under `Projects`
- Browse finished work under `Completed`
- Click any task row to open full task details
- Import or compose Markdown to create projects, collections, and tasks quickly

### Board

Use the `Board` tab for day-to-day execution.

- View tasks by Kanban column
- Drag tasks between columns
- Drag columns to reorder them
- Create tasks and columns
- See collection badges directly on task cards
- Start focus work from a task

### Focus

Use the `Focus` tab when you want to work through Pomodoro sessions.

- Select an active task from work-in-progress tasks
- Start, pause, resume, finish, or stop focus sessions
- See today’s focus stats
- Review upcoming due dates
- Review tasks completed today
- Update Pomodoro settings

### Report

Use the `Report` tab to review progress over time.

- See focus time today, this week, and this month
- See tasks completed today, this week, and this month
- View a calendar with due dates, completed tasks, and Pomodoros per day
- Switch to a graph view for Pomodoros, focus time, and break time

## Install

### Prerequisites

- Node.js 20+ recommended
- npm
- Windows is the main packaged target in this repo

### Install Dependencies

```powershell
npm install
```

## Run In Development

Use this while iterating on the desktop UI:

```powershell
npm run dev
```

This starts:

- the Vite renderer
- Electron TypeScript watch mode
- the Electron desktop window

## Build

Build the renderer and Electron main process:

```powershell
npm run build
```

Type-check the project:

```powershell
npm run typecheck
```

## Package The Desktop App

Create an unpacked desktop build:

```powershell
npm run pack
```

Build a Windows installer:

```powershell
npm run dist:win
```

Build a portable Windows executable:

```powershell
npm run dist:portable
```

Packaged output is written to the `release` folder.

## How To Use

### Basic Flow

1. Open the `Tasks` tab.
2. Create a project.
3. Create one or more collections inside that project.
4. Create tasks inside a collection.
5. Add estimates, due dates, and priority to each task.
6. Use the `Board` tab to move tasks through your workflow.
7. Move a task into `In Dev` and start a Pomodoro from `Focus`.
8. Review progress in `Report`.

### Recommended Workflow

- Use `Tasks` for planning
- Use `Board` for execution
- Use `Focus` when actively working
- Use `Report` to review throughput and follow-up work

## Markdown Import

The app supports importing a structured Markdown file or composing the same format inside the app.

Expected format:

- `# Project Name`
- `## Collection Name`
- task bullets under the collection

Supported inline task fields:

- `EP` for estimated Pomodoros
- `Date` for due date / estimated completion date
- `Priority` for task priority

Example:

```md
# Marketing Site
## Landing Page
- Build hero section | EP: 2 | Date: Jan 12 2027 | Priority: high
  Create headline, CTA, and supporting copy.
- Add testimonials | EP: 1 | Priority: medium

## Launch Checklist
- Final QA pass | EP: 1 | Date: Jan 15 2027 | Priority: medium

# Desktop App
## Focus Flow
- Refine timer transitions | EP: 3 | Date: Jan 20 2027 | Priority: high
  Make interrupted, paused, and completed states easier to review.
```

Notes:

- New imported tasks are placed in the first board column
- Re-importing the same structure updates matching items instead of duplicating them
- Import is available from the bottom of the `Tasks` sidebar

## Data Storage

The app stores data locally in a SQLite database inside Electron’s `userData` directory.

Saved data includes:

- board columns
- projects
- collections
- tasks
- Pomodoro sessions
- break history
- app settings

## Scripts

```json
{
  "dev": "Run the Electron app in development",
  "build": "Build renderer and Electron code",
  "typecheck": "Run TypeScript checks",
  "pack": "Create an unpacked desktop build",
  "dist": "Create a packaged release",
  "dist:win": "Create a Windows installer",
  "dist:portable": "Create a portable Windows build"
}
```

## Tech Stack

- Electron
- React
- TypeScript
- Vite
- better-sqlite3
