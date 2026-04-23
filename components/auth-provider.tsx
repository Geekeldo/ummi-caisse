'use client'

import type { ReactNode } from 'react'
import { AuthContext, useAuthLogic } from '@/hooks/use-auth'

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuthLogic()
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
}