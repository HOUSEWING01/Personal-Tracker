import { MutationCache, QueryClient } from '@tanstack/react-query'
import { toast } from './toast'

declare module '@tanstack/react-query' {
  interface Register {
    /** `success` and `error` on a mutation's `meta` raise a toast when it finishes. Forms still show their own inline errors. */
    mutationMeta: { success?: string; error?: string }
  }
}

export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false } },
  mutationCache: new MutationCache({
    onSuccess: (_data, _vars, _ctx, mutation) => { if (mutation.meta?.success) toast.success(mutation.meta.success) },
    onError: (_err, _vars, _ctx, mutation) => { if (mutation.meta?.error) toast.error(mutation.meta.error) },
  }),
})
