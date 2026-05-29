type Props = { durationMs: number }

export function RetroSuccess({ durationMs }: Props): JSX.Element {
  return (
    <div className="w-full h-full relative pointer-events-none">
      <div
        className="retro-success"
        style={{ ['--duration' as string]: `${durationMs}ms` } as React.CSSProperties}
      >
        SUCCESS
      </div>
    </div>
  )
}
