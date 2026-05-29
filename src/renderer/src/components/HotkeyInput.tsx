import { useEffect, useRef, useState } from 'react'

type Props = {
  value: string
  onChange: (next: string) => void
}

// Map JS KeyboardEvent.key / .code to Electron accelerator tokens.
function toAcceleratorKey(e: KeyboardEvent): string | null {
  const k = e.key
  if (!k) return null
  // Modifier-only presses produce keys like "Control", "Alt"...
  if (['Control', 'Shift', 'Alt', 'Meta', 'OS'].includes(k)) return null

  if (k === ' ') return 'Space'
  if (k === 'Escape') return 'Escape'
  if (k === 'Enter') return 'Return'
  if (k === 'Tab') return 'Tab'
  if (k === 'Backspace') return 'Backspace'
  if (k === 'Delete') return 'Delete'
  if (/^Arrow/.test(k)) return k.replace('Arrow', '') // ArrowUp -> Up
  if (/^F\d{1,2}$/.test(k)) return k.toUpperCase()
  if (k.length === 1) return k.toUpperCase()
  return k
}

function buildAccelerator(e: KeyboardEvent): string | null {
  const key = toAcceleratorKey(e)
  if (!key) return null
  const parts: string[] = []
  if (e.ctrlKey || e.metaKey) parts.push('CommandOrControl')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')
  // Require at least one modifier — global shortcuts without modifiers are dangerous.
  if (parts.length === 0) return null
  parts.push(key)
  return parts.join('+')
}

function formatAccelerator(acc: string): string {
  const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform)
  return acc
    .split('+')
    .map((p) => {
      if (p === 'CommandOrControl') return isMac ? '⌘' : 'Ctrl'
      if (p === 'Alt') return isMac ? '⌥' : 'Alt'
      if (p === 'Shift') return isMac ? '⇧' : 'Shift'
      if (p === 'Command' || p === 'Cmd') return '⌘'
      if (p === 'Control') return 'Ctrl'
      return p
    })
    .join(isMac ? '' : ' + ')
}

export function HotkeyInput({ value, onChange }: Props): JSX.Element {
  const [recording, setRecording] = useState(false)
  const [draft, setDraft] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)

  // Pause main's globalShortcuts while recording so keydowns reach this window.
  useEffect(() => {
    if (!recording) return
    window.fanfare.pauseHotkeys()
    return () => {
      window.fanfare.resumeHotkeys()
    }
  }, [recording])

  useEffect(() => {
    if (!recording) return
    const handler = (e: KeyboardEvent): void => {
      e.preventDefault()
      e.stopPropagation()
      if (e.key === 'Escape') {
        setRecording(false)
        setDraft(null)
        return
      }
      const acc = buildAccelerator(e)
      if (!acc) {
        // Show modifiers-in-progress as a hint
        const hint: string[] = []
        if (e.ctrlKey || e.metaKey) hint.push('CommandOrControl')
        if (e.altKey) hint.push('Alt')
        if (e.shiftKey) hint.push('Shift')
        setDraft(hint.length ? hint.join('+') + '+…' : '…')
        return
      }
      setDraft(acc)
      // Commit
      onChange(acc)
      setRecording(false)
      setDraft(null)
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [recording, onChange])

  // Click outside cancels
  useEffect(() => {
    if (!recording) return
    const onDown = (ev: MouseEvent): void => {
      if (rootRef.current && !rootRef.current.contains(ev.target as Node)) {
        setRecording(false)
        setDraft(null)
      }
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [recording])

  const display = draft ?? value
  const friendly = display ? formatAccelerator(display) : '— none —'

  return (
    <div ref={rootRef} className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setRecording((r) => !r)}
        className={`flex-1 px-3 py-1.5 rounded-md text-sm font-mono border transition text-left ${
          recording
            ? 'bg-accent/20 border-accent text-paper'
            : 'bg-white/5 border-white/10 hover:bg-white/10'
        }`}
        title={recording ? 'Press your shortcut… (Esc to cancel)' : 'Click to record a new hotkey'}
      >
        {recording ? draft ? friendly : 'Press keys…' : friendly}
      </button>
      {value && !recording && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="text-xs text-paper/70 hover:text-paper px-1"
          title="Clear hotkey"
        >
          clear
        </button>
      )}
    </div>
  )
}
