'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { formatDH, getMonthKey, getDaysInMonth, MONTHS_FR } from '@/lib/business'
import { Card, MonoNum } from '@/components/ui'
import { Plus, X, Loader2, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { logActivity } from '@/lib/log-activity'
import MonthPicker from '@/components/ui/month-picker'

export default function SafePage() {
  const supabase = useRef(createClient()).current
  const { user } = useAuth()
  const isSuperAdmin = user?.role?.name === 'super_admin'

  const now = new Date()
  const [monthKey, setMonthKey] = useState(() => getMonthKey(now))
  const [entries, setEntries] = useState<any[]>([])
  const [withdrawals, setWithdrawals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Withdrawal form
  const [showForm, setShowForm] = useState(false)
  const [wDate, setWDate] = useState(() => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`)
  const [wAmount, setWAmount] = useState('')
  const [wReason, setWReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [year, month] = monthKey.split('-').map(Number)
  const dim = getDaysInMonth(year, month)
  const monthLabel = `${MONTHS_FR[month - 1]} ${year}`

  const load = async () => {
    setLoading(true)
    try {
      const [depRes, wRes] = await Promise.all([
        supabase
          .from('daily_entries')
          .select('date, coffre_depose')
          .eq('month_key', monthKey)
          .order('date'),
        supabase
          .from('safe_withdrawals')
          .select('*')
          .eq('month_key', monthKey)
          .order('date'),
      ])
      setEntries(depRes.data || [])
      setWithdrawals(wRes.data || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [monthKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const dailyCoffre = useMemo(() => {
    const map = new Map(entries.map((e: any) => [new Date(e.date).getDate(), Number(e.coffre_depose || 0)]))
    return Array.from({ length: dim }, (_, i) => ({ day: i + 1, amount: map.get(i + 1) || 0 }))
  }, [entries, dim])

  const totalDeposits = dailyCoffre.reduce((s, d) => s + d.amount, 0)
  const totalWithdrawals = withdrawals.reduce((s: number, w: any) => s + Number(w.amount || 0), 0)
  const balance = totalDeposits - totalWithdrawals

  const addWithdrawal = async () => {
    const amt = parseFloat(wAmount)
    if (!wDate || isNaN(amt) || amt <= 0) { setError('Date et montant requis'); return }
    setSaving(true)
    setError(null)
    try {
      const wMonthKey = wDate.substring(0, 7)
      const { error: err } = await supabase.from('safe_withdrawals').insert({
        date: wDate,
        month_key: wMonthKey,
        amount: amt,
        reason: wReason.trim() || null,
        created_by: user?.id ?? null,
        created_by_name: user?.full_name ?? null,
      })
      if (err) throw err
      // Journal
      if (user) {
        logActivity({
          userId: user.id, userName: user.full_name,
          action: `Retrait coffre${wReason.trim() ? ' — ' + wReason.trim() : ''} : ${amt} DH`,
          category: 'coffre_retrait',
          amount: amt,
          detail: wReason.trim() || null,
          date: wDate, monthKey: wMonthKey,
        } as any)
      }
      setShowForm(false)
      setWAmount('')
      setWReason('')
      setWDate(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`)
      if (wMonthKey === monthKey) await load()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const deleteWithdrawal = async (id: string) => {
    const { error: err } = await supabase.from('safe_withdrawals').delete().eq('id', id)
    if (!err) setWithdrawals(prev => prev.filter((w: any) => w.id !== id))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-gray-200 border-t-brand-400 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Coffre fort</h2>
          <p className="text-xs text-gray-400">Dépôts journaliers et retraits</p>
        </div>
        <div className="flex items-center gap-2">
          {isSuperAdmin && (
            <button
              onClick={() => { setShowForm(!showForm); setError(null) }}
              className="btn-primary text-xs"
            >
              <TrendingDown size={13} /> Retrait
            </button>
          )}
          <MonthPicker value={monthKey} onChange={setMonthKey} />
        </div>
      </div>

      {/* ── Withdrawal form ── */}
      {showForm && isSuperAdmin && (
        <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-5 animate-fade-up space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
            <TrendingDown size={12} className="text-danger-500" /> Enregistrer un retrait
          </p>
          {error && <p className="text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">{error}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1">
              <label className="label">Date</label>
              <input type="date" value={wDate} onChange={e => setWDate(e.target.value)} className="input-field text-sm" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="label">Montant (DH)</label>
              <input
                type="number" min="1" step="0.01"
                value={wAmount} onChange={e => setWAmount(e.target.value)}
                placeholder="0.00" className="input-field text-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="label">Motif (optionnel)</label>
              <input
                type="text" value={wReason} onChange={e => setWReason(e.target.value)}
                placeholder="ex: Règlement loyer" className="input-field text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={addWithdrawal} disabled={saving} className="btn-primary text-xs disabled:opacity-50">
              {saving ? <><Loader2 size={12} className="animate-spin" /> Enregistrement…</> : <><Plus size={12} /> Confirmer le retrait</>}
            </button>
            <button onClick={() => setShowForm(false)} className="btn-icon text-xs px-3">Annuler</button>
          </div>
        </div>
      )}

      {/* ── KPIs ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="kpi-card animate-fade-up">
          <p className="label">Dépôts — {monthLabel}</p>
          <MonoNum value={totalDeposits} size="text-xl" color="text-brand-500" suffix="DH" />
        </div>
        <div className="kpi-card animate-fade-up">
          <p className="label">Retraits — {monthLabel}</p>
          <MonoNum value={totalWithdrawals} size="text-xl" color="text-danger-500" suffix="DH" />
        </div>
        <div className="kpi-card animate-fade-up">
          <p className="label">Solde coffre</p>
          <MonoNum value={balance} size="text-xl" color={balance >= 0 ? 'text-purple-600' : 'text-danger-600'} suffix="DH" />
        </div>
      </div>

      {/* ── Dépôts journaliers ── */}
      <Card title="Dépôts journaliers">
        <p className="text-[11px] text-gray-400 mb-3">
          Saisis depuis la page Journée — champ « Déposé au coffre »
        </p>
        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-7 gap-2">
          {dailyCoffre.map(e => (
            <div
              key={e.day}
              className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl border transition-colors ${
                e.amount > 0
                  ? 'bg-brand-50 border-brand-100'
                  : 'bg-gray-50 border-gray-100'
              }`}
            >
              <span className="mono-num text-[11px] text-gray-400 w-5">{e.day}</span>
              <span className={`mono-num text-xs ${e.amount > 0 ? 'text-brand-500 font-semibold' : 'text-gray-300'}`}>
                {e.amount > 0 ? formatDH(e.amount) : '—'}
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* ── Retraits ── */}
      {(withdrawals.length > 0 || isSuperAdmin) && (
        <Card title={`Retraits (${withdrawals.length})`} noPad>
          {withdrawals.length === 0 ? (
            <div className="px-5 py-6 text-center text-xs text-gray-300 italic">
              Aucun retrait enregistré ce mois
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {withdrawals.map((w: any) => {
                const d = new Date(w.date)
                return (
                  <div key={w.id} className="flex items-center gap-4 px-5 py-3.5">
                    <div className="w-9 h-9 rounded-xl bg-danger-50 flex items-center justify-center flex-shrink-0">
                      <TrendingDown size={16} className="text-danger-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">
                        {w.reason || 'Retrait coffre'}
                      </p>
                      <p className="text-[11px] text-gray-400">
                        {d.getDate()} {MONTHS_FR[d.getMonth()]} · par {w.created_by_name || '—'}
                      </p>
                    </div>
                    <span className="font-mono text-sm font-bold text-danger-600">
                      −{formatDH(Number(w.amount))}
                    </span>
                    {isSuperAdmin && (
                      <button
                        onClick={() => deleteWithdrawal(w.id)}
                        className="btn-icon text-gray-300 hover:text-danger-500 flex-shrink-0"
                        title="Supprimer"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
