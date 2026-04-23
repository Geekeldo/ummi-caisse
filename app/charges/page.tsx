'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getMonthKey, MONTHS_FR } from '@/lib/business'
import { useAuth } from '@/hooks/use-auth'
import { Card, InputField, MonoNum, EmptyState } from '@/components/ui'
import { Plus, X, Check, Pencil, Receipt } from 'lucide-react'
import MonthPicker from '@/components/ui/month-picker'
import ConfirmDialog from '@/components/ui/confirm-dialog'
import type { ChargeCategory } from '@/types'

const PAYMENT_METHODS = ['Espèces', 'Virement', 'Chèque', 'CB/TPE', 'Prélèvement']

const CATEGORIES: { value: ChargeCategory; label: string; description: string }[] = [
  { value: 'fixed', label: 'Charges fixes', description: 'Loyer, électricité, abonnements récurrents' },
  { value: 'other', label: 'Autres charges', description: 'Ponctuelles : entretien, imprévus, taxes' },
]

interface Charge {
  id: string
  label: string
  amount: number
  payment_method: string
  month_key: string
  sort_order: number
  category: ChargeCategory
}

interface EditState {
  label: string
  amount: number | string
  payment_method: string
  category: ChargeCategory
}

export default function ChargesPage() {
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
  const { user } = useAuth()
  const canWrite = user?.role?.name === 'super_admin'

  const now = new Date()
  const [monthKey, setMonthKey] = useState(() => getMonthKey(now))
  const [charges, setCharges] = useState<Charge[]>([])
  const [loading, setLoading] = useState(true)

  // Add form
  const [showAdd, setShowAdd] = useState<ChargeCategory | null>(null)
  const [newLabel, setNewLabel] = useState('')
  const [newAmount, setNewAmount] = useState<number | string>(0)
  const [newPayment, setNewPayment] = useState('Espèces')

  // Edit state
  const [editId, setEditId] = useState<string | null>(null)
  const [editState, setEditState] = useState<EditState>({ label: '', amount: 0, payment_method: 'Espèces', category: 'fixed' })
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const { data } = await supabase
          .from('monthly_charges')
          .select('*')
          .eq('month_key', monthKey)
          .order('sort_order')
        setCharges((data || []).map((c: any) => ({ ...c, category: (c.category ?? 'fixed') as ChargeCategory })))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [monthKey, supabase])

  const grouped = useMemo(() => {
    const fixed = charges.filter(c => c.category === 'fixed')
    const other = charges.filter(c => c.category === 'other')
    return { fixed, other }
  }, [charges])

  const totalFixed = grouped.fixed.reduce((s, c) => s + Number(c.amount || 0), 0)
  const totalOther = grouped.other.reduce((s, c) => s + Number(c.amount || 0), 0)
  const total = totalFixed + totalOther

  const addCharge = async (category: ChargeCategory) => {
    if (!newLabel.trim() || !canWrite) return
    const amount = Number(newAmount) || 0
    const { data } = await supabase
      .from('monthly_charges')
      .insert({
        label: newLabel.trim(),
        amount,
        payment_method: newPayment,
        month_key: monthKey,
        sort_order: charges.length,
        category,
      })
      .select()
      .single()
    if (data) {
      setCharges(prev => [...prev, { ...(data as any), category: (data.category ?? category) as ChargeCategory }])
      setNewLabel('')
      setNewAmount(0)
      setNewPayment('Espèces')
      setShowAdd(null)
    }
  }

  const startEdit = (c: Charge) => {
    setEditId(c.id)
    setEditState({ label: c.label, amount: c.amount, payment_method: c.payment_method, category: c.category })
  }

  const saveEdit = async (id: string) => {
    if (!canWrite) return
    const amount = Number(editState.amount) || 0
    await supabase
      .from('monthly_charges')
      .update({
        label: editState.label,
        amount,
        payment_method: editState.payment_method,
        category: editState.category,
      })
      .eq('id', id)
    setCharges(prev => prev.map(c =>
      c.id === id
        ? { ...c, label: editState.label, amount, payment_method: editState.payment_method, category: editState.category }
        : c
    ))
    setEditId(null)
  }

  const deleteCharge = async (id: string) => {
    if (!canWrite) return
    await supabase.from('monthly_charges').delete().eq('id', id)
    setCharges(prev => prev.filter(c => c.id !== id))
    if (editId === id) setEditId(null)
  }

  // Month navigation helper
  const [year, month] = monthKey.split('-').map(Number)
  const monthLabel = `${MONTHS_FR[month - 1]} ${year}`

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-gray-100 border-t-brand-400 rounded-full animate-spin" />
      </div>
    )
  }

  const renderSection = (cat: ChargeCategory) => {
    const meta = CATEGORIES.find(c => c.value === cat)!
    const list = cat === 'fixed' ? grouped.fixed : grouped.other
    const subtotal = cat === 'fixed' ? totalFixed : totalOther

    return (
      <Card
        key={cat}
        title={`${meta.label} — ${monthLabel}`}
        noPad
        action={canWrite ? (
          <button
            onClick={() => { setShowAdd(showAdd === cat ? null : cat); setNewLabel(''); setNewAmount(0); setNewPayment('Espèces') }}
            className="btn-primary text-xs"
          >
            <Plus size={14} /> Charge
          </button>
        ) : undefined}
      >
        <p className="text-[11px] text-gray-400 px-4 pt-3 pb-2">{meta.description}</p>

        {showAdd === cat && canWrite && (
          <div className="card-body space-y-3 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Nouvelle {meta.label.toLowerCase()}</p>
            <div className="flex gap-2 flex-wrap items-end">
              <InputField
                label="Libellé"
                type="text"
                value={newLabel}
                onChange={setNewLabel}
                placeholder={cat === 'fixed' ? 'ex: Loyer, Électricité…' : 'ex: Réparation, Taxe…'}
                className="flex-1 min-w-[160px]"
              />
              <InputField
                label="Montant"
                value={newAmount}
                onChange={setNewAmount}
                mono
                suffix="DH"
                className="w-32"
              />
              <div className="flex flex-col gap-1">
                <label className="label">Mode de paiement</label>
                <select
                  value={newPayment}
                  onChange={e => setNewPayment(e.target.value)}
                  className="input-field text-sm"
                >
                  {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => addCharge(cat)} className="btn-primary text-xs">Ajouter</button>
              <button onClick={() => setShowAdd(null)} className="btn-icon"><X size={14} /></button>
            </div>
          </div>
        )}

        {list.length === 0 ? (
          <div className="card-body">
            <EmptyState message={`Aucune ${meta.label.toLowerCase()} pour ce mois`} />
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {list.map(c => {
              const isEditing = editId === c.id
              return (
                <div key={c.id} className="card-body py-3">
                  {isEditing ? (
                    <div className="space-y-3">
                      <div className="flex gap-2 flex-wrap items-end">
                        <InputField
                          label="Libellé"
                          type="text"
                          value={editState.label}
                          onChange={v => setEditState(s => ({ ...s, label: v }))}
                          className="flex-1 min-w-[160px]"
                        />
                        <InputField
                          label="Montant"
                          value={editState.amount}
                          onChange={v => setEditState(s => ({ ...s, amount: v }))}
                          mono
                          suffix="DH"
                          className="w-32"
                        />
                        <div className="flex flex-col gap-1">
                          <label className="label">Mode de paiement</label>
                          <select
                            value={editState.payment_method}
                            onChange={e => setEditState(s => ({ ...s, payment_method: e.target.value }))}
                            className="input-field text-sm"
                          >
                            {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                          </select>
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="label">Catégorie</label>
                          <select
                            value={editState.category}
                            onChange={e => setEditState(s => ({ ...s, category: e.target.value as ChargeCategory }))}
                            className="input-field text-sm"
                          >
                            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => saveEdit(c.id)} className="btn-primary text-xs">
                          <Check size={13} /> Enregistrer
                        </button>
                        <button onClick={() => setEditId(null)} className="btn-icon text-xs">Annuler</button>
                        <button
                          onClick={() => deleteCharge(c.id)}
                          className="btn-icon text-danger-500 ml-auto"
                          title="Supprimer cette charge"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-danger-50 flex items-center justify-center flex-shrink-0">
                        <Receipt size={14} className="text-danger-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{c.label}</p>
                        <p className="text-[10px] text-gray-400">{c.payment_method}</p>
                      </div>
                      <MonoNum value={Number(c.amount)} size="text-sm" color="text-danger-500" suffix="DH" />
                      {canWrite && (
                        <button onClick={() => startEdit(c)} className="btn-icon flex-shrink-0">
                          <Pencil size={13} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
            <div className="px-4 py-3 bg-danger-50 flex items-center justify-between rounded-b-2xl">
              <span className="text-xs font-semibold text-danger-600">Sous-total {meta.label.toLowerCase()}</span>
              <MonoNum value={subtotal} size="text-sm" color="text-danger-600" suffix="DH" />
            </div>
          </div>
        )}
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Charges</h2>
          <p className="text-xs text-gray-400">Charges fixes récurrentes + autres charges ponctuelles</p>
        </div>
        <div className="flex items-center gap-3">
          <MonthPicker value={monthKey} onChange={setMonthKey} />
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="kpi-card animate-fade-up">
          <p className="label">Total charges — {monthLabel}</p>
          <MonoNum value={total} size="text-2xl" color="text-danger-500" suffix="DH" />
        </div>
        <div className="kpi-card animate-fade-up">
          <p className="label">Charges fixes</p>
          <MonoNum value={totalFixed} size="text-xl" color="text-danger-500" suffix="DH" />
        </div>
        <div className="kpi-card animate-fade-up">
          <p className="label">Autres charges</p>
          <MonoNum value={totalOther} size="text-xl" color="text-danger-500" suffix="DH" />
        </div>
      </div>

      {renderSection('fixed')}
      {renderSection('other')}
    </div>
  )
}
