# Immediate TODO

These are the highest-priority tasks for moving the app from scaffold to usable desktop prototype.

- [x] 1. Replace seeded in-memory state with SQLite-backed persistence for boards, columns, tasks, fields, and Pomodoro history
- [x] 2. Add typed Electron IPC APIs so the renderer can load and save board data through the main process
- [x] 3. Persist Pomodoro configuration so long-break settings survive app restarts
- [x] 4. Run verification and fix any build or type issues introduced by the persistence work
