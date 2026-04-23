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

// ─── Types ─────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string
  email: string
  full_name: string
  role_id: string
  role: {
    id: string
    name: string
    label: string
    color: string
    permissions: string[]
    is_system?: boolean
  } | null
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

// ─── Helpers ───────────────────────────────────────────────────────────────

function getRedirectPath(roleName: string): string {
  switch (roleName) {
    case 'super_admin':
      return '/dashboard'
    case 'cuisinier':
      return '/inventory'
    default:
      return '/daily'
  }
}

// ─── Hook principal ────────────────────────────────────────────────────────

export function useAuthLogic(): AuthContextValue {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  // Lazy ref : createClient() n'est appelé qu'une seule fois
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)
  if (!supabaseRef.current) supabaseRef.current = createClient()
  const supabase = supabaseRef.current

  // Ref pour éviter les race conditions sur les loads concurrents
  const loadIdRef = useRef(0)

  // Flag : login() est en cours, le listener ne doit pas interférer
  const loginInProgressRef = useRef(false)

  // ── loadProfile ──────────────────────────────────────────────────────────

  const loadProfile = useCallback(
    async (
      session: { user: { id: string; email?: string } } | null,
    ): Promise<AuthUser | null> => {
      if (!session?.user) return null

      try {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*, role:roles(*)')
          .eq('id', session.user.id)
          .single()

        if (profileError || !profile) {
          console.error('loadProfile: query error', profileError)
          return null
        }

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
      } catch (e) {
        console.error('loadProfile error:', e)
        return null
      }
    },
    [supabase],
  )

  // ── Auth initialization ──────────────────────────────────────────────────

  useEffect(() => {
    let mounted = true

    const getInitialSession = async () => {
      const currentLoadId = ++loadIdRef.current

      try {
        const sessionPromise = supabase.auth
          .getSession()
          .then((r) => r.data.session)

        const timeoutPromise = new Promise<null>((resolve) =>
          setTimeout(() => resolve(null), 5_000),
        )

        const session = await Promise.race([sessionPromise, timeoutPromise])

        if (!mounted || currentLoadId !== loadIdRef.current) return

        if (session) {
          const authUser = await loadProfile(session)
          if (!mounted || currentLoadId !== loadIdRef.current) return
          setUser(authUser)
          setError(null)
        } else {
          setUser(null)
        }
      } catch (e) {
        console.error('Auth init error:', e)
        if (mounted) setError('Erreur de connexion — rechargez la page')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    getInitialSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return
      if (event === 'INITIAL_SESSION') return

      // Si login() est en cours, il gère tout lui-même
      if (loginInProgressRef.current && event === 'SIGNED_IN') return

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (!session) return
        const currentLoadId = ++loadIdRef.current
        const authUser = await loadProfile(session)
        if (!mounted || currentLoadId !== loadIdRef.current) return
        if (authUser) {
          setUser(authUser)
          setError(null)
        }
        setLoading(false)
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
        setError(null)
        setLoading(false)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [loadProfile, supabase])

  // ── login ────────────────────────────────────────────────────────────────

  const login = useCallback(
    async (email: string, password: string): Promise<boolean> => {
      setLoading(true)
      setError(null)
      loginInProgressRef.current = true

      try {
        const { data, error: signInError } =
          await supabase.auth.signInWithPassword({ email, password })

        if (signInError) {
          setError(
            signInError.message === 'Invalid login credentials'
              ? 'Email ou mot de passe incorrect'
              : signInError.message,
          )
          return false
        }

        if (!data.session) {
          setError('Session introuvable après connexion')
          return false
        }

        const authUser = await loadProfile(data.session)

        if (!authUser) {
          setError('Profil introuvable — contactez un administrateur')
          await supabase.auth.signOut()
          return false
        }

        if (authUser.is_active === false) {
          setError('Votre compte est désactivé')
          await supabase.auth.signOut()
          return false
        }

        setUser(authUser)

        const roleName = authUser.role?.name || ''
        router.push(getRedirectPath(roleName))
        return true
      } catch (e) {
        console.error('Login error:', e)
        setError('Erreur inattendue — réessayez')
        return false
      } finally {
        setLoading(false)
        loginInProgressRef.current = false
      }
    },
    [supabase, router, loadProfile],
  )

  // ── logout ───────────────────────────────────────────────────────────────

  const logout = useCallback(async () => {
    setUser(null)
    setError(null)
    try {
      await supabase.auth.signOut()
    } catch (e) {
      console.error('Logout error:', e)
    } finally {
      router.push('/login')
    }
  }, [supabase, router])

  // ── refreshUser ──────────────────────────────────────────────────────────

  const refreshUser = useCallback(async (): Promise<AuthUser | null> => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        setUser(null)
        return null
      }

      const authUser = await loadProfile(session)
      setUser(authUser)
      return authUser
    } catch (e) {
      console.error('refreshUser error:', e)
      return null
    }
  }, [supabase, loadProfile])

  // ── Permission helpers ───────────────────────────────────────────────────

  const can = useCallback(
    (permission: string): boolean => {
      if (!user?.permissions) return false
      if (user.permissions.includes('super_admin')) return true
      return user.permissions.includes(permission)
    },
    [user],
  )

  const canAny = useCallback(
    (...permissions: string[]): boolean => permissions.some((p) => can(p)),
    [can],
  )

  // ── Valeur du contexte ───────────────────────────────────────────────────

  return useMemo<AuthContextValue>(
    () => ({ user, loading, error, login, logout, refreshUser, can, canAny }),
    [user, loading, error, login, logout, refreshUser, can, canAny],
  )
}

// ─── Consumer hook ─────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within <AuthProvider>')
  }
  return context
}