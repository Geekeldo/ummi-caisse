'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MONTHS_FR } from '@/lib/business'
import { useAuth } from '@/hooks/use-auth'
import CalendarPicker from '@/components/ui/calendar-picker'
import { Plus, X, Settings, ClipboardList, PackageCheck, ChevronDown, ChevronUp, Check, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'

interface InventoryItem {
  id: string
  name: string
  unit: string
  is_active: boolean
  sort_order: number
}

interface EntryRow {
  id: string | null
  item_id: string
  initial_stock: number
  purchases: number
  remaining: number
}

interface PendingOrder {
  id: string
  supplier_name: string
  items: { name: string; qty: string; unit: string }[]
  created_at: string
  date: string
}

const UNITS = ['kg', 'g', 'L', 'ml', 'pcs', 'boîtes', 'sacs', 'cartons']
const DAY_NAMES_FR = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

function parseNum(v: string): number {
  const n = parseFloat(v.replace(',', '.'))
  return isNaN(n) ? 0 : n
}

export default function InventoryPage() {
  const supabase = useRef(createClient()).current
  const { user } = useAuth()
  const isAdmin = user?.role?.name === 'super_admin' || user?.role?.name === 'admin'

  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [day, setDay] = useState(now.getDate())

  const [tab, setTab] = useState<'daily' | 'config'>('daily')

  const [items, setItems] = useState<InventoryItem[]>([])
  const [itemsLoaded, setItemsLoaded] = useState(false)
  const [entries, setEntries] = useState<Record<string, EntryRow>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<Set<string>>(new Set())

  // Config state
  const [suppliers, setSuppliers] = useState<{ id: string; name: string; items: string[] }[]>([])
  const suppLoadedRef = useRef(false)
  const [newItemName, setNewItemName] = useState('')
  const [newItemUnit, setNewItemUnit] = useState('kg')
  const [addingItem, setAddingItem] = useState(false)
  const [configError, setConfigError] = useState<string | null>(null)

  // Pending orders (yesterday's orders to validate)
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([])
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)
  const [receptionQty, setReceptionQty] = useState<Record<string, Record<number, string>>>({})

  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  const toLocalDateStr = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const lookbackDateStr = (() => {
    const d = new Date(year, month - 1, day)
    d.setDate(d.getDate() - 90)
    return toLocalDateStr(d)
  })()
  const dayName = DAY_NAMES_FR[new Date(year, month - 1, day).getDay()]
  const monthName = MONTHS_FR[month - 1]

  // Yesterday's date for pending orders
  const yesterdayStr = (() => {
    const d = new Date(year, month - 1, day)
    d.setDate(d.getDate() - 1)
    return toLocalDateStr(d)
  })()

  // ── Load tracked items once ────────────────────────────────
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('is_active', true)
        .order('sort_order')
      setItems((data || []) as InventoryItem[])
      setItemsLoaded(true)
    }
    load()
  }, [supabase])

  // ── Load daily entries whenever date or items change ────────
  const loadEntries = useCallback(async () => {
    if (!itemsLoaded) return
    if (items.length === 0) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const [todayRes, prevRes] = await Promise.all([
        supabase.from('inventory_entries').select('*').eq('date', dateStr),
        supabase
          .from('inventory_entries')
          .select('item_id, remaining, date')
          .lt('date', dateStr)
          .gte('date', lookbackDateStr)
          .order('date', { ascending: false }),
      ])

      const todayMap: Record<string, any> = {}
      for (const e of (todayRes.data || [])) todayMap[e.item_id] = e

      const prevMap: Record<string, number> = {}
      for (const e of (prevRes.data || [])) {
        if (!(e.item_id in prevMap)) {
          prevMap[e.item_id] = Number(e.remaining || 0)
        }
      }

      const rows: Record<string, EntryRow> = {}
      for (const item of items) {
        const today = todayMap[item.id]
        rows[item.id] = {
          id: today?.id ?? null,
          item_id: item.id,
          initial_stock: today ? Number(today.initial_stock) : (prevMap[item.id] ?? 0),
          purchases: today ? Number(today.purchases) : 0,
          remaining: today ? Number(today.remaining) : 0,
        }
      }
      setEntries(rows)
    } finally {
      setLoading(false)
    }
  }, [supabase, dateStr, lookbackDateStr, items, itemsLoaded])

  useEffect(() => { loadEntries() }, [loadEntries])

  // ── Load yesterday's orders ────────────────────────────────
  useEffect(() => {
    if (!itemsLoaded) return
    const load = async () => {
      const { data } = await supabase
        .from('purchase_orders')
        .select('id, supplier_name, items, created_at, date')
        .eq('date', yesterdayStr)
        .order('created_at', { ascending: false })
      setPendingOrders((data || []) as PendingOrder[])
    }
    load()
  }, [supabase, yesterdayStr, itemsLoaded])

  // ── Update a field (upsert) ────────────────────────────────
  const updateField = async (itemId: string, field: 'purchases' | 'remaining', raw: string) => {
    const value = parseNum(raw)

    setEntries(prev => ({ ...prev, [itemId]: { ...prev[itemId], [field]: value } }))

    setSaving(prev => new Set(prev).add(itemId))
    try {
      const current = entries[itemId]
      const payload = {
        date: dateStr,
        month_key: `${year}-${String(month).padStart(2, '0')}`,
        item_id: itemId,
        initial_stock: current?.initial_stock ?? 0,
        purchases: field === 'purchases' ? value : (current?.purchases ?? 0),
        other_entries: 0,
        remaining: field === 'remaining' ? value : (current?.remaining ?? 0),
        created_by: user?.id ?? null,
        updated_at: new Date().toISOString(),
      }

      const existingId = entries[itemId]?.id
      if (existingId) {
        await supabase.from('inventory_entries').update(payload).eq('id', existingId)
      } else {
        const { data } = await supabase.from('inventory_entries').insert(payload).select('id').single()
        if (data?.id) {
          setEntries(prev => ({ ...prev, [itemId]: { ...prev[itemId], id: data.id } }))
        }
      }
    } finally {
      setSaving(prev => { const n = new Set(prev); n.delete(itemId); return n })
    }
  }

  // ── Validate reception of an order → auto-fill purchases ──
  const validateReception = async (order: PendingOrder) => {
    const qtyMap = receptionQty[order.id] || {}
    const trackedNames = new Map(items.map(i => [i.name.toLowerCase(), i.id]))

    for (let i = 0; i < order.items.length; i++) {
      const orderItem = order.items[i]
      const itemId = trackedNames.get(orderItem.name.toLowerCase())
      if (!itemId) continue

      const receivedQty = parseNum(qtyMap[i] ?? orderItem.qty)
      if (receivedQty <= 0) continue

      const current = entries[itemId]
      const newPurchases = (current?.purchases ?? 0) + receivedQty

      await updateField(itemId, 'purchases', String(newPurchases))
    }

    // Remove this order from pending list
    setPendingOrders(prev => prev.filter(o => o.id !== order.id))
    setExpandedOrder(null)
    setReceptionQty(prev => { const n = { ...prev }; delete n[order.id]; return n })
  }

  // ── Load suppliers for config (once) ─────────────────────────
  const loadSuppliers = useCallback(async () => {
    if (suppLoadedRef.current) return
    suppLoadedRef.current = true
    const { data } = await supabase.from('suppliers').select('id, name, items').eq('is_active', true).order('name')
    setSuppliers((data || []).filter((s: any) => (s.items || []).length > 0))
  }, [supabase])

  useEffect(() => {
    if (tab === 'config') loadSuppliers()
  }, [tab, loadSuppliers])

  const addItemFromArticle = async (name: string) => {
    if (items.find(i => i.name.toLowerCase() === name.toLowerCase())) return
    setConfigError(null)
    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .insert({ name, unit: 'kg', is_active: true, sort_order: items.length })
        .select().single()
      if (error) {
        if (error.code === '23505') {
          const { data: reactivated } = await supabase
            .from('inventory_items')
            .update({ is_active: true, sort_order: items.length })
            .eq('name', name)
            .select().single()
          if (reactivated) setItems(prev => [...prev, reactivated as InventoryItem])
        } else {
          setConfigError(error.message)
        }
        return
      }
      if (data) setItems(prev => [...prev, data as InventoryItem])
    } catch (e: any) {
      setConfigError(e.message)
    }
  }

  const addCustomItem = async () => {
    const trimmed = newItemName.trim()
    if (!trimmed || addingItem) return
    if (items.find(i => i.name.toLowerCase() === trimmed.toLowerCase())) {
      setConfigError(`"${trimmed}" existe déjà`)
      return
    }
    setAddingItem(true)
    setConfigError(null)
    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .insert({ name: trimmed, unit: newItemUnit, is_active: true, sort_order: items.length })
        .select().single()
      if (error) {
        if (error.code === '23505') {
          const { data: reactivated } = await supabase
            .from('inventory_items')
            .update({ is_active: true, unit: newItemUnit, sort_order: items.length })
            .eq('name', trimmed)
            .select().single()
          if (reactivated) setItems(prev => [...prev, reactivated as InventoryItem])
        } else {
          setConfigError(error.message)
        }
      } else if (data) {
        setItems(prev => [...prev, data as InventoryItem])
      }
      setNewItemName('')
      setNewItemUnit('kg')
    } finally {
      setAddingItem(false)
    }
  }

  const removeItem = async (id: string) => {
    const { error } = await supabase.from('inventory_items').update({ is_active: false }).eq('id', id)
    if (error) {
      setConfigError(error.message)
      return
    }
    setItems(prev => prev.filter(i => i.id !== id))
    setEntries(prev => { const n = { ...prev }; delete n[id]; return n })
  }

  const updateItemUnit = async (id: string, unit: string) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, unit } : i))
    await supabase.from('inventory_items').update({ unit }).eq('id', id)
  }

  const allArticles = [...new Set(
    suppliers.flatMap(s => (s.items || []).map((item: any) =>
      typeof item === 'string' ? item : item.name || ''
    )).filter(Boolean)
  )].sort()
  const trackedNames = new Set(items.map(i => i.name.toLowerCase()))

  // Filter pending orders to only show those with tracked items
  const relevantOrders = pendingOrders.filter(order =>
    order.items.some(oi => trackedNames.has(oi.name.toLowerCase()))
  )

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Inventaire</h2>
          <p className="text-xs text-gray-400">Suivi des stocks journalier</p>
        </div>
        {isAdmin && (
          <div className="flex rounded-xl border border-gray-200 overflow-hidden">
            <button
              onClick={() => setTab('daily')}
              className={cn('flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors',
                tab === 'daily' ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-50')}
            >
              <ClipboardList size={12} /> Saisie
            </button>
            <button
              onClick={() => setTab('config')}
              className={cn('flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors',
                tab === 'config' ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-50')}
            >
              <Settings size={12} /> Articles
            </button>
          </div>
        )}
      </div>

      {/* ── CONFIG TAB ── */}
      {tab === 'config' && isAdmin && (
        <div className="space-y-4">
          {configError && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl px-4 py-3 flex items-center justify-between animate-fade-up">
              <span>{configError}</span>
              <button onClick={() => setConfigError(null)} className="btn-icon"><X size={14} /></button>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-50">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Articles suivis ({items.length})</p>
            </div>
            {items.length === 0 && (
              <p className="px-5 py-5 text-xs text-gray-300 text-center italic">Aucun article suivi</p>
            )}
            <div className="divide-y divide-gray-50">
              {items.map(item => (
                <div key={item.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="flex-1 text-sm font-medium text-gray-700">{item.name}</span>
                  <select
                    value={item.unit}
                    onChange={e => updateItemUnit(item.id, e.target.value)}
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-500 focus:outline-none"
                  >
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                  <button onClick={() => removeItem(item.id)} className="btn-icon text-danger-400 hover:text-danger-600">
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
            <div className="px-5 py-3 border-t border-gray-50 flex items-center gap-2">
              <input
                type="text"
                value={newItemName}
                onChange={e => setNewItemName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCustomItem()}
                placeholder="Article personnalisé…"
                className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-300"
              />
              <select value={newItemUnit} onChange={e => setNewItemUnit(e.target.value)}
                className="text-xs border border-gray-200 rounded-xl px-2 py-2 bg-white focus:outline-none">
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
              <button onClick={addCustomItem} disabled={!newItemName.trim() || addingItem}
                className="btn-primary text-xs disabled:opacity-40">
                <Plus size={13} /> Ajouter
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-50">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Articles fournisseurs</p>
              <p className="text-[10px] text-gray-300 mt-0.5">Cliquez pour ajouter au suivi</p>
            </div>
            {allArticles.length === 0 ? (
              <p className="px-5 py-5 text-xs text-gray-300 text-center italic">Aucun article fournisseur</p>
            ) : (
              <div className="px-5 py-4 flex flex-wrap gap-2">
                {allArticles.map(art => {
                  const tracked = trackedNames.has(art.toLowerCase())
                  return (
                    <button key={art} onClick={() => !tracked && addItemFromArticle(art)} disabled={tracked}
                      className={cn('px-3 py-1.5 rounded-full text-xs font-medium transition-colors border',
                        tracked ? 'bg-brand-50 border-brand-200 text-brand-500 cursor-default'
                          : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-brand-50 hover:border-brand-200 hover:text-brand-500 cursor-pointer'
                      )}>
                      {tracked ? '✓ ' : '+ '}{art}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── DAILY TAB ── */}
      {tab === 'daily' && (
        <>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3">
            <CalendarPicker year={year} month={month} day={day} onChange={(y, m, d) => { setYear(y); setMonth(m); setDay(d) }} />
          </div>

          <p className="text-xs text-gray-400 font-medium px-1">{dayName} {day} {monthName} {year}</p>

          {/* ── Pending orders notification ── */}
          {relevantOrders.length > 0 && (
            <div className="bg-amber-50 rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-amber-100 flex items-center gap-2">
                <PackageCheck size={14} className="text-amber-600" />
                <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">
                  Commandes à réceptionner ({relevantOrders.length})
                </p>
              </div>

              <div className="divide-y divide-amber-100">
                {relevantOrders.map(order => {
                  const isExpanded = expandedOrder === order.id
                  const qtyMap = receptionQty[order.id] || {}

                  return (
                    <div key={order.id}>
                      <button
                        onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                        className="w-full px-5 py-3 flex items-center justify-between text-left"
                      >
                        <div>
                          <p className="text-sm font-semibold text-amber-800">{order.supplier_name}</p>
                          <p className="text-[10px] text-amber-500">
                            {order.items.length} article{order.items.length > 1 ? 's' : ''} — commandé le {new Date(order.date).toLocaleDateString('fr-MA')}
                          </p>
                        </div>
                        {isExpanded ? <ChevronUp size={14} className="text-amber-400" /> : <ChevronDown size={14} className="text-amber-400" />}
                      </button>

                      {isExpanded && (
                        <div className="px-5 pb-4 space-y-2">
                          {order.items.map((oi, idx) => {
                            const isTracked = trackedNames.has(oi.name.toLowerCase())
                            const currentQty = qtyMap[idx] ?? oi.qty

                            return (
                              <div key={idx} className={cn(
                                'flex items-center gap-3 px-3 py-2 rounded-xl',
                                isTracked ? 'bg-white border border-amber-100' : 'bg-amber-50/50 opacity-50'
                              )}>
                                <span className={cn('flex-1 text-sm', isTracked ? 'text-gray-700' : 'text-gray-400 line-through')}>
                                  {oi.name}
                                </span>
                                {isTracked ? (
                                  <>
                                    <input
                                      type="number"
                                      inputMode="decimal"
                                      value={currentQty}
                                      onChange={e => setReceptionQty(prev => ({
                                        ...prev,
                                        [order.id]: { ...(prev[order.id] || {}), [idx]: e.target.value }
                                      }))}
                                      className="w-16 text-right font-mono text-sm rounded-lg border border-amber-200 px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-amber-300"
                                    />
                                    <span className="text-xs text-gray-400 w-12">{oi.unit || ''}</span>
                                  </>
                                ) : (
                                  <span className="text-xs text-gray-400 italic">Non suivi</span>
                                )}
                              </div>
                            )
                          })}

                          <div className="flex items-center gap-2 pt-1">
                            <button
                              onClick={() => validateReception(order)}
                              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-amber-600 text-white hover:bg-amber-700 transition-colors"
                            >
                              <Check size={13} /> Valider la réception
                            </button>
                            <button
                              onClick={() => { setExpandedOrder(null); setPendingOrders(prev => prev.filter(o => o.id !== order.id)) }}
                              className="text-xs text-gray-400 hover:text-gray-600 px-3 py-2"
                            >
                              Ignorer
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Inventory grid ── */}
          {!itemsLoaded || (loading && items.length > 0) ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-gray-100 border-t-brand-400 rounded-full animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
              <p className="text-sm text-gray-400">Aucun article à inventorier.</p>
              {isAdmin ? (
                <button onClick={() => setTab('config')} className="mt-3 text-xs text-brand-500 font-medium underline underline-offset-2">
                  Configurer les articles →
                </button>
              ) : (
                <p className="text-xs text-gray-300 mt-1">Demandez à l'admin d'ajouter des articles.</p>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="hidden sm:grid grid-cols-[1fr_64px_72px_72px_68px] px-4 py-2 bg-gray-50 border-b border-gray-100 gap-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Article</span>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Initial</span>
                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider text-right">Achats</span>
                <span className="text-[10px] font-bold text-green-500 uppercase tracking-wider text-right">Reste</span>
                <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wider text-right">Conso</span>
              </div>

              <div className="divide-y divide-gray-50">
                {items.map(item => {
                  const row = entries[item.id]
                  if (!row) return null
                  const conso = row.initial_stock + row.purchases - row.remaining
                  const isSav = saving.has(item.id)

                  return (
                    <div key={item.id} className={cn('transition-opacity', isSav && 'opacity-60')}>
                      <div className="hidden sm:grid grid-cols-[1fr_64px_72px_72px_68px] px-4 py-2.5 items-center gap-1">
                        <div className="min-w-0 pr-2">
                          <p className="text-sm font-medium text-gray-700 truncate">{item.name}</p>
                          <p className="text-[10px] text-gray-400">{item.unit}</p>
                        </div>
                        <div className="text-right">
                          <span className="font-mono text-xs text-gray-400">{row.initial_stock || '—'}</span>
                        </div>
                        <NumInput value={row.purchases} onChange={v => updateField(item.id, 'purchases', v)} accent="blue" />
                        <NumInput value={row.remaining} onChange={v => updateField(item.id, 'remaining', v)} accent="green" />
                        <div className="text-right">
                          <span className={cn('font-mono text-xs font-bold',
                            conso > 0 ? 'text-orange-500' : conso < 0 ? 'text-danger-500' : 'text-gray-300'
                          )}>
                            {conso !== 0 ? Number(conso.toFixed(2)) : '—'}
                          </span>
                        </div>
                      </div>

                      <div className="sm:hidden px-4 py-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold text-gray-700">{item.name}</p>
                            <p className="text-[10px] text-gray-400">{item.unit} · Initial : {row.initial_stock || 0}</p>
                          </div>
                          <span className={cn('font-mono text-sm font-bold',
                            conso > 0 ? 'text-orange-500' : conso < 0 ? 'text-danger-500' : 'text-gray-300'
                          )}>
                            {conso !== 0 ? `${Number(conso.toFixed(2))} ${item.unit}` : '—'}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <p className="text-[10px] text-blue-400 font-semibold mb-1">Achats</p>
                            <NumInput value={row.purchases} onChange={v => updateField(item.id, 'purchases', v)} accent="blue" />
                          </div>
                          <div>
                            <p className="text-[10px] text-green-500 font-semibold mb-1">Reste</p>
                            <NumInput value={row.remaining} onChange={v => updateField(item.id, 'remaining', v)} accent="green" />
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100 hidden sm:flex flex-wrap gap-3 text-[10px] text-gray-400">
                <span><strong className="text-gray-500">Initial</strong> = stock veille</span>
                <span>·</span>
                <span><strong className="text-blue-400">Achats</strong> = reçus aujourd'hui</span>
                <span>·</span>
                <span><strong className="text-green-500">Reste</strong> = fin de journée</span>
                <span>·</span>
                <span><strong className="text-orange-500">Conso</strong> = Initial + Achats − Reste</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function NumInput({ value, onChange, accent }: {
  value: number
  onChange: (v: string) => void
  accent: 'blue' | 'green'
}) {
  const [local, setLocal] = useState(value === 0 ? '' : String(value))

  useEffect(() => {
    setLocal(value === 0 ? '' : String(value))
  }, [value])

  const ring = accent === 'blue'
    ? 'focus:ring-blue-300 border-blue-100 text-blue-700'
    : 'focus:ring-green-300 border-green-100 text-green-700'
  const hasValue = local !== '' && Number(local) !== 0

  return (
    <input
      type="number"
      inputMode="decimal"
      min="0"
      step="0.1"
      value={local}
      onChange={e => setLocal(e.target.value)}
      onBlur={() => onChange(local)}
      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
      placeholder="—"
      className={cn(
        'w-full text-right font-mono text-xs rounded-lg border px-1.5 py-1.5 focus:outline-none focus:ring-2',
        hasValue
          ? cn('font-semibold bg-white', ring)
          : 'border-gray-100 text-gray-300 bg-transparent placeholder-gray-200'
      )}
    />
  )
}
