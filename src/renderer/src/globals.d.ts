import type { FanfareSettingsApi } from '../../preload/settings'
import type { OverlayApi } from '../../preload/overlay'

declare global {
  interface Window {
    fanfare: FanfareSettingsApi
    overlay: OverlayApi
  }
}

export {}
