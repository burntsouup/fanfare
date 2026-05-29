import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipc'
import type { DisplayInfo, Reaction, Settings } from '../shared/types'

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
  onSettingsChanged: (cb: (next: Settings) => void): (() => void) => {
    const listener = (_e: Electron.IpcRendererEvent, next: Settings): void => cb(next)
    ipcRenderer.on(IPC.SettingsChanged, listener)
    return () => ipcRenderer.removeListener(IPC.SettingsChanged, listener)
  }
}

contextBridge.exposeInMainWorld('fanfare', api)

export type FanfareSettingsApi = typeof api
