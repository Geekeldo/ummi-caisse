'use client'

import AppShell from '@/components/layout/app-shell'
import RouteGuard from '@/components/layout/route-guard'

export default function ChargesLayout({ children }: { children: React.ReactNode }) {
  return (
    <RouteGuard module="charges">
      <AppShell>{children}</AppShell>
    </RouteGuard>
  )
}
