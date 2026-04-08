import type { DesktopApi } from "../lib/electron-api/desktop-api";

declare global {
  interface Window {
    desktop: DesktopApi;
  }
}

export {};
