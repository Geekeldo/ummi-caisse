'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MONTHS_FR } from '@/lib/business'
import { useAuth } from '@/hooks/use-auth'
import CalendarPicker from '@/components/ui/calendar-picker'
import { ShoppingCart, FileText, ChevronDown, ChevronUp, Clock, User, X, Plus, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { logActivity } from '@/lib/log-activity'

interface SupplierArticle { name: string; unit: string }

interface Supplier {
  id: string
  name: string
  phone: string | null
  items: SupplierArticle[]
}

function normalizeArticles(raw: any[]): SupplierArticle[] {
  if (!Array.isArray(raw)) return []
  return raw.map(item =>
    typeof item === 'string'
      ? { name: item, unit: '' }
      : { name: item.name || '', unit: item.unit || '' }
  )
}

interface SavedOrder {
  id: string
  supplier_name: string
  items: { name: string; qty: string; unit: string }[]
  notes: string | null
  created_by_name: string | null
  created_at: string
}

function cleanPhone(phone: string): string {
  let p = phone.replace(/[\s\-\.()]/g, '')
  if (p.startsWith('0')) p = '212' + p.slice(1)
  else if (p.startsWith('+')) p = p.slice(1)
  return p
}

function getPdfFilename(supplierName: string, date: string): string {
  const safe = supplierName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_àâäéèêëïîôùûüçÀÂÄÉÈÊËÏÎÔÙÛÜÇ-]/g, '')
  return `ummi_${safe}_${date}.pdf`
}

async function generateBdcPdf(
  supplierName: string,
  lines: { name: string; qty: string; unit: string }[],
  date: string,
  createdByName: string,
  note?: string
): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pw = doc.internal.pageSize.getWidth()
  const dateLabel = new Date(date).toLocaleDateString('fr-MA', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
  const mx = 20 // margin x
  let y = 25

  // ── Header ──
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.text('UMMI', mx, y)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text('Bon de commande', pw - mx, y - 6, { align: 'right' })
  doc.setFontSize(9)
  doc.setTextColor(100)
  doc.text(`Fournisseur : ${supplierName}`, pw - mx, y, { align: 'right' })
  doc.text(`Date : ${dateLabel}`, pw - mx, y + 5, { align: 'right' })
  doc.text(`Créé par : ${createdByName}`, pw - mx, y + 10, { align: 'right' })

  y += 16
  doc.setDrawColor(30)
  doc.setLineWidth(0.5)
  doc.line(mx, y, pw - mx, y)
  y += 10

  // ── Table header ──
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(130)
  doc.text('ARTICLE', mx, y)
  doc.text('QTÉ', pw - mx - 30, y, { align: 'right' })
  doc.text('UNITÉ', pw - mx, y, { align: 'right' })
  y += 2
  doc.setDrawColor(230)
  doc.setLineWidth(0.2)
  doc.line(mx, y, pw - mx, y)
  y += 6

  // ── Table rows ──
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(30)

  for (const l of lines) {
    doc.text(l.name, mx, y)
    doc.setFont('helvetica', 'bold')
    doc.text(l.qty, pw - mx - 30, y, { align: 'right' })
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(120)
    doc.text(l.unit || '—', pw - mx, y, { align: 'right' })
    doc.setTextColor(30)
    y += 7
    doc.setDrawColor(245)
    doc.line(mx, y - 2, pw - mx, y - 2)
  }

  // ── Note ──
  if (note?.trim()) {
    y += 4
    doc.setFillColor(255, 251, 240)
    doc.roundedRect(mx, y - 4, pw - mx * 2, 14, 2, 2, 'F')
    doc.setDrawColor(192, 128, 64)
    doc.setLineWidth(0.6)
    doc.line(mx, y - 4, mx, y + 10)
    doc.setFontSize(9)
    doc.setTextColor(100)
    doc.text(`Note : ${note.trim()}`, mx + 4, y + 3)
    y += 18
  }

  // ── Footer ──
  y = doc.internal.pageSize.getHeight() - 15
  doc.setDrawColor(220)
  doc.setLineWidth(0.2)
  doc.line(mx, y, pw - mx, y)
  y += 5
  doc.setFontSize(8)
  doc.setTextColor(170)
  doc.text('UMMI', mx, y)
  doc.text(`Généré le ${new Date().toLocaleDateString('fr-MA')} par ${createdByName}`, pw - mx, y, { align: 'right' })

  return doc.output('blob')
}

function buildWhatsAppUrl(phone: string, text: string): string {
  return `https://wa.me/${cleanPhone(phone)}?text=${encodeURIComponent(text)}`
}

function buildWhatsAppText(supplierName: string, lines: { name: string; qty: string; unit: string }[], date: string, note?: string): string {
  const dateLabel = new Date(date).toLocaleDateString('fr-MA', { day: 'numeric', month: 'long', year: 'numeric' })
  const itemList = lines.map(l => `  • ${l.name} : ${l.qty}${l.unit ? ' ' + l.unit : ''}`).join('\n')
  const noteStr = note?.trim() ? `\n\n📝 Note : ${note.trim()}` : ''
  return `Bonjour,\n\nBon de commande — *UMMI*\nDate : ${dateLabel}\n\n*${supplierName}*\n${itemList}${noteStr}\n\nMerci.`
}

function WhatsAppIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

const UNITS = ['', 'kg', 'g', 'L', 'ml', 'pcs', 'boîtes', 'sacs', 'cartons', 'caisses']
const DAY_NAMES_FR = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

export default function OrdersPage() {
  const supabase = useRef(createClient()).current
  const { user } = useAuth()

  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [day, setDay] = useState(now.getDate())

  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [savedOrders, setSavedOrders] = useState<SavedOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  // New order mode
  const [showNewOrder, setShowNewOrder] = useState(false)
  const [selectedSuppId, setSelectedSuppId] = useState<string | null>(null)
  const [expandedArts, setExpandedArts] = useState<Set<string>>(new Set())
  const [quantities, setQuantities] = useState<Record<string, Record<number, { qty: string; unit: string }>>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [pdfResult, setPdfResult] = useState<{
    blob: Blob
    filename: string
    suppName: string
    phone: string | null
    lines: { name: string; qty: string; unit: string }[]
    note?: string
  } | null>(null)

  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  const monthKey = `${year}-${String(month).padStart(2, '0')}`
  const dayName = DAY_NAMES_FR[new Date(year, month - 1, day).getDay()]
  const monthName = MONTHS_FR[month - 1]

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const { data } = await supabase.from('suppliers').select('id, name, phone, items').eq('is_active', true).order('name')
      const supps = (data || [])
        .map((s: any) => ({ ...s, items: normalizeArticles(s.items) }))
        .filter((s: Supplier) => s.items.length > 0)
      setSuppliers(supps)
      setLoading(false)
    }
    load()
  }, [supabase])

  const loadOrders = useCallback(async () => {
    const { data } = await supabase
      .from('purchase_orders')
      .select('id, supplier_name, items, notes, created_by_name, created_at')
      .eq('date', dateStr)
      .order('created_at', { ascending: false })
    setSavedOrders((data || []) as SavedOrder[])
  }, [supabase, dateStr])

  useEffect(() => { loadOrders() }, [loadOrders])

  const setQty = (suppId: string, idx: number, field: 'qty' | 'unit', value: string) => {
    setQuantities(prev => ({
      ...prev,
      [suppId]: {
        ...(prev[suppId] || {}),
        [idx]: { ...(prev[suppId]?.[idx] || { qty: '', unit: '' }), [field]: value },
      },
    }))
  }

  const getOrderLines = (supp: Supplier) => {
    const suppQty = quantities[supp.id] || {}
    return (supp.items || [])
      .map((art, idx) => ({
        name: art.name,
        qty: suppQty[idx]?.qty || '',
        unit: suppQty[idx]?.unit || art.unit || '',
      }))
      .filter(l => l.qty.trim() !== '' && Number(l.qty) > 0)
  }

  const toggleArts = (id: string) => {
    setExpandedArts(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const handleGenerate = async (supp: Supplier) => {
    const lines = getOrderLines(supp)
    if (lines.length === 0) return

    setSaving(supp.id)
    setPdfResult(null)

    const note = notes[supp.id]

    await supabase.from('purchase_orders').insert({
      date: dateStr,
      month_key: monthKey,
      supplier_id: supp.id,
      supplier_name: supp.name,
      items: lines,
      notes: note?.trim() || null,
      created_by: user?.id || null,
      created_by_name: user?.full_name || null,
    })

    await loadOrders()

    if (user) {
      logActivity({
        userId: user.id, userName: user.full_name,
        action: `Commande générée — ${supp.name} (${lines.length} article${lines.length > 1 ? 's' : ''})`,
        category: 'commande',
        detail: supp.name,
        date: dateStr, monthKey,
      })
    }

    const filename = getPdfFilename(supp.name, dateStr)
    const blob = await generateBdcPdf(supp.name, lines, dateStr, user?.full_name || 'UMMI', note)

    setPdfResult({
      blob,
      filename,
      suppName: supp.name,
      phone: supp.phone?.trim() || null,
      lines,
      note,
    })

    setQuantities(prev => { const n = { ...prev }; delete n[supp.id]; return n })
    setNotes(prev => { const n = { ...prev }; delete n[supp.id]; return n })
    setSaving(null)
    setSelectedSuppId(null)
    setShowNewOrder(false)
  }

  const openOrderPdf = async (order: SavedOrder) => {
    const supp = suppliers.find(s => s.name === order.supplier_name)
    const filename = getPdfFilename(order.supplier_name, dateStr)
    const blob = await generateBdcPdf(order.supplier_name, order.items, dateStr, order.created_by_name || 'UMMI', order.notes || undefined)

    setPdfResult({
      blob,
      filename,
      suppName: order.supplier_name,
      phone: supp?.phone?.trim() || null,
      lines: order.items,
      note: order.notes || undefined,
    })
  }

  const sharePdfWhatsApp = async () => {
    if (!pdfResult) return
    const pdfFile = new File([pdfResult.blob], pdfResult.filename, { type: 'application/pdf' })

    // Try native share with the PDF file (works on Android/iOS)
    if (navigator.share && navigator.canShare?.({ files: [pdfFile] })) {
      try {
        await navigator.share({ files: [pdfFile], title: pdfResult.filename.replace('.pdf', '') })
        return
      } catch (err: any) {
        if (err?.name === 'AbortError') return
      }
    }

    // Fallback: open WhatsApp with text message + download PDF separately
    if (pdfResult.phone) {
      const text = buildWhatsAppText(pdfResult.suppName, pdfResult.lines, dateStr, pdfResult.note)
      window.open(buildWhatsAppUrl(pdfResult.phone, text), '_blank')
    }
    downloadPdf()
  }

  const downloadPdf = () => {
    if (!pdfResult) return
    const url = URL.createObjectURL(pdfResult.blob)
    const a = document.createElement('a')
    a.href = url
    a.download = pdfResult.filename
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  }

  const startNewOrder = () => {
    setShowNewOrder(true)
    setSelectedSuppId(null)
    setExpandedArts(new Set())
    setQuantities({})
    setNotes({})
    setPdfResult(null)
  }

  if (loading) {
    return <div className="flex items-center justify-center py-24"><div className="w-6 h-6 border-2 border-gray-100 border-t-brand-400 rounded-full animate-spin" /></div>
  }

  const selectedSupp = suppliers.find(s => s.id === selectedSuppId)

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Commandes</h2>
          <p className="text-xs text-gray-400">Bons de commande fournisseurs</p>
        </div>
        {!showNewOrder && (
          <button onClick={startNewOrder} className="btn-primary text-xs">
            <Plus size={14} /> Nouvelle commande
          </button>
        )}
      </div>

      {/* Date */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3">
        <CalendarPicker year={year} month={month} day={day} onChange={(y, m, d) => { setYear(y); setMonth(m); setDay(d) }} />
      </div>

      <div className="flex items-center gap-2 px-1">
        <ShoppingCart size={14} className="text-gray-300" />
        <p className="text-xs text-gray-400 font-medium">{dayName} {day} {monthName} {year}</p>
      </div>

      {/* ── PDF Result Card ── */}
      {pdfResult && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-fade-up">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center">
                <FileText size={15} className="text-brand-500" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-800">{pdfResult.suppName}</p>
                <p className="text-[10px] text-gray-400">{pdfResult.filename}</p>
              </div>
            </div>
            <button onClick={() => setPdfResult(null)} className="btn-icon text-gray-400"><X size={14} /></button>
          </div>

          {/* Order summary */}
          <div className="px-5 py-3 space-y-1">
            {pdfResult.lines.map((l, i) => (
              <div key={i} className="flex justify-between text-xs">
                <span className="text-gray-500">{l.name}</span>
                <span className="font-mono font-semibold text-gray-700">{l.qty}{l.unit ? ' ' + l.unit : ''}</span>
              </div>
            ))}
          </div>

          {/* Action buttons */}
          <div className="px-5 pb-4 flex flex-col gap-2">
            {pdfResult.phone && (
              <button
                onClick={sharePdfWhatsApp}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold bg-[#25D366] text-white hover:bg-[#1ebe5d] transition-colors"
              >
                <WhatsAppIcon size={16} /> Envoyer au fournisseur
              </button>
            )}
            {!pdfResult.phone && (
              <button
                onClick={sharePdfWhatsApp}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold bg-gray-900 text-white hover:bg-gray-800 transition-colors"
              >
                <FileText size={15} /> Partager le PDF
              </button>
            )}
            <button
              onClick={downloadPdf}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
            >
              Télécharger le PDF
            </button>
          </div>
        </div>
      )}

      {/* ── NEW ORDER FLOW ── */}
      {showNewOrder && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-fade-up">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-bold tracking-tight">Nouvelle commande</h3>
            <button onClick={() => setShowNewOrder(false)} className="btn-icon"><X size={14} /></button>
          </div>

          {!selectedSuppId ? (
            /* Step 1: Choose supplier */
            <div className="p-4 space-y-1.5">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Choisir un fournisseur</p>
              {suppliers.map(supp => (
                <button
                  key={supp.id}
                  onClick={() => { setSelectedSuppId(supp.id); setExpandedArts(new Set()) }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-amber-600">{supp.name.charAt(0)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{supp.name}</p>
                    <p className="text-[10px] text-gray-400">{supp.items.length} article{supp.items.length > 1 ? 's' : ''}</p>
                  </div>
                  <ChevronDown size={14} className="text-gray-300" />
                </button>
              ))}
              {suppliers.length === 0 && (
                <p className="text-xs text-gray-300 text-center py-4 italic">Aucun fournisseur avec des articles</p>
              )}
            </div>
          ) : selectedSupp ? (
            /* Step 2: Select articles + quantities */
            <div>
              {/* Supplier header */}
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
                    <span className="text-xs font-bold text-amber-600">{selectedSupp.name.charAt(0)}</span>
                  </div>
                  <span className="text-sm font-semibold">{selectedSupp.name}</span>
                </div>
                <button onClick={() => setSelectedSuppId(null)} className="text-xs text-brand-500 font-medium">
                  ← Changer
                </button>
              </div>

              {/* Articles - collapsible */}
              <div className="px-5 py-3">
                <button
                  onClick={() => toggleArts(selectedSupp.id)}
                  className="w-full flex items-center justify-between py-2"
                >
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    Articles ({selectedSupp.items.length})
                  </span>
                  {expandedArts.has(selectedSupp.id) ? <ChevronUp size={13} className="text-gray-300" /> : <ChevronDown size={13} className="text-gray-300" />}
                </button>

                {expandedArts.has(selectedSupp.id) && (
                  <div className="space-y-2 mt-1">
                    {selectedSupp.items.map((art, idx) => {
                      const suppQty = quantities[selectedSupp.id] || {}
                      const entry = suppQty[idx] || { qty: '', unit: '' }
                      const isSelected = entry.qty.trim() !== '' && Number(entry.qty) > 0
                      const hasSupplierUnit = !!art.unit

                      return (
                        <div key={idx} className={cn(
                          'flex items-center gap-3 py-2.5 px-3 rounded-xl transition-colors',
                          isSelected ? 'bg-brand-50/60 border border-brand-100' : 'bg-gray-50/50'
                        )}>
                          <div className={cn('flex-1 min-w-0', isSelected ? 'font-medium text-gray-800' : 'text-gray-500')}>
                            <span className="text-sm">{art.name}</span>
                            {hasSupplierUnit && <span className="text-[10px] text-gray-400 ml-1.5">({art.unit})</span>}
                          </div>
                          <input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="0.5"
                            value={entry.qty}
                            onChange={e => setQty(selectedSupp.id, idx, 'qty', e.target.value)}
                            placeholder="0"
                            className={cn(
                              'w-16 text-right font-mono text-sm rounded-lg border px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-300',
                              isSelected ? 'border-brand-200 bg-white font-semibold text-gray-800' : 'border-gray-200 bg-white text-gray-400'
                            )}
                          />
                          {hasSupplierUnit ? (
                            <span className="text-xs text-gray-400 w-16 text-center">{art.unit}</span>
                          ) : (
                            <select
                              value={entry.unit}
                              onChange={e => setQty(selectedSupp.id, idx, 'unit', e.target.value)}
                              className="text-xs border border-gray-200 rounded-lg px-1.5 py-1.5 bg-white text-gray-500 focus:outline-none"
                            >
                              {UNITS.map(u => <option key={u} value={u}>{u || '—'}</option>)}
                            </select>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Recap + actions */}
              {(() => {
                const lines = getOrderLines(selectedSupp)
                const hasOrder = lines.length > 0
                const isSaving = saving === selectedSupp.id
                const hasPhone = !!selectedSupp.phone?.trim()

                return (
                  <div className="px-5 pb-4 space-y-3">
                    <textarea
                      value={notes[selectedSupp.id] || ''}
                      onChange={e => setNotes(prev => ({ ...prev, [selectedSupp.id]: e.target.value }))}
                      placeholder="Note (optionnel)…"
                      rows={2}
                      className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-300 resize-none text-gray-500 placeholder-gray-300"
                    />

                    {hasOrder && (
                      <div className="px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-100">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Récapitulatif</p>
                        {lines.map((l, i) => (
                          <div key={i} className="flex justify-between text-xs">
                            <span className="text-gray-500">{l.name}</span>
                            <span className="font-mono font-semibold text-gray-700">{l.qty}{l.unit ? ' ' + l.unit : ''}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => handleGenerate(selectedSupp)}
                        disabled={!hasOrder || isSaving}
                        className={cn(
                          'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all',
                          hasOrder && !isSaving
                            ? 'bg-gray-900 text-white hover:bg-gray-800 shadow-sm'
                            : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                        )}
                      >
                        <Check size={15} />
                        {isSaving ? 'Enregistrement…' : 'Valider la commande'}
                      </button>
                      {!hasOrder && (
                        <p className="text-xs text-gray-300 italic">Dépliez les articles et entrez des quantités</p>
                      )}
                    </div>
                  </div>
                )
              })()}
            </div>
          ) : null}
        </div>
      )}

      {/* ── SAVED ORDERS ── */}
      {savedOrders.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-50">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <Clock size={11} /> BDC enregistrés — {day} {monthName}
            </p>
          </div>
          <div className="divide-y divide-gray-50">
            {savedOrders.map(order => (
              <div key={order.id} className="px-5 py-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-semibold">{order.supplier_name}</p>
                    <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                      {order.items.length} article{order.items.length > 1 ? 's' : ''}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 flex items-center gap-1">
                    <User size={10} /> {order.created_by_name || '—'}
                    <span className="mx-1">·</span>
                    {new Date(order.created_at).toLocaleTimeString('fr-MA', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {order.items.map((item, i) => (
                      <span key={i} className="text-[10px] bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-full text-gray-500">
                        {item.name} {item.qty}{item.unit ? ' ' + item.unit : ''}
                      </span>
                    ))}
                  </div>
                </div>
                <button onClick={() => openOrderPdf(order)} title="Ouvrir le PDF" className="flex-shrink-0 btn-icon">
                  <FileText size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state when no new order and no saved */}
      {!showNewOrder && savedOrders.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
          <ShoppingCart size={24} className="text-gray-200 mx-auto mb-2" />
          <p className="text-sm text-gray-400">Aucune commande pour cette date</p>
          <button onClick={startNewOrder} className="mt-3 text-xs text-brand-500 font-medium underline underline-offset-2">
            Créer une commande →
          </button>
        </div>
      )}
    </div>
  )
}
