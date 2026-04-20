'use client'

import AppShell from '@/components/layout/app-shell'
import RouteGuard from '@/components/layout/route-guard'

export default function SuppliersLayout({ children }: { children: React.ReactNode }) {
  return (
    <RouteGuard module="suppliers">
      <AppShell>{children}</AppShell>
    </RouteGuard>
  )
}
