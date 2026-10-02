import { afterEach, describe, expect, it, vi } from 'vitest'
import { dismissInstallBanner, installBannerDismissed, iosBrowser } from './install'

const DAY = 86_400_000

describe('iosBrowser', () => {
  it('tells the iOS browsers apart, checking the specific tokens before "Safari"', () => {
    const base = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)'
    expect(iosBrowser(`${base} Version/17.0 Mobile/15E148 Safari/604.1`)).toBe('safari')
    expect(iosBrowser(`${base} CriOS/120.0 Mobile/15E148 Safari/604.1`)).toBe('chrome')
    expect(iosBrowser(`${base} FxiOS/120.0 Mobile/15E148 Safari/605.1.15`)).toBe('firefox')
    expect(iosBrowser(`${base} EdgiOS/120.0 Version/17.0 Mobile/15E148 Safari/604.1`)).toBe('edge')
  })
})

describe('install banner dismissal', () => {
  afterEach(() => vi.unstubAllGlobals())

  function fakeStorage() {
    const data = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) })
  }

  it('stays hidden for two weeks, then shows again', () => {
    fakeStorage()
    const t0 = Date.UTC(2026, 9, 3)
    expect(installBannerDismissed(t0)).toBe(false)
    dismissInstallBanner(t0)
    expect(installBannerDismissed(t0 + 13 * DAY)).toBe(true)
    expect(installBannerDismissed(t0 + 15 * DAY)).toBe(false)
  })

  it('does not throw when storage is unavailable', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } })
    expect(installBannerDismissed()).toBe(false)
    expect(() => dismissInstallBanner()).not.toThrow()
  })
})
