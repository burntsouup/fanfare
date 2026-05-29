import { useMemo } from 'react'

type Props = { durationMs: number }

const SPARKLE_GLYPHS = ['✨', '⭐', '🌟', '💫']

type Sparkle = { dx: number; dy: number; delay: number; duration: number; glyph: string }

function buildSparkles(count: number): Sparkle[] {
  const out: Sparkle[] = []
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5
    const radius = 220 + Math.random() * 140
    out.push({
      dx: Math.cos(angle) * radius,
      dy: Math.sin(angle) * radius,
      delay: 100 + Math.random() * 600,
      duration: 900 + Math.random() * 600,
      glyph: SPARKLE_GLYPHS[Math.floor(Math.random() * SPARKLE_GLYPHS.length)]
    })
  }
  return out
}

export function Correct({ durationMs }: Props): JSX.Element {
  const sparkles = useMemo(() => buildSparkles(14), [])

  return (
    <div
      className="w-full h-full relative pointer-events-none"
      style={{ ['--duration' as string]: `${durationMs}ms` } as React.CSSProperties}
    >
      <div className="correct-card">CORRECT!</div>
      {sparkles.map((s, i) => (
        <span
          key={i}
          className="correct-sparkle"
          style={
            {
              animationDelay: `${s.delay}ms`,
              animationDuration: `${s.duration}ms`,
              ['--dx' as string]: `${s.dx}px`,
              ['--dy' as string]: `${s.dy}px`
            } as React.CSSProperties
          }
        >
          {s.glyph}
        </span>
      ))}
    </div>
  )
}
