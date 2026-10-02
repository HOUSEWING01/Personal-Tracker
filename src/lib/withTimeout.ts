/** Rejects if `work` has not settled within `ms`, so a stuck network call becomes a visible, retryable error. */
export function withTimeout<T>(work: PromiseLike<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => reject(new Error(message)), ms)
    Promise.resolve(work).then(
      (v) => { clearTimeout(id); resolve(v) },
      (e: unknown) => { clearTimeout(id); reject(e) },
    )
  })
}
