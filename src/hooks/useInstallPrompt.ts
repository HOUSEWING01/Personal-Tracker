import { useSyncExternalStore } from 'react'
import { getInstallState, isIos, promptInstall, subscribeInstall } from '../lib/install'

/** Install availability for the banner and the menu button. */
export function useInstallPrompt() {
  const s = useSyncExternalStore(subscribeInstall, getInstallState, getInstallState)
  const ios = isIos()
  return {
    /** The browser can show its own install dialog. */
    canPrompt: s.canPrompt,
    ios,
    installed: s.installed,
    /** Show an install entry: installable here, or iOS where we can only explain the steps. */
    available: !s.installed && (s.canPrompt || ios),
    promptInstall,
  }
}
