import { useState } from 'react'
import { DownloadSimple, DotsThree, DotsThreeVertical, Export, PlusSquare, X, type Icon } from '@phosphor-icons/react'
import { useInstallPrompt } from '../../hooks/useInstallPrompt'
import { dismissInstallBanner, installBannerDismissed, iosBrowser, type IosBrowser } from '../../lib/install'
import { toast } from '../../lib/toast'
import { Dialog, DialogActions } from '../ui/Dialog'
import { buttonPrimary, buttonSecondary } from '../ui/FullScreenMessage'

const IOS_STEPS: Record<IosBrowser, { icon: Icon; text: string }[]> = {
  safari: [
    { icon: Export, text: 'Tap the Share button in the toolbar at the bottom.' },
    { icon: PlusSquare, text: 'Scroll down and tap "Add to Home Screen".' },
    { icon: DownloadSimple, text: 'Tap "Add" in the top-right corner.' },
  ],
  chrome: [
    { icon: Export, text: 'Tap the Share button in the address bar at the top.' },
    { icon: PlusSquare, text: 'Tap "Add to Home Screen".' },
    { icon: DownloadSimple, text: 'Tap "Add" to confirm.' },
  ],
  firefox: [
    { icon: DotsThree, text: 'Tap the menu button at the bottom.' },
    { icon: Export, text: 'Tap "Share".' },
    { icon: PlusSquare, text: 'Tap "Add to Home Screen", then "Add".' },
  ],
  edge: [
    { icon: DotsThreeVertical, text: 'Tap the menu button at the bottom.' },
    { icon: Export, text: 'Tap "Share".' },
    { icon: PlusSquare, text: 'Tap "Add to Home Screen", then "Add".' },
  ],
}

/** iOS has no install API, so this walks through the browser's own steps. */
function IosSteps({ open, onClose }: { open: boolean; onClose: () => void }) {
  const steps = IOS_STEPS[iosBrowser()]
  return (
    <Dialog open={open} onClose={onClose} title="Install Business Admin">
      <p className="text-sm text-muted">Add the app to your home screen to open it full screen, like any other app.</p>
      <ol className="mt-4 flex flex-col gap-3">
        {steps.map(({ icon: StepIcon, text }, i) => (
          <li key={text} className="flex items-start gap-3 text-sm">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-sage-soft text-primary"><StepIcon size={18} aria-hidden /></span>
            <span className="pt-1"><span className="sr-only">Step {i + 1}: </span>{text}</span>
          </li>
        ))}
      </ol>
      <DialogActions><button type="button" className={buttonPrimary} data-autofocus onClick={onClose}>Got it</button></DialogActions>
    </Dialog>
  )
}

/** Runs the install: the browser's dialog where there is one, the iOS steps otherwise. */
function useInstallAction() {
  const { canPrompt, ios, promptInstall } = useInstallPrompt()
  const [steps, setSteps] = useState(false)
  const run = async () => {
    if (canPrompt) { if (await promptInstall()) toast.success('Business Admin is being installed.') }
    else if (ios) setSteps(true)
  }
  return { run, steps, closeSteps: () => setSteps(false) }
}

/** Card at the top of the page. "Not now" hides it for two weeks; the menu button stays available. */
export function InstallAppBanner() {
  const { available } = useInstallPrompt()
  const [hidden, setHidden] = useState(installBannerDismissed)
  const { run, steps, closeSteps } = useInstallAction()
  if (!available || hidden) return <IosSteps open={steps} onClose={closeSteps} />
  const dismiss = () => { dismissInstallBanner(); setHidden(true) }
  return (
    <>
      <section aria-label="Install app" className="mb-5 flex items-start gap-3 rounded-lg border border-line bg-surface p-4">
        <img src="/icons/icon-192.png" alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded-lg" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Install Business Admin</p>
          <p className="mt-0.5 text-sm text-muted">Open it from your home screen or desktop, full screen, without the browser bar.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className={`${buttonPrimary} gap-1.5`} onClick={() => void run()}><DownloadSimple size={16} aria-hidden /> Install</button>
            <button type="button" className={buttonSecondary} onClick={dismiss}>Not now</button>
          </div>
        </div>
        <button type="button" aria-label="Dismiss install suggestion" onClick={dismiss} className="-m-1 shrink-0 rounded-md p-2.5 text-muted hover:bg-canvas hover:text-ink"><X size={16} aria-hidden /></button>
      </section>
      <IosSteps open={steps} onClose={closeSteps} />
    </>
  )
}

/** Always-available entry in the menu, for anyone who tapped "Not now". Hidden once the app is installed. */
export function InstallAppButton({ collapsed = false }: { collapsed?: boolean }) {
  const { available } = useInstallPrompt()
  const { run, steps, closeSteps } = useInstallAction()
  if (!available) return <IosSteps open={steps} onClose={closeSteps} />
  return (
    <>
      <button type="button" onClick={() => void run()} title={collapsed ? 'Install app' : undefined} aria-label={collapsed ? 'Install app' : undefined}
        className={`flex min-h-11 w-full items-center gap-2.5 rounded-md px-2 py-2 text-sm hover:bg-canvas lg:min-h-0 ${collapsed ? 'justify-center' : ''}`}>
        <DownloadSimple size={18} aria-hidden className="shrink-0" /> {!collapsed && 'Install app'}
      </button>
      <IosSteps open={steps} onClose={closeSteps} />
    </>
  )
}
