import { useCallback, useEffect, useMemo, useState } from 'react'
import type { DisplayChoice, DisplayInfo, Reaction, Settings } from '@shared/types'
import { ReactionRow } from './ReactionRow'
import { HotkeyInput } from './HotkeyInput'

type Tab = 'reactions' | 'settings'

export function SettingsApp(): JSX.Element {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [tab, setTab] = useState<Tab>('reactions')
  const [displays, setDisplays] = useState<DisplayInfo[]>([])

  useEffect(() => {
    window.fanfare.getSettings().then(setSettings)
    window.fanfare.listDisplays().then(setDisplays)
    return window.fanfare.onSettingsChanged((next) => setSettings(next))
  }, [])

  const updateReaction = useCallback(async (id: string, patch: Partial<Reaction>) => {
    const next = await window.fanfare.updateReaction(id, patch)
    setSettings(next)
  }, [])

  const updateSettings = useCallback(async (patch: Partial<Settings>) => {
    if (!settings) return
    const next = await window.fanfare.updateSettings({ ...settings, ...patch })
    setSettings(next)
  }, [settings])

  const conflictHotkeys = useMemo(() => {
    if (!settings) return new Set<string>()
    const counts = new Map<string, number>()
    for (const r of settings.reactions) {
      if (!r.enabled || !r.hotkey) continue
      counts.set(r.hotkey, (counts.get(r.hotkey) ?? 0) + 1)
    }
    const conflicts = new Set<string>()
    for (const [hotkey, count] of counts) {
      if (count > 1) conflicts.add(hotkey)
    }
    return conflicts
  }, [settings])

  if (!settings) {
    return (
      <div className="h-full grid place-items-center text-paper/75">
        Loading…
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-ink text-paper">
      <Header />
      <div className="flex-1 flex min-h-0">
        <Sidebar tab={tab} setTab={setTab} />
        <main className="flex-1 overflow-y-auto p-6">
          {tab === 'reactions' && (
            <section className="space-y-3 max-w-3xl">
              {!settings.hasSeenWelcome && (
                <WelcomeBanner onDismiss={() => updateSettings({ hasSeenWelcome: true })} />
              )}
              <div className="flex items-baseline justify-between">
                <h2 className="text-xl font-semibold">Reactions</h2>
                <p className="text-sm text-paper/75">
                  Press a hotkey anywhere on your machine to trigger an animation overlay.
                </p>
              </div>
              <div className="space-y-3">
                {settings.reactions.map((r) => (
                  <ReactionRow
                    key={r.id}
                    reaction={r}
                    hotkeyConflict={r.enabled && conflictHotkeys.has(r.hotkey)}
                    onChange={(patch) => updateReaction(r.id, patch)}
                    onTest={() => window.fanfare.testReaction(r.id)}
                  />
                ))}
              </div>
            </section>
          )}
          {tab === 'settings' && (
            <section className="space-y-6 max-w-2xl">
              <h2 className="text-xl font-semibold">App settings</h2>
              <ToggleRow
                label="Launch on system startup"
                description="Open Fanfare automatically when you log in."
                value={settings.launchOnStartup}
                onChange={(v) => updateSettings({ launchOnStartup: v })}
              />
              <ToggleRow
                label="Reduced motion"
                description="Show each reaction as a static frame instead of an animation. Recommended for sensitivity to motion."
                value={settings.reducedMotion}
                onChange={(v) => updateSettings({ reducedMotion: v })}
              />

              <div className="pt-2">
                <div className="font-medium mb-1">Display</div>
                <p className="text-sm text-paper/75 mb-2">
                  Where to render reactions when triggered.
                </p>
                <DisplaySelect
                  value={settings.displayId}
                  displays={displays}
                  onChange={(v) => updateSettings({ displayId: v })}
                />
              </div>

              <div className="pt-2">
                <ToggleRow
                  label="Pause hotkeys"
                  description="Temporarily disable all reaction hotkeys without losing your settings. The master shortcut below still works."
                  value={settings.hotkeysPaused}
                  onChange={(v) => updateSettings({ hotkeysPaused: v })}
                />
                <div className="mt-3 pl-14 max-w-xs">
                  <div className="text-xs uppercase tracking-wider text-paper/70 mb-1">
                    Master shortcut
                  </div>
                  <HotkeyInput
                    value={settings.masterMuteHotkey}
                    onChange={(next) => updateSettings({ masterMuteHotkey: next })}
                  />
                  <p className="mt-1.5 text-xs text-paper/60">
                    Press anywhere to toggle pause / resume.
                  </p>
                </div>
              </div>

              <div className="text-xs text-paper/75 pt-4 border-t border-white/10">
                Settings are stored locally. No accounts, no cloud, no telemetry.
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  )
}

function Header(): JSX.Element {
  const [version, setVersion] = useState<string>('')

  useEffect(() => {
    window.fanfare.getVersion().then(setVersion)
  }, [])

  return (
    <header className="px-6 py-4 border-b border-white/10 flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-accent2 grid place-items-center text-lg">
        👏
      </div>
      <div>
        <h1 className="font-display font-semibold leading-none">Fanfare</h1>
        <p className="text-xs text-paper/75 leading-tight mt-0.5">
          Hotkey-triggered joy for virtual presentations.
        </p>
      </div>
      {version && (
        <span className="ml-auto text-xs text-paper/50 font-mono self-start">
          v{version}
        </span>
      )}
    </header>
  )
}

function Sidebar({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }): JSX.Element {
  const items: { id: Tab; label: string }[] = [
    { id: 'reactions', label: 'Reactions' },
    { id: 'settings', label: 'Settings' }
  ]
  return (
    <nav className="w-44 shrink-0 border-r border-white/10 p-3 space-y-1">
      {items.map((it) => (
        <button
          key={it.id}
          onClick={() => setTab(it.id)}
          className={`w-full text-left px-3 py-2 rounded-md text-sm transition ${
            tab === it.id
              ? 'bg-white/10 text-paper'
              : 'text-paper/75 hover:text-paper hover:bg-white/5'
          }`}
        >
          {it.label}
        </button>
      ))}
    </nav>
  )
}

function WelcomeBanner({ onDismiss }: { onDismiss: () => void }): JSX.Element {
  return (
    <div className="relative rounded-xl border border-accent/30 bg-accent/10 p-4 pr-10 text-sm">
      <div className="font-medium text-paper">Welcome to Fanfare 🎺</div>
      <p className="text-paper/70 mt-1">
        Toggle a reaction on and press its hotkey anywhere on your machine to fire it.
        Try <span className="font-mono text-paper">Ctrl+Alt+R</span> for a random pick, or
        right-click the tray icon for the full menu.
      </p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss welcome"
        className="absolute top-2 right-2 w-6 h-6 grid place-items-center rounded text-paper/75 hover:text-paper hover:bg-white/10"
      >
        ×
      </button>
    </div>
  )
}

function ToggleRow({
  label,
  description,
  value,
  onChange
}: {
  label: string
  description?: string
  value: boolean
  onChange: (next: boolean) => void
}): JSX.Element {
  return (
    <label className="flex items-start gap-4 cursor-pointer">
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`mt-0.5 w-10 h-6 rounded-full relative transition ${
          value ? 'bg-accent' : 'bg-white/15'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
            value ? 'translate-x-4' : ''
          }`}
        />
      </button>
      <div>
        <div className="font-medium">{label}</div>
        {description && <div className="text-sm text-paper/75">{description}</div>}
      </div>
    </label>
  )
}

function DisplaySelect({
  value,
  displays,
  onChange
}: {
  value: DisplayChoice
  displays: DisplayInfo[]
  onChange: (next: DisplayChoice) => void
}): JSX.Element {
  const stringValue = typeof value === 'number' ? `id:${value}` : value
  return (
    <select
      value={stringValue}
      onChange={(e) => {
        const raw = e.target.value
        if (raw === 'cursor' || raw === 'primary') onChange(raw)
        else onChange(Number(raw.replace('id:', '')))
      }}
      className="w-full max-w-md bg-white/5 border border-white/10 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-accent text-paper"
    >
      <option value="cursor" className="bg-ink text-paper">
        Active display (follow cursor)
      </option>
      <option value="primary" className="bg-ink text-paper">
        Primary display
      </option>
      {displays.map((d, i) => (
        <option key={d.id} value={`id:${d.id}`} className="bg-ink text-paper">
          {d.label}
          {d.primary ? ' (primary)' : ''} — {d.bounds.width}×{d.bounds.height}
          {displays.length > 1 ? ` · #${i + 1}` : ''}
        </option>
      ))}
    </select>
  )
}
