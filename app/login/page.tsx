'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Loader2, Coffee } from 'lucide-react'

export default function LoginPage() {
  const supabase = useRef(createClient()).current
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [logoUrl, setLogoUrl] = useState<string>(() =>
    typeof window !== 'undefined' ? (localStorage.getItem('lb_logo_url') || '') : ''
  )
  const router = useRouter()

  useEffect(() => {
    if (logoUrl) return
    createClient()
      .from('app_settings').select('value').eq('key', 'logo_url').single()
      .then(({ data }) => { if (data?.value) { setLogoUrl(data.value); localStorage.setItem('lb_logo_url', data.value) } })
  }, [logoUrl])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message === 'Invalid login credentials'
        ? 'Email ou mot de passe incorrect'
        : error.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex">

      {/* ── Left panel: brand ─────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[52%] flex-col items-center justify-center relative overflow-hidden"
        style={{ background: '#1D2D2B' }}>

        {/* Subtle radial glow (gold) */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 60%, rgba(184,149,106,0.12) 0%, transparent 70%)' }} />

        {/* Grid texture */}
        <div className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)',
            backgroundSize: '40px 40px'
          }} />

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center text-center px-12">
          {/* Logo */}
          <div className="mb-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoUrl || '/logo.png'}
              alt="UMMI"
              className="w-48 h-48 rounded-3xl object-contain"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          </div>

          <div className="space-y-2">
            <p className="text-white/30 text-xs uppercase tracking-[0.25em] font-medium">
              Système de gestion
            </p>
            <p className="text-white/15 text-xs max-w-xs">
              Caisse · Stock · Équipe · Commandes
            </p>
          </div>
        </div>

        {/* Bottom tag */}
        <p className="absolute bottom-8 text-white/15 text-[11px] tracking-wider">
          UMMI
        </p>
      </div>

      {/* ── Right panel: form ─────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 bg-gray-50">

        {/* Mobile logo */}
        <div className="lg:hidden mb-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#1D2D2B] mb-3 shadow-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoUrl || '/logo.png'}
              alt="UMMI"
              className="w-14 h-14 rounded-xl object-contain"
              onError={e => {
                const el = e.target as HTMLImageElement
                el.style.display = 'none'
                el.parentElement!.innerHTML = '<span style="color:#C49A58;font-size:22px;font-weight:700">U</span>'
              }}
            />
          </div>
          <h1 className="text-xl font-bold text-gray-900">UMMI</h1>
          <p className="text-xs text-gray-400 uppercase tracking-widest mt-0.5">Gestion</p>
        </div>

        {/* Form card */}
        <div className="w-full max-w-sm">
          <div className="mb-6">
            <h2 className="text-2xl font-bold tracking-tight text-gray-900">Connexion</h2>
            <p className="text-sm text-gray-400 mt-1">Entrez vos identifiants pour accéder au tableau de bord</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="input-field h-11"
                placeholder="salah@ummi.ma"
                required
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Mot de passe</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="input-field h-11 pr-10"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm">
                <span className="flex-shrink-0 w-4 h-4 rounded-full bg-red-100 flex items-center justify-center text-[10px] font-bold">!</span>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full h-11 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2
                         transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed
                         active:scale-[0.98]"
              style={{ background: loading ? '#5E8981' : '#1D2D2B' }}
            >
              {loading && <Loader2 size={15} className="animate-spin" />}
              {loading ? 'Connexion en cours…' : 'Se connecter'}
            </button>
          </form>

          <p className="text-center text-[11px] text-gray-300 mt-8">
            UMMI &copy; {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  )
}
