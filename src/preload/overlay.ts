import { contextBridge, ipcRenderer } from 'electron'
import type { TriggerPayload } from '../shared/types'

// Inlined from src/shared/ipc.ts. Sandboxed preloads can't require() relative
// paths, so sharing this via an import causes rollup to emit a chunk that
// crashes at load time. Keep in sync with the shared module by hand.
const IPC = {
  OverlayTrigger: 'overlay:trigger'
} as const

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
