/**
 * "Install the app" state (PWA). Chrome, Edge and Android fire `beforeinstallprompt` once, often before React mounts,
 * so `initInstall()` runs from main.tsx and keeps the event until a button uses it. iOS never fires it: there the only
 * route is Share > Add to Home Screen, so we detect iOS and show steps instead.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

export type IosBrowser = 'safari' | 'chrome' | 'firefox' | 'edge'
export interface InstallState { canPrompt: boolean; installed: boolean }

const DISMISS_KEY = 'install-banner-dismissed-at'
const DISMISS_DAYS = 14

let deferred: BeforeInstallPromptEvent | null = null
let state: InstallState = { canPrompt: false, installed: false }
const listeners = new Set<() => void>()
const set = (next: Partial<InstallState>) => { state = { ...state, ...next }; listeners.forEach((l) => l()) }

export const isStandalone = (): boolean =>
  typeof window !== 'undefined'
  && (window.matchMedia?.('(display-mode: standalone)').matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true)

export function isIos(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && typeof document !== 'undefined' && 'ontouchend' in document)
}

/** Every iOS browser is WebKit, but each puts the Share button somewhere different. Chrome, Firefox and Edge also say "Safari". */
export function iosBrowser(ua = navigator.userAgent): IosBrowser {
  if (ua.includes('CriOS')) return 'chrome'
  if (ua.includes('FxiOS')) return 'firefox'
  if (ua.includes('EdgiOS')) return 'edge'
  return 'safari'
}

let started = false
export function initInstall() {
  if (started || typeof window === 'undefined') return
  started = true
  state = { canPrompt: false, installed: isStandalone() }
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault() // hide the browser's own mini-bar; our banner and menu button call prompt() on a tap
    deferred = e as BeforeInstallPromptEvent
    set({ canPrompt: true })
  })
  window.addEventListener('appinstalled', () => { deferred = null; set({ canPrompt: false, installed: true }) })
  window.matchMedia?.('(display-mode: standalone)').addEventListener?.('change', (e) => set({ installed: e.matches }))
}

export const subscribeInstall = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l) } }
export const getInstallState = () => state

/** Opens the browser's install dialog. Resolves true when the person accepted. The event works once. */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false
  const ev = deferred
  deferred = null
  set({ canPrompt: false })
  await ev.prompt()
  return (await ev.userChoice).outcome === 'accepted'
}

export function installBannerDismissed(now = Date.now()): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY))
    return Boolean(at) && now - at < DISMISS_DAYS * 86_400_000
  } catch { return false }
}
export function dismissInstallBanner(now = Date.now()) {
  try { localStorage.setItem(DISMISS_KEY, String(now)) } catch { /* private mode: it just shows again next visit */ }
}
