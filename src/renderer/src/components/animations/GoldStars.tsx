import { useMemo } from 'react'

type Props = { durationMs: number }

const STARS = ['⭐', '🌟', '✨']

type Star = { dx: number; dy: number; delay: number; duration: number; size: number; glyph: string }

function buildStars(count: number, durationMs: number): Star[] {
  const pieceMin = 1400
  const pieceMax = 2200
  const spawnWindow = Math.max(0, durationMs - pieceMax)
  const out: Star[] = []
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.6
    const radius = 80 + Math.random() * 200
    const delay = Math.random() * spawnWindow
    const duration = Math.min(
      durationMs - delay,
      pieceMin + Math.random() * (pieceMax - pieceMin)
    )
    out.push({
      dx: Math.cos(angle) * radius,
      dy: Math.sin(angle) * radius,
      delay,
      duration,
      size: 36 + Math.random() * 48,
      glyph: STARS[Math.floor(Math.random() * STARS.length)]
    })
  }
  return out
}

export function GoldStars({ durationMs }: Props): JSX.Element {
  const stars = useMemo(() => buildStars(18, durationMs), [durationMs])

  return (
    <div className="w-full h-full relative pointer-events-none">
      {stars.map((s, i) => (
        <span
          key={i}
          className="gold-star"
          style={
            {
              animationDelay: `${s.delay}ms`,
              animationDuration: `${s.duration}ms`,
              ['--dx' as string]: `${s.dx}px`,
              ['--dy' as string]: `${s.dy}px`,
              ['--size' as string]: `${s.size}px`
            } as React.CSSProperties
          }
        >
          {s.glyph}
        </span>
      ))}
    </div>
  )
}
