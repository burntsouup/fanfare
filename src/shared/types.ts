export type ReactionPosition = 'center' | 'bottom-right' | 'random'

export type Reaction = {
  id: string
  name: string
  emoji: string
  animationKey: string
  hotkey: string
  durationMs: number
  enabled: boolean
  position: ReactionPosition
  soundEnabled: boolean
  /** Optional per-reaction custom text. Currently only used by Applause. */
  phrases?: string[]
}

export type DisplayChoice = 'cursor' | 'primary' | number

export type Settings = {
  reactions: Reaction[]
  launchOnStartup: boolean
  reducedMotion: boolean
  hasSeenWelcome: boolean
  /** Where to render the overlay: 'cursor', 'primary', or an Electron display id. */
  displayId: DisplayChoice
  /** When true, no reaction hotkeys are registered. Master mute hotkey still works. */
  hotkeysPaused: boolean
  /** Global accelerator that toggles hotkeysPaused. Empty string disables. */
  masterMuteHotkey: string
}

export type TriggerPayload = {
  reactionId: string
  reactionName: string
  reactionEmoji: string
  animationKey: string
  durationMs: number
  position: ReactionPosition
  reducedMotion: boolean
  /** Optional list of praise phrases (Applause). */
  phrases?: string[]
}

export type DisplayInfo = {
  id: number
  label: string
  primary: boolean
  bounds: { x: number; y: number; width: number; height: number }
}

export const DEFAULT_APPLAUSE_PHRASES = ['Nice!', 'Yes!', 'Great!', 'Well done!', 'Awesome!']

const make = (
  id: string,
  name: string,
  emoji: string,
  animationKey: string,
  hotkey: string,
  enabled = false
): Reaction => ({
  id,
  name,
  emoji,
  animationKey,
  hotkey,
  durationMs: 3000,
  enabled,
  position: 'center',
  soundEnabled: false
})

export const DEFAULT_SETTINGS: Settings = {
  launchOnStartup: false,
  reducedMotion: false,
  hasSeenWelcome: false,
  displayId: 'cursor',
  hotkeysPaused: false,
  masterMuteHotkey: 'CommandOrControl+Alt+0',
  reactions: [
    make('applause',      'Applause',         '👏', 'applause',      'CommandOrControl+Alt+A', true),
    make('confetti',      'Confetti',         '🎊', 'confetti',      'CommandOrControl+Alt+C', true),
    make('fireworks',     'Fireworks',        '🎆', 'fireworks',     'CommandOrControl+Alt+F', true),
    make('pixel-hearts',  'Pixel Hearts',     '💖', 'pixel-hearts',  'CommandOrControl+Alt+H'),
    make('correct',       '"Correct!" Popup', '✅', 'correct',       'CommandOrControl+Alt+Q'),
    make('gold-stars',    'Gold Stars',       '⭐', 'gold-stars',    'CommandOrControl+Alt+G'),
    make('retro-success', 'Retro SUCCESS',    '🕹️', 'retro-success', 'CommandOrControl+Alt+S'),
    make('emoji-burst',   'Emoji Burst',      '🥳', 'emoji-burst',   'CommandOrControl+Alt+E'),
    make('pixel-crowd',   'Pixel Crowd',      '🙋', 'pixel-crowd',   'CommandOrControl+Alt+P'),
    make('random',        'Randomizer',       '🎲', 'random',        'CommandOrControl+Alt+R', true)
  ]
}

