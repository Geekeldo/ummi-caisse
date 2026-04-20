'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { computeCaisse, formatNumber, MONTHS_FR } from '@/lib/business'
import { EmptyState } from '@/components/ui'
import CalendarPicker from '@/components/ui/calendar-picker'
import { Plus, X, CreditCard, Vault, TrendingUp, TrendingDown, Camera, AlertTriangle } from 'lucide-react'
import { logActivity } from '@/lib/log-activity'
import { cn } from '@/lib/utils'

interface Line { id: string; [key: string]: any }
interface LineCancel { id: string; revenue_line_id: string; amount: number; reason: string; photo_url?: string | null }

const DAY_NAMES_FR = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

export default function DailyPage() {
  const { user, can } = useAuth()
  const supabase = useRef(createClient()).current

  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [day, setDay] = useState(now.getDate())

  const [entry, setEntry] = useState<any>(null)
  const [revenues, setRevenues] = useState<Line[]>([])
  const [lineCancels, setLineCancels] = useState<Record<string, LineCancel[]>>({})
  const [expenses, setExpenses] = useState<Line[]>([])
  const [salaries, setSalaries] = useState<Line[]>([])
  const [prevSolde, setPrevSolde] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  const [serveurs, setServeurs] = useState<{ id: string; name: string }[]>([])
  const [supplierNames, setSupplierNames] = useState<string[]>([])

  const readOnly = !can('daily.write')

  // Track logged values to avoid duplicate activity logs on every keystroke
  const loggedRef = useRef<Record<string, number>>({})
  const logOnce = (key: string, value: number, fn: () => void) => {
    if (loggedRef.current[key] === value) return
    loggedRef.current[key] = value
    fn()
  }

  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  const monthKey = `${year}-${String(month).padStart(2, '0')}`
  const dayName = DAY_NAMES_FR[new Date(year, month - 1, day).getDay()]
  const monthName = MONTHS_FR[month - 1]

  const setDate = (y: number, m: number, d: number) => { setYear(y); setMonth(m); setDay(d) }

  // ── Load suggestions once ──
  useEffect(() => {
    const load = async () => {
      const [empRes, suppRes] = await Promise.all([
        supabase.from('employees').select('id, name, position').eq('is_active', true).order('name'),
        supabase.from('suppliers').select('name').eq('is_active', true).order('name'),
      ])
      if (empRes.error) console.error('❌ Load employees error:', empRes.error)
      if (suppRes.error) console.error('❌ Load suppliers error:', suppRes.error)

      const allEmp = (empRes.data || []) as { id: string; name: string; position: string }[]
      const srv = allEmp.filter(e =>
        ['serveur', 'serveuse', 'manager'].includes((e.position || '').toLowerCase())
      )
      setServeurs(srv.length > 0 ? srv : allEmp)
      setSupplierNames((suppRes.data || []).map((s: any) => s.name))
    }
    load()
  }, [supabase])

  // ── Load day ──
  const loadDay = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      // 1) Fetch or create entry
      let { data: entryData, error: fetchError } = await supabase
        .from('daily_entries').select('*').eq('date', dateStr).single()

      // PGRST116 = "no rows found" → normal, on va créer
      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('❌ Fetch daily_entry error:', fetchError)
      }

      if (!entryData) {
        const { data: newEntry, error: insertError } = await supabase
          .from('daily_entries')
          .insert({
            date: dateStr,
            month_key: monthKey,
            filled_by: user.id,
            tpe_amount: 0,
            coffre_depose: 0,
          })
          .select()
          .single()

        if (insertError) {
          console.error('❌ Insert daily_entry failed:', insertError)
          // Tentative de re-fetch au cas où un autre process l'aurait créé (race condition)
          const { data: retryData, error: retryError } = await supabase
            .from('daily_entries').select('*').eq('date', dateStr).single()
          if (retryError) {
            console.error('❌ Retry fetch also failed:', retryError)
            setEntry(null)
            setRevenues([])
            setExpenses([])
            setSalaries([])
            setLineCancels({})
            return
          }
          entryData = retryData
        } else {
          entryData = newEntry
        }
      }

      if (!entryData) {
        console.error('❌ entry is still null after insert — impossible d\'ajouter des lignes')
        setEntry(null)
        setRevenues([])
        setExpenses([])
        setSalaries([])
        setLineCancels({})
        return
      }

      setEntry(entryData)

      // 2) Charger les lignes
      const [revRes, expRes, salRes, cancelRes] = await Promise.all([
        supabase.from('revenue_lines').select('*').eq('daily_entry_id', entryData.id).order('sort_order'),
        supabase.from('expense_lines').select('*').eq('daily_entry_id', entryData.id).order('sort_order'),
        supabase.from('salary_lines').select('*').eq('daily_entry_id', entryData.id),
        supabase.from('revenue_cancellations').select('*').eq('daily_entry_id', entryData.id),
      ])

      if (revRes.error) console.error('❌ Load revenue_lines error:', revRes.error)
      if (expRes.error) console.error('❌ Load expense_lines error:', expRes.error)
      if (salRes.error) console.error('❌ Load salary_lines error:', salRes.error)
      if (cancelRes.error) console.error('❌ Load revenue_cancellations error:', cancelRes.error)

      setRevenues(revRes.data || [])
      setExpenses(expRes.data || [])
      setSalaries(salRes.data || [])

      // Group cancellations by revenue_line_id
      const grouped: Record<string, LineCancel[]> = {}
      for (const c of (cancelRes.data || [])) {
        const lid = c.revenue_line_id || '__daily__'
        if (!grouped[lid]) grouped[lid] = []
        grouped[lid].push(c)
      }
      setLineCancels(grouped)

      // 3) Previous day solde — look back up to 90 days for the most recent saved reste
      // (fixes the CAISSE_INIT bug: if day J-1 has no entry, use day J-2's, etc.)
      const lookback = new Date(year, month - 1, day)
      lookback.setDate(lookback.getDate() - 90)
      const lookbackDateStr = `${lookback.getFullYear()}-${String(lookback.getMonth() + 1).padStart(2, '0')}-${String(lookback.getDate()).padStart(2, '0')}`

      const { data: prevEntries } = await supabase
        .from('daily_entries')
        .select('date, reste_en_caisse')
        .lt('date', dateStr)
        .gte('date', lookbackDateStr)
        .order('date', { ascending: false })
        .limit(1)

      // Use the most recent saved reste, fall back to null → CAISSE_INIT will apply (first ever day)
      const prevReste = (prevEntries && prevEntries.length > 0)
        ? Number(prevEntries[0].reste_en_caisse ?? 0)
        : null
      setPrevSolde(prevReste)
    } catch (err) {
      console.error('❌ loadDay unexpected error:', err)
    } finally {
      setLoading(false)
    }
  }, [dateStr, monthKey, day, year, month, user?.id, supabase])

  useEffect(() => {
    if (user?.id) {
      loadDay()
    } else {
      setLoading(false) // user null ou pas encore chargé → stoppe le spinner
    }
  }, [loadDay, user?.id])

  // ── Computed totals ──
  const totalGrossRevenue = revenues.reduce((s, r) => s + Number(r.amount || 0), 0)
  const totalCancellations = Object.values(lineCancels).flat().reduce((s, c) => s + Number(c.amount || 0), 0)
  const totalNetRevenue = totalGrossRevenue - totalCancellations

  const caisse = useMemo(() => {
    const tExp = expenses.reduce((s, r) => s + Number(r.amount || 0), 0)
    const tSal = salaries.reduce((s, r) => s + Number(r.amount || 0), 0)
    const tpe = Number(entry?.tpe_amount || 0)
    const coffre = Number(entry?.coffre_depose || 0)
    return computeCaisse(totalNetRevenue, tExp, tSal, tpe, coffre, prevSolde)
  }, [totalNetRevenue, expenses, salaries, entry, prevSolde])

  // ── Auto-save reste_en_caisse whenever caisse changes ──
  // This allows the NEXT day to read it directly without recursion
  useEffect(() => {
    if (!entry?.id || loading) return
    supabase
      .from('daily_entries')
      .update({ reste_en_caisse: caisse.reste_en_caisse })
      .eq('id', entry.id)
      .then(({ error }) => {
        if (error) console.error('❌ Auto-save reste_en_caisse error:', error)
      })
  }, [caisse.reste_en_caisse, entry?.id, loading]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Mutations ──
  const updateEntry = async (field: string, value: number) => {
    if (!entry) {
      console.warn('⚠️ updateEntry: entry is null')
      return
    }
    setEntry((prev: any) => ({ ...prev, [field]: value }))
    const { error } = await supabase.from('daily_entries').update({ [field]: value }).eq('id', entry.id)
    if (error) console.error('❌ updateEntry error:', error)

    // Journal : dépôt coffre (logOnce avoids duplicate logs on every keystroke)
    if (field === 'coffre_depose' && value > 0 && user) {
      logOnce(`coffre_${dateStr}`, value, () =>
        logActivity({
          userId: user.id, userName: user.full_name,
          action: `Dépôt coffre : ${value} DH`,
          category: 'coffre_depot',
          amount: value,
          date: dateStr, monthKey,
        })
      )
    }
  }

  const addRevenueLine = async () => {
    if (!entry) {
      console.warn('⚠️ addRevenueLine: entry is null — impossible d\'ajouter')
      return
    }
    if (readOnly) {
      console.warn('⚠️ addRevenueLine: readOnly mode')
      return
    }
    const { data, error } = await supabase.from('revenue_lines')
      .insert({ daily_entry_id: entry.id, server_name: '', amount: 0, sort_order: revenues.length })
      .select().single()
    if (error) {
      console.error('❌ addRevenueLine error:', error)
      return
    }
    if (data) setRevenues(prev => [...prev, data])
  }

  const updateRevLine = async (id: string, field: string, value: any) => {
    setRevenues(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l))
    const { error } = await supabase.from('revenue_lines').update({ [field]: value }).eq('id', id)
    if (error) console.error('❌ updateRevLine error:', error)
  }

  const removeRevLine = async (id: string) => {
    setRevenues(prev => prev.filter(l => l.id !== id))
    setLineCancels(prev => { const n = { ...prev }; delete n[id]; return n })
    const { error } = await supabase.from('revenue_lines').delete().eq('id', id)
    if (error) console.error('❌ removeRevLine error:', error)
  }

  const addExpenseLine = async () => {
    if (!entry) {
      console.warn('⚠️ addExpenseLine: entry is null')
      return
    }
    if (readOnly) {
      console.warn('⚠️ addExpenseLine: readOnly mode')
      return
    }
    const { data, error } = await supabase.from('expense_lines')
      .insert({ daily_entry_id: entry.id, designation: '', amount: 0, sort_order: expenses.length })
      .select().single()
    if (error) {
      console.error('❌ addExpenseLine error:', error)
      return
    }
    if (data) setExpenses(prev => [...prev, data])
  }

  const updateExpLine = async (id: string, field: string, value: any) => {
    setExpenses(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l))
    const { error } = await supabase.from('expense_lines').update({ [field]: value }).eq('id', id)
    if (error) console.error('❌ updateExpLine error:', error)
  }

  const removeExpLine = async (id: string) => {
    setExpenses(prev => prev.filter(l => l.id !== id))
    const { error } = await supabase.from('expense_lines').delete().eq('id', id)
    if (error) console.error('❌ removeExpLine error:', error)
  }

  const addSalaryLine = async () => {
    if (!entry) {
      console.warn('⚠️ addSalaryLine: entry is null')
      return
    }
    if (readOnly) {
      console.warn('⚠️ addSalaryLine: readOnly mode')
      return
    }
    const { data, error } = await supabase.from('salary_lines')
      .insert({ daily_entry_id: entry.id, employee_name: '', amount: 0 })
      .select().single()
    if (error) {
      console.error('❌ addSalaryLine error:', error)
      return
    }
    if (data) setSalaries(prev => [...prev, data])
  }

  const updateSalLine = async (id: string, field: string, value: any) => {
    setSalaries(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l))
    const { error } = await supabase.from('salary_lines').update({ [field]: value }).eq('id', id)
    if (error) console.error('❌ updateSalLine error:', error)

    // Journal : avance salaire (logOnce avoids duplicate logs on every keystroke)
    if (field === 'amount' && Number(value) > 0 && user) {
      const line = salaries.find(l => l.id === id)
      const empName = line?.employee_name || '—'
      logOnce(`sal_${id}`, Number(value), () =>
        logActivity({
          userId: user.id, userName: user.full_name,
          action: `Avance salaire — ${empName} : ${value} DH`,
          category: 'avance_salaire',
          amount: Number(value),
          detail: empName,
          date: dateStr, monthKey,
        })
      )
    }
  }

  const removeSalLine = async (id: string) => {
    setSalaries(prev => prev.filter(l => l.id !== id))
    const { error } = await supabase.from('salary_lines').delete().eq('id', id)
    if (error) console.error('❌ removeSalLine error:', error)
  }

  // ── Per-line cancellation ──
  const addLineCancel = async (lineId: string, serverName: string) => {
    if (!entry) {
      console.warn('⚠️ addLineCancel: entry is null')
      return
    }
    if (readOnly) {
      console.warn('⚠️ addLineCancel: readOnly mode')
      return
    }
    const { data, error } = await supabase.from('revenue_cancellations').insert({
      daily_entry_id: entry.id,
      revenue_line_id: lineId,
      server_name: serverName,
      amount: 0,
      reason: '',
    }).select().single()
    if (error) {
      console.error('❌ addLineCancel error:', error)
      return
    }
    if (data) setLineCancels(prev => ({ ...prev, [lineId]: [...(prev[lineId] || []), data] }))
  }

  const updateLineCancel = async (lineId: string, cancelId: string, field: string, value: any) => {
    setLineCancels(prev => ({
      ...prev,
      [lineId]: (prev[lineId] || []).map(c => c.id === cancelId ? { ...c, [field]: value } : c),
    }))
    const { error } = await supabase.from('revenue_cancellations').update({ [field]: value }).eq('id', cancelId)
    if (error) console.error('❌ updateLineCancel error:', error)
  }

  const removeLineCancel = async (lineId: string, cancelId: string) => {
    setLineCancels(prev => ({ ...prev, [lineId]: (prev[lineId] || []).filter(c => c.id !== cancelId) }))
    const { error } = await supabase.from('revenue_cancellations').delete().eq('id', cancelId)
    if (error) console.error('❌ removeLineCancel error:', error)
  }

  // ── Photo uploads ──
  const uploadPhoto = async (
    table: 'revenue_lines' | 'expense_lines' | 'revenue_cancellations',
    id: string,
    file: File,
    onUpdate: (url: string) => void
  ) => {
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `${dateStr}/${table}_${id}.${ext}`
    const { error: uploadError } = await supabase.storage.from('receipts').upload(path, file, { upsert: true })
    if (uploadError) {
      console.error('❌ Upload photo error:', uploadError)
      return
    }
    const { data: urlData } = supabase.storage.from('receipts').getPublicUrl(path)
    const url = urlData.publicUrl
    const { error: updateError } = await supabase.from(table).update({ photo_url: url }).eq('id', id)
    if (updateError) {
      console.error('❌ Update photo_url error:', updateError)
      return
    }
    onUpdate(url)
  }

  // ── Render ──
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-6 h-6 border-2 border-gray-100 border-t-brand-400 rounded-full animate-spin" />
      </div>
    )
  }

  if (!entry) {
    return (
      <div className="space-y-4 max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3">
          <CalendarPicker year={year} month={month} day={day} onChange={setDate} />
        </div>
        <div className="bg-danger-50 border border-danger-200 rounded-2xl p-6 text-center">
          <AlertTriangle size={24} className="text-danger-500 mx-auto mb-2" />
          <p className="text-sm font-semibold text-danger-700 mb-1">Impossible de charger ou créer l'entrée du jour</p>
          <p className="text-xs text-danger-500">
            Vérifiez les permissions (RLS) sur la table <code>daily_entries</code> et la console pour plus de détails.
          </p>
          <button
            onClick={loadDay}
            className="mt-3 inline-flex items-center gap-1.5 text-xs px-4 py-2 rounded-xl font-medium bg-danger-100 text-danger-700 hover:bg-danger-200 transition-colors"
          >
            Réessayer
          </button>
        </div>
      </div>
    )
  }

  const soldePositif = caisse.solde >= 0

  return (
    <div className="space-y-4 max-w-2xl mx-auto">

      {/* ── CALENDRIER ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3">
        <CalendarPicker year={year} month={month} day={day} onChange={setDate} />
      </div>

      {/* ── CAISSE ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 font-medium">{dayName} {day} {monthName} {year}</p>
            <h3 className="text-sm font-bold tracking-tight text-gray-900">Caisse du jour</h3>
          </div>
          <div className={cn(
            'px-3 py-1 rounded-full text-xs font-bold font-mono',
            soldePositif ? 'bg-brand-50 text-brand-500' : 'bg-danger-50 text-danger-600'
          )}>
            {soldePositif ? '+' : ''}{formatNumber(caisse.solde)} DH
          </div>
        </div>

        <div className="divide-y divide-gray-50">
          {/* ENTRÉES */}
          <div className="px-5 py-3.5">
            <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
              <TrendingUp size={10} /> Entrées
            </p>
            <div className="space-y-1.5">
              <CalcRow label="Restant veille" value={caisse.restant_veille} />
              <CalcRow label="Recettes brutes" value={totalGrossRevenue} highlight />
              {totalCancellations > 0 && (
                <CalcRow label="Annulations" value={totalCancellations} negative accent="danger" />
              )}
              {totalCancellations > 0 && (
                <CalcRow label="Recettes nettes" value={totalNetRevenue} bold accent="brand" />
              )}
              <div className="border-t border-gray-100 pt-1.5 mt-1.5">
                <CalcRow label="Total entrée" value={caisse.total_entree} bold accent="brand" />
              </div>
            </div>
          </div>

          {/* SORTIES */}
          <div className="px-5 py-3.5">
            <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
              <TrendingDown size={10} /> Sorties
            </p>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5">
                  <CreditCard size={12} className="text-gray-300" />
                  <span className="text-xs text-gray-500">TPE / Carte (→ banque)</span>
                </div>
                <div className="w-28">
                  <InlineInput
                    value={entry?.tpe_amount || 0}
                    onCommit={v => updateEntry('tpe_amount', v)}
                    disabled={readOnly}
                    negative
                  />
                </div>
              </div>

              <CalcRow label="Dépenses" value={caisse.total_expense} negative />
              <CalcRow label="Salaires" value={caisse.total_salary} negative />

              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5">
                  <Vault size={12} className="text-gray-300" />
                  <span className="text-xs text-gray-500">Déposé au coffre</span>
                </div>
                <div className="w-28">
                  <InlineInput
                    value={entry?.coffre_depose || 0}
                    onCommit={v => updateEntry('coffre_depose', v)}
                    disabled={readOnly}
                    negative
                  />
                </div>
              </div>

              <div className="border-t border-gray-100 pt-1.5 mt-1.5">
                <CalcRow label="Total sortie" value={caisse.total_sortie} bold negative accent="danger" />
              </div>
            </div>
          </div>

          {/* SOLDE THÉORIQUE */}
          <div className={cn(
            'px-5 py-4 flex items-center justify-between',
            soldePositif ? 'bg-brand-50' : 'bg-danger-50'
          )}>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-0.5">Solde théorique</p>
              <p className="text-xs text-gray-400">Calculé automatiquement</p>
            </div>
            <div className={cn('text-right', soldePositif ? 'text-brand-500' : 'text-danger-600')}>
              <p className="font-mono font-bold text-2xl tracking-tight">{formatNumber(caisse.solde)}</p>
              <p className="text-[10px] font-medium">DH</p>
            </div>
          </div>

          {/* CAISSE RÉELLE */}
          {(() => {
            const caisseReelle = entry?.caisse_reelle != null ? Number(entry.caisse_reelle) : null
            const ecart = caisseReelle != null ? caisseReelle - caisse.solde : null
            const hasEcart = ecart != null && Math.abs(ecart) >= 0.5
            return (
              <div className="px-5 py-3 border-t border-gray-100">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-0.5">Caisse réelle</p>
                    <p className="text-xs text-gray-400">Comptée physiquement</p>
                  </div>
                  <div className="w-32">
                    <InlineInput
                      value={caisseReelle ?? 0}
                      onCommit={v => updateEntry('caisse_reelle', v)}
                      disabled={readOnly}
                    />
                  </div>
                </div>
                {hasEcart && (
                  <div className={cn(
                    'mt-2 px-3 py-2 rounded-xl flex items-center justify-between text-xs font-semibold',
                    ecart! > 0
                      ? 'bg-brand-50 text-brand-600'
                      : 'bg-danger-50 text-danger-600'
                  )}>
                    <span>{ecart! > 0 ? 'Surplus' : 'Manque'}</span>
                    <span className="font-mono">{ecart! > 0 ? '+' : ''}{formatNumber(ecart!)} DH</span>
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      </div>

      {/* ── RECETTES ── */}
      <SectionCard
        title="Recettes"
        total={totalNetRevenue}
        totalLabel={totalCancellations > 0 ? `recettes nettes (brut ${formatNumber(totalGrossRevenue)} DH)` : 'recettes'}
        totalColor="brand"
        action={!readOnly ? (
          <button onClick={addRevenueLine} className="btn-primary text-xs px-3 py-1.5">
            <Plus size={13} /> Ligne
          </button>
        ) : undefined}
      >
        {revenues.length === 0
          ? <EmptyState message="Aucune recette — ajoutez une ligne" />
          : revenues.map(r => {
            const lineCancel = (lineCancels[r.id] || [])[0]
            const net = Number(r.amount || 0) - Number(lineCancel?.amount || 0)
            return (
              <div key={r.id} className="rounded-xl border border-gray-100 overflow-hidden">
                <div className="flex gap-2 items-center p-2.5">
                  <select
                    value={r.server_name || ''}
                    onChange={e => updateRevLine(r.id, 'server_name', e.target.value)}
                    disabled={readOnly}
                    className="input-field flex-1 text-xs py-1.5 h-9"
                  >
                    <option value="">— Serveur —</option>
                    {serveurs.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>

                  <div className="relative w-28">
                    <BufferedNumberInput
                      value={Number(r.amount || 0)}
                      onCommit={v => updateRevLine(r.id, 'amount', v)}
                      disabled={readOnly}
                      className="input-mono w-full text-xs py-1.5 h-9 pr-7 text-right"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-gray-300 pointer-events-none">DH</span>
                  </div>

                  <PhotoBtn
                    url={r.photo_url}
                    disabled={readOnly}
                    onFile={file => uploadPhoto('revenue_lines', r.id, file, url =>
                      setRevenues(prev => prev.map(x => x.id === r.id ? { ...x, photo_url: url } : x))
                    )}
                  />

                  {!readOnly && (
                    <button onClick={() => removeRevLine(r.id)} className="btn-icon h-9 w-9">
                      <X size={13} />
                    </button>
                  )}
                </div>

                {lineCancel ? (
                  <div className="border-t border-danger-100 bg-danger-50/40 px-2.5 py-2 space-y-1.5">
                    <div className="flex gap-2 items-center">
                      <AlertTriangle size={11} className="text-danger-400 flex-shrink-0" />
                      <div className="relative flex-1">
                        <BufferedNumberInput
                          value={Number(lineCancel.amount || 0)}
                          onCommit={v => updateLineCancel(r.id, lineCancel.id, 'amount', v)}
                          placeholder="Montant annulation"
                          disabled={readOnly}
                          className="input-mono w-full text-xs py-1 h-8 pr-7 text-right border-danger-200"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-gray-300 pointer-events-none">DH</span>
                      </div>
                      <BufferedTextInput
                        value={lineCancel.reason || ''}
                        onCommit={v => updateLineCancel(r.id, lineCancel.id, 'reason', v)}
                        placeholder="Motif *"
                        disabled={readOnly}
                        className="input-field flex-1 text-xs py-1 h-8"
                      />
                      <PhotoBtn
                        url={lineCancel.photo_url}
                        disabled={readOnly}
                        small
                        onFile={file => uploadPhoto('revenue_cancellations', lineCancel.id, file, url =>
                          setLineCancels(prev => ({
                            ...prev,
                            [r.id]: (prev[r.id] || []).map(c => c.id === lineCancel.id ? { ...c, photo_url: url } : c)
                          }))
                        )}
                      />
                      {!readOnly && (
                        <button onClick={() => removeLineCancel(r.id, lineCancel.id)} className="btn-icon h-8 w-8">
                          <X size={11} />
                        </button>
                      )}
                    </div>
                    <div className="flex justify-between items-center px-1">
                      <span className="text-[10px] text-danger-500 font-medium">Annulation : −{formatNumber(Number(lineCancel.amount))} DH</span>
                      <span className="font-mono text-xs font-bold text-brand-500">Net : {formatNumber(net)} DH</span>
                    </div>
                  </div>
                ) : (
                  !readOnly && (
                    <button
                      onClick={() => addLineCancel(r.id, r.server_name || '')}
                      className="w-full flex items-center justify-center gap-1.5 text-[10px] text-danger-400 hover:text-danger-600 hover:bg-danger-50 py-1.5 transition-colors border-t border-gray-50"
                    >
                      <AlertTriangle size={10} /> Ajouter une annulation
                    </button>
                  )
                )}
              </div>
            )
          })
        }
      </SectionCard>

      {/* ── DÉPENSES ── */}
      <SectionCard
        title="Dépenses"
        total={caisse.total_expense}
        totalLabel="dépenses"
        totalColor="danger"
        action={!readOnly ? (
          <button onClick={addExpenseLine} className="btn-danger text-xs px-3 py-1.5">
            <Plus size={13} /> Ligne
          </button>
        ) : undefined}
      >
        {expenses.length === 0
          ? <EmptyState message="Aucune dépense" />
          : expenses.map(r => (
            <div key={r.id} className="rounded-xl border border-gray-100 overflow-hidden">
              <div className="flex gap-2 items-center p-2.5">
                <BufferedTextInput
                  value={r.designation || ''}
                  onCommit={v => updateExpLine(r.id, 'designation', v)}
                  placeholder="Désignation"
                  list="suppliers-list"
                  disabled={readOnly}
                  className="input-field flex-1 text-xs py-1.5 h-9"
                />
                <div className="relative w-28">
                  <BufferedNumberInput
                    value={Number(r.amount || 0)}
                    onCommit={v => updateExpLine(r.id, 'amount', v)}
                    disabled={readOnly}
                    className="input-mono w-full text-xs py-1.5 h-9 pr-7 text-right"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-gray-300 pointer-events-none">DH</span>
                </div>
                <PhotoBtn
                  url={r.photo_url}
                  disabled={readOnly}
                  onFile={file => uploadPhoto('expense_lines', r.id, file, url =>
                    setExpenses(prev => prev.map(x => x.id === r.id ? { ...x, photo_url: url } : x))
                  )}
                />
                {!readOnly && (
                  <button onClick={() => removeExpLine(r.id)} className="btn-icon h-9 w-9">
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>
          ))
        }
      </SectionCard>

      {/* ── SALAIRES ── */}
      <SectionCard
        title="Salaires / Avances du jour"
        total={caisse.total_salary}
        totalLabel="salaires"
        totalColor="warning"
        action={!readOnly ? (
          <button
            onClick={addSalaryLine}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl font-medium bg-warning-50 text-warning-600 hover:bg-warning-100 transition-colors"
          >
            <Plus size={13} /> Ligne
          </button>
        ) : undefined}
      >
        {salaries.length === 0
          ? <EmptyState message="Aucun versement" />
          : salaries.map(r => (
            <div key={r.id} className="rounded-xl border border-gray-100 overflow-hidden">
              <div className="flex gap-2 items-center p-2.5">
                <BufferedTextInput
                  value={r.employee_name || ''}
                  onCommit={v => updateSalLine(r.id, 'employee_name', v)}
                  placeholder="Employé(e)"
                  list="employees-list"
                  disabled={readOnly}
                  className="input-field flex-1 text-xs py-1.5 h-9"
                />
                <div className="relative w-28">
                  <BufferedNumberInput
                    value={Number(r.amount || 0)}
                    onCommit={v => updateSalLine(r.id, 'amount', v)}
                    disabled={readOnly}
                    className="input-mono w-full text-xs py-1.5 h-9 pr-7 text-right"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-gray-300 pointer-events-none">DH</span>
                </div>
                {!readOnly && (
                  <button onClick={() => removeSalLine(r.id)} className="btn-icon h-9 w-9">
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>
          ))
        }
      </SectionCard>

      {/* Datalists */}
      <datalist id="employees-list">
        {serveurs.map(s => <option key={s.id} value={s.name} />)}
      </datalist>
      <datalist id="suppliers-list">
        {supplierNames.map(n => <option key={n} value={n} />)}
      </datalist>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────

function CalcRow({ label, value, negative, bold, highlight, accent }: {
  label: string; value: number; negative?: boolean; bold?: boolean; highlight?: boolean; accent?: 'brand' | 'danger'
}) {
  const textColor = accent === 'brand' ? 'text-brand-500' : accent === 'danger' ? 'text-danger-600' : negative ? 'text-gray-500' : 'text-gray-700'
  return (
    <div className="flex items-center justify-between">
      <span className={cn('text-xs', highlight ? 'font-medium text-gray-700' : 'text-gray-400')}>{label}</span>
      <span className={cn('font-mono text-xs tabular-nums', bold && 'font-bold text-sm', textColor)}>
        {negative && value > 0 ? '−' : ''}{formatNumber(value)} DH
      </span>
    </div>
  )
}

function InlineInput({ value, onCommit, disabled, negative }: {
  value: number; onCommit: (v: number) => void; disabled?: boolean; negative?: boolean
}) {
  const [local, setLocal] = useState(value)
  const committed = useRef(value)
  useEffect(() => { setLocal(value); committed.current = value }, [value])

  const commit = () => {
    if (local !== committed.current) {
      committed.current = local
      onCommit(local)
    }
  }

  return (
    <div className="relative">
      {negative && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-300 font-mono">−</span>}
      <input
        type="number"
        inputMode="decimal"
        value={local === 0 ? '' : local}
        onChange={e => setLocal(e.target.value === '' ? 0 : Number(e.target.value))}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') { e.currentTarget.blur() } }}
        placeholder="0"
        disabled={disabled}
        className={cn(
          'w-full font-mono text-xs text-right rounded-lg border border-gray-200 bg-gray-50 py-1.5 pr-8 outline-none transition-colors',
          negative ? 'pl-5' : 'pl-2',
          'focus:border-brand-400 focus:bg-white focus:ring-1 focus:ring-brand-400/20',
          'disabled:opacity-40 disabled:cursor-not-allowed'
        )}
      />
      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-gray-300">DH</span>
    </div>
  )
}

function BufferedNumberInput({ value, onCommit, placeholder, disabled, className }: {
  value: number; onCommit: (v: number) => void; placeholder?: string; disabled?: boolean; className?: string
}) {
  const [local, setLocal] = useState(value)
  const committed = useRef(value)
  useEffect(() => { setLocal(value); committed.current = value }, [value])

  const commit = () => {
    if (local !== committed.current) {
      committed.current = local
      onCommit(local)
    }
  }

  return (
    <input
      type="number"
      inputMode="decimal"
      value={local === 0 ? '' : local}
      onChange={e => setLocal(e.target.value === '' ? 0 : Number(e.target.value))}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') { e.currentTarget.blur() } }}
      placeholder={placeholder || '0'}
      disabled={disabled}
      className={className}
    />
  )
}

function BufferedTextInput({ value, onCommit, placeholder, disabled, className, list }: {
  value: string; onCommit: (v: string) => void; placeholder?: string; disabled?: boolean; className?: string; list?: string
}) {
  const [local, setLocal] = useState(value)
  const committed = useRef(value)
  useEffect(() => { setLocal(value); committed.current = value }, [value])

  const commit = () => {
    if (local !== committed.current) {
      committed.current = local
      onCommit(local)
    }
  }

  return (
    <input
      type="text"
      value={local}
      onChange={e => setLocal(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') { e.currentTarget.blur() } }}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
      list={list}
    />
  )
}

function SectionCard({ title, total, totalLabel, totalColor, action, children }: {
  title: string; total: number; totalLabel: string; totalColor: 'brand' | 'danger' | 'warning'; action?: React.ReactNode; children: React.ReactNode
}) {
  const colors = { brand: 'bg-brand-50 text-brand-500', danger: 'bg-danger-50 text-danger-600', warning: 'bg-warning-50 text-warning-600' }
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
        {action}
      </div>
      <div className="p-4 space-y-2.5">{children}</div>
      <div className={cn('mx-4 mb-4 px-4 py-2.5 rounded-xl flex items-center justify-between', colors[totalColor])}>
        <span className="text-xs font-semibold">Total {totalLabel}</span>
        <span className="font-mono text-sm font-bold tabular-nums">{formatNumber(total)} DH</span>
      </div>
    </div>
  )
}

function PhotoBtn({ url, onFile, disabled, small }: {
  url?: string | null; onFile: (f: File) => void | Promise<void>; disabled?: boolean; small?: boolean
}) {
  const ref = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const size = small ? 'h-8 w-8' : 'h-9 w-9'

  const handle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    await onFile(file)
    setUploading(false)
    e.target.value = ''
  }

  if (url) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className={cn('flex-shrink-0 rounded-lg overflow-hidden border border-gray-200', size)}>
        <img src={url} alt="bon" className="w-full h-full object-cover hover:opacity-80 transition-opacity" />
      </a>
    )
  }

  return (
    <>
      <button
        onClick={() => ref.current?.click()}
        disabled={disabled || uploading}
        title="Photo du bon"
        className={cn('btn-icon flex-shrink-0 flex items-center justify-center disabled:opacity-40', size)}
      >
        {uploading
          ? <div className="w-3 h-3 border border-gray-300 border-t-brand-400 rounded-full animate-spin" />
          : <Camera size={small ? 11 : 13} />}
      </button>
      <input ref={ref} type="file" accept="image/*" capture="environment" className="hidden" onChange={handle} />
    </>
  )
}