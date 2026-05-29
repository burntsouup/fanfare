import { useMemo } from 'react'
import { DEFAULT_APPLAUSE_PHRASES } from '@shared/types'

type Props = {
  durationMs: number
  phrases?: string[]
}

type Emoji = {
  char: string
  dx: number
  dy: number
  rot: number
  delay: number
  size: number
  duration: number
}

const EMOJIS = ['👏', '🙌', '✨', '🎉', '⭐', '💫']

// Spread pieces across the full reaction duration so a long durationMs
// keeps emitting bursts instead of finishing in the first ~2s.
function buildBurst(count: number, durationMs: number): Emoji[] {
  const pieceMin = 1200
  const pieceMax = 1900
  const spawnWindow = Math.max(0, durationMs - pieceMax)
  const out: Emoji[] = []
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4
    const radius = 140 + Math.random() * 160
    const delay = Math.random() * spawnWindow
    const duration = Math.min(
      durationMs - delay,
      pieceMin + Math.random() * (pieceMax - pieceMin)
    )
    out.push({
      char: EMOJIS[i % EMOJIS.length],
      dx: Math.cos(angle) * radius,
      dy: Math.sin(angle) * radius,
      rot: (Math.random() - 0.5) * 60,
      delay,
      size: 40 + Math.random() * 36,
      duration
    })
  }
  return out
}

export function Applause({ durationMs, phrases }: Props): JSX.Element {
  const burst = useMemo(() => buildBurst(24, durationMs), [durationMs])
  const phrase = useMemo(() => {
    const pool = phrases && phrases.length > 0 ? phrases : DEFAULT_APPLAUSE_PHRASES
    return pool[Math.floor(Math.random() * pool.length)]
  }, [durationMs, phrases])

  return (
    <div className="w-full h-full relative pointer-events-none" style={{ '--duration': `${durationMs}ms` } as React.CSSProperties}>
      <div className="applause-ring" />
      <div className="applause-ring" style={{ animationDelay: '180ms' }} />
      <div className="applause-banner">👏 {phrase}</div>
      {burst.map((e, i) => (
        <span
          key={i}
          className="applause-emoji"
          style={
            {
              fontSize: `${e.size}px`,
              animationDelay: `${e.delay}ms`,
              animationDuration: `${e.duration}ms`,
              ['--dx' as string]: `${e.dx}px`,
              ['--dy' as string]: `${e.dy}px`,
              ['--rot' as string]: `${e.rot}deg`
            } as React.CSSProperties
          }
        >
          {e.char}
        </span>
      ))}
    </div>
  )
}
