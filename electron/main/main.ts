import path from "node:path";
import { readFile } from "node:fs/promises";
import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from "electron";
import type { OpenDialogOptions } from "electron";
import { AppDatabase } from "./db/database";
import type { PomodoroChimeId } from "../../src/features/pomodoro/domain/pomodoro.types";

const isDevelopment = !app.isPackaged;
const rendererDevUrl = "http://127.0.0.1:5173";
let database: AppDatabase | null = null;
const appUserModelId = "com.jag.kanbanpomo";
const appDisplayName = "Kanban Pomo";
const defaultZoomFactor = 0.76;

const nativeChimePatternById: Record<PomodoroChimeId, number[]> = {
  "bright-bells": [0, 130, 130],
  "victory-ping": [0, 120, 120, 220],
  "triple-rise": [0, 110, 170],
  "soft-bloom": [0],
  "gentle-glass": [0, 260],
  "quiet-morning": [0, 360]
};

const getWindowIconPath = (): string =>
  isDevelopment
    ? path.join(app.getAppPath(), "build", "icon.ico")
    : path.join(process.resourcesPath, "build", "icon.ico");

const wait = (durationMs: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });

const playNativePomodoroChime = async (chimeId: PomodoroChimeId): Promise<void> => {
  const pattern = nativeChimePatternById[chimeId] ?? nativeChimePatternById["bright-bells"];

  for (let index = 0; index < pattern.length; index += 1) {
    const delayMs = pattern[index] ?? 0;

    if (delayMs > 0) {
      await wait(delayMs);
    }

    shell.beep();
  }
};

const createMainWindow = async (): Promise<void> => {
  const window = new BrowserWindow({
    width: 1560,
    height: 980,
    minWidth: 1180,
    minHeight: 720,
    autoHideMenuBar: true,
    backgroundColor: "#0d141d",
    icon: getWindowIconPath(),
    titleBarStyle: "hiddenInset",
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  window.webContents.setZoomFactor(defaultZoomFactor);

  if (isDevelopment) {
    await window.loadURL(rendererDevUrl);
    window.webContents.openDevTools({ mode: "detach" });
    return;
  }

  await window.loadFile(path.join(app.getAppPath(), "dist", "index.html"));
};

app.whenReady().then(() => {
  app.setAppUserModelId(appUserModelId);
  app.setName(appDisplayName);
  const dbPath = path.join(app.getPath("userData"), "kanban-pomo.sqlite");
  database = new AppDatabase(dbPath);
  Menu.setApplicationMenu(null);

  ipcMain.handle("app:get-meta", () => ({
    name: appDisplayName,
    platform: process.platform,
    versions: {
      chrome: process.versions.chrome,
      electron: process.versions.electron,
      node: process.versions.node
    }
  }));
  ipcMain.handle("board:load-snapshot", () => {
    if (!database) {
      throw new Error("Database is not initialized.");
    }

    return database.loadBoardSnapshot();
  });
  ipcMain.handle("board:save-snapshot", (_event, snapshot) => {
    if (!database) {
      throw new Error("Database is not initialized.");
    }

    database.saveBoardSnapshot(snapshot);
  });
  ipcMain.handle("settings:load", () => {
    if (!database) {
      throw new Error("Database is not initialized.");
    }

    return database.loadAppSettings();
  });
  ipcMain.handle("settings:save-pomodoro-config", (_event, config) => {
    if (!database) {
      throw new Error("Database is not initialized.");
    }

    database.savePomodoroConfig(config);
  });
  ipcMain.handle("audio:play-pomodoro-chime", async (_event, chimeId: PomodoroChimeId) => {
    await playNativePomodoroChime(chimeId);
  });
  ipcMain.handle("import:pick-markdown-file", async () => {
    const [window] = BrowserWindow.getAllWindows();
    const dialogOptions: OpenDialogOptions = {
      title: "Import Markdown",
      properties: ["openFile"],
      filters: [{ name: "Markdown", extensions: ["md", "markdown"] }]
    };

    const result = window
      ? await dialog.showOpenDialog(window, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions);

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const selectedPath = result.filePaths[0];

    if (!selectedPath) {
      return null;
    }

    const content = await readFile(selectedPath, "utf8");

    return {
      path: selectedPath,
      name: path.basename(selectedPath),
      content
    };
  });

  void createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
