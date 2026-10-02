import { toast } from './toast'

const CHECK_EVERY_MS = 60_000

/**
 * Registers /sw.js (needed for install) and tells the person when a newer version has been deployed. It never reloads by
 * itself: a reload could throw away a half-filled form, so the toast offers a Refresh button instead.
 */
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return
  // A change of controller with one already in place means a new deploy took over (not just the first install).
  let hadController = Boolean(navigator.serviceWorker.controller)
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) toast.info('A new version is ready.', { duration: 0, action: { label: 'Refresh', onClick: () => window.location.reload() } })
    hadController = true
  })
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      const check = () => { void reg.update().catch(() => { /* offline: try again next time */ }) }
      window.setInterval(check, CHECK_EVERY_MS)
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check() })
    }).catch(() => { /* the app works without it; only installing is affected */ })
  })
}
