import { useEffect, useState } from 'react'
import type { TriggerPayload } from '@shared/types'
import { Applause } from './animations/Applause'
import { Confetti } from './animations/Confetti'
import { Fireworks } from './animations/Fireworks'
import { PixelHearts } from './animations/PixelHearts'
import { Correct } from './animations/Correct'
import { GoldStars } from './animations/GoldStars'
import { RetroSuccess } from './animations/RetroSuccess'
import { EmojiBurst } from './animations/EmojiBurst'
import { PixelCrowd } from './animations/PixelCrowd'

type ActiveTrigger = TriggerPayload & { key: number }

// A static frame doesn't earn the user's full durationMs.
const REDUCED_MOTION_MAX_HOLD_MS = 2500

export function OverlayApp(): JSX.Element {
  const [active, setActive] = useState<ActiveTrigger | null>(null)

  useEffect(() => {
    let nextKey = 0
    return window.overlay.onTrigger((payload) => {
      nextKey += 1
      setActive({ ...payload, key: nextKey })
    })
  }, [])

  useEffect(() => {
    if (!active) return
    const hold = active.reducedMotion
      ? Math.min(active.durationMs, REDUCED_MOTION_MAX_HOLD_MS)
      : active.durationMs + 100
    const t = window.setTimeout(() => setActive(null), hold)
    return () => window.clearTimeout(t)
  }, [active])

  if (!active) return <div className="w-full h-full" />

  return (
    <div
      className="w-full h-full relative overflow-hidden"
      data-static={active.reducedMotion ? '' : undefined}
    >
      <div role="status" aria-live="polite" className="sr-only">
        {active.reactionName} triggered
      </div>
      <PositionedStage key={active.key} position={active.position} animationKey={active.animationKey}>
        {renderAnimation(active.animationKey, active.durationMs, active.reducedMotion, active.phrases)}
      </PositionedStage>
    </div>
  )
}

function renderAnimation(
  key: string,
  durationMs: number,
  reducedMotion: boolean,
  phrases?: string[]
): JSX.Element | null {
  switch (key) {
    case 'applause':
      return <Applause durationMs={durationMs} phrases={phrases} />
    case 'confetti':
      return <Confetti durationMs={durationMs} reducedMotion={reducedMotion} />
    case 'fireworks':
      return <Fireworks durationMs={durationMs} reducedMotion={reducedMotion} />
    case 'pixel-hearts':
      return <PixelHearts durationMs={durationMs} />
    case 'correct':
      return <Correct durationMs={durationMs} />
    case 'gold-stars':
      return <GoldStars durationMs={durationMs} />
    case 'retro-success':
      return <RetroSuccess durationMs={durationMs} />
    case 'emoji-burst':
      return <EmojiBurst durationMs={durationMs} reducedMotion={reducedMotion} />
    case 'pixel-crowd':
      return <PixelCrowd durationMs={durationMs} />
    default:
      console.warn('[fanfare] unknown animation key:', key)
      return null
  }
}

function PositionedStage({
  position,
  animationKey,
  children
}: {
  position: TriggerPayload['position']
  animationKey: string
  children: React.ReactNode
}): JSX.Element {
  const fullScreen = ['confetti', 'fireworks', 'pixel-hearts', 'pixel-crowd'].includes(
    animationKey
  )
  if (fullScreen) {
    return <div className="absolute inset-0">{children}</div>
  }

  let style: React.CSSProperties
  switch (position) {
    case 'bottom-right':
      style = { position: 'absolute', right: '6%', bottom: '8%', width: 520, height: 360 }
      break
    case 'random': {
      const xPct = 10 + Math.random() * 70
      const yPct = 10 + Math.random() * 60
      style = {
        position: 'absolute',
        left: `${xPct}%`,
        top: `${yPct}%`,
        width: 520,
        height: 360
      }
      break
    }
    case 'center':
    default:
      style = {
        position: 'absolute',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        width: 600,
        height: 400
      }
  }
  return <div style={style}>{children}</div>
}
