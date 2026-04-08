import { contextBridge, ipcRenderer } from "electron";
import type { DesktopApi } from "../../src/lib/electron-api/desktop-api";

const desktopApi: DesktopApi = {
  getAppMeta: () => ipcRenderer.invoke("app:get-meta"),
  loadBoardSnapshot: () => ipcRenderer.invoke("board:load-snapshot"),
  saveBoardSnapshot: (snapshot) =>
    ipcRenderer.invoke("board:save-snapshot", snapshot),
  loadAppSettings: () => ipcRenderer.invoke("settings:load"),
  savePomodoroConfig: (config) =>
    ipcRenderer.invoke("settings:save-pomodoro-config", config),
  pickMarkdownImportFile: () => ipcRenderer.invoke("import:pick-markdown-file"),
  playPomodoroChime: (chimeId) => ipcRenderer.invoke("audio:play-pomodoro-chime", chimeId)
};

contextBridge.exposeInMainWorld("desktop", desktopApi);
