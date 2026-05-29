import { useMemo } from 'react'

type Props = { durationMs: number; reducedMotion?: boolean }

const PALETTES = [
  ['#ff5fa8', '#fcd34d', '#ffffff'],
  ['#7c5cff', '#60a5fa', '#ffffff'],
  ['#34d399', '#fde047', '#ffffff'],
  ['#f97316', '#ec4899', '#ffffff']
]

type Spark = { dx: number; dy: number; delay: number; color: string; duration: number }
type Burst = {
  xPct: number
  yPct: number
  fireAt: number
  sparks: Spark[]
}

function buildBursts(durationMs: number): Burst[] {
  const burstCount = 4
  const bursts: Burst[] = []
  for (let b = 0; b < burstCount; b++) {
    const palette = PALETTES[b % PALETTES.length]
    const sparks: Spark[] = []
    const sparkCount = 28
    for (let i = 0; i < sparkCount; i++) {
      const angle = (i / sparkCount) * Math.PI * 2 + Math.random() * 0.2
      const radius = 140 + Math.random() * 100
      sparks.push({
        dx: Math.cos(angle) * radius,
        dy: Math.sin(angle) * radius,
        delay: Math.random() * 80,
        color: palette[Math.floor(Math.random() * palette.length)],
        duration: 900 + Math.random() * 500
      })
    }
    bursts.push({
      xPct: 20 + Math.random() * 60,
      yPct: 20 + Math.random() * 50,
      fireAt: b * (durationMs / (burstCount + 1)) * 0.6 + Math.random() * 200,
      sparks
    })
  }
  return bursts
}

export function Fireworks({ durationMs, reducedMotion }: Props): JSX.Element {
  const bursts = useMemo(() => buildBursts(durationMs), [durationMs])

  if (reducedMotion) {
    return (
      <div className="w-full h-full relative pointer-events-none overflow-hidden">
        {bursts.map((burst, bi) => (
          <div
            key={bi}
            className="absolute"
            style={{ left: `${burst.xPct}%`, top: `${burst.yPct}%`, width: 0, height: 0 }}
          >
            {burst.sparks.map((s, si) => (
              <span
                key={si}
                className="absolute"
                style={{
                  left: '50%',
                  top: '50%',
                  width: 6,
                  height: 6,
                  borderRadius: 9999,
                  background: s.color,
                  color: s.color,
                  boxShadow: `0 0 8px ${s.color}, 0 0 16px ${s.color}`,
                  transform: `translate(-50%, -50%) translate(${s.dx * 0.7}px, ${s.dy * 0.7}px)`
                }}
              />
            ))}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="w-full h-full relative pointer-events-none overflow-hidden">
      {bursts.map((burst, bi) => (
        <div
          key={bi}
          className="firework-burst"
          style={{ left: `${burst.xPct}%`, top: `${burst.yPct}%` }}
        >
          {burst.sparks.map((s, si) => (
            <span
              key={si}
              className="firework-spark"
              style={
                {
                  color: s.color,
                  background: s.color,
                  animationDelay: `${burst.fireAt + s.delay}ms`,
                  animationDuration: `${s.duration}ms`,
                  ['--dx' as string]: `${s.dx}px`,
                  ['--dy' as string]: `${s.dy}px`
                } as React.CSSProperties
              }
            />
          ))}
        </div>
      ))}
    </div>
  )
}
