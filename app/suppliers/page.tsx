'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDH, MONTHS_FR } from '@/lib/business'
import { Card, InputField, MonoNum, EmptyState } from '@/components/ui'
import CalendarPicker from '@/components/ui/calendar-picker'
import { useAuth } from '@/hooks/use-auth'
import { Plus, X, Check, Pencil, Phone, Calendar, ChevronDown, ChevronUp, Archive } from 'lucide-react'

// Article = { name, unit } — backward compat: old data may be plain strings
interface Article { name: string; unit: string }

function normalizeArticles(raw: any[]): Article[] {
  if (!Array.isArray(raw)) return []
  return raw.map(item =>
    typeof item === 'string'
      ? { name: item, unit: '' }
      : { name: item.name || '', unit: item.unit || '' }
  )
}

const UNITS = ['', 'kg', 'g', 'L', 'ml', 'pcs', 'boîtes', 'sacs', 'cartons', 'caisses']

function getWhatsAppUrl(phone: string, supplierName: string, items: Article[]): string {
  let cleaned = phone.replace(/[\s\-\.()]/g, '')
  if (cleaned.startsWith('0')) cleaned = '212' + cleaned.slice(1)
  else if (cleaned.startsWith('+')) cleaned = cleaned.slice(1)

  const itemList = items.length > 0
    ? items.map(i => `  - ${i.name}${i.unit ? ' (' + i.unit + ')' : ''}`).join('\n')
    : '  (à préciser)'

  const message = `Bonjour ${supplierName},\n\nJe souhaite passer commande :\n${itemList}\n\nMerci.`
  return `https://wa.me/${cleaned}?text=${encodeURIComponent(message)}`
}

function WhatsAppIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

export default function SuppliersPage() {
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
  const { user } = useAuth()
  const isSuperAdmin = user?.role?.name === 'super_admin'

  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [day, setDay] = useState(now.getDate())

  const [suppliers, setSuppliers] = useState<any[]>([])
  const [editId, setEditId] = useState<string | null>(null)
  const [editPhone, setEditPhone] = useState('')
  const [newItem, setNewItem] = useState('')
  const [newItemUnit, setNewItemUnit] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newSupplierItems, setNewSupplierItems] = useState<Article[]>([])
  const [newSuppItem, setNewSuppItem] = useState('')
  const [newSuppItemUnit, setNewSuppItemUnit] = useState('')
  const [loading, setLoading] = useState(true)

  // ── Suivi calendrier ──
  const [showSuivi, setShowSuivi] = useState(false)
  const [expenseData, setExpenseData] = useState<{ date: string; designation: string; amount: number }[]>([])
  const [loadingSuivi, setLoadingSuivi] = useState(false)

  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  const monthKey = `${year}-${String(month).padStart(2, '0')}`

  const setDate = (y: number, m: number, d: number) => { setYear(y); setMonth(m); setDay(d) }

  // ── Load suppliers ──
  useEffect(() => {
    const load = async () => {
      try {
        const { data: supps } = await supabase.from('suppliers').select('*').eq('is_active', true).order('name')
        setSuppliers(supps || [])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [supabase])

  // ── Load expense data for selected month (super_admin only) ──
  useEffect(() => {
    if (!showSuivi || !isSuperAdmin) return
    const load = async () => {
      setLoadingSuivi(true)
      try {
        const { data } = await supabase
          .from('expense_lines')
          .select('designation, amount, daily_entry:daily_entries!inner(date, month_key)')
          .eq('daily_entry.month_key', monthKey)

        const rows = (data || []).map((d: any) => ({
          date: d.daily_entry?.date || '',
          designation: (d.designation || '').trim(),
          amount: Number(d.amount || 0),
        }))
        setExpenseData(rows)
      } finally {
        setLoadingSuivi(false)
      }
    }
    load()
  }, [monthKey, showSuivi, isSuperAdmin, supabase])

  // ── Compute per-supplier totals ──
  const { dayExpenses, monthTotals, grandMonth } = useMemo(() => {
    const dayExp: { supplier: string; amount: number }[] = []
    const monthTot: Record<string, number> = {}

    for (const row of expenseData) {
      const matchedSupplier = suppliers.find(s => s.name.toLowerCase() === row.designation.toLowerCase())
      if (!matchedSupplier) continue
      const name = matchedSupplier.name
      monthTot[name] = (monthTot[name] || 0) + row.amount
      if (row.date === dateStr) {
        dayExp.push({ supplier: name, amount: row.amount })
      }
    }

    const grand = Object.values(monthTot).reduce((s, v) => s + v, 0)
    return { dayExpenses: dayExp, monthTotals: monthTot, grandMonth: grand }
  }, [expenseData, dateStr, suppliers])

  // Day total
  const dayTotal = dayExpenses.reduce((s, e) => s + e.amount, 0)
  // Aggregate day expenses per supplier
  const dayBySupplier: Record<string, number> = {}
  for (const e of dayExpenses) {
    dayBySupplier[e.supplier] = (dayBySupplier[e.supplier] || 0) + e.amount
  }

  const addSupplier = async () => {
    if (!newName.trim()) return
    const { data, error } = await supabase
      .from('suppliers')
      .insert({ name: newName.trim(), phone: newPhone.trim() || null, items: newSupplierItems })
      .select().single()
    if (error) { console.error('addSupplier error:', error); return }
    if (data) {
      setSuppliers(prev => [...prev, data])
      setNewName('')
      setNewPhone('')
      setNewSupplierItems([])
      setShowAdd(false)
    }
  }

  const archiveSupplier = async (id: string) => {
    const s = suppliers.find(x => x.id === id)
    if (!s || !confirm(`Archiver le fournisseur "${s.name}" ? Il ne sera plus visible mais ses données sont conservées.`)) return
    const { error } = await supabase.from('suppliers').update({ is_active: false }).eq('id', id)
    if (error) { console.error('archiveSupplier error:', error); return }
    setSuppliers(prev => prev.filter(x => x.id !== id))
  }

  const savePhone = async (suppId: string, phone: string) => {
    const { error } = await supabase.from('suppliers').update({ phone: phone.trim() || null }).eq('id', suppId)
    if (error) { console.error('savePhone error:', error); return }
    setSuppliers(prev => prev.map(x => x.id === suppId ? { ...x, phone: phone.trim() || null } : x))
  }

  const addItem = async (suppId: string) => {
    if (!newItem.trim()) return
    const s = suppliers.find(x => x.id === suppId)
    if (!s) return
    const articles = normalizeArticles(s.items)
    const updated = [...articles, { name: newItem.trim(), unit: newItemUnit }]
    const { error } = await supabase.from('suppliers').update({ items: updated }).eq('id', suppId)
    if (error) { console.error('addItem error:', error); return }
    setSuppliers(prev => prev.map(x => x.id === suppId ? { ...x, items: updated } : x))
    setNewItem('')
    setNewItemUnit('')
  }

  const removeItem = async (suppId: string, idx: number) => {
    const s = suppliers.find(x => x.id === suppId)
    if (!s) return
    const articles = normalizeArticles(s.items)
    const updated = articles.filter((_, i) => i !== idx)
    const { error } = await supabase.from('suppliers').update({ items: updated }).eq('id', suppId)
    if (error) { console.error('removeItem error:', error); return }
    setSuppliers(prev => prev.map(x => x.id === suppId ? { ...x, items: updated } : x))
  }

  const updateItemUnit = async (suppId: string, idx: number, unit: string) => {
    const s = suppliers.find(x => x.id === suppId)
    if (!s) return
    const articles = normalizeArticles(s.items)
    articles[idx] = { ...articles[idx], unit }
    const { error } = await supabase.from('suppliers').update({ items: articles }).eq('id', suppId)
    if (error) { console.error('updateItemUnit error:', error); return }
    setSuppliers(prev => prev.map(x => x.id === suppId ? { ...x, items: articles } : x))
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="w-6 h-6 border-2 border-gray-100 border-t-brand-400 rounded-full animate-spin" /></div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Fournisseurs</h2>
          <p className="text-xs text-gray-400">Gestion des fournisseurs et articles</p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} className="btn-primary text-xs">
          <Plus size={14} /> Fournisseur
        </button>
      </div>

      {/* ── Suivi dépenses (super_admin only) ── */}
      {isSuperAdmin && (
        <Card>
          <button
            onClick={() => setShowSuivi(!showSuivi)}
            className="w-full card-header flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-brand-400" />
              <h3 className="text-sm font-semibold tracking-tight">Suivi dépenses fournisseurs</h3>
            </div>
            {showSuivi ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
          </button>

          {showSuivi && (
            <div className="card-body space-y-4">
              {/* Calendrier */}
              <div className="bg-white rounded-xl border border-gray-100 px-3 py-2">
                <CalendarPicker year={year} month={month} day={day} onChange={setDate} />
              </div>

              {loadingSuivi ? (
                <div className="flex items-center justify-center py-6">
                  <div className="w-5 h-5 border-2 border-gray-100 border-t-brand-400 rounded-full animate-spin" />
                </div>
              ) : (
                <div className="space-y-3">
                  {/* ── Dépenses du jour sélectionné ── */}
                  <div className="rounded-xl border border-gray-100 overflow-hidden">
                    <div className="px-3 py-2 bg-brand-50 flex items-center justify-between">
                      <span className="text-xs font-semibold text-brand-700">
                        {day} {MONTHS_FR[month - 1]} {year}
                      </span>
                      <span className="font-mono text-xs font-bold text-brand-600">{formatDH(dayTotal)}</span>
                    </div>
                    <div className="p-3">
                      {Object.keys(dayBySupplier).length === 0 ? (
                        <p className="text-xs text-gray-300 italic text-center py-2">Aucune dépense ce jour</p>
                      ) : (
                        <div className="space-y-1.5">
                          {Object.entries(dayBySupplier).map(([name, amount]) => (
                            <div key={name} className="flex items-center justify-between">
                              <span className="text-xs text-gray-600">{name}</span>
                              <span className="font-mono text-xs font-semibold text-danger-500">{formatDH(amount)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── Résumé du mois ── */}
                  <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 space-y-1.5">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                      Résumé — {MONTHS_FR[month - 1]} {year}
                    </p>
                    {Object.keys(monthTotals).length === 0 ? (
                      <p className="text-xs text-gray-300 italic">Aucune dépense ce mois</p>
                    ) : (
                      <>
                        {Object.entries(monthTotals)
                          .sort((a, b) => b[1] - a[1])
                          .map(([name, amount]) => (
                            <div key={name} className="flex items-center justify-between">
                              <span className="text-xs text-gray-500">{name}</span>
                              <span className="font-mono text-xs font-semibold text-gray-700">{formatDH(amount)}</span>
                            </div>
                          ))}
                        <div className="border-t border-gray-200 pt-1.5 flex items-center justify-between">
                          <span className="text-xs font-bold text-gray-700">Total</span>
                          <span className="font-mono text-sm font-bold text-danger-500">{formatDH(grandMonth)}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {/* ── Add supplier form ── */}
      {showAdd && (
        <Card className="animate-fade-up">
          <div className="card-body space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Nouveau fournisseur</p>
            <div className="flex gap-2 items-end flex-wrap">
              <InputField label="Nom" type="text" value={newName} onChange={setNewName} className="flex-1 min-w-[140px]" />
              <InputField label="Téléphone" type="text" value={newPhone} onChange={setNewPhone} className="flex-1 min-w-[160px]" placeholder="0612345678" />
            </div>

            {/* Articles for new supplier */}
            <div>
              <p className="label mb-1.5">Articles</p>
              {newSupplierItems.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {newSupplierItems.map((art, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-brand-50 border border-brand-100 text-xs text-brand-600">
                      {art.name}{art.unit ? ` (${art.unit})` : ''}
                      <button onClick={() => setNewSupplierItems(prev => prev.filter((_, i) => i !== idx))} className="text-brand-400 hover:text-danger-500 ml-0.5">
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  value={newSuppItem}
                  onChange={e => setNewSuppItem(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && newSuppItem.trim()) {
                      setNewSupplierItems(prev => [...prev, { name: newSuppItem.trim(), unit: newSuppItemUnit }])
                      setNewSuppItem('')
                      setNewSuppItemUnit('')
                    }
                  }}
                  placeholder="Nom de l'article…"
                  className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-300"
                />
                <select
                  value={newSuppItemUnit}
                  onChange={e => setNewSuppItemUnit(e.target.value)}
                  className="text-xs border border-gray-200 rounded-xl px-2 py-2 bg-white focus:outline-none"
                >
                  {UNITS.map(u => <option key={u} value={u}>{u || '— Unité —'}</option>)}
                </select>
                <button
                  onClick={() => {
                    if (newSuppItem.trim()) {
                      setNewSupplierItems(prev => [...prev, { name: newSuppItem.trim(), unit: newSuppItemUnit }])
                      setNewSuppItem('')
                      setNewSuppItemUnit('')
                    }
                  }}
                  disabled={!newSuppItem.trim()}
                  className="btn-icon text-brand-500 disabled:text-gray-300"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={addSupplier} disabled={!newName.trim()} className="btn-primary text-xs disabled:opacity-40">Créer le fournisseur</button>
              <button onClick={() => { setShowAdd(false); setNewSupplierItems([]) }} className="btn-icon text-xs px-3">Annuler</button>
            </div>
          </div>
        </Card>
      )}

      {suppliers.length === 0 && (
        <Card><div className="card-body"><EmptyState message="Aucun fournisseur actif" /></div></Card>
      )}

      {suppliers.map(s => {
        const isEdit = editId === s.id
        const articles = normalizeArticles(s.items)
        const hasPhone = !!s.phone?.trim()

        return (
          <Card key={s.id}>
            {/* Header */}
            <div className="card-header">
              <div className="flex items-center gap-2 min-w-0">
                <h3 className="text-sm font-semibold tracking-tight truncate">{s.name}</h3>
                {isSuperAdmin && showSuivi && (monthTotals[s.name] || 0) > 0 && (
                  <MonoNum value={monthTotals[s.name]} size="text-xs" color="text-danger-500" suffix="DH" />
                )}
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {hasPhone && (
                  <div className="flex items-center gap-1">
                    <span className="flex items-center gap-1 text-[10px] text-gray-400 mr-1">
                      <Phone size={10} /> {s.phone}
                    </span>
                    <a
                      href={getWhatsAppUrl(s.phone, s.name, articles)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`Commander via WhatsApp — ${s.name}`}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold
                                 bg-[#25D366]/10 text-[#128C7E] hover:bg-[#25D366]/20 transition-colors duration-150"
                    >
                      <WhatsAppIcon size={12} />
                      Commander
                    </a>
                  </div>
                )}
                <button
                  onClick={async () => {
                    if (isEdit) {
                      if (editPhone !== (s.phone || '')) {
                        await savePhone(s.id, editPhone)
                      }
                      setEditId(null)
                    } else {
                      setEditPhone(s.phone || '')
                      setEditId(s.id)
                    }
                  }}
                  className="btn-icon"
                >
                  {isEdit ? <Check size={14} /> : <Pencil size={14} />}
                </button>
                {isEdit && (
                  <button onClick={() => archiveSupplier(s.id)} className="btn-icon text-amber-500" title="Archiver">
                    <Archive size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Body */}
            <div className="card-body">
              {isEdit ? (
                <div>
                  <div className="mb-3">
                    <InputField
                      label="WhatsApp / Téléphone"
                      type="text"
                      value={editPhone}
                      onChange={setEditPhone}
                      placeholder="Ex: 0612345678"
                    />
                  </div>

                  <p className="label mb-1.5">Articles</p>
                  <div className="space-y-1.5 mb-3">
                    {articles.map((art, idx) => (
                      <div key={idx} className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-gray-50 border border-gray-100">
                        <span className="flex-1 text-sm text-gray-700">{art.name}</span>
                        <select
                          value={art.unit}
                          onChange={e => updateItemUnit(s.id, idx, e.target.value)}
                          className="text-xs border border-gray-200 rounded-lg px-1.5 py-1 bg-white text-gray-500 focus:outline-none"
                        >
                          {UNITS.map(u => <option key={u} value={u}>{u || '— Unité —'}</option>)}
                        </select>
                        <button onClick={() => removeItem(s.id, idx)} className="text-danger-400 hover:text-danger-600">
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                    {articles.length === 0 && <span className="text-xs text-gray-300 italic">Aucun article</span>}
                  </div>

                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={newItem}
                      onChange={e => setNewItem(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addItem(s.id)}
                      placeholder="Nouvel article…"
                      className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-300"
                    />
                    <select
                      value={newItemUnit}
                      onChange={e => setNewItemUnit(e.target.value)}
                      className="text-xs border border-gray-200 rounded-xl px-2 py-2 bg-white focus:outline-none"
                    >
                      {UNITS.map(u => <option key={u} value={u}>{u || '— Unité —'}</option>)}
                    </select>
                    <button onClick={() => addItem(s.id)} disabled={!newItem.trim()} className="btn-primary text-xs disabled:opacity-40">Ajouter</button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {articles.slice(0, 12).map((art, idx) => (
                    <span key={idx} className="px-2.5 py-1 rounded-full bg-gray-50 text-[11px] text-gray-500 border border-gray-100/80">
                      {art.name}{art.unit ? <span className="text-gray-300 ml-1">({art.unit})</span> : ''}
                    </span>
                  ))}
                  {articles.length > 12 && (
                    <span className="px-2.5 py-1 rounded-full bg-gray-100 text-[11px] text-gray-400">
                      +{articles.length - 12}
                    </span>
                  )}
                  {articles.length === 0 && (
                    <span className="text-xs text-gray-300 italic">Aucun article — cliquez sur modifier</span>
                  )}
                </div>
              )}
            </div>
          </Card>
        )
      })}
    </div>
  )
}
