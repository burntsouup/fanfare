import { useMemo } from 'react'

type Props = { durationMs: number; reducedMotion?: boolean }

const EMOJIS = ['🥳', '🎉', '🎊', '🤩', '🎈', '🍾', '🥂', '😎', '💥', '⚡', '🚀']

type Piece = {
  dx: number
  dy: number
  rot: number
  delay: number
  duration: number
  size: number
  char: string
}

function buildPieces(count: number, durationMs: number): Piece[] {
  const pieceMin = 1100
  const pieceMax = 1800
  const spawnWindow = Math.max(0, durationMs - pieceMax)
  const out: Piece[] = []
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2
    const radius = 180 + Math.random() * 240
    const delay = Math.random() * spawnWindow
    const duration = Math.min(
      durationMs - delay,
      pieceMin + Math.random() * (pieceMax - pieceMin)
    )
    out.push({
      dx: Math.cos(angle) * radius,
      dy: Math.sin(angle) * radius,
      rot: (Math.random() - 0.5) * 720,
      delay,
      duration,
      size: 40 + Math.random() * 40,
      char: EMOJIS[Math.floor(Math.random() * EMOJIS.length)]
    })
  }
  return out
}

export function EmojiBurst({ durationMs, reducedMotion }: Props): JSX.Element {
  const pieces = useMemo(() => buildPieces(32, durationMs), [durationMs])

  if (reducedMotion) {
    return (
      <div className="w-full h-full relative pointer-events-none">
        {pieces.map((p, i) => (
          <span
            key={i}
            className="absolute"
            style={{
              left: '50%',
              top: '50%',
              fontSize: `${p.size}px`,
              lineHeight: 1,
              filter: 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.35))',
              transform: `translate(-50%, -50%) translate(${p.dx * 0.65}px, ${p.dy * 0.65}px) rotate(${p.rot * 0.65}deg)`
            }}
          >
            {p.char}
          </span>
        ))}
      </div>
    )
  }

  return (
    <div className="w-full h-full relative pointer-events-none">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="emoji-burst-piece"
          style={
            {
              animationDelay: `${p.delay}ms`,
              animationDuration: `${p.duration}ms`,
              ['--dx' as string]: `${p.dx}px`,
              ['--dy' as string]: `${p.dy}px`,
              ['--rot' as string]: `${p.rot}deg`,
              ['--size' as string]: `${p.size}px`
            } as React.CSSProperties
          }
        >
          {p.char}
        </span>
      ))}
    </div>
  )
}
