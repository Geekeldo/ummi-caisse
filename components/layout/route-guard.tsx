'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { useRouter } from 'next/navigation'
import type { AppModule } from '@/types'

// ── Permission rules (single source of truth) ─────────────────────────────
// super_admin : all modules
// admin       : all EXCEPT dashboard and charges
// cuisinier   : orders and inventory ONLY
// others      : based on DB permissions (${module}.read)

function isModuleAllowed(roleName: string, permissions: string[], module: AppModule): boolean {
  if (roleName === 'super_admin') return true

  if (roleName === 'cuisinier') {
    return module === 'orders' || module === 'inventory'
  }

  if (roleName === 'admin') {
    if (module === 'dashboard' || module === 'charges') return false
    return true
  }

  // Serveur / other roles: check DB permissions
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
  const [redirecting, setRedirecting] = useState(false)

  useEffect(() => {
    if (loading) return

    if (!user) {
      setRedirecting(true)
      router.replace('/login')
      return
    }

    if (user.is_active === false) {
      setRedirecting(true)
      router.replace('/login')
      return
    }

    const roleName = user.role?.name || ''
    if (!isModuleAllowed(roleName, user.permissions || [], module)) {
      setRedirecting(true)
      router.replace(getDefaultRoute(roleName))
    }
  }, [user, loading, router, module])

  // Loading or redirecting — always show spinner, never a blank white screen
  if (loading || redirecting || !user) {
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
