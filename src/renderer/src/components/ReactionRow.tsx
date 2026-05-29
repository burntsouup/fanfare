import type { Reaction, ReactionPosition } from '@shared/types'
import { DEFAULT_APPLAUSE_PHRASES } from '@shared/types'
import { HotkeyInput } from './HotkeyInput'

type Props = {
  reaction: Reaction
  hotkeyConflict?: boolean
  onChange: (patch: Partial<Reaction>) => void
  onTest: () => void
}

const POSITIONS: { value: ReactionPosition; label: string }[] = [
  { value: 'center', label: 'Center' },
  { value: 'bottom-right', label: 'Bottom right' },
  { value: 'random', label: 'Random' }
]

export function ReactionRow({ reaction, hotkeyConflict, onChange, onTest }: Props): JSX.Element {
  return (
    <div
      className={`rounded-xl border p-4 transition ${
        hotkeyConflict
          ? 'border-amber-400/50 bg-amber-400/[0.04]'
          : 'border-white/5 bg-white/[0.03]'
      } ${reaction.enabled ? '' : 'opacity-60'}`}
    >
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-accent to-accent2 grid place-items-center text-2xl shrink-0">
          {reaction.emoji ?? '✨'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold">{reaction.name}</h3>
            <span className="text-xs text-paper/60">id: {reaction.id}</span>
            {hotkeyConflict && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-400/15 text-amber-300 border border-amber-400/40">
                <span aria-hidden="true">⚠</span>
                Hotkey conflict
              </span>
            )}
          </div>
          <p className="text-sm text-paper/75">
            {reaction.animationKey === 'random'
              ? `Picks a random enabled reaction. Plays for ${(reaction.durationMs / 1000).toFixed(1)}s.`
              : `Plays for ${(reaction.durationMs / 1000).toFixed(1)}s at ${reaction.position}.`}
          </p>
        </div>
        <button
          onClick={onTest}
          className="px-3 py-1.5 text-sm rounded-md bg-white/10 hover:bg-white/15 transition"
        >
          Test
        </button>
        <ToggleSwitch
          value={reaction.enabled}
          onChange={(v) => onChange({ enabled: v })}
          ariaLabel="Enable reaction"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 pl-16">
        <Field label="Hotkey">
          <HotkeyInput
            value={reaction.hotkey}
            onChange={(next) => onChange({ hotkey: next })}
          />
          {hotkeyConflict && (
            <div className="mt-1.5 text-xs text-amber-300">
              Another enabled reaction uses this hotkey — only one will fire.
            </div>
          )}
        </Field>
        <Field label={`Duration: ${(reaction.durationMs / 1000).toFixed(1)}s`}>
          <input
            type="range"
            min={1000}
            max={10000}
            step={250}
            value={reaction.durationMs}
            onChange={(e) => onChange({ durationMs: Number(e.target.value) })}
            className="w-full accent-accent"
          />
        </Field>
        <Field label="Position">
          <select
            value={reaction.position}
            onChange={(e) => onChange({ position: e.target.value as ReactionPosition })}
            className="w-full bg-white/5 border border-white/10 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-accent text-paper"
          >
            {POSITIONS.map((p) => (
              <option key={p.value} value={p.value} className="bg-ink text-paper">
                {p.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {reaction.animationKey === 'applause' && (
        <div className="mt-4 pl-16">
          <PhrasesEditor
            phrases={reaction.phrases}
            onChange={(next) => onChange({ phrases: next })}
          />
        </div>
      )}
    </div>
  )
}

function PhrasesEditor({
  phrases,
  onChange
}: {
  phrases: string[] | undefined
  onChange: (next: string[] | undefined) => void
}): JSX.Element {
  const value = (phrases ?? DEFAULT_APPLAUSE_PHRASES).join('\n')
  const usingDefaults = !phrases || phrases.length === 0
  return (
    <Field label="Praise phrases (one per line)">
      <textarea
        value={value}
        rows={5}
        spellCheck
        onChange={(e) => {
          const lines = e.target.value
            .split('\n')
            .map((s) => s.trim())
            .filter((s) => s.length > 0)
          // Empty list -> revert to defaults so the user can't lock themselves out.
          onChange(lines.length === 0 ? undefined : lines)
        }}
        className="w-full bg-white/5 border border-white/10 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-accent text-paper font-mono leading-relaxed resize-y"
      />
      <div className="mt-1.5 flex items-center justify-between text-xs text-paper/60">
        <span>{usingDefaults ? 'Using defaults.' : `${phrases!.length} custom phrase${phrases!.length === 1 ? '' : 's'}.`}</span>
        {!usingDefaults && (
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="text-paper/75 hover:text-paper underline underline-offset-2"
          >
            Reset to defaults
          </button>
        )}
      </div>
    </Field>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <label className="block">
      <div className="text-xs uppercase tracking-wider text-paper/70 mb-1">{label}</div>
      {children}
    </label>
  )
}

function ToggleSwitch({
  value,
  onChange,
  ariaLabel
}: {
  value: boolean
  onChange: (v: boolean) => void
  ariaLabel: string
}): JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-label={ariaLabel}
      aria-checked={value}
      onClick={() => onChange(!value)}
      className={`w-10 h-6 rounded-full relative transition shrink-0 ${
        value ? 'bg-accent' : 'bg-white/15'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
          value ? 'translate-x-4' : ''
        }`}
      />
    </button>
  )
}
