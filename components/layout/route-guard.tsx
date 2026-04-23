'use client'

import { useEffect, useRef } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { useRouter } from 'next/navigation'
import type { AppModule } from '@/types'

function isModuleAllowed(
  roleName: string,
  permissions: string[],
  module: AppModule,
): boolean {
  if (roleName === 'super_admin') return true
  if (roleName === 'cuisinier') return module === 'orders' || module === 'inventory' || module === 'suppliers'
  if (roleName === 'admin') return module !== 'dashboard' && module !== 'charges'
  return permissions.includes(`${module}.read`)
}

function getDefaultRoute(roleName: string): string {
  if (roleName === 'cuisinier') return '/inventory'
  return '/daily'
}

export default function RouteGuard({
  children,
  module,
}: {
  children: React.ReactNode
  module: AppModule
}) {
  const { user, loading, error } = useAuth()
  const router = useRouter()
  const hasRedirected = useRef(false)

  // Reset quand le module change
  useEffect(() => {
    hasRedirected.current = false
  }, [module])

  useEffect(() => {
    if (loading) return
    if (hasRedirected.current) return

    if (!user) {
      hasRedirected.current = true
      router.replace('/login')
      return
    }

    if (user.is_active === false) {
      hasRedirected.current = true
      router.replace('/login')
      return
    }

    const roleName = user.role?.name || ''
    if (!isModuleAllowed(roleName, user.permissions || [], module)) {
      hasRedirected.current = true
      router.replace(getDefaultRoute(roleName))
    }
  }, [user, loading, router, module])

  // ── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-7 h-7 border-2 border-gray-200 border-t-brand-400 rounded-full animate-spin" />
          {error && (
            <p className="text-xs text-gray-400 max-w-xs text-center">{error}</p>
          )}
        </div>
      </div>
    )
  }

  if (!user || hasRedirected.current) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-7 h-7 border-2 border-gray-200 border-t-brand-400 rounded-full animate-spin" />
      </div>
    )
  }

  const roleName = user.role?.name || ''
  if (!isModuleAllowed(roleName, user.permissions || [], module)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-7 h-7 border-2 border-gray-200 border-t-brand-400 rounded-full animate-spin" />
      </div>
    )
  }

  return <>{children}</>
}