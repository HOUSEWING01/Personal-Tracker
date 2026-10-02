import { afterEach, describe, expect, it, vi } from 'vitest'
import { withTimeout } from './withTimeout'

afterEach(() => vi.useRealTimers())

describe('withTimeout', () => {
  it('passes through a fast result', async () => {
    await expect(withTimeout(Promise.resolve(42), 1000, 'slow')).resolves.toBe(42)
  })
  it('passes through a fast failure unchanged', async () => {
    await expect(withTimeout(Promise.reject(new Error('boom')), 1000, 'slow')).rejects.toThrow('boom')
  })
  it('rejects with the message when the work never settles', async () => {
    vi.useFakeTimers()
    const p = withTimeout(new Promise<never>(() => {}), 1000, 'took too long')
    const assertion = expect(p).rejects.toThrow('took too long')
    await vi.advanceTimersByTimeAsync(1000)
    await assertion
  })
})
