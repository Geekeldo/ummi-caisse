import type { AppUser, Role, AppModule } from '@/types'

export function hasPermission(user: AppUser | null, permissionKey: string): boolean {
  if (!user?.role) return false
  if (user.role.name === 'super_admin') return true
  return user.role.permissions.includes(permissionKey)
}

export function canAccess(user: AppUser | null, module: AppModule): boolean {
  return hasPermission(user, `${module}.read`)
}

export function canWrite(user: AppUser | null, module: AppModule): boolean {
  return hasPermission(user, `${module}.write`)
}

export function isSuperAdmin(user: AppUser | null): boolean {
  return user?.role?.name === 'super_admin'
}

export function isAdmin(user: AppUser | null): boolean {
  return user?.role?.name === 'super_admin' || user?.role?.name === 'admin'
}

export function getRoleColor(role?: Role): string {
  return role?.color ?? '#6B7280'
}
