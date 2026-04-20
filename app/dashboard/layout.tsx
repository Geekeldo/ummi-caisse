'use client'

import AppShell from '@/components/layout/app-shell'
import RouteGuard from '@/components/layout/route-guard'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <RouteGuard module="dashboard">
      <AppShell>{children}</AppShell>
    </RouteGuard>
  )
}
