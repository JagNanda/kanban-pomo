import type {
  AppSettingsSnapshot,
  BoardSnapshot
} from "./board-snapshot";
import type { PomodoroChimeId } from "../../features/pomodoro/domain/pomodoro.types";

export interface AppMeta {
  name: string;
  platform: string;
  versions: {
    chrome: string;
    electron: string;
    node: string;
  };
}

export interface PickedMarkdownFile {
  path: string;
  name: string;
  content: string;
}

export interface DesktopApi {
  getAppMeta: () => Promise<AppMeta>;
  loadBoardSnapshot: () => Promise<BoardSnapshot>;
  saveBoardSnapshot: (snapshot: BoardSnapshot) => Promise<void>;
  loadAppSettings: () => Promise<AppSettingsSnapshot>;
  savePomodoroConfig: (config: AppSettingsSnapshot["pomodoroConfig"]) => Promise<void>;
  pickMarkdownImportFile: () => Promise<PickedMarkdownFile | null>;
  playPomodoroChime: (chimeId: PomodoroChimeId) => Promise<void>;
}
