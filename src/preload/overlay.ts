import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipc'
import type { TriggerPayload } from '../shared/types'

const api = {
  onTrigger: (cb: (payload: TriggerPayload) => void): (() => void) => {
    const listener = (_e: Electron.IpcRendererEvent, payload: TriggerPayload): void => cb(payload)
    ipcRenderer.on(IPC.OverlayTrigger, listener)
    return () => {
      ipcRenderer.removeListener(IPC.OverlayTrigger, listener)
    }
  }
}

contextBridge.exposeInMainWorld('overlay', api)

export type OverlayApi = typeof api
