import { contextBridge, ipcRenderer } from 'electron'
import type { DisplayInfo, Reaction, Settings } from '../shared/types'

// Inlined from src/shared/ipc.ts. Sandboxed preloads can't require() relative
// paths, so sharing this via an import causes rollup to emit a chunk that
// crashes at load time. Keep in sync with the shared module by hand.
const IPC = {
  SettingsGet: 'settings:get',
  SettingsUpdate: 'settings:update',
  SettingsChanged: 'settings:changed',
  ReactionUpdate: 'reaction:update',
  ReactionTest: 'reaction:test',
  HotkeysPause: 'hotkeys:pause',
  HotkeysResume: 'hotkeys:resume',
  DisplaysList: 'displays:list',
  AppGetVersion: 'app:get-version'
} as const

const api = {
  getSettings: (): Promise<Settings> => ipcRenderer.invoke(IPC.SettingsGet),
  updateSettings: (next: Settings): Promise<Settings> =>
    ipcRenderer.invoke(IPC.SettingsUpdate, next),
  updateReaction: (id: string, patch: Partial<Reaction>): Promise<Settings> =>
    ipcRenderer.invoke(IPC.ReactionUpdate, id, patch),
  testReaction: (id: string): Promise<boolean> => ipcRenderer.invoke(IPC.ReactionTest, id),
  pauseHotkeys: (): Promise<void> => ipcRenderer.invoke(IPC.HotkeysPause),
  resumeHotkeys: (): Promise<void> => ipcRenderer.invoke(IPC.HotkeysResume),
  listDisplays: (): Promise<DisplayInfo[]> => ipcRenderer.invoke(IPC.DisplaysList),
  getVersion: (): Promise<string> => ipcRenderer.invoke(IPC.AppGetVersion),
  onSettingsChanged: (cb: (next: Settings) => void): (() => void) => {
    const listener = (_e: Electron.IpcRendererEvent, next: Settings): void => cb(next)
    ipcRenderer.on(IPC.SettingsChanged, listener)
    return () => ipcRenderer.removeListener(IPC.SettingsChanged, listener)
  }
}

contextBridge.exposeInMainWorld('fanfare', api)

export type FanfareSettingsApi = typeof api
