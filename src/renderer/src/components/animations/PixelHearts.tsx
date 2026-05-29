import { useMemo } from 'react'

type Props = { durationMs: number }

const COLORS = ['#ff5fa8', '#ec4899', '#f43f5e', '#fb7185', '#a855f7', '#ffffff']

type Heart = {
  xPct: number
  yPct: number
  sway: number
  delay: number
  duration: number
  color: string
  scale: number
}

function buildHearts(count: number, durationMs: number): Heart[] {
  const out: Heart[] = []
  for (let i = 0; i < count; i++) {
    out.push({
      xPct: 10 + Math.random() * 80,
      // Spawn anchor in the central band (35%-65% from top) so hearts feel central
      // even as they drift up. The keyframe carries them from +25vh to -32vh from here.
      yPct: 35 + Math.random() * 30,
      sway: (Math.random() - 0.5) * 120,
      delay: Math.random() * (durationMs * 0.6),
      duration: durationMs * (0.6 + Math.random() * 0.4),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      scale: 0.7 + Math.random() * 1.1
    })
  }
  return out
}

export function PixelHearts({ durationMs }: Props): JSX.Element {
  const hearts = useMemo(() => buildHearts(20, durationMs), [durationMs])

  return (
    <div className="w-full h-full relative pointer-events-none overflow-hidden">
      {hearts.map((h, i) => (
        <span
          key={i}
          className="pixel-heart"
          style={
            {
              left: `${h.xPct}%`,
              top: `${h.yPct}%`,
              animationDelay: `${h.delay}ms`,
              animationDuration: `${h.duration}ms`,
              ['--c' as string]: h.color,
              ['--sway' as string]: `${h.sway}px`,
              ['--scale' as string]: h.scale
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  )
}
