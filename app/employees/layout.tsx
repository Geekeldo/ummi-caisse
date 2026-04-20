'use client'

import AppShell from '@/components/layout/app-shell'
import RouteGuard from '@/components/layout/route-guard'

export default function EmployeesLayout({ children }: { children: React.ReactNode }) {
  return (
    <RouteGuard module="employees">
      <AppShell>{children}</AppShell>
    </RouteGuard>
  )
}
