import Store from 'electron-store'
import { DEFAULT_SETTINGS, Settings, Reaction } from '../shared/types'

const store = new Store<{ settings: Settings }>({
  name: 'fanfare-settings',
  defaults: { settings: DEFAULT_SETTINGS }
})

export function getSettings(): Settings {
  const stored = store.get('settings', DEFAULT_SETTINGS)
  const defaultsById = new Map(DEFAULT_SETTINGS.reactions.map((r) => [r.id, r]))
  const storedIds = new Set(stored.reactions.map((r) => r.id))

  // Migration: backfill new fields on existing reactions, then append any
  // brand-new default reactions the user is missing entirely.
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
  return merged
}

export function setSettings(next: Settings): Settings {
  store.set('settings', next)
  return next
}

export function updateReaction(id: string, patch: Partial<Reaction>): Settings {
  const current = getSettings()
  const next: Settings = {
    ...current,
    reactions: current.reactions.map((r) => (r.id === id ? { ...r, ...patch } : r))
  }
  return setSettings(next)
}
