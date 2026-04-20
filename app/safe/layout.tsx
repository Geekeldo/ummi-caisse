'use client'

import AppShell from '@/components/layout/app-shell'
import RouteGuard from '@/components/layout/route-guard'

export default function SafeLayout({ children }: { children: React.ReactNode }) {
  return (
    <RouteGuard module="safe">
      <AppShell>{children}</AppShell>
    </RouteGuard>
  )
}
