import path from "node:path";
import { execFile } from "node:child_process";
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

interface NativeToneStep {
  frequency: number;
  durationMs: number;
  pauseAfterMs?: number;
}

const nativeChimePatternById: Record<PomodoroChimeId, NativeToneStep[]> = {
  "bright-bells": [
    { frequency: 880, durationMs: 130, pauseAfterMs: 60 },
    { frequency: 1174, durationMs: 150, pauseAfterMs: 70 },
    { frequency: 1568, durationMs: 260 }
  ],
  "victory-ping": [
    { frequency: 784, durationMs: 130, pauseAfterMs: 50 },
    { frequency: 1046, durationMs: 150, pauseAfterMs: 55 },
    { frequency: 1318, durationMs: 180, pauseAfterMs: 75 },
    { frequency: 1760, durationMs: 280 }
  ],
  "triple-rise": [
    { frequency: 988, durationMs: 120, pauseAfterMs: 45 },
    { frequency: 1318, durationMs: 120, pauseAfterMs: 50 },
    { frequency: 988, durationMs: 120, pauseAfterMs: 55 },
    { frequency: 1760, durationMs: 260 }
  ],
  "soft-bloom": [
    { frequency: 523, durationMs: 180, pauseAfterMs: 65 },
    { frequency: 659, durationMs: 220, pauseAfterMs: 80 },
    { frequency: 784, durationMs: 320 }
  ],
  "gentle-glass": [
    { frequency: 392, durationMs: 220, pauseAfterMs: 70 },
    { frequency: 523, durationMs: 280, pauseAfterMs: 90 },
    { frequency: 659, durationMs: 340 }
  ],
  "quiet-morning": [
    { frequency: 440, durationMs: 180, pauseAfterMs: 60 },
    { frequency: 554, durationMs: 180, pauseAfterMs: 60 },
    { frequency: 659, durationMs: 260, pauseAfterMs: 80 },
    { frequency: 880, durationMs: 320 }
  ]
};

const getWindowIconPath = (): string =>
  isDevelopment
    ? path.join(app.getAppPath(), "build", "icon.ico")
    : path.join(process.resourcesPath, "build", "icon.ico");

const runPowerShellScript = (script: string): Promise<void> =>
  new Promise((resolve, reject) => {
    execFile(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-Command", script],
      (error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      }
    );
  });

const playNativePomodoroChime = async (chimeId: PomodoroChimeId): Promise<void> => {
  const pattern = nativeChimePatternById[chimeId] ?? nativeChimePatternById["bright-bells"];

  if (process.platform === "win32") {
    const toneScript = pattern
      .map((step) => {
        const commands = [`[console]::Beep(${step.frequency}, ${step.durationMs})`];

        if (step.pauseAfterMs && step.pauseAfterMs > 0) {
          commands.push(`Start-Sleep -Milliseconds ${step.pauseAfterMs}`);
        }

        return commands.join("; ");
      })
      .join("; ");

    try {
      await runPowerShellScript(toneScript);
      return;
    } catch {
      // Fall through to the generic system beep if tone playback is unavailable.
    }
  }

  for (let index = 0; index < pattern.length; index += 1) {
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
      sandbox: false,
      backgroundThrottling: false
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
