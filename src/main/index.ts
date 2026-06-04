import {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  Menu,
  nativeImage,
  screen,
  session,
  shell,
  Tray
} from 'electron'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { autoUpdater } from 'electron-updater'
import { getSettings, setSettings, updateReaction } from './store'
import { IPC } from '../shared/ipc'
import type {
  DisplayInfo,
  Reaction,
  Settings,
  TriggerPayload
} from '../shared/types'
import { DEFAULT_APPLAUSE_PHRASES } from '../shared/types'

// electron-vite globals: __dirname -> out/main; ELECTRON_RENDERER_URL set in dev.
const isDev = !!process.env['ELECTRON_RENDERER_URL']
const RENDERER_DEV_URL = process.env['ELECTRON_RENDERER_URL']

let settingsWindow: BrowserWindow | null = null
let overlayWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false

function resourcePath(name: string): string {
  const devPath = join(__dirname, '../../resources', name)
  if (existsSync(devPath)) return devPath
  return join(process.resourcesPath, 'resources', name)
}

function rendererPath(name: 'settings' | 'overlay'): string {
  return join(__dirname, `../renderer/${name}.html`)
}

function preloadPath(name: 'settings' | 'overlay'): string {
  return join(__dirname, `../preload/${name}.js`)
}

function createSettingsWindow(): void {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    if (!settingsWindow.isVisible()) settingsWindow.show()
    settingsWindow.focus()
    return
  }
  settingsWindow = new BrowserWindow({
    width: 880,
    height: 600,
    minWidth: 720,
    minHeight: 480,
    title: 'Fanfare',
    icon: resourcePath('app-icon.png'),
    backgroundColor: '#0e0b1a',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: preloadPath('settings'),
      sandbox: true,
      contextIsolation: true
    }
  })

  settingsWindow.on('ready-to-show', () => settingsWindow?.show())
  settingsWindow.on('close', (e) => {
    // Hide-to-tray; the tray's Quit item is the only way to fully exit.
    if (!isQuitting && settingsWindow) {
      e.preventDefault()
      settingsWindow.hide()
    }
  })
  settingsWindow.on('closed', () => {
    settingsWindow = null
  })
  settingsWindow.webContents.setWindowOpenHandler(({ url }) => {
    safeOpenExternal(url)
    return { action: 'deny' }
  })
  lockDownNavigation(settingsWindow)

  if (isDev && RENDERER_DEV_URL) {
    settingsWindow.loadURL(`${RENDERER_DEV_URL}/settings.html`)
  } else {
    settingsWindow.loadFile(rendererPath('settings'))
  }
}

function createOverlayWindow(): void {
  if (overlayWindow && !overlayWindow.isDestroyed()) return
  const primary = screen.getPrimaryDisplay()
  const { x, y, width, height } = primary.bounds

  overlayWindow = new BrowserWindow({
    x,
    y,
    width,
    height,
    transparent: true,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    focusable: false,
    hasShadow: false,
    show: false,
    alwaysOnTop: true,
    // 'screen-saver' level sits above most app windows including fullscreen on macOS.
    // 'panel' window type on macOS keeps it from stealing focus or app activation.
    type: process.platform === 'darwin' ? 'panel' : undefined,
    webPreferences: {
      preload: preloadPath('overlay'),
      sandbox: true,
      contextIsolation: true,
      backgroundThrottling: false
    }
  })

  overlayWindow.setAlwaysOnTop(true, 'screen-saver')
  overlayWindow.setIgnoreMouseEvents(true, { forward: true })
  overlayWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  lockDownNavigation(overlayWindow)
  if (process.platform === 'darwin') {
    overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  }

  if (isDev && RENDERER_DEV_URL) {
    overlayWindow.loadURL(`${RENDERER_DEV_URL}/overlay.html`)
  } else {
    overlayWindow.loadFile(rendererPath('overlay'))
  }

  overlayWindow.on('closed', () => {
    overlayWindow = null
  })
}

function positionOverlayForTrigger(): void {
  if (!overlayWindow || overlayWindow.isDestroyed()) return
  const settings = getSettings()
  let display: Electron.Display
  if (settings.displayId === 'primary') {
    display = screen.getPrimaryDisplay()
  } else if (typeof settings.displayId === 'number') {
    const found = screen.getAllDisplays().find((d) => d.id === settings.displayId)
    display = found ?? screen.getPrimaryDisplay()
  } else {
    const cursor = screen.getCursorScreenPoint()
    display = screen.getDisplayNearestPoint(cursor)
  }
  const { x, y, width, height } = display.bounds
  overlayWindow.setBounds({ x, y, width, height })
}

function listDisplays(): DisplayInfo[] {
  const primaryId = screen.getPrimaryDisplay().id
  return screen.getAllDisplays().map((d, i) => ({
    id: d.id,
    label: d.label && d.label.trim().length > 0 ? d.label : `Display ${i + 1}`,
    primary: d.id === primaryId,
    bounds: d.bounds
  }))
}

function resolvePickedReaction(reaction: Reaction): Reaction | null {
  if (reaction.animationKey !== 'random') return reaction
  const pool = getSettings().reactions.filter(
    (r) => r.enabled && r.animationKey !== 'random'
  )
  if (pool.length === 0) return null
  return pool[Math.floor(Math.random() * pool.length)]
}

function triggerReaction(reaction: Reaction): void {
  if (!overlayWindow || overlayWindow.isDestroyed()) createOverlayWindow()
  if (!overlayWindow) return

  const picked = resolvePickedReaction(reaction)
  if (!picked) return

  positionOverlayForTrigger()
  if (!overlayWindow.isVisible()) overlayWindow.showInactive()

  const settings = getSettings()
  const payload: TriggerPayload = {
    reactionId: reaction.id,
    reactionName: picked.name,
    reactionEmoji: picked.emoji,
    animationKey: picked.animationKey,
    durationMs: reaction.durationMs,
    position: reaction.position,
    reducedMotion: settings.reducedMotion,
    phrases:
      picked.animationKey === 'applause'
        ? picked.phrases && picked.phrases.length > 0
          ? picked.phrases
          : DEFAULT_APPLAUSE_PHRASES
        : undefined
  }
  overlayWindow.webContents.send(IPC.OverlayTrigger, payload)
}

// ---------- hotkey registration ----------

let registeredAccelerators: string[] = []
let masterMuteAccelerator: string | null = null

// Keep master mute registration isolated from reaction registration.
// Re-registering an accelerator from inside its own callback is unreliable
// on Windows (the second register() silently fails), so we only touch the
// master mute binding when the master mute *hotkey itself* changes — never
// just because the pause state flipped.
function applyMasterMuteRegistration(settings: Settings): void {
  const desired = settings.masterMuteHotkey || null
  if (masterMuteAccelerator === desired) return

  if (masterMuteAccelerator) {
    globalShortcut.unregister(masterMuteAccelerator)
    masterMuteAccelerator = null
  }
  if (!desired) return
  try {
    const ok = globalShortcut.register(desired, () => toggleMasterMute())
    if (ok) masterMuteAccelerator = desired
    else console.warn('[fanfare] failed to register master mute hotkey', desired)
  } catch (err) {
    console.warn('[fanfare] invalid master mute accelerator', desired, err)
  }
}

function applyReactionHotkeys(settings: Settings): void {
  for (const acc of registeredAccelerators) globalShortcut.unregister(acc)
  registeredAccelerators = []
  if (settings.hotkeysPaused) return

  for (const reaction of settings.reactions) {
    if (!reaction.enabled || !reaction.hotkey) continue
    // Never let a reaction's hotkey clobber the master mute binding.
    if (reaction.hotkey === masterMuteAccelerator) {
      console.warn(
        '[fanfare] skipping reaction hotkey that collides with master mute:',
        reaction.hotkey
      )
      continue
    }
    try {
      const ok = globalShortcut.register(reaction.hotkey, () => triggerReaction(reaction))
      if (ok) registeredAccelerators.push(reaction.hotkey)
      else console.warn('[fanfare] failed to register', reaction.hotkey)
    } catch (err) {
      console.warn('[fanfare] invalid accelerator', reaction.hotkey, err)
    }
  }
}

function registerHotkeys(settings: Settings): void {
  applyMasterMuteRegistration(settings)
  applyReactionHotkeys(settings)
}

function toggleMasterMute(): void {
  const current = getSettings()
  const next: Settings = { ...current, hotkeysPaused: !current.hotkeysPaused }
  const saved = setSettings(next)
  // Only reaction hotkeys need re-applying here — the master mute binding
  // is the very callback we're inside, so leave it alone.
  applyReactionHotkeys(saved)
  refreshTrayMenu()
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.webContents.send(IPC.SettingsChanged, saved)
  }
}

// ---------- IPC ----------

// Reject IPC from any frame whose URL is not our bundled HTML or the dev server.
function isTrustedSender(evt: Electron.IpcMainInvokeEvent): boolean {
  const url = evt.senderFrame?.url ?? ''
  if (RENDERER_DEV_URL && url.startsWith(RENDERER_DEV_URL)) return true
  if (url.startsWith('file://')) return true
  return false
}

function registerIpc(): void {
  ipcMain.handle(IPC.SettingsGet, (evt) => {
    if (!isTrustedSender(evt)) throw new Error('untrusted sender')
    return getSettings()
  })

  ipcMain.handle(IPC.SettingsUpdate, (evt, next: Settings) => {
    if (!isTrustedSender(evt)) throw new Error('untrusted sender')
    const saved = setSettings(next)
    registerHotkeys(saved)
    applyLoginItem(saved)
    refreshTrayMenu()
    return saved
  })

  ipcMain.handle(IPC.ReactionUpdate, (evt, id: string, patch: Partial<Reaction>) => {
    if (!isTrustedSender(evt)) throw new Error('untrusted sender')
    const saved = updateReaction(id, patch)
    registerHotkeys(saved)
    refreshTrayMenu()
    return saved
  })

  ipcMain.handle(IPC.ReactionTest, (evt, id: string) => {
    if (!isTrustedSender(evt)) throw new Error('untrusted sender')
    const settings = getSettings()
    const reaction = settings.reactions.find((r) => r.id === id)
    if (reaction) triggerReaction(reaction)
    return true
  })

  // Recording mode in the settings UI needs keydowns to reach the renderer;
  // a registered globalShortcut would swallow them and fire its reaction instead.
  ipcMain.handle(IPC.HotkeysPause, (evt) => {
    if (!isTrustedSender(evt)) throw new Error('untrusted sender')
    for (const acc of registeredAccelerators) globalShortcut.unregister(acc)
  })
  ipcMain.handle(IPC.HotkeysResume, (evt) => {
    if (!isTrustedSender(evt)) throw new Error('untrusted sender')
    registerHotkeys(getSettings())
  })

  ipcMain.handle(IPC.DisplaysList, (evt) => {
    if (!isTrustedSender(evt)) throw new Error('untrusted sender')
    return listDisplays()
  })

  ipcMain.handle(IPC.AppGetVersion, (evt) => {
    if (!isTrustedSender(evt)) throw new Error('untrusted sender')
    return app.getVersion()
  })
}

function applyLoginItem(settings: Settings): void {
  if (process.platform === 'linux') return
  app.setLoginItemSettings({ openAtLogin: settings.launchOnStartup })
}

// ---------- auto-update ----------

// In production, check GitHub Releases (same repo as `build.publish`) for a newer
// version and download it in the background. On Windows the update is applied the
// next time the app launches. electron-updater reads the latest.yml that
// electron-builder publishes with every release, so no extra infrastructure is
// needed. Disabled in dev (there is no published feed to check against).
//
// Note: macOS only applies updates to a signed + notarized build. Until the Mac
// build is signed, the check runs but silently no-ops there.
function setupAutoUpdates(): void {
  if (isDev) return
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.on('error', (err) => {
    console.warn('[fanfare] auto-update error:', err?.message ?? err)
  })
  autoUpdater.checkForUpdatesAndNotify().catch((err) => {
    console.warn('[fanfare] update check failed:', err?.message ?? err)
  })
}

// ---------- tray ----------

function trayImage(): Electron.NativeImage {
  if (process.platform === 'darwin') {
    // On macOS, prefer the template image so it adapts to light/dark menu bar.
    const img = nativeImage.createFromPath(resourcePath('tray-iconTemplate.png'))
    img.setTemplateImage(true)
    return img
  }
  return nativeImage.createFromPath(resourcePath('tray-icon.png'))
}

function buildTrayMenu(): Electron.Menu {
  const settings = getSettings()
  const enabledReactions = settings.reactions.filter((r) => r.enabled)

  const reactionItems: Electron.MenuItemConstructorOptions[] = enabledReactions.map((r) => ({
    label: `${r.emoji ?? ''}  ${r.name}`,
    click: () => triggerReaction(r),
    accelerator: r.hotkey || undefined
  }))

  return Menu.buildFromTemplate([
    { label: 'Open Fanfare', click: () => createSettingsWindow() },
    { type: 'separator' },
    ...(reactionItems.length
      ? [{ label: 'Trigger reaction', submenu: reactionItems }]
      : [{ label: 'No reactions enabled', enabled: false }]),
    { type: 'separator' },
    {
      label: settings.hotkeysPaused ? 'Resume hotkeys' : 'Pause hotkeys',
      accelerator: settings.masterMuteHotkey || undefined,
      click: () => toggleMasterMute()
    },
    { type: 'separator' },
    {
      label: 'Quit Fanfare',
      click: () => {
        isQuitting = true
        app.quit()
      }
    }
  ])
}

function createTray(): void {
  if (tray) return
  try {
    tray = new Tray(trayImage())
  } catch (err) {
    console.warn('[fanfare] failed to create tray icon:', err)
    return
  }
  tray.setToolTip('Fanfare \u2014 Hotkey-triggered joy')
  tray.setContextMenu(buildTrayMenu())
  tray.on('click', () => createSettingsWindow())
  tray.on('double-click', () => createSettingsWindow())
}

function refreshTrayMenu(): void {
  if (tray) tray.setContextMenu(buildTrayMenu())
}

// ---------- lifecycle ----------

// Block in-page navigation away from our bundled HTML — defense against
// preload exploits that try to swap the page to an attacker-controlled origin.
function lockDownNavigation(win: BrowserWindow): void {
  win.webContents.on('will-navigate', (e, url) => {
    const allowedDev = RENDERER_DEV_URL && url.startsWith(RENDERER_DEV_URL)
    const allowedFile = url.startsWith('file://')
    if (!allowedDev && !allowedFile) {
      e.preventDefault()
      safeOpenExternal(url)
    }
  })
}

// Only http/https are forwarded to the OS; other schemes (file:, javascript:,
// custom protocol handlers) are silently dropped.
function safeOpenExternal(url: string): void {
  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      shell.openExternal(url)
    }
  } catch {
    /* swallow malformed URLs */
  }
}

// We never need camera, mic, geolocation, notifications, etc. — deny everything.
function lockDownPermissions(): void {
  const ses = session.defaultSession
  ses.setPermissionRequestHandler((_wc, _permission, callback) => callback(false))
  ses.setPermissionCheckHandler(() => false)
}

app.whenReady().then(() => {
  // Single instance guard so hotkeys don't double-fire.
  const gotLock = app.requestSingleInstanceLock()
  if (!gotLock) {
    app.quit()
    return
  }
  app.on('second-instance', () => {
    createSettingsWindow()
  })

  if (process.platform === 'win32') {
    app.setAppUserModelId('com.fanfare.app')
  }

  const settings = getSettings()
  applyLoginItem(settings)
  lockDownPermissions()
  registerIpc()
  createOverlayWindow()
  createTray()
  createSettingsWindow()
  registerHotkeys(settings)
  setupAutoUpdates()

  app.on('activate', () => {
    createSettingsWindow()
  })
})

app.on('before-quit', () => {
  isQuitting = true
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  if (tray) {
    tray.destroy()
    tray = null
  }
})

// Keep the process alive for hotkeys even when all windows are hidden/closed.
app.on('window-all-closed', () => {
  /* no-op */
})
