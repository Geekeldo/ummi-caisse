'use client'

import AppShell from '@/components/layout/app-shell'
import RouteGuard from '@/components/layout/route-guard'

export default function InventoryLayout({ children }: { children: React.ReactNode }) {
  return (
    <RouteGuard module="inventory">
      <AppShell>{children}</AppShell>
    </RouteGuard>
  )
}
