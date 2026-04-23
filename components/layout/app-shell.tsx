'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { canAccess, isAdmin, isSuperAdmin, getRoleColor } from '@/lib/permissions'
import {
  LayoutDashboard, CalendarDays, Users, Truck, Lock,
  Package, Shield, LogOut, Menu, X, Receipt, ShoppingCart, Coffee
} from 'lucide-react'
import type { AppModule } from '@/types'
import { cn } from '@/lib/utils'

const NAV_ITEMS: { id: AppModule; label: string; href: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Aperçu',        href: '/dashboard', icon: LayoutDashboard },
  { id: 'daily',     label: 'Journée',       href: '/daily',     icon: CalendarDays },
  { id: 'employees', label: 'Équipe',        href: '/employees', icon: Users },
  { id: 'suppliers', label: 'Fournisseurs',  href: '/suppliers', icon: Truck },
  { id: 'orders',    label: 'Commandes',     href: '/orders',    icon: ShoppingCart },
  { id: 'inventory', label: 'Inventaire',    href: '/inventory', icon: Package },
  { id: 'charges',   label: 'Charges',       href: '/charges',   icon: Receipt },
  { id: 'safe',      label: 'Coffre',        href: '/safe',      icon: Lock },
  { id: 'admin',     label: 'Admin',         href: '/admin',     icon: Shield },
]

const ROLE_PILL: Record<string, string> = {
  super_admin: 'bg-amber-500/20 text-amber-400',
  admin:       'bg-brand-500/20 text-brand-400',
  cuisinier:   'bg-orange-500/15 text-orange-400',
  default:     'bg-white/10 text-white/40',
}

const FALLBACK_LOGO = '/logo.png'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  const [logoUrl, setLogoUrl] = useState('')
  const [logoReady, setLogoReady] = useState(false)

  // Lire le localStorage côté client uniquement
  useEffect(() => {
    const cached = localStorage.getItem('lb_logo_url')
    if (cached) {
      setLogoUrl(cached)
    }
    setLogoReady(true)
  }, [])

  // Load logo from DB si pas en cache
// Load logo from DB si pas en cache
useEffect(() => {
  if (!logoReady) return
  if (logoUrl) return

  const fetchLogo = async () => {
    try {
      const { data } = await createClient()
        .from('app_settings')
        .select('value')
        .eq('key', 'logo_url')
        .maybeSingle()

      if (data?.value) {
        setLogoUrl(data.value)
        localStorage.setItem('lb_logo_url', data.value)
      }
    } catch (err) {
      console.error('Failed to load logo:', err)
    }
  }

  fetchLogo()
}, [logoReady, logoUrl])

  // Listen for logo updates from admin panel (cross-tab)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'lb_logo_url' && e.newValue) setLogoUrl(e.newValue)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const logoSrc = logoUrl || FALLBACK_LOGO

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#1D2D2B] flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoSrc}
              alt=""
              className="w-10 h-10 rounded-xl object-contain"
              onError={e => {
                (e.target as HTMLImageElement).replaceWith(
                  Object.assign(document.createElement('span'), {
                    innerHTML: 'U',
                    style: 'font-size:20px;color:#C49A58;font-weight:700',
                  })
                )
              }}
            />
          </div>
          <div className="w-5 h-5 border-2 border-gray-200 border-t-brand-400 rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  const roleName = user?.role?.name || 'default'
  const filteredNav = NAV_ITEMS.filter(item => {
    if (item.id === 'dashboard') return isSuperAdmin(user as any)
    if (item.id === 'admin') return isAdmin(user as any)
    if (item.id === 'charges') return isSuperAdmin(user as any)
    if (roleName === 'cuisinier') return item.id === 'orders' || item.id === 'inventory' || item.id === 'suppliers'
    return canAccess(user as any, item.id)
  })
  const pillClass = ROLE_PILL[roleName] || ROLE_PILL.default

  const SidebarContent = () => (
    <div className="flex flex-col h-full" style={{ background: '#1D2D2B' }}>

      {/* ── Logo ── */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/[0.06]">
        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoSrc}
            alt="UMMI"
            className="w-9 h-9 object-contain rounded-lg"
            onError={e => {
              const img = e.target as HTMLImageElement
              img.style.display = 'none'
              const fallback = document.createElement('div')
              fallback.innerHTML =
                '<span style="color:#C49A58;font-size:18px;font-weight:700;letter-spacing:0.05em">U</span>'
              img.parentElement?.appendChild(fallback.firstChild!)
            }}
          />
        </div>
        <div>
          <p className="text-[15px] font-bold text-white tracking-tight leading-none">UMMI</p>
          <p className="text-[9px] text-white/25 uppercase tracking-[0.15em] font-medium mt-0.5">
            Gestion & Administration
          </p>
        </div>
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {filteredNav.map(item => {
          const isActive =
            pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
          const Icon = item.icon
          return (
            <button
              key={item.id}
              onClick={() => {
                router.push(item.href)
                setMobileOpen(false)
              }}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 text-left',
                isActive
                  ? 'bg-white/10 text-white shadow-inner'
                  : 'text-white/35 hover:text-white/70 hover:bg-white/5'
              )}
            >
              <Icon
                size={17}
                strokeWidth={isActive ? 2.2 : 1.7}
                className={isActive ? 'text-white' : 'text-white/35'}
              />
              <span className={isActive ? 'font-semibold' : ''}>{item.label}</span>
              {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-400" />}
            </button>
          )
        })}
      </nav>

      {/* ── User ── */}
      <div className="px-4 py-4 border-t border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
            style={{ background: getRoleColor(user?.role as any) }}
          >
            {user?.full_name?.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white/80 truncate">{user?.full_name}</p>
            <span
              className={cn(
                'text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full inline-block mt-0.5',
                pillClass
              )}
            >
              {user?.role?.label || user?.role?.name}
            </span>
          </div>
          <button
            onClick={logout}
            className="p-1.5 rounded-lg text-white/20 hover:text-white/60 hover:bg-white/5 transition-colors flex-shrink-0"
            title="Déconnexion"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex bg-gray-50">

      {/* ── Sidebar desktop ── */}
      <aside
        className="hidden lg:flex lg:flex-col lg:w-60 fixed inset-y-0 left-0 z-30 shadow-xl"
        style={{ background: '#1D2D2B' }}
      >
        <SidebarContent />
      </aside>

      {/* ── Mobile top bar ── */}
      <div
        className="lg:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3 shadow-sm"
        style={{ background: '#1D2D2B' }}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoSrc}
              alt=""
              className="w-6 h-6 object-contain rounded"
              onError={e => {
                ;(e.target as HTMLImageElement).style.display = 'none'
              }}
            />
          </div>
          <span className="text-sm font-bold text-white">UMMI</span>
        </div>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* ── Mobile drawer ── */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside
            className="fixed inset-y-0 left-0 w-64 z-50 lg:hidden shadow-2xl"
            style={{ background: '#1D2D2B' }}
          >
            <SidebarContent />
          </aside>
        </>
      )}

      {/* ── Main content ── */}
      <main className="flex-1 lg:pl-60">
        <div className="pt-16 lg:pt-0 min-h-screen">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">{children}</div>
        </div>
      </main>
    </div>
  )
}