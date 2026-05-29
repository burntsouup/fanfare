# Fanfare

A tray app that fires off celebratory animations on a global hotkey.

I built this for the people who run webinars, classes, training sessions, and
streams and want a fun way to react during a live screen share without leaving
their slides. The animation lands on top of whatever you're showing (yes,
including a Teams or Zoom share), runs for a couple of seconds, and then
disappears.

<!-- Drop a screenshot or GIF in here: ![screenshot](docs/screenshot.png) -->

## Install

Pre-built installers are on the [releases page](https://github.com/burntsouup/fanfare/releases).

**Windows.** Download the `.exe`, double-click. SmartScreen will say
"Windows protected your PC" because the binary isn't signed — code signing
certs cost more than I want to spend on a free side-project. Click
*More info* → *Run anyway*.

**macOS.** Download the `.dmg`, drag the app into Applications. The first time
you launch it, Gatekeeper will refuse because it isn't notarised (same reason).
Right-click the app → *Open* → *Open* in the dialog. After that it'll launch
normally.

Or build from source:

```bash
git clone https://github.com/burntsouup/fanfare
cd fanfare
npm install
npm run dev
```

## Hotkeys

| Reaction         | Default      | On at install |
| ---------------- | ------------ | ------------- |
| 👏 Applause      | Ctrl+Alt+A   | yes           |
| 🎊 Confetti      | Ctrl+Alt+C   | yes           |
| 🎆 Fireworks     | Ctrl+Alt+F   | yes           |
| 🎲 Random        | Ctrl+Alt+R   | yes           |
| 💖 Pixel Hearts  | Ctrl+Alt+H   | no            |
| ✅ "Correct!"    | Ctrl+Alt+Q   | no            |
| ⭐ Gold Stars    | Ctrl+Alt+G   | no            |
| 🕹️ Retro SUCCESS | Ctrl+Alt+S   | no            |
| 🥳 Emoji Burst   | Ctrl+Alt+E   | no            |
| 🙋 Pixel Crowd   | Ctrl+Alt+P   | no            |

On macOS, swap Ctrl+Alt for ⌘+⌥. Reactions that aren't on at install have
suggested hotkeys but they don't actually register until you toggle them on,
so they won't fight with app shortcuts you already use.

`Random` picks a random *enabled* reaction at trigger time. Useful if you want
variety without remembering nine different shortcuts.

## A few useful behaviours

Closing the settings window hides it to the tray; the hotkeys keep working.
Use the tray menu (right-click the icon) to trigger reactions manually, pause
all hotkeys, or quit.

If you've got more than one display, the overlay shows up on whichever screen
the mouse is on. You can pin it to the primary display or a specific one in
Settings.

If you need to type something that contains one of your reaction shortcuts,
**Ctrl+Alt+0** (configurable) toggles all hotkeys on and off.

## Adding a new reaction

1. Add an entry to `DEFAULT_SETTINGS.reactions` in
   [src/shared/types.ts](src/shared/types.ts) with a unique `id` and `animationKey`.
2. Build the animation component under
   [src/renderer/src/components/animations](src/renderer/src/components/animations).
3. Wire the `animationKey` into the switch in
   [src/renderer/src/components/OverlayApp.tsx](src/renderer/src/components/OverlayApp.tsx).
   Add the key to the `fullScreen` list there too if the animation needs the
   whole overlay area.

Settings UI, hotkey registration, tray menu, randomizer eligibility — all
generic, no extra wiring needed.

## Layout

```
resources/   tray + app icons (regen with `npm run gen:icons`)
scripts/     one-off dev scripts
src/
├── main/      Electron main: windows, hotkeys, tray, store, IPC
├── preload/   contextBridge APIs for each window
├── renderer/  React UIs (settings + overlay) + shared Tailwind CSS
└── shared/    Types + IPC channel names shared across processes
```

## Scripts

- `npm run dev` — start with hot reload
- `npm run build` — production assets to `out/`
- `npm run typecheck` — typecheck main + renderer
- `npm run package:win` / `package:mac` — produce installers in `release/`
- `npm run gen:icons` — regenerate tray + app icons (Windows only; uses PowerShell + System.Drawing)

## Stack

Electron + electron-vite, React, TypeScript, Tailwind. Settings live in a JSON
file via `electron-store`. Animations are plain CSS/SVG, no Lottie or third-
party graphics deps.

No accounts, no telemetry, no cloud sync.

## License

[MIT](LICENSE).
