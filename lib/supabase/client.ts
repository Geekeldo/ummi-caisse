import { createBrowserClient } from '@supabase/ssr'

// ── Resilient navigator lock ─────────────────────────────────
// The default Supabase lock throws NavigatorLockAcquireTimeoutError
// when multiple tabs or rapid navigations compete for the same lock.
// This custom lock catches those errors and retries gracefully.
async function resilientLock<R>(
  name: string,
  acquireTimeout: number,
  fn: () => Promise<R>
): Promise<R> {
  if (typeof navigator === 'undefined' || !navigator.locks) {
    // No navigator.locks support — run without lock
    return fn()
  }

  const abortController = new AbortController()
  if (acquireTimeout > 0) {
    setTimeout(() => abortController.abort(), acquireTimeout)
  }

  try {
    return await navigator.locks.request(
      name,
      acquireTimeout === 0 ? { ifAvailable: true } : { signal: abortController.signal },
      async (lock) => {
        if (!lock) {
          // ifAvailable was true but lock not available — run anyway
          return fn()
        }
        return fn()
      }
    )
  } catch {
    // Lock timed out or was aborted — run the function anyway
    // rather than throwing and breaking the auth flow
    return fn()
  }
}

// ── Client-side singleton ─────────────────────────────────────
let _instance: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'

  if (typeof window !== 'undefined') {
    if (!_instance) {
      _instance = createBrowserClient(url, key, {
        auth: {
          lock: resilientLock,
        },
      } as any)
    }
    return _instance
  }

  return createBrowserClient(url, key)
}
