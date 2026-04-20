// hooks/use-auth.ts
'use client'

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export interface AuthUser {
  id: string
  email: string
  full_name: string
  role_id: string
  role?: {
    id: string
    name: string
    label: string
    color: string
    permissions: string[]
    is_system?: boolean
  }
  permissions: string[]
  is_active?: boolean
}

export interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  error: string | null
  login: (email: string, password: string) => Promise<boolean>
  logout: () => Promise<void>
  refreshUser: () => Promise<AuthUser | null>
  can: (permission: string) => boolean
  canAny: (...permissions: string[]) => boolean
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuthLogic() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = useRef(createClient()).current

  const loadProfile = useCallback(async (session: any): Promise<AuthUser | null> => {
    if (!session?.user) return null

    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*, role:roles(*)')
        .eq('id', session.user.id)
        .single()

      if (profileError || !profile) return null

      const rolePerms = Array.isArray(profile.role?.permissions)
        ? (profile.role.permissions as string[])
        : []

      return {
        id: profile.id,
        email: profile.email || session.user.email || '',
        full_name: profile.full_name || '',
        role_id: profile.role_id,
        role: profile.role || null,
        permissions: rolePerms,
        is_active: profile.is_active,
      }
    } catch {
      return null
    }
  }, [supabase])

  // ── Auth initialization ──
  // Two-part approach:
  // 1) getSession() for immediate init (resilient lock handles conflicts)
  // 2) onAuthStateChange for subsequent events (sign-in, sign-out, token refresh)
  // No initDone ref — React cleanup handles unsubscription naturally.
  useEffect(() => {
    let mounted = true

    // Part 1: Get initial session directly
    // Race against a timeout so a hung Supabase call can't freeze the
    // loading screen indefinitely on refresh (root cause of "page doesn't
    // load on refresh, no error"). After the timeout we fall back to
    // no-session, and the middleware redirect will handle the rest.
    const getInitialSession = async () => {
      try {
        const sessionPromise = supabase.auth.getSession().then(r => r.data.session)
        const timeoutPromise = new Promise<null>(resolve =>
          setTimeout(() => resolve(null), 5000)
        )
        const session = await Promise.race([sessionPromise, timeoutPromise])
        if (!mounted) return

        if (session) {
          const authUser = await loadProfile(session)
          if (!mounted) return
          setUser(authUser)
          setError(null)
        }
      } catch (e) {
        console.error('Auth init error:', e)
        if (mounted) setError('Erreur de connexion — rechargez la page')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    getInitialSession()

    // Part 2: Listen for auth state changes (sign-in, sign-out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return

        // Skip INITIAL_SESSION — getInitialSession() handles it
        if (event === 'INITIAL_SESSION') return

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (session) {
            const authUser = await loadProfile(session)
            if (!mounted) return
            if (authUser) {
              setUser(prev => {
                if (prev?.id === authUser.id && prev?.role_id === authUser.role_id) return prev
                return authUser
              })
              setError(null)
            }
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
        }
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [loadProfile, supabase])

  const login = useCallback(
    async (email: string, password: string): Promise<boolean> => {
      setLoading(true)
      setError(null)

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        setError(
          signInError.message === 'Invalid login credentials'
            ? 'Email ou mot de passe incorrect'
            : signInError.message
        )
        setLoading(false)
        return false
      }

      // onAuthStateChange will fire SIGNED_IN and load the profile.
      // Wait a moment for it to resolve, then redirect.
      await new Promise(r => setTimeout(r, 300))

      const roleName = user?.role?.name || ''
      if (roleName === 'super_admin') {
        router.push('/dashboard')
      } else if (roleName === 'cuisinier') {
        router.push('/inventory')
      } else {
        router.push('/daily')
      }
      return true
    },
    [supabase, router, user]
  )

  const logout = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
    router.push('/login')
  }, [supabase, router])

  const refreshUser = useCallback(async (): Promise<AuthUser | null> => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return null
      const authUser = await loadProfile(session)
      if (authUser) setUser(authUser)
      return authUser
    } catch {
      return null
    }
  }, [supabase, loadProfile])

  const can = useCallback(
    (permission: string): boolean => {
      if (!user?.permissions) return false
      if (user.permissions.includes('super_admin')) return true
      return user.permissions.includes(permission)
    },
    [user]
  )

  const canAny = useCallback(
    (...permissions: string[]): boolean => permissions.some(p => can(p)),
    [can]
  )

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, error, login, logout, refreshUser, can, canAny }),
    [user, loading, error, login, logout, refreshUser, can, canAny]
  )

  return value
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within <AuthProvider>')
  }
  return context
}
