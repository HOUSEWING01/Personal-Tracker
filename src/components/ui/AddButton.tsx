import { Plus } from '@phosphor-icons/react'
import { buttonPrimary } from './FullScreenMessage'

/**
 * The one "Add X" action of a screen. A normal button from sm up; on phones a floating "+" in the corner, so it costs no
 * row above the list and stays under the thumb while scrolling.
 */
export function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <>
      <button type="button" className={`${buttonPrimary} hidden gap-1.5 sm:inline-flex`} onClick={onClick}>
        <Plus size={16} aria-hidden /> {label}
      </button>
      <button
        type="button" aria-label={label} title={label} onClick={onClick}
        className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-[max(1.25rem,env(safe-area-inset-right))] z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg hover:bg-primary-hover active:scale-95 sm:hidden"
      >
        <Plus size={24} weight="bold" aria-hidden />
      </button>
    </>
  )
}
