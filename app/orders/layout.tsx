'use client'

import AppShell from '@/components/layout/app-shell'
import RouteGuard from '@/components/layout/route-guard'

export default function OrdersLayout({ children }: { children: React.ReactNode }) {
  return (
    <RouteGuard module="orders">
      <AppShell>{children}</AppShell>
    </RouteGuard>
  )
}
