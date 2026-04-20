'use client'

import AppShell from '@/components/layout/app-shell'
import RouteGuard from '@/components/layout/route-guard'

export default function DailyLayout({ children }: { children: React.ReactNode }) {
  return (
    <RouteGuard module="daily">
      <AppShell>{children}</AppShell>
    </RouteGuard>
  )
}
