export const IPC = {
  // Settings window <-> main
  SettingsGet: 'settings:get',
  SettingsUpdate: 'settings:update',
  SettingsChanged: 'settings:changed',
  ReactionUpdate: 'reaction:update',
  ReactionTest: 'reaction:test',
  HotkeysPause: 'hotkeys:pause',
  HotkeysResume: 'hotkeys:resume',
  DisplaysList: 'displays:list',
  AppGetVersion: 'app:get-version',
  AppIsStoreBuild: 'app:is-store-build',
  AppOpenStartupSettings: 'app:open-startup-settings',

  // Main -> overlay
  OverlayTrigger: 'overlay:trigger'
} as const
