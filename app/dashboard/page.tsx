'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { computeMonthlyStats, formatDH, formatNumber, MONTHS_FR, getMonthKey, getDaysInMonth } from '@/lib/business'
import { Card, Pill, MonoNum } from '@/components/ui'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, BarChart, Bar } from 'recharts'
import { TrendingUp, TrendingDown, ArrowUp, ArrowDown, Minus, GitCompareArrows } from 'lucide-react'
import { cn } from '@/lib/utils'
import MonthPicker from '@/components/ui/month-picker'

function prevMonthKey(key: string): string {
  const [y, m] = key.split('-').map(Number)
  if (m === 1) return `${y - 1}-12`
  return `${y}-${String(m - 1).padStart(2, '0')}`
}

function pct(current: number, prev: number): number | null {
  if (prev === 0) return null
  return ((current - prev) / prev) * 100
}

function DeltaBadge({ current, prev, good = 'high' }: { current: number; prev: number; good?: 'high' | 'low' }) {
  const delta = pct(current, prev)
  if (delta === null) return null
  const positive = delta >= 0
  const isGood = good === 'high' ? positive : !positive
  const abs = Math.abs(delta)
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
      isGood ? 'bg-brand-50 text-brand-500' : 'bg-danger-50 text-danger-500'
    )}>
      {positive ? <ArrowUp size={9} /> : <ArrowDown size={9} />}
      {abs.toFixed(1)}%
    </span>
  )
}

export default function DashboardPage() {
  const [monthKey, setMonthKey] = useState(() => getMonthKey(new Date()))
  const [compareKey, setCompareKey] = useState(() => prevMonthKey(getMonthKey(new Date())))
  const [showCompare, setShowCompare] = useState(false)

  const [summaries, setSummaries] = useState<any[]>([])
  const [charges, setCharges] = useState<any[]>([])
  const [advances, setAdvances] = useState<any[]>([])
  const [prevSummaries, setPrevSummaries] = useState<any[]>([])
  const [prevCharges, setPrevCharges] = useState<any[]>([])
  const [prevAdvances, setPrevAdvances] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  const [year, month] = monthKey.split('-').map(Number)
  const [cmpYear, cmpMonth] = compareKey.split('-').map(Number)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [sumRes, chgRes, advRes, pSumRes, pChgRes, pAdvRes] = await Promise.all([
          supabase.from('daily_summary').select('*').eq('month_key', monthKey).order('date'),
          supabase.from('monthly_charges').select('*').eq('month_key', monthKey),
          supabase.from('salary_advances').select('*').eq('month_key', monthKey),
          supabase.from('daily_summary').select('*').eq('month_key', compareKey).order('date'),
          supabase.from('monthly_charges').select('*').eq('month_key', compareKey),
          supabase.from('salary_advances').select('*').eq('month_key', compareKey),
        ])
        setSummaries(sumRes.data || [])
        setCharges(chgRes.data || [])
        setAdvances(advRes.data || [])
        setPrevSummaries(pSumRes.data || [])
        setPrevCharges(pChgRes.data || [])
        setPrevAdvances(pAdvRes.data || [])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [monthKey, compareKey])

  const buildStats = (sums: any[], chgs: any[], advs: any[], y: number, m: number) => {
    const dim = getDaysInMonth(y, m)
    const dailyMap = new Map(sums.map((s: any) => [new Date(s.date).getDate(), s]))
    const dailyData = Array.from({ length: dim }, (_, i) => {
      const d = dailyMap.get(i + 1)
      return {
        day: i + 1,
        revenue: Number(d?.total_revenue || 0),
        expense: Number(d?.total_expense || 0),
        salary: Number(d?.total_salary || 0),
        tpe: Number(d?.tpe_amount || 0),
        coffre: Number(d?.coffre_depose || 0),
      }
    })
    const totalAdv = advs.reduce((s: number, a: any) => s + Number(a.amount || 0), 0)
    const totalChg = chgs.reduce((s: number, c: any) => s + Number(c.amount || 0), 0)
    return computeMonthlyStats(dailyData, totalAdv, totalChg)
  }

  const stats = useMemo(
    () => buildStats(summaries, charges, advances, year, month),
    [summaries, charges, advances, year, month]
  )

  const cmpStats = useMemo(
    () => buildStats(prevSummaries, prevCharges, prevAdvances, cmpYear, cmpMonth),
    [prevSummaries, prevCharges, prevAdvances, cmpYear, cmpMonth]
  )

  // ── Écarts de caisse ──
  const ecartData = useMemo(() => {
    let totalEcart = 0
    let countEcart = 0
    const jours: { day: number; ecart: number }[] = []

    for (const s of summaries) {
      if (s.caisse_reelle == null) continue
      const theorique = Number(s.reste_en_caisse || 0)
      const reelle = Number(s.caisse_reelle)
      const ecart = reelle - theorique
      if (Math.abs(ecart) >= 0.5) {
        totalEcart += ecart
        countEcart++
        jours.push({ day: new Date(s.date).getDate(), ecart })
      }
    }

    return { totalEcart, countEcart, jours }
  }, [summaries])

  const pie = [
    { name: 'Dépenses', value: stats.total_expense, color: '#C44B4B' },
    { name: 'Salaires', value: stats.total_salary + stats.total_advances, color: '#D4930D' },
    { name: 'Charges', value: stats.total_charges, color: '#6B7280' },
    { name: 'Bénéfice', value: Math.max(0, stats.benefice), color: '#2D8B75' },
  ].filter(d => d.value > 0)

  const hasCmpData = cmpStats.total_revenue > 0 || cmpStats.total_expense > 0

  // ── Additional KPIs ──
  const activeDays = stats.daily_data.filter(d => d.revenue > 0).length
  const totalDays = stats.daily_data.length
  const tauxActivite = totalDays > 0 ? (activeDays / totalDays) * 100 : 0
  const tpeRatio = stats.total_revenue > 0 ? (stats.total_tpe / stats.total_revenue) * 100 : 0
  const cashRatio = 100 - tpeRatio
  const chargesRevenuePct = stats.total_revenue > 0 ? (stats.total_charges / stats.total_revenue) * 100 : 0
  const margeBrute = stats.total_revenue > 0 ? ((stats.total_revenue - stats.total_expense) / stats.total_revenue) * 100 : 0

  // Comparison bar chart data
  const cmpBarData = [
    { name: 'Recettes', current: stats.total_revenue, compare: cmpStats.total_revenue },
    { name: 'Dépenses', current: stats.total_expense, compare: cmpStats.total_expense },
    { name: 'Salaires', current: stats.total_salary + stats.total_advances, compare: cmpStats.total_salary + cmpStats.total_advances },
    { name: 'Bénéfice', current: Math.max(0, stats.benefice), compare: Math.max(0, cmpStats.benefice) },
  ]

  const monthLabel = `${MONTHS_FR[month - 1]} ${year}`
  const cmpLabel = `${MONTHS_FR[cmpMonth - 1]} ${cmpYear}`

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-gray-200 border-t-brand-400 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Month selector + compare */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Tableau de bord</h2>
          <p className="text-xs text-gray-400 capitalize">{monthLabel}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <MonthPicker value={monthKey} onChange={setMonthKey} />
          <button
            onClick={() => setShowCompare(!showCompare)}
            className={cn(
              'flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl font-medium transition-colors border',
              showCompare
                ? 'bg-purple-50 border-purple-200 text-purple-600'
                : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
            )}
          >
            <GitCompareArrows size={13} /> Comparer
          </button>
          {showCompare && (
            <MonthPicker value={compareKey} onChange={setCompareKey} />
          )}
        </div>
      </div>

      {/* Primary KPIs with delta */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Recettes', value: stats.total_revenue, prev: cmpStats.total_revenue, color: 'text-brand-400', good: 'high' as const },
          { label: 'Dépenses', value: stats.total_expense, prev: cmpStats.total_expense, color: 'text-danger-500', good: 'low' as const },
          { label: 'Salaires + Avances', value: stats.total_salary + stats.total_advances, prev: cmpStats.total_salary + cmpStats.total_advances, color: 'text-warning-500', good: 'low' as const },
          { label: 'Bénéfice net', value: stats.benefice, prev: cmpStats.benefice, color: stats.benefice >= 0 ? 'text-brand-400' : 'text-danger-500', good: 'high' as const },
        ].map(k => (
          <div key={k.label} className="kpi-card animate-fade-up">
            <div className="flex items-center justify-between mb-1">
              <p className="label">{k.label}</p>
              {hasCmpData && <DeltaBadge current={k.value} prev={k.prev} good={k.good} />}
            </div>
            <p className={cn('mono-num text-xl', k.color)}>
              {k.value.toLocaleString('fr-MA', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
              <span className="text-xs font-normal text-gray-400 ml-1">DH</span>
            </p>
          </div>
        ))}
      </div>

      {/* Secondary KPIs — expanded for restaurant management */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { l: 'TPE / Carte', v: stats.total_tpe, suffix: 'DH' },
          { l: 'Coffre', v: stats.total_coffre, suffix: 'DH' },
          { l: 'Charges fixes', v: stats.total_charges, suffix: 'DH' },
          { l: 'Moy. CA / jour actif', v: stats.avg_daily_revenue, suffix: 'DH' },
        ].map(k => (
          <div key={k.l} className="kpi-card animate-fade-up">
            <p className="label">{k.l}</p>
            <MonoNum value={k.v} size="text-base" suffix={k.suffix} />
          </div>
        ))}
      </div>

      {/* ── Restaurant KPIs ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className={cn('kpi-card animate-fade-up', ecartData.totalEcart < -1 && 'ring-1 ring-danger-200')}>
          <p className="label">Écart de caisse</p>
          <p className={cn(
            'mono-num text-lg',
            ecartData.countEcart === 0 ? 'text-gray-300' : ecartData.totalEcart >= 0 ? 'text-brand-400' : 'text-danger-500'
          )}>
            {ecartData.countEcart === 0 ? '—' : `${ecartData.totalEcart > 0 ? '+' : ''}${ecartData.totalEcart.toLocaleString('fr-MA', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`}
            {ecartData.countEcart > 0 && <span className="text-xs font-normal text-gray-400 ml-1">DH</span>}
          </p>
          <p className="text-[10px] text-gray-400 mt-0.5">
            {ecartData.countEcart === 0 ? 'Aucun écart signalé' : `${ecartData.countEcart} jour${ecartData.countEcart > 1 ? 's' : ''} avec écart`}
          </p>
        </div>
        <div className="kpi-card animate-fade-up">
          <p className="label">Jours d'activité</p>
          <p className="mono-num text-lg text-gray-700">
            {activeDays}<span className="text-xs font-normal text-gray-400 ml-1">/ {totalDays} j</span>
          </p>
          <p className="text-[10px] text-gray-400 mt-0.5">{tauxActivite.toFixed(0)}% taux d'activité</p>
        </div>
        <div className="kpi-card animate-fade-up">
          <p className="label">Ratio espèces / carte</p>
          <p className="mono-num text-lg text-gray-700">
            {cashRatio.toFixed(0)}%<span className="text-xs font-normal text-gray-400 ml-1">espèces</span>
          </p>
          <p className="text-[10px] text-gray-400 mt-0.5">{tpeRatio.toFixed(0)}% TPE</p>
        </div>
        <div className="kpi-card animate-fade-up">
          <p className="label">Marge brute</p>
          <MonoNum value={margeBrute} size="text-lg" color={margeBrute >= 50 ? 'text-brand-400' : margeBrute >= 35 ? 'text-warning-500' : 'text-danger-500'} suffix="%" />
          <p className="text-[10px] text-gray-400 mt-0.5">CA − Dépenses / CA</p>
        </div>
        <div className="kpi-card animate-fade-up">
          <p className="label">Poids charges fixes</p>
          <MonoNum value={chargesRevenuePct} size="text-lg" color={chargesRevenuePct <= 15 ? 'text-brand-400' : chargesRevenuePct <= 25 ? 'text-warning-500' : 'text-danger-500'} suffix="%" />
          <p className="text-[10px] text-gray-400 mt-0.5">Charges / CA</p>
        </div>
      </div>

      {/* ── Comparison section ── */}
      {showCompare && hasCmpData && (
        <Card title={`Comparaison : ${monthLabel} vs ${cmpLabel}`}>
          <div className="space-y-4">
            {/* Bar chart comparison */}
            <div className="w-full h-52">
              <ResponsiveContainer>
                <BarChart data={cmpBarData} margin={{ top: 5, right: 5, bottom: 5, left: -15 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#999' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#999', fontFamily: 'DM Mono' }} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: '1px solid #f0f0f0', fontSize: 12 }}
                    formatter={(v: number) => formatDH(v)}
                  />
                  <Bar dataKey="current" name={monthLabel} fill="#2D8B75" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="compare" name={cmpLabel} fill="#9CA3AF" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Detailed comparison table */}
            <div className="space-y-2.5">
              {[
                { label: 'CA Total', cur: stats.total_revenue, prev: cmpStats.total_revenue, good: 'high' as const, color: 'text-brand-400' },
                { label: 'Dépenses', cur: stats.total_expense, prev: cmpStats.total_expense, good: 'low' as const, color: 'text-danger-500' },
                { label: 'Masse salariale', cur: stats.total_salary + stats.total_advances, prev: cmpStats.total_salary + cmpStats.total_advances, good: 'low' as const, color: 'text-warning-500' },
                { label: 'Charges fixes', cur: stats.total_charges, prev: cmpStats.total_charges, good: 'low' as const, color: 'text-gray-600' },
                { label: 'Bénéfice', cur: stats.benefice, prev: cmpStats.benefice, good: 'high' as const, color: 'text-brand-500' },
                { label: 'Moy. CA / jour', cur: stats.avg_daily_revenue, prev: cmpStats.avg_daily_revenue, good: 'high' as const, color: 'text-gray-600' },
                { label: 'Food cost %', cur: stats.food_cost_pct, prev: cmpStats.food_cost_pct, good: 'low' as const, color: 'text-orange-500' },
                { label: 'Marge nette %', cur: stats.marge_nette_pct, prev: cmpStats.marge_nette_pct, good: 'high' as const, color: 'text-purple-500' },
              ].map(row => {
                const delta = pct(row.cur, row.prev)
                const positive = delta !== null && delta >= 0
                const isGood = row.good === 'high' ? positive : !positive
                const noData = delta === null
                return (
                  <div key={row.label} className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-32 flex-shrink-0">{row.label}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all duration-500', isGood ? 'bg-brand-400' : 'bg-danger-400')}
                        style={{ width: `${row.prev > 0 ? Math.min(100, (row.cur / row.prev) * 100) : 0}%` }}
                      />
                    </div>
                    <span className={cn('font-mono text-xs w-20 text-right flex-shrink-0', row.color)}>
                      {row.label.includes('%') ? `${row.cur.toFixed(1)}%` : formatDH(row.cur)}
                    </span>
                    {noData ? (
                      <span className="w-16 flex-shrink-0 flex justify-end">
                        <Minus size={10} className="text-gray-300" />
                      </span>
                    ) : (
                      <span className={cn(
                        'inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full w-16 justify-center flex-shrink-0',
                        isGood ? 'bg-brand-50 text-brand-500' : 'bg-danger-50 text-danger-500'
                      )}>
                        {positive ? <ArrowUp size={9} /> : <ArrowDown size={9} />}
                        {Math.abs(delta!).toFixed(1)}%
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </Card>
      )}

      {/* Ratios */}
      <Card title="Ratios mensuels">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { l: 'Food cost', v: stats.food_cost_pct, t: 35, good: 'low' as const },
            { l: 'Masse salariale', v: stats.masse_salariale_pct, t: 30, good: 'low' as const },
            { l: 'Marge nette', v: stats.marge_nette_pct, t: 20, good: 'high' as const },
          ].map(r => {
            const ok = r.good === 'low' ? r.v <= r.t : r.v >= r.t
            const warn = r.good === 'low' ? r.v <= r.t * 1.2 : r.v >= r.t * 0.7
            return (
              <div key={r.l} className="p-4 rounded-2xl bg-gray-50 border border-gray-100 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{r.l}</span>
                  <Pill variant={ok ? 'brand' : warn ? 'warning' : 'danger'}>
                    {ok ? 'OK' : warn ? 'Attention' : 'Alerte'}
                  </Pill>
                </div>
                <MonoNum value={r.v} size="text-2xl" color={ok ? 'text-brand-400' : warn ? 'text-warning-500' : 'text-danger-500'} suffix="%" />
                <div className="h-1 rounded-full bg-gray-200 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${ok ? 'bg-brand-400' : warn ? 'bg-warning-400' : 'bg-danger-400'}`}
                    style={{ width: `${Math.min(100, Math.abs(r.v) / (r.t * 1.5) * 100)}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      {/* Chart */}
      <Card title="Évolution journalière">
        <div className="w-full h-52">
          <ResponsiveContainer>
            <AreaChart data={stats.daily_data} margin={{ top: 5, right: 5, bottom: 5, left: -15 }}>
              <defs>
                <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2D8B75" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#2D8B75" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#999', fontFamily: 'DM Mono' }} />
              <YAxis tick={{ fontSize: 10, fill: '#999', fontFamily: 'DM Mono' }} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: '1px solid #f0f0f0', fontSize: 12, fontFamily: 'DM Sans' }}
                formatter={(v: number) => formatDH(v)}
              />
              <Area type="monotone" dataKey="revenue" stroke="#2D8B75" fill="url(#gRev)" strokeWidth={2} name="Recettes" />
              <Area type="monotone" dataKey="expense" stroke="#C44B4B" fill="none" strokeWidth={1.5} strokeDasharray="4 4" name="Dépenses" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Best/Worst + Pie */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Meilleur jour">
          {stats.best_day ? (
            <div className="text-center py-3">
              <div className="inline-flex items-center gap-2 text-brand-400 mb-1">
                <TrendingUp size={18} />
                <MonoNum value={stats.best_day.day} size="text-3xl" color="text-brand-400" />
              </div>
              <p className="text-sm text-gray-400">{formatDH(stats.best_day.amount)}</p>
            </div>
          ) : <p className="text-center text-sm text-gray-300 py-4">Aucune donnée</p>}
        </Card>

        <Card title="Pire jour">
          {stats.worst_day ? (
            <div className="text-center py-3">
              <div className="inline-flex items-center gap-2 text-danger-500 mb-1">
                <TrendingDown size={18} />
                <MonoNum value={stats.worst_day.day} size="text-3xl" color="text-danger-500" />
              </div>
              <p className="text-sm text-gray-400">{formatDH(stats.worst_day.amount)}</p>
            </div>
          ) : <p className="text-center text-sm text-gray-300 py-4">Aucune donnée</p>}
        </Card>

        {pie.length > 0 && (
          <Card title="Répartition">
            <div className="flex items-center gap-4">
              <div className="w-24 h-24 flex-shrink-0">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={pie} cx="50%" cy="50%" innerRadius={25} outerRadius={42} dataKey="value" paddingAngle={3} strokeWidth={0}>
                      {pie.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1.5 text-xs">
                {pie.map(d => (
                  <div key={d.name} className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: d.color }} />
                    <span className="text-gray-500">{d.name}</span>
                    <span className="font-mono text-gray-400">{formatDH(d.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* ── Résumé financier ── */}
      <Card title="Résumé financier">
        <div className="space-y-2">
          {[
            { label: 'Chiffre d\'affaires', value: stats.total_revenue, color: 'text-brand-500' },
            { label: '− Dépenses (achats)', value: stats.total_expense, color: 'text-danger-500', neg: true },
            { label: '− Salaires + Avances', value: stats.total_salary + stats.total_advances, color: 'text-warning-500', neg: true },
            { label: '− Charges fixes', value: stats.total_charges, color: 'text-gray-500', neg: true },
          ].map(r => (
            <div key={r.label} className="flex items-center justify-between px-1">
              <span className="text-xs text-gray-500">{r.label}</span>
              <span className={cn('font-mono text-xs tabular-nums', r.color)}>
                {r.neg && r.value > 0 ? '−' : ''}{formatDH(r.value)}
              </span>
            </div>
          ))}
          <div className="border-t border-gray-200 pt-2 mt-2 flex items-center justify-between px-1">
            <span className="text-sm font-bold text-gray-700">= Bénéfice net</span>
            <span className={cn('font-mono text-sm font-bold', stats.benefice >= 0 ? 'text-brand-500' : 'text-danger-600')}>
              {formatDH(stats.benefice)}
            </span>
          </div>
        </div>
      </Card>

      {/* ── VU GLOBAL — tableau journalier ── */}
      <Card title="Vu global">
        <div className="overflow-x-auto -mx-4">
          {(() => {
            const ecartMap = new Map<number, number>()
            for (const j of ecartData.jours) ecartMap.set(j.day, j.ecart)
            return (
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    <td className="px-4 py-2.5 text-left">Date</td>
                    <td className="px-3 py-2.5 text-right">Recette</td>
                    <td className="px-3 py-2.5 text-right">Dépense</td>
                    <td className="px-3 py-2.5 text-right">Salaire</td>
                    <td className="px-3 py-2.5 text-right">TPE</td>
                    <td className="px-3 py-2.5 text-right">Écart</td>
                  </tr>
                </thead>
                <tbody>
                  {stats.daily_data.map(d => {
                    const hasData = d.revenue > 0 || d.expense > 0 || d.salary > 0 || d.tpe > 0
                    const ecart = ecartMap.get(d.day)
                    return (
                      <tr key={d.day} className={cn('border-t border-gray-50', hasData ? '' : 'opacity-30')}>
                        <td className="px-4 py-1.5 font-medium text-gray-600">{d.day}</td>
                        <td className="px-3 py-1.5 text-right font-mono tabular-nums text-brand-500">
                          {d.revenue > 0 ? formatNumber(d.revenue) : '—'}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono tabular-nums text-danger-500">
                          {d.expense > 0 ? formatNumber(d.expense) : '—'}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono tabular-nums text-warning-500">
                          {d.salary > 0 ? formatNumber(d.salary) : '—'}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono tabular-nums text-gray-500">
                          {d.tpe > 0 ? formatNumber(d.tpe) : '—'}
                        </td>
                        <td className={cn('px-3 py-1.5 text-right font-mono tabular-nums',
                          ecart == null ? 'text-gray-300' : ecart >= 0 ? 'text-brand-500' : 'text-danger-500'
                        )}>
                          {ecart != null ? `${ecart > 0 ? '+' : ''}${formatNumber(ecart)}` : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200 bg-gray-50 font-bold">
                    <td className="px-4 py-2.5 text-gray-700">Total</td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-brand-500">{formatNumber(stats.total_revenue)}</td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-danger-500">{formatNumber(stats.total_expense)}</td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-warning-500">{formatNumber(stats.total_salary)}</td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-gray-500">{formatNumber(stats.total_tpe)}</td>
                    <td className={cn('px-3 py-2.5 text-right font-mono tabular-nums font-bold',
                      ecartData.totalEcart >= 0 ? 'text-brand-500' : 'text-danger-500'
                    )}>
                      {ecartData.countEcart > 0 ? `${ecartData.totalEcart > 0 ? '+' : ''}${formatNumber(ecartData.totalEcart)}` : '—'}
                    </td>
                  </tr>
                  <tr className="border-t border-gray-100 bg-gray-50/60 text-[11px]">
                    <td className="px-4 py-2 text-gray-400 font-medium">Moyenne / jour actif</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-brand-400">
                      {activeDays > 0 ? formatNumber(stats.total_revenue / activeDays) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-danger-400">
                      {activeDays > 0 ? formatNumber(stats.total_expense / activeDays) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-warning-400">
                      {activeDays > 0 ? formatNumber(stats.total_salary / activeDays) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-gray-400">
                      {activeDays > 0 ? formatNumber(stats.total_tpe / activeDays) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-gray-400">—</td>
                  </tr>
                </tfoot>
              </table>
            )
          })()}
        </div>
      </Card>
    </div>
  )
}
