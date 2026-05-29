import { useMemo } from 'react'

type Props = { durationMs: number; reducedMotion?: boolean }

const COLORS = ['#ff5fa8', '#7c5cff', '#fcd34d', '#34d399', '#60a5fa', '#f97316', '#ec4899']

type Piece = {
  xPct: number
  yPct: number
  drift: number
  spin: number
  delay: number
  duration: number
  color: string
  width: number
  height: number
  shape: 'rect' | 'ribbon' | 'square'
  rot: number
}

function buildPieces(count: number, durationMs: number): Piece[] {
  const pieces: Piece[] = []
  for (let i = 0; i < count; i++) {
    const isRibbon = Math.random() < 0.25
    pieces.push({
      xPct: Math.random() * 100,
      // Spread vertically so the static frame fills the screen.
      yPct: Math.random() * 95,
      drift: (Math.random() - 0.5) * 240,
      spin: (Math.random() - 0.5) * 1440,
      delay: Math.random() * (durationMs * 0.4),
      duration: durationMs * (0.6 + Math.random() * 0.4),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      width: isRibbon ? 4 : 8 + Math.random() * 8,
      height: isRibbon ? 18 + Math.random() * 14 : 10 + Math.random() * 10,
      shape: isRibbon ? 'ribbon' : Math.random() < 0.3 ? 'square' : 'rect',
      rot: (Math.random() - 0.5) * 360
    })
  }
  return pieces
}

export function Confetti({ durationMs, reducedMotion }: Props): JSX.Element {
  const pieces = useMemo(() => buildPieces(80, durationMs), [durationMs])

  if (reducedMotion) {
    return (
      <div className="w-full h-full relative pointer-events-none overflow-hidden">
        {pieces.map((p, i) => (
          <span
            key={i}
            className="absolute"
            style={{
              left: `${p.xPct}%`,
              top: `${p.yPct}%`,
              width: `${p.width}px`,
              height: `${p.height}px`,
              background: p.color,
              borderRadius: p.shape === 'square' ? '2px' : p.shape === 'ribbon' ? '1px' : '3px',
              transform: `rotate(${p.rot}deg)`
            }}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="w-full h-full relative pointer-events-none overflow-hidden">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={
            {
              left: `${p.xPct}%`,
              width: `${p.width}px`,
              height: `${p.height}px`,
              background: p.color,
              borderRadius: p.shape === 'square' ? '2px' : p.shape === 'ribbon' ? '1px' : '3px',
              animationDelay: `${p.delay}ms`,
              animationDuration: `${p.duration}ms`,
              ['--drift' as string]: `${p.drift}px`,
              ['--spin' as string]: `${p.spin}deg`
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  )
}
