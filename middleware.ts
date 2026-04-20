import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// ── Timeout wrapper ─────────────────────────────────────────────
// Supabase's getUser() does a network round-trip to verify the JWT.
// If the network is slow or Supabase is hanging, middleware would
// block forever and the page never loads (no error shown to user).
// A short timeout lets us fall back to "no session" → redirect to login.
function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>(resolve => setTimeout(() => resolve(fallback), ms)),
  ])
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // 4s is long enough for a healthy round-trip, short enough that users
  // don't sit on a blank page if Supabase/network is struggling.
  const { data: { user } } = await withTimeout(
    supabase.auth.getUser(),
    4000,
    { data: { user: null }, error: null } as any
  )

  const pathname = request.nextUrl.pathname
  const isAuthPage = pathname === '/login'
  const isRoot = pathname === '/'
  const isProtected = !isAuthPage && !isRoot

  if (user && (isAuthPage || isRoot)) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  if (!user && isProtected) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (!user && isRoot) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|api/|manifest\\.json|icon-.*\\.png|logo\\.png|.*\\.webmanifest).*)'],
}
