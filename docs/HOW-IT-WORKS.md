# How Fanfare Works

A deep walkthrough of the app's architecture, from "you double-click the
installer" to "a fullscreen confetti explosion lands on top of your slides."

Written for someone who's comfortable with JavaScript and React but new to
Electron, IPC, and desktop app packaging.

---

## Table of contents

1. [The mental model — three worlds, one app](#1-the-mental-model)
2. [The file layout — what lives where and why](#2-the-file-layout)
3. [Trace: what happens when you launch the app](#3-launch-trace)
4. [Trace: what happens when you press a hotkey](#4-hotkey-trace)
5. [Settings — how data is stored and synced](#5-settings)
6. [Security — why all the ceremony](#6-security)
7. [The build pipeline — TypeScript to executable](#7-the-build-pipeline)
8. [The release pipeline — git tag to GitHub release](#8-the-release-pipeline)
9. [Case studies — the bugs we fixed](#9-case-studies)
10. [Trade-offs — the choices we made and why](#10-trade-offs)
11. [What you'd add next](#11-what-youd-add-next)

---

## 1. The mental model

If you take one thing away from this doc, take this: **an Electron app is not
one process. It's many.**

When you launch Fanfare, your operating system actually starts at least three
distinct programs running side by side:

```
┌──────────────────────────────────────────────────────────────┐
│  Main process (Node.js)                                      │
│  - Runs src/main/index.ts                                    │
│  - Has full OS access: files, hotkeys, tray, windows         │
│  - One per app, no UI                                        │
│  - The "boss"                                                │
└────────────────┬─────────────────────┬───────────────────────┘
                 │                     │
                 │ IPC                 │ IPC
                 ▼                     ▼
┌─────────────────────────┐  ┌─────────────────────────┐
│ Settings renderer       │  │ Overlay renderer        │
│ - Runs src/renderer/    │  │ - Runs src/renderer/    │
│   src/components/       │  │   src/components/       │
│   SettingsApp.tsx       │  │   OverlayApp.tsx        │
│ - Chromium tab          │  │ - Chromium tab          │
│ - NO OS access          │  │ - NO OS access          │
└─────────────────────────┘  └─────────────────────────┘
```

### Why on earth would you design it this way?

Because of **security**. Electron started life as "what if we wrapped a web
browser around Node.js so you could ship a web app as a desktop app?" The
problem: if your renderer (the part showing HTML) had full access to Node.js,
then any bug or third-party script could `require('fs').unlink('/etc/passwd')`
and wreck someone's machine. The same reason your browser doesn't let
websites read your filesystem.

So Electron separates them. The **main process** runs Node and has the keys
to your machine. The **renderer processes** are basically Chrome tabs —
they show UI but can't touch your filesystem, network in a Node-y way,
register global hotkeys, etc.

The renderers communicate with main through a controlled channel called
**Inter-Process Communication (IPC)**. We'll trace that later.

### The third world: the preload

There's also a third kind of code that runs in each renderer: the **preload
script**.

Preload scripts run in the same process as their renderer, BUT before the
HTML page loads. They have a slightly elevated context: they can use a
subset of Node APIs and, crucially, they can use `contextBridge.exposeInMainWorld()`
to inject a controlled API into the renderer's `window` object.

Without preload, you'd have two terrible choices:
- **Trust the renderer fully** → security disaster.
- **Isolate the renderer with no escape hatch** → useless UI, can't do anything.

The preload is the compromise. It runs in a controlled environment, exposes
a *specific* set of methods to the renderer, and that's the only way the UI
can ask the main process to do anything.

In Fanfare, the settings preload ([`src/preload/settings.ts`](src/preload/settings.ts))
exposes a `window.fanfare` object with methods like `getSettings()`,
`updateReaction()`, and `testReaction()`. The settings UI calls those. Under
the hood, each call fires an IPC message to main, main does the work,
returns a value, the preload returns it back up the chain.

---

## 2. The file layout

```
src/
  main/            ← runs in the main process (Node.js context)
    index.ts       ← app entry; creates windows, tray, hotkeys, IPC handlers
    store.ts       ← settings persistence via electron-store
  preload/         ← runs in each renderer process BEFORE the page loads
    settings.ts    ← exposes window.fanfare API
    overlay.ts     ← exposes window.overlay API
  renderer/        ← runs in each BrowserWindow (Chromium context)
    settings.html  ← entry HTML for the settings window
    overlay.html   ← entry HTML for the overlay window
    src/
      components/  ← React components for the UI
      animations/  ← each reaction (Confetti, Applause, etc.)
  shared/          ← TypeScript types and constants used by all sides
    ipc.ts         ← the canonical IPC channel names
    types.ts       ← Settings, Reaction, TriggerPayload, defaults

resources/         ← runtime assets bundled into the installer
  app-icon.png
  tray-icon.png
  tray-iconTemplate.png

build/             ← electron-builder inputs (installer icons)
  icon.png

scripts/           ← one-off dev scripts (icon generation, etc.)
docs/              ← human docs (README assets, this file, demo GIF)

out/               ← build output (generated; gitignored)
  main/            ← compiled main process JS
  preload/         ← compiled preload JS
  renderer/        ← compiled renderer HTML + JS + CSS

release/           ← packaged installers (generated; gitignored)
  Fanfare Setup 0.1.2.exe
  Fanfare-0.1.2.dmg
  ...

.github/
  workflows/
    release.yml    ← GitHub Actions: tag push → build installers → upload

electron.vite.config.ts   ← tells electron-vite how to build the three bundles
package.json              ← npm metadata + electron-builder config
tsconfig.node.json        ← TypeScript settings for main/preload (Node-ish)
tsconfig.web.json         ← TypeScript settings for renderer (browser-ish)
tailwind.config.js
postcss.config.js
```

The key thing to notice: **three categories of code, each compiled
differently.** Main and preload target a Node-like environment. The renderer
targets a browser-like environment. They have different TypeScript configs,
different module systems at runtime, and different access to APIs.

`src/shared/` is the bridge in terms of *types* and *constants*. Both sides
can import from it during development, but the constants get duplicated at
build time (more on this in §9, where we'll talk about the v0.1.1 bug).

---

## 3. Launch trace

Let's walk through what happens, top to bottom, from the moment a user
double-clicks `Fanfare.exe`.

### 3.1 The OS launches the binary

`Fanfare.exe` is an Electron-bundled executable. It's basically the Electron
runtime (a stripped Chromium + Node) with your code packaged into an
`app.asar` archive sitting next to it. Windows starts the .exe, the Electron
runtime initializes, finds `main` in `package.json` (which points at
`out/main/index.js` inside `app.asar`), and runs it.

### 3.2 main process boots

The first lines that matter in [`src/main/index.ts`](src/main/index.ts):

```ts
const isDev = !!process.env['ELECTRON_RENDERER_URL']
const RENDERER_DEV_URL = process.env['ELECTRON_RENDERER_URL']
```

`ELECTRON_RENDERER_URL` is set by electron-vite during development (when
you run `npm run dev`) and points at the Vite dev server (e.g.
`http://localhost:5173`). In production it's undefined. The whole codebase
uses this one boolean to switch between "load from dev server" and "load
from packaged files."

### 3.3 app.whenReady

Electron emits a `ready` event once it's done initializing. Everything we do
hangs off `app.whenReady().then(() => { ... })`:

```ts
app.whenReady().then(() => {
  const gotLock = app.requestSingleInstanceLock()
  if (!gotLock) {
    app.quit()
    return
  }
  ...
  const settings = getSettings()
  applyLoginItem(settings)
  lockDownPermissions()
  registerIpc()
  createOverlayWindow()
  createTray()
  createSettingsWindow()
  registerHotkeys(settings)
})
```

Order matters. Let's walk through each step.

#### 3.3.1 Single-instance lock

```ts
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
  return
}
```

If another copy of Fanfare is already running, we don't want to start a
second one. Two copies would both register Ctrl+Alt+A, both fire animations
on every press, etc. The single-instance lock asks the OS: "am I the first?"
If no, quit. If yes, continue. We also subscribe to `second-instance` so
that if a user double-clicks the icon while we're running, we re-show the
settings window instead of starting fresh.

#### 3.3.2 Load settings from disk

```ts
const settings = getSettings()
```

This calls into [`src/main/store.ts`](src/main/store.ts), which uses
`electron-store` to read a JSON file. The file lives in
`app.getPath('userData')` — on Windows that's
`%APPDATA%\Fanfare\fanfare-settings.json`, on macOS it's
`~/Library/Application Support/Fanfare/fanfare-settings.json`.

If the file doesn't exist (first launch), electron-store creates it with
`DEFAULT_SETTINGS` from [`src/shared/types.ts`](src/shared/types.ts).

`getSettings()` also does **migration**: it merges whatever's on disk with
the current default reactions, in case we've added new reactions in a newer
version that aren't in the user's old file. This is why you can update
Fanfare and immediately see new reactions in your settings UI without
losing your custom hotkeys for the old ones.

#### 3.3.3 Apply login-item setting

```ts
applyLoginItem(settings)
```

If the user has "Launch on system startup" checked, this registers Fanfare
with the OS as a login item so it auto-starts at boot. Implemented via
`app.setLoginItemSettings()`, which Electron translates to the right OS API
on Windows and macOS.

#### 3.3.4 Lock down the renderer's permissions

```ts
lockDownPermissions()
```

This denies all permission requests from renderers — camera, microphone,
geolocation, notifications, anything. Fanfare doesn't need any of them, so
we proactively refuse so that a hypothetical compromised renderer can't
prompt the user for a permission and exfiltrate data.

#### 3.3.5 Register IPC handlers

```ts
registerIpc()
```

This wires up `ipcMain.handle(...)` callbacks for every IPC channel a
renderer is allowed to call: `IPC.SettingsGet`, `IPC.SettingsUpdate`,
`IPC.ReactionUpdate`, etc. Each handler checks `isTrustedSender(evt)`
first to make sure the message came from one of our own frames (not some
injected iframe). See §6 for why that matters.

#### 3.3.6 Create the overlay window (hidden)

```ts
createOverlayWindow()
```

This is the transparent, click-through, always-on-top window that the
animations render into. We create it now (at boot) so the OS has a window
handle ready to go. Triggering a reaction later doesn't have to wait for
window creation — it just shows the existing window and positions it.

A few key options on this BrowserWindow:

```ts
{
  transparent: true,        // ← see-through background
  frame: false,             // ← no titlebar/border
  focusable: false,         // ← can't steal focus from your slides
  skipTaskbar: true,        // ← doesn't show up in alt-tab
  alwaysOnTop: true,        // ← above all other windows
  type: process.platform === 'darwin' ? 'panel' : undefined,
  webPreferences: {
    preload: preloadPath('overlay'),
    sandbox: true,
    contextIsolation: true,
    backgroundThrottling: false   // ← keep animating when "in background"
  }
}
```

Then `setIgnoreMouseEvents(true, { forward: true })` makes the overlay
completely click-through. Your mouse goes straight through it to whatever's
underneath. That's why the overlay can sit on top of your slides without
breaking interaction.

The macOS `type: 'panel'` is critical — it's the magic that lets the
overlay appear above fullscreen apps. A normal window would be hidden by
fullscreen mode. A `panel` ignores fullscreen.

#### 3.3.7 Create the tray icon

```ts
createTray()
```

Reads the right icon for the platform (templated for macOS so it adapts to
light/dark menu bar, full-color for Windows), builds a context menu listing
all enabled reactions, and wires up click/double-click to open the settings
window.

#### 3.3.8 Create the settings window

```ts
createSettingsWindow()
```

Normal-ish window: 880×600, title "Fanfare," with sandbox + contextIsolation.
The one notable trick: the close button doesn't quit the app, it just hides
the window:

```ts
settingsWindow.on('close', (e) => {
  if (!isQuitting && settingsWindow) {
    e.preventDefault()
    settingsWindow.hide()
  }
})
```

This is the standard "tray app" UX — closing the window leaves the app
running in the background. The only way to actually exit is **Quit Fanfare**
from the tray menu, which sets `isQuitting = true` and then calls
`app.quit()`.

#### 3.3.9 Register global hotkeys

```ts
registerHotkeys(settings)
```

For each enabled reaction with a hotkey set, call `globalShortcut.register()`
which asks the OS to forward that key combo to us *globally* — even when
Fanfare isn't focused, even when you're typing into another app. This is the
core feature.

The full implementation has more nuance — see [§4](#4-hotkey-trace) and
[§9.2](#92-the-windows-globalshortcut-bug-v012) for the case study on the
re-registration bug we fixed.

### 3.4 The renderer processes start

When we called `createSettingsWindow()` and `createOverlayWindow()`,
Electron started a Chromium renderer process for each one. Each renderer:

1. Loads its preload script (`out/preload/settings.js` or
   `out/preload/overlay.js`) which runs and calls
   `contextBridge.exposeInMainWorld('fanfare', api)`.
2. Loads its HTML file (`out/renderer/settings.html` or `overlay.html`).
3. The HTML's `<script>` tag loads the React bundle.
4. React mounts and the UI appears.

The settings window UI ([`src/renderer/src/components/SettingsApp.tsx`](src/renderer/src/components/SettingsApp.tsx))
immediately calls `window.fanfare.getSettings()` to ask main for the current
settings, and uses them to populate the form.

The overlay window UI ([`src/renderer/src/components/OverlayApp.tsx`](src/renderer/src/components/OverlayApp.tsx))
mounts an empty `<div>` and waits for `window.overlay.onTrigger(...)` to be
called.

At this point, the app is fully booted. The tray is showing, both windows
exist (settings hidden by default if launched at startup, overlay always
hidden until triggered), and hotkeys are armed.

---

## 4. Hotkey trace

Now let's trace what happens when a user, mid-Zoom-call, presses Ctrl+Alt+A.

### 4.1 The OS forwards the keystroke

The user's keyboard sends `Ctrl+Alt+A` to Windows. Windows looks up its
table of registered global hotkeys (which is what `globalShortcut.register()`
added to during boot). It finds Fanfare claiming that combo, so instead of
delivering the keystroke to whatever app currently has focus (Zoom, say),
it sends a message to Fanfare's main process.

### 4.2 Electron invokes the callback

The callback we registered fires inside the main process:

```ts
globalShortcut.register(reaction.hotkey, () => triggerReaction(reaction))
```

So `triggerReaction(reaction)` runs with the matched reaction object —
the one with `id: 'applause'`, the hotkey, the duration, the position, etc.

### 4.3 triggerReaction does its work

```ts
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
    ...
  }
  overlayWindow.webContents.send(IPC.OverlayTrigger, payload)
}
```

Let's break that down:

1. **Make sure the overlay exists.** If it was destroyed for any reason
   (shouldn't normally happen, but defensive), create a new one.
2. **Resolve the actual reaction to play.** If the user pressed the
   Randomizer hotkey, pick one of the other enabled reactions at random.
   Otherwise use the reaction directly.
3. **Position the overlay.** Move it to cover the right display — primary
   monitor, cursor's monitor, or a specific monitor based on the user's
   setting.
4. **Show the overlay** (`showInactive` so it doesn't steal focus from your
   Zoom call).
5. **Build the trigger payload** with everything the renderer needs to
   render — animation key, duration, position, reduced-motion flag, custom
   phrases.
6. **Send the payload via IPC** to the overlay renderer:
   `overlayWindow.webContents.send(IPC.OverlayTrigger, payload)`.

### 4.4 The overlay renderer receives the IPC

Over in [`src/preload/overlay.ts`](src/preload/overlay.ts), there's a
listener that was set up at boot:

```ts
const api = {
  onTrigger: (cb) => {
    const listener = (_e, payload) => cb(payload)
    ipcRenderer.on(IPC.OverlayTrigger, listener)
    return () => ipcRenderer.removeListener(IPC.OverlayTrigger, listener)
  }
}
contextBridge.exposeInMainWorld('overlay', api)
```

When the React `OverlayApp` mounted, it subscribed:

```ts
useEffect(() => {
  let nextKey = 0
  return window.overlay.onTrigger((payload) => {
    nextKey += 1
    setActive({ ...payload, key: nextKey })
  })
}, [])
```

So `setActive(...)` runs with the new trigger payload. React re-renders.

### 4.5 React renders the animation

`OverlayApp` now has an `active` state. It looks up which animation
component to use based on `active.animationKey`:

```ts
function renderAnimation(key, durationMs, reducedMotion, phrases) {
  switch (key) {
    case 'applause':
      return <Applause durationMs={durationMs} phrases={phrases} />
    case 'confetti':
      return <Confetti durationMs={durationMs} reducedMotion={reducedMotion} />
    ...
  }
}
```

Each animation component is a self-contained React component in
[`src/renderer/src/components/animations/`](src/renderer/src/components/animations/).
They use CSS animations or canvas-based effects to draw the actual visuals.

The `<PositionedStage>` wrapper decides whether the animation should be
fullscreen (confetti, fireworks, hearts, crowd) or anchored to a corner
(applause, correct, gold stars, etc.) and applies the right CSS positioning.

### 4.6 The animation plays, then hides

Also in `OverlayApp`:

```ts
useEffect(() => {
  if (!active) return
  const hold = active.reducedMotion
    ? Math.min(active.durationMs, REDUCED_MOTION_MAX_HOLD_MS)
    : active.durationMs + 100
  const t = window.setTimeout(() => setActive(null), hold)
  return () => window.clearTimeout(t)
}, [active])
```

A `setTimeout` runs for the reaction's duration (3 seconds by default,
clamped lower if reduced motion is on). When it fires, `setActive(null)`
clears the state, React unmounts the animation, and the overlay goes back
to showing an empty transparent `<div>`.

The window itself stays visible but empty. That's fine — it's transparent
and click-through, so the user sees nothing.

### 4.7 Total elapsed time

From "user pressed Ctrl+Alt+A" to "first confetti pixel on screen" is
typically under 16ms (one frame at 60Hz). The main process work is
microseconds. The IPC hop is microseconds. The React re-render is a few
milliseconds. The bottleneck is the CSS animation kicking in, which
happens at the next browser frame.

---

## 5. Settings

The settings system has three actors: the disk file, the main process, and
the settings renderer.

### 5.1 The disk file

`electron-store` wraps a JSON file. Path on Windows:
`%APPDATA%\Fanfare\fanfare-settings.json`. The file looks like:

```json
{
  "settings": {
    "launchOnStartup": false,
    "reducedMotion": false,
    "hasSeenWelcome": true,
    "displayId": "cursor",
    "hotkeysPaused": false,
    "masterMuteHotkey": "CommandOrControl+Alt+0",
    "reactions": [ ... ]
  }
}
```

### 5.2 The main process is the only writer

Only [`src/main/store.ts`](src/main/store.ts) reads and writes that file.
Renderers never touch it directly — they can't, they're sandboxed.

### 5.3 Renderers read and write via IPC

The settings UI calls `window.fanfare.updateSettings(newSettings)`. The
preload turns that into `ipcRenderer.invoke(IPC.SettingsUpdate, newSettings)`.
The main process has a handler:

```ts
ipcMain.handle(IPC.SettingsUpdate, (evt, next: Settings) => {
  if (!isTrustedSender(evt)) throw new Error('untrusted sender')
  const saved = setSettings(next)
  registerHotkeys(saved)         // re-register hotkeys in case they changed
  applyLoginItem(saved)          // re-apply launch-on-startup
  refreshTrayMenu()              // tray text may have changed
  return saved
})
```

This is the **canonical pattern** in Electron: renderer requests an action,
main process does the work, returns the new state. The renderer updates its
local React state with the returned value. Everyone stays in sync.

### 5.4 Pushing updates the other way

Sometimes main needs to push state TO a renderer without being asked.
Example: the user toggles the master mute hotkey from the tray menu. The
tray menu lives in main, so the settings UI (in the renderer) won't know
about the change unless we tell it.

The mechanism is `webContents.send()`:

```ts
function toggleMasterMute(): void {
  ...
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.webContents.send(IPC.SettingsChanged, saved)
  }
}
```

And the settings renderer subscribed at mount:

```ts
useEffect(() => {
  window.fanfare.getSettings().then(setSettings)
  window.fanfare.listDisplays().then(setDisplays)
  return window.fanfare.onSettingsChanged((next) => setSettings(next))
}, [])
```

So when the tray fires `toggleMasterMute`, the settings UI's toggle
automatically updates without the user having to refresh anything.

### 5.5 The migration trick

`getSettings()` does this:

```ts
const merged: Settings = {
  ...DEFAULT_SETTINGS,
  ...stored,
  reactions: [
    ...stored.reactions.map((r) => {
      const def = defaultsById.get(r.id)
      return def ? { ...def, ...r } : r
    }),
    ...DEFAULT_SETTINGS.reactions.filter((r) => !storedIds.has(r.id))
  ]
}
```

Two things happen on every read:

1. **Existing reactions get backfilled** with any new fields from the
   defaults that didn't exist when they were saved. So if v0.2 adds a
   `volume: number` field to `Reaction`, old saved reactions get it
   silently.
2. **Brand new reactions** that the user is missing get appended. So if
   v0.2 adds a new "Birthday cake" reaction, it shows up in the user's
   list without them having to do anything.

This is a poor-man's migration system that works fine for additive changes.
If you ever need to *remove* a field or *change* its shape, you'd need a
proper migration step that runs once on version-bump.

---

## 6. Security

You'll see a lot of code in [`src/main/index.ts`](src/main/index.ts) that
looks paranoid. It's there because Electron apps have a well-documented
attack surface and shipping an unhardened one is irresponsible. Here's what
each defense does and why.

### 6.1 sandbox: true

```ts
webPreferences: {
  sandbox: true,
  contextIsolation: true,
  ...
}
```

`sandbox: true` puts the renderer process in Chromium's OS-level sandbox.
It can't make arbitrary syscalls. It can't open files outside its sandbox.
If a malicious script somehow gets executed in the renderer, the blast
radius is limited to "things a browser tab can do" — which is bad but
recoverable, vs. "things any program on your machine can do" which is
unbounded.

`contextIsolation: true` puts the preload's JavaScript context in a
separate V8 world from the renderer's. The renderer can't reach in and
modify or read the preload's variables, even though they're in the same
process. Without this, a malicious script could redefine your
`contextBridge` API and intercept all IPC.

These two together are the **baseline hardening** for any modern Electron
app. There's no good reason to ship without them.

### 6.2 The preload as the only bridge

`contextBridge.exposeInMainWorld('fanfare', api)` is the only way the
renderer gets ANY Node-like capabilities. Everything in that `api` object
is hand-picked and minimal. No raw `ipcRenderer`, no `require`, no `fs`.
Just a few methods that wrap IPC calls.

### 6.3 isTrustedSender on every IPC handler

```ts
function isTrustedSender(evt: Electron.IpcMainInvokeEvent): boolean {
  const url = evt.senderFrame?.url ?? ''
  if (RENDERER_DEV_URL && url.startsWith(RENDERER_DEV_URL)) return true
  if (url.startsWith('file://')) return true
  return false
}

ipcMain.handle(IPC.SettingsUpdate, (evt, next: Settings) => {
  if (!isTrustedSender(evt)) throw new Error('untrusted sender')
  ...
})
```

Every single IPC handler checks who called it. The check looks at
`evt.senderFrame.url` — the URL of the frame that fired the message.
We accept either the dev server URL (during development) or a `file://`
URL (our packaged HTML). Anything else throws.

Why does this matter? Because if a renderer somehow gets compromised and
the attacker can inject an iframe pointing at `https://evil.com`, that
iframe is still running inside Fanfare's renderer process and could call
`ipcRenderer.invoke('settings:update', maliciousPayload)`. The check stops
it — `https://evil.com` isn't an allowed sender, the handler throws, the
attack fails.

### 6.4 lockDownNavigation

```ts
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
```

If something in the renderer tries to navigate the BrowserWindow to a
different URL (e.g., `location.href = 'https://evil.com'`), we cancel the
navigation. If the URL is a normal `http(s)://` link, we open it in the
user's default browser instead. This prevents a "swap the page" attack
where an attacker tricks the window into loading malicious content that
would then have the same preload privileges as our real UI.

### 6.5 safeOpenExternal

```ts
function safeOpenExternal(url: string): void {
  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      shell.openExternal(url)
    }
  } catch { /* swallow malformed URLs */ }
}
```

`shell.openExternal` is dangerous if called with arbitrary input. On
Windows, opening `file:///some/path` could launch random executables.
Opening `javascript:` URLs in a browser is also bad. So we explicitly
allowlist `http:` and `https:` and drop everything else.

### 6.6 lockDownPermissions

```ts
function lockDownPermissions(): void {
  const ses = session.defaultSession
  ses.setPermissionRequestHandler((_wc, _permission, callback) => callback(false))
  ses.setPermissionCheckHandler(() => false)
}
```

If a renderer ever asks "can I use the camera?" or "can I access the
clipboard?", the answer is always no. Fanfare needs none of those.

### 6.7 Content Security Policy

Both `settings.html` and `overlay.html` have a `<meta>` CSP:

```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self' 'unsafe-inline' data:; script-src 'self'" />
```

This tells Chromium to refuse to load scripts from any origin other than
"self" (the page's own origin). Inline scripts are also blocked (note
`script-src 'self'` does NOT include `'unsafe-inline'`). This is
defense-in-depth — if an XSS vulnerability slipped through, the attacker
couldn't easily load a remote payload.

### 6.8 In summary

These defenses are layered. No single one is sufficient. The attacker has
to defeat sandbox + contextIsolation + CSP + sender validation +
navigation lockdown to do real damage. That's a much harder bar than the
default "Electron app with `nodeIntegration: true`" you'd find in a
tutorial circa 2017.

---

## 7. The build pipeline

This section answers: how does TypeScript source become an executable?

### 7.1 The three bundles

Electron-vite (the toolchain we use) is a wrapper around Vite that knows
about Electron's three-process model. When you run `npm run build`, it
runs Vite three times with different configs:

```
src/main/index.ts            ─► out/main/index.js        (Node-targeted CJS)
src/preload/settings.ts      ─► out/preload/settings.js  (Node-targeted CJS)
src/preload/overlay.ts       ─► out/preload/overlay.js   (Node-targeted CJS)
src/renderer/settings.html   ─► out/renderer/settings.html
+ React app                  ─► out/renderer/assets/settings-[hash].js
src/renderer/overlay.html    ─► out/renderer/overlay.html
+ React app                  ─► out/renderer/assets/overlay-[hash].js
```

The configuration lives in [`electron.vite.config.ts`](electron.vite.config.ts).

Each section (`main`, `preload`, `renderer`) targets a different runtime
and uses different optimization rules.

### 7.2 externalizeDepsPlugin

In main and preload:

```ts
plugins: [externalizeDepsPlugin()]
```

This tells Vite/Rollup: "don't try to bundle Node dependencies into the
output. Leave them as `require('electron-store')` and let Node resolve
them at runtime." Without this, Vite would try to bundle `electron-store`
into the output bundle, which doesn't work well for packages with native
dependencies or Node-only code.

The renderer doesn't get this plugin because renderers don't have
`require` — they're browser-ish. Everything in the renderer bundle is
inlined.

### 7.3 The renderer bundle uses code splitting

You'll see `out/renderer/assets/types-[hash].js` even though we never
explicitly built it. That's a shared chunk — both `settings.js` and
`overlay.js` import from `@shared/types`, and Rollup hoists that shared
code into its own file to avoid duplication.

In the renderer this works fine because the renderer is just a browser.
The HTML loads `settings.js` via `<script type="module">`, the browser
sees the import of `./types-[hash].js`, and fetches it from the same
origin. No problem.

**This same code-splitting behavior in the *preload* is what caused the
v0.1.1 bug.** See [§9.1](#91-the-sandboxed-preload-chunking-bug-v011).

### 7.4 electron-builder takes it from here

After `electron-vite build` produces `out/`, the `package:win` (or
`release:win`) script runs `electron-builder --win --publish never/always`.

electron-builder reads its config from `package.json`:

```json
"build": {
  "appId": "com.fanfare.app",
  "productName": "Fanfare",
  "files": ["out/**/*", "package.json"],
  "extraResources": [{ "from": "resources", "to": "resources" }],
  "win": { "target": "nsis", "icon": "build/icon.png" },
  "mac": { "target": "dmg", ... },
  "publish": [{ "provider": "github", "owner": "burntsouup", "repo": "fanfare" }]
}
```

The build process:

1. **Bundle the app into an asar archive.** `app.asar` is a single-file
   archive (similar to a zip) containing your `out/` directory and
   `package.json`. Electron's runtime knows how to read files out of it
   directly.
2. **Copy in extra resources.** Anything in `resources/` (your tray icons,
   app icon) gets copied next to the asar.
3. **Bundle with the Electron runtime.** electron-builder downloads the
   Electron prebuilt binary for your target platform (Chromium + Node +
   glue code) and wraps your app around it.
4. **Generate the installer.** On Windows, that's NSIS — a wizard-style
   installer that handles install/uninstall, start menu shortcuts, etc.
   On macOS, that's a DMG — a mountable disk image with a drag-to-Applications
   prompt.
5. **Generate auto-update metadata.** `latest.yml` (Windows) and
   `latest-mac.yml` (macOS) contain the new version number, the installer
   filename, and a SHA-512 checksum. Even though we don't have auto-update
   wired up yet, these files get generated for free.

The output lands in `release/`. That's what users download.

---

## 8. The release pipeline

You don't run `npm run package:win` locally for releases. Two reasons:

1. **Cross-platform builds need cross-platform machines.** You can't make
   a working `.dmg` on Windows (and electron-builder's cross-build mode
   doesn't handle code signing properly).
2. **The local Windows build failed for you due to a symlink permission
   issue** with electron-builder's `winCodeSign` cache (covered earlier
   in our conversation).

So we use GitHub Actions. The workflow lives at
[`.github/workflows/release.yml`](.github/workflows/release.yml).

### 8.1 The trigger

```yaml
on:
  push:
    tags:
      - 'v*.*.*'
  workflow_dispatch:
```

Pushing a tag like `v0.1.2` to GitHub fires the workflow. So does manually
clicking "Run workflow" in the Actions tab (useful for testing).

### 8.2 The matrix

```yaml
strategy:
  matrix:
    os: [windows-latest, macos-latest]
runs-on: ${{ matrix.os }}
```

This is a "matrix" job — GitHub spins up TWO runners in parallel, one
Windows and one Mac. Each does its own platform's build independently.

### 8.3 The steps

For each runner:

```yaml
- uses: actions/checkout@v4
- uses: actions/setup-node@v4
  with: { node-version: '22', cache: 'npm' }
- run: npm ci
- name: Build & publish (Windows)
  if: matrix.os == 'windows-latest'
  run: npm run release:win
  env:
    GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

1. **Checkout the code** at the tag's commit.
2. **Set up Node 22** (matching your local dev version).
3. **`npm ci`** — clean install of dependencies from `package-lock.json`.
   Faster and more deterministic than `npm install`.
4. **Run the platform-specific release script.** The `if:` clause makes
   sure each runner only runs its own build.
5. **`GH_TOKEN`** — GitHub auto-injects a token with permissions to write
   to the current repo (because we declared `permissions: contents: write`
   at the workflow level). electron-builder uses this token to create the
   draft release and upload installers.

### 8.4 The publishing step

`electron-builder --publish always` does these things after the build:

1. Look at the `publish` config in `package.json` — that points at
   `burntsouup/fanfare` on GitHub.
2. Check if a release named `v0.1.2` exists. If not, create one as a draft.
3. Upload each generated artifact (the `.exe`, the `.dmg`, the `latest.yml`,
   the blockmaps) as assets on that release.
4. Repeat for each runner. Windows uploads its `.exe`. Mac uploads its
   `.dmg` files. Both reference the same draft release, so all assets end
   up attached to the same `v0.1.2`.

### 8.5 The human step

The release is created as a **draft**, not published. You go to the
Releases page, review the assets, add release notes, and click Publish.
That's deliberate — it's a safety net so you can review what's about to
be public.

---

## 9. Case studies

Two real bugs we hit and fixed during this session. Worth understanding
because both are common Electron foot-guns.

### 9.1 The sandboxed-preload chunking bug (v0.1.1)

**Symptom:** App launched, tray icon appeared, settings window opened —
but the window was completely blank. Hotkeys also didn't work.

**Root cause:** Both preload files (`settings.ts` and `overlay.ts`)
imported the same module:

```ts
// settings.ts
import { IPC } from '../shared/ipc'

// overlay.ts
import { IPC } from '../shared/ipc'
```

Rollup, the bundler underneath Vite, saw two entries sharing a module and
did the "smart" thing — extracted the shared module into a separate chunk:

```
out/preload/
  chunks/
    ipc-DwwSWLxe.js   ← shared chunk
  settings.js           ← does require("./chunks/ipc-...")
  overlay.js            ← does require("./chunks/ipc-...")
```

But our preloads run with `sandbox: true`. Sandboxed preloads have a
restricted `require()` — it only allows a tiny allowlist of modules
(`electron`, `events`, `timers`, `url`). Relative-path requires throw.

So when the packaged app loaded the preload:
1. `require("./chunks/ipc-DwwSWLxe.js")` threw.
2. The preload crashed before reaching `contextBridge.exposeInMainWorld()`.
3. `window.fanfare` (and `window.overlay`) was undefined.
4. React mounted, immediately called `window.fanfare.getSettings()`, threw,
   crashed the render — blank screen.
5. Same bug in the overlay preload meant the overlay had no listener for
   trigger messages, so even though hotkeys WERE registered and firing,
   nothing happened visually. Hence "hotkeys don't work."

**Why did dev mode work?** electron-vite's dev mode bundles the preloads
differently — it doesn't extract chunks the same way Rollup does in
production.

**The fix:** Inline the IPC constants in each preload. Tiny duplication
(10 lines), but no shared module → no chunk extraction → no broken
require.

### 9.2 The Windows globalShortcut bug (v0.1.2)

**Symptom:** The master mute hotkey (Ctrl+Alt+0) worked to *resume*
hotkeys after manually pausing via the tray, but didn't work to *pause*
them in the first place.

**Root cause:** The old `registerHotkeys()` function unregistered and
re-registered the master mute accelerator every time it ran:

```ts
function registerHotkeys(settings: Settings): void {
  if (masterMuteAccelerator) {
    globalShortcut.unregister(masterMuteAccelerator)
    masterMuteAccelerator = null
  }
  // ...re-register master mute and reactions
}
```

And `toggleMasterMute()` called `registerHotkeys()` from inside the master
mute callback.

On Windows, calling `globalShortcut.unregister()` followed by
`globalShortcut.register()` for the SAME accelerator while you're STILL
INSIDE that accelerator's callback is unreliable — the re-registration
silently fails because the OS's `RegisterHotKey` API doesn't handle the
re-entrant case well.

So pressing Ctrl+Alt+0 to mute caused the master mute binding to be
silently destroyed. Pressing it again did nothing. The only way to recover
was to call `toggleMasterMute()` from a non-shortcut context (like the
tray menu).

**The fix:** Separate master mute management from reaction management.
Only touch the master mute binding when the master mute *hotkey itself*
changes (not just when paused state flips). That way, toggling pause only
re-registers reactions, never the master mute. The Windows quirk is
avoided entirely.

### 9.3 The pattern across both bugs

Both bugs share a property: **they worked in dev, broke in production.**
That's the most expensive class of Electron bug. Things that worked fine
in `npm run dev` shipped silently broken in the installer.

Lessons:
1. **Always test the packaged build** before tagging a release. We didn't
   do this for v0.1.0 because the local Windows build was failing for
   unrelated reasons; we shipped blind.
2. **Sandbox + chunking is a known footgun.** If you see relative-path
   `require()` in a built preload, it's probably broken. Inline shared
   code or use a Vite config that disables chunking for preloads.
3. **Don't re-register hotkeys from inside their own callbacks.** Use
   `setImmediate(...)` to defer, or split your registration logic so the
   triggering hotkey's binding isn't touched.

---

## 10. Trade-offs

### 10.1 Why Electron at all?

Alternatives considered:

| Stack | Pro | Con |
|---|---|---|
| **Native Windows + Native macOS** | Tiny binaries, fast | Two codebases, two skill sets |
| **Tauri (Rust + webview)** | Tiny binaries, web UI | Rust learning curve; less mature; smaller community |
| **Pure web app** | No install at all | Can't register global hotkeys; can't overlay other apps |
| **Electron** | Ship one codebase to all desktops; huge ecosystem; familiar (Node+React) | 150 MB installer; high memory use |

We picked Electron because:
- The UI is React. Electron makes that trivial.
- Hotkey + overlay + tray + cross-platform is exactly what Electron is
  good at.
- 150 MB for a free side project is fine. We're not shipping to embedded
  hardware.

### 10.2 Two windows instead of one

We have `settingsWindow` and `overlayWindow` as separate `BrowserWindow`
instances. The simpler alternative: one window with conditional UI.

We chose two because:
- The overlay needs to be transparent, click-through, always-on-top,
  non-focusable, fullscreen. The settings window needs to be opaque,
  interactive, focusable, normal-sized.
- These window properties are immutable after creation in Electron. You
  can't toggle a window's `transparent: true` at runtime.
- So you either have two windows, or you destroy + recreate one window
  every time, which is slow and would flash.

### 10.3 Click-through overlay

`overlayWindow.setIgnoreMouseEvents(true, { forward: true })` makes mouse
events pass through. The overlay is invisible to user input. That's
critical because:
- The user is presenting. They need to click on their slides, their video
  call controls, their browser tabs. The overlay must not interfere.
- The `forward: true` part lets the renderer still receive `mousemove`
  events for tracking (we don't use this, but it's good practice).

### 10.4 Why electron-store for settings

`electron-store` is a tiny library that wraps `JSON.stringify` and
`fs.writeFileSync` with a sensible API. We could've written this
ourselves in 30 lines. We didn't because:
- It handles atomic writes (write to temp file, rename) so settings aren't
  corrupted if the app crashes mid-save.
- It handles default values cleanly.
- It picks the right user-data directory per platform.
- The maintenance cost is zero.

### 10.5 No auto-update yet

Auto-update via `electron-updater` is wired into electron-builder's
publish output (the `latest.yml` files exist). We didn't enable the
client-side bit because:
- We're shipping bug fixes weekly. Users uninstalling and reinstalling is
  fine.
- Auto-update on macOS requires code signing + notarisation. We're
  unsigned.
- Auto-update increases the security surface — if your release pipeline
  is compromised, attackers can push malicious "updates" to every install.

When the app stabilizes, this is a 10-line change to add.

### 10.6 No code signing

Apple Developer ID is $99/yr. Windows OV cert is ~$200/yr. For a free
side project with no revenue, that's not justified. The cost is making
users click through SmartScreen/Gatekeeper warnings once on install,
which the README explains.

---

## 11. What you'd add next

If you wanted to keep improving this past v0.1.x, here's a rough roadmap
in order of impact:

1. **Auto-update (electron-updater).** Three lines of code in main, plus
   handling the "update available" UX in the settings window. Massively
   improves the upgrade story.
2. **Crash reporting / telemetry (opt-in).** Right now if a user hits a
   bug, you'd never know. A lightweight `electron-log` + a Sentry-like
   service (opt-in!) would surface real failures.
3. **Custom reaction creation in the UI.** The data model already supports
   adding new reactions. The UI doesn't yet expose "create new reaction."
   Add a form, plumb it through the existing IPC handlers.
4. **Sound effects per reaction.** The `Reaction` type has a
   `soundEnabled: boolean` field that's currently a no-op. Add a real
   audio pipeline that loads short MP3s and plays them through the
   default output device when reactions fire.
5. **Hotkey conflict resolution.** Right now if a user binds two reactions
   to the same hotkey, the second one silently wins and a `conflictHotkeys`
   `Set` highlights it in the UI. You could be more proactive about
   warning at bind time.
6. **Recordable cues for OBS / streaming software.** Many streamers want
   to trigger animations from a Stream Deck or Twitch chat. Expose an
   HTTP or WebSocket endpoint that fires the same `triggerReaction()`
   that hotkeys do.
7. **Code signing.** Once you have actual users complaining about
   SmartScreen / Gatekeeper, this becomes worth the $99–300/yr.

---

That's the whole picture. If anything in here was confusing or skipped
over too fast, the source code is your friend — the files referenced
throughout are short and well-commented. Start with
[`src/main/index.ts`](src/main/index.ts), then walk through whatever
trace catches your interest.
