import { afterEach, describe, expect, it } from 'vitest'
import { getToasts, MAX_TOASTS, subscribeToasts, toast } from './toast'

afterEach(() => toast.clear())

describe('toast store', () => {
  it('adds toasts with a kind and the default duration for that kind', () => {
    toast.success('Saved')
    toast.error('Failed')
    const [a, b] = getToasts()
    expect([a.kind, a.message, a.duration]).toEqual(['success', 'Saved', 4000])
    expect([b.kind, b.message]).toEqual(['error', 'Failed'])
    expect(b.duration).toBeGreaterThan(a.duration)
  })

  it('replaces an identical message instead of stacking it', () => {
    toast.success('Saved')
    const first = getToasts()[0].id
    toast.success('Saved')
    expect(getToasts()).toHaveLength(1)
    expect(getToasts()[0].id).not.toBe(first)
  })

  it('keeps only the newest few', () => {
    for (let i = 0; i < MAX_TOASTS + 2; i++) toast.info(`m${i}`)
    expect(getToasts()).toHaveLength(MAX_TOASTS)
    expect(getToasts().at(-1)?.message).toBe(`m${MAX_TOASTS + 1}`)
  })

  it('dismisses by id and notifies subscribers', () => {
    let calls = 0
    const off = subscribeToasts(() => { calls++ })
    const id = toast.success('One')
    toast.dismiss(id)
    toast.dismiss(id) // already gone: no extra notification
    off()
    expect(getToasts()).toHaveLength(0)
    expect(calls).toBe(2)
  })
})

describe('toast actions', () => {
  it('keeps an action and allows a sticky toast', () => {
    const onClick = () => {}
    toast.info('New version ready', { duration: 0, action: { label: 'Refresh', onClick } })
    const t = getToasts()[0]
    expect(t.duration).toBe(0)
    expect(t.action?.label).toBe('Refresh')
  })
})
