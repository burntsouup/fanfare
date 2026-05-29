import { useMemo } from 'react'

type Props = { durationMs: number }

// "Pixel crowd" using cheering people emojis as the figures — chunky and readable.
const FIGURES = ['🙋', '🙌', '🙋‍♂️', '🙋‍♀️', '🙆', '🤾', '🙌']

type Figure = { char: string; delay: number }

function buildRow(count: number): Figure[] {
  const out: Figure[] = []
  for (let i = 0; i < count; i++) {
    out.push({
      char: FIGURES[Math.floor(Math.random() * FIGURES.length)],
      // Stagger the arm-bounce animation so the crowd doesn't move in unison
      delay: Math.random() * -400
    })
  }
  return out
}

export function PixelCrowd({ durationMs }: Props): JSX.Element {
  const row = useMemo(() => buildRow(10), [])

  return (
    <div className="w-full h-full relative pointer-events-none">
      <div
        className="crowd-row"
        style={{ ['--duration' as string]: `${durationMs}ms` } as React.CSSProperties}
      >
        {row.map((f, i) => (
          <span
            key={i}
            className="crowd-figure"
            style={{ animationDelay: `${f.delay}ms` }}
          >
            {f.char}
          </span>
        ))}
      </div>
    </div>
  )
}
