'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDH, getMonthKey, MONTHS_FR } from '@/lib/business'
import { Card, InputField, MonoNum, Pill, ProgressBar, EmptyState } from '@/components/ui'
import { useAuth } from '@/hooks/use-auth'
import { X, Pencil, Check, AlertCircle, ChevronDown, ChevronUp, UserPlus, Power } from 'lucide-react'
import { cn } from '@/lib/utils'
import MonthPicker from '@/components/ui/month-picker'

interface Employee {
  id: string
  name: string
  position: string
  base_salary: number
  hire_date: string | null
  is_active: boolean
}

interface SalaryAdvance {
  date: string
  amount: number
}

interface Deduction {
  id: string
  employee_id: string
  month_key: string
  amount: number
  reason: string
}

interface EmpForm {
  name: string
  position: string
  base_salary: number | string
  hire_date: string
}

const POSITIONS = ['Gérant', 'Manager', 'Barista', 'Serveur', 'Serveuse', 'Cuisinier', 'Plongeur', 'Caissier', 'Autre']

export default function EmployeesPage() {
  const { can } = useAuth()
  const canWrite = can('employees.write')
  const supabase = useRef(createClient()).current

  const now = new Date()
  const [monthKey, setMonthKey] = useState(() => getMonthKey(now))
  const [employees, setEmployees] = useState<Employee[]>([])
  // advances by employee name (from daily salary_lines)
  const [advancesByName, setAdvancesByName] = useState<Record<string, SalaryAdvance[]>>({})
  const [deductions, setDeductions] = useState<Deduction[]>([])
  const [loading, setLoading] = useState(true)

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const [showModal, setShowModal] = useState(false)
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null)
  const [empForm, setEmpForm] = useState<EmpForm>({ name: '', position: 'Serveur', base_salary: 0, hire_date: '' })
  const [saving, setSaving] = useState(false)

  const [showDeductionFor, setShowDeductionFor] = useState<string | null>(null)
  const [dedAmount, setDedAmount] = useState<number>(0)
  const [dedReason, setDedReason] = useState('')

  const [year, month] = monthKey.split('-').map(Number)
  const monthLabel = `${MONTHS_FR[month - 1]} ${year}`

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        // Load ALL employees (active + inactive)
        const empRes = await supabase.from('employees').select('*').order('name')

        // Load deductions for the month
        const dedRes = await supabase.from('salary_deductions').select('*').eq('month_key', monthKey)

        // Load salary_lines for the month (advances from daily page)
        const entriesRes = await supabase
          .from('daily_entries')
          .select('id, date')
          .eq('month_key', monthKey)

        const entries = (entriesRes.data || []) as { id: string; date: string }[]
        const entryIds = entries.map(e => e.id)
        const dateByEntryId: Record<string, string> = {}
        for (const e of entries) dateByEntryId[e.id] = e.date

        let salaryLines: { daily_entry_id: string; employee_name: string; amount: number }[] = []
        if (entryIds.length > 0) {
          const salRes = await supabase
            .from('salary_lines')
            .select('daily_entry_id, employee_name, amount')
            .in('daily_entry_id', entryIds)
          salaryLines = (salRes.data || []) as typeof salaryLines
        }

        // Group salary_lines by employee_name
        const byName: Record<string, SalaryAdvance[]> = {}
        for (const line of salaryLines) {
          const name = (line.employee_name || '').trim()
          if (!name) continue
          if (!byName[name]) byName[name] = []
          byName[name].push({
            date: dateByEntryId[line.daily_entry_id] || '',
            amount: Number(line.amount || 0),
          })
        }

        setEmployees(empRes.data || [])
        setDeductions(dedRes.data || [])
        setAdvancesByName(byName)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [monthKey, supabase])

  const getAdvances = (emp: Employee): SalaryAdvance[] =>
    advancesByName[emp.name] || []

  const getDeductions = (empId: string) => deductions.filter(d => d.employee_id === empId)

  const totalAdvances = (emp: Employee) =>
    getAdvances(emp).reduce((s, a) => s + Number(a.amount || 0), 0)

  const totalDeductions = (empId: string) =>
    getDeductions(empId).reduce((s, d) => s + Number(d.amount || 0), 0)

  const totalMasse = employees
    .filter(e => e.is_active)
    .reduce((s, e) => s + Number(e.base_salary || 0), 0)

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const toggleActive = async (emp: Employee) => {
    const newVal = !emp.is_active
    await supabase.from('employees').update({ is_active: newVal }).eq('id', emp.id)
    setEmployees(prev => prev.map(e => e.id === emp.id ? { ...e, is_active: newVal } : e))
  }

  // Employee CRUD
  const openAdd = () => {
    setEditingEmp(null)
    setEmpForm({ name: '', position: 'Serveur', base_salary: 0, hire_date: '' })
    setShowModal(true)
  }

  const openEdit = (emp: Employee) => {
    setEditingEmp(emp)
    setEmpForm({ name: emp.name, position: emp.position || 'Autre', base_salary: emp.base_salary, hire_date: emp.hire_date || '' })
    setShowModal(true)
  }

  const saveEmployee = async () => {
    if (!empForm.name.trim() || saving) return
    setSaving(true)
    try {
      const payload = {
        name: empForm.name.trim(),
        position: empForm.position,
        base_salary: Number(empForm.base_salary) || 0,
        hire_date: empForm.hire_date || null,
      }
      if (editingEmp) {
        await supabase.from('employees').update(payload).eq('id', editingEmp.id)
        setEmployees(prev => prev.map(e => e.id === editingEmp.id ? { ...e, ...payload } : e))
      } else {
        const { data } = await supabase.from('employees').insert({ ...payload, is_active: true }).select().single()
        if (data) setEmployees(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      }
      setShowModal(false)
    } finally {
      setSaving(false)
    }
  }

  // Deductions CRUD
  const addDeduction = async (empId: string) => {
    if (!canWrite || !dedReason.trim() || dedAmount <= 0) return
    const { data } = await supabase
      .from('salary_deductions')
      .insert({ employee_id: empId, month_key: monthKey, amount: dedAmount, reason: dedReason.trim() })
      .select().single()
    if (data) {
      setDeductions(prev => [...prev, data])
      setDedAmount(0); setDedReason(''); setShowDeductionFor(null)
    }
  }

  const removeDeduction = async (id: string) => {
    setDeductions(prev => prev.filter(d => d.id !== id))
    await supabase.from('salary_deductions').delete().eq('id', id)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-gray-200 border-t-brand-400 rounded-full animate-spin" />
      </div>
    )
  }

  const activeEmployees = employees.filter(e => e.is_active)
  const inactiveEmployees = employees.filter(e => !e.is_active)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Équipe</h2>
          <p className="text-xs text-gray-400">Salaires et retenues — avances dans Journée</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="label">Masse salariale</p>
            <MonoNum value={totalMasse} size="text-lg" color="text-warning-500" suffix="DH" />
          </div>
          {canWrite && (
            <button onClick={openAdd} className="btn-primary text-xs">
              <UserPlus size={14} /> Employé
            </button>
          )}
        </div>
      </div>

      {/* Month selector */}
      <div className="flex items-center gap-2">
        <MonthPicker value={monthKey} onChange={setMonthKey} />
      </div>

      {/* Active employees */}
      {activeEmployees.length === 0 && (
        <Card><div className="card-body"><EmptyState message="Aucun employé actif" /></div></Card>
      )}

      {activeEmployees.map(emp => <EmployeeCard
        key={emp.id}
        emp={emp}
        advances={getAdvances(emp)}
        advTotal={totalAdvances(emp)}
        deductions={getDeductions(emp.id)}
        dedTotal={totalDeductions(emp.id)}
        isExpanded={expandedIds.has(emp.id)}
        onToggleExpand={() => toggleExpand(emp.id)}
        onEdit={() => openEdit(emp)}
        onToggleActive={() => toggleActive(emp)}
        canWrite={canWrite}
        monthLabel={monthLabel}
        showDeductionFor={showDeductionFor}
        onShowDeduction={setShowDeductionFor}
        dedAmount={dedAmount}
        setDedAmount={setDedAmount}
        dedReason={dedReason}
        setDedReason={setDedReason}
        onAddDeduction={addDeduction}
        onRemoveDeduction={removeDeduction}
      />)}

      {/* Inactive employees */}
      {inactiveEmployees.length > 0 && (
        <div className="pt-2">
          <p className="text-[10px] font-bold text-gray-300 uppercase tracking-wider mb-2">Employés inactifs</p>
          {inactiveEmployees.map(emp => (
            <Card key={emp.id} className="opacity-50 mb-3">
              <div className="card-header">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-gray-400">{emp.name.charAt(0)}</span>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-400">{emp.name}</h3>
                    <p className="text-[10px] text-gray-300">{emp.position || 'N/A'} · Inactif</p>
                  </div>
                </div>
                {canWrite && (
                  <button
                    onClick={() => toggleActive(emp)}
                    className="text-xs text-brand-500 font-medium flex items-center gap-1"
                  >
                    <Power size={14} /> Réactiver
                  </button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 mb-4 sm:mb-0 overflow-hidden animate-fade-up">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-sm">
                {editingEmp ? `Modifier — ${editingEmp.name}` : 'Nouvel employé'}
              </h3>
              <button onClick={() => setShowModal(false)} className="btn-icon"><X size={16} /></button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <InputField
                label="Nom complet"
                type="text"
                value={empForm.name}
                onChange={v => setEmpForm(s => ({ ...s, name: v }))}
                placeholder="Prénom Nom"
              />
              <div className="flex flex-col gap-1">
                <label className="label">Poste</label>
                <select
                  value={empForm.position}
                  onChange={e => setEmpForm(s => ({ ...s, position: e.target.value }))}
                  className="input-field text-sm"
                >
                  {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <InputField
                label="Salaire de base"
                value={empForm.base_salary}
                onChange={v => setEmpForm(s => ({ ...s, base_salary: v }))}
                mono
                suffix="DH"
              />
              <div className="flex flex-col gap-1">
                <label className="label">Date d'embauche</label>
                <input
                  type="date"
                  value={empForm.hire_date}
                  onChange={e => setEmpForm(s => ({ ...s, hire_date: e.target.value }))}
                  className="input-field text-sm"
                />
              </div>
            </div>
            <div className="px-6 pb-5 flex gap-2">
              <button
                onClick={saveEmployee}
                disabled={!empForm.name.trim() || saving}
                className="btn-primary flex-1 disabled:opacity-40"
              >
                {saving ? 'Enregistrement…' : editingEmp ? 'Enregistrer' : 'Ajouter'}
              </button>
              <button onClick={() => setShowModal(false)} className="btn-icon px-4">Annuler</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Employee Card ─────────────────────────────────────────────────────────────
interface EmployeeCardProps {
  emp: Employee
  advances: SalaryAdvance[]
  advTotal: number
  deductions: Deduction[]
  dedTotal: number
  isExpanded: boolean
  onToggleExpand: () => void
  onEdit: () => void
  onToggleActive: () => void
  canWrite: boolean
  monthLabel: string
  showDeductionFor: string | null
  onShowDeduction: (id: string | null) => void
  dedAmount: number
  setDedAmount: (v: number) => void
  dedReason: string
  setDedReason: (v: string) => void
  onAddDeduction: (empId: string) => void
  onRemoveDeduction: (id: string) => void
}

function EmployeeCard({
  emp, advances, advTotal, deductions, dedTotal,
  isExpanded, onToggleExpand, onEdit, onToggleActive,
  canWrite, monthLabel,
  showDeductionFor, onShowDeduction,
  dedAmount, setDedAmount, dedReason, setDedReason,
  onAddDeduction, onRemoveDeduction,
}: EmployeeCardProps) {
  const salary = Number(emp.base_salary || 0)
  // CORRECT: rest = salary - advances - deductions
  const rest = salary - advTotal - dedTotal
  const isShowingDeduction = showDeductionFor === emp.id

  return (
    <Card className="overflow-hidden mb-3">
      {/* Card Header */}
      <div className="card-header">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-bold text-brand-500">{emp.name.charAt(0)}</span>
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold tracking-tight truncate">{emp.name}</h3>
            <p className="text-[10px] text-gray-400">{emp.position || 'N/A'} · {emp.hire_date ? new Date(emp.hire_date).getFullYear() : '—'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="text-right hidden sm:block">
            <p className="label">Salaire</p>
            <MonoNum value={salary} size="text-xs" color="text-gray-600" suffix="DH" />
          </div>
          {salary > 0 && (
            <Pill variant={rest <= 0 ? 'brand' : 'warning'}>
              {rest <= 0 ? 'Soldé' : `Reste ${formatDH(Math.max(0, rest))}`}
            </Pill>
          )}
          {canWrite && (
            <button onClick={onEdit} className="btn-icon">
              <Pencil size={13} />
            </button>
          )}
          {canWrite && (
            <button
              onClick={onToggleActive}
              title="Désactiver cet employé"
              className="btn-icon text-gray-300 hover:text-danger-400"
            >
              <Power size={13} />
            </button>
          )}
          <button onClick={onToggleExpand} className="btn-icon">
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* Progress bar */}
      {salary > 0 && (
        <div className="px-4 pb-3">
          <div className="flex justify-between text-[10px] text-gray-400 mb-1">
            <span>Avances: {formatDH(advTotal)}</span>
            {dedTotal > 0 && <span className="text-danger-400">Retenues: −{formatDH(dedTotal)}</span>}
            <span className={rest < 0 ? 'text-danger-500 font-semibold' : ''}>
              Reste: {formatDH(Math.max(0, rest))}
            </span>
          </div>
          <ProgressBar
            value={advTotal + dedTotal}
            max={salary}
            color={advTotal + dedTotal >= salary ? 'bg-brand-400' : 'bg-warning-400'}
          />
        </div>
      )}

      {/* Expanded section */}
      {isExpanded && (
        <div className="border-t border-gray-100">
          {/* Avances (read-only — saisies dans Journée) */}
          <div className="px-4 pt-3 pb-2">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                Avances — {monthLabel}
              </p>
              <span className="text-[10px] text-gray-300 italic">Via page Journée</span>
            </div>
            <div className="space-y-1.5">
              {advances.length === 0 && (
                <p className="text-xs text-gray-300 italic">Aucune avance ce mois</p>
              )}
              {advances.map((adv, i) => (
                <div key={i} className="flex items-center justify-between py-0.5">
                  <span className="text-xs text-gray-400">
                    {adv.date ? new Date(adv.date).getDate() + ' ' + MONTHS_FR[new Date(adv.date).getMonth()] : '—'}
                  </span>
                  <span className="font-mono text-xs font-semibold text-warning-500">{formatDH(adv.amount)}</span>
                </div>
              ))}
            </div>
            {advTotal > 0 && (
              <div className="flex justify-between text-xs mt-2 pt-2 border-t border-gray-100">
                <span className="text-gray-400">Total avances</span>
                <span className="font-mono font-semibold text-warning-500">{formatDH(advTotal)}</span>
              </div>
            )}
          </div>

          {/* Retenues */}
          <div className="px-4 pt-2 pb-3 border-t border-gray-50">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Retenues</p>
              {canWrite && (
                <button
                  onClick={() => {
                    onShowDeduction(isShowingDeduction ? null : emp.id)
                    setDedAmount(0); setDedReason('')
                  }}
                  className="btn-ghost text-xs py-1 text-danger-500"
                >
                  <AlertCircle size={12} /> Retenue
                </button>
              )}
            </div>

            {isShowingDeduction && canWrite && (
              <div className="bg-danger-50/50 rounded-xl p-3 mb-2 space-y-2">
                <div className="flex gap-2 items-end">
                  <InputField
                    label="Montant"
                    value={dedAmount}
                    onChange={setDedAmount}
                    mono
                    suffix="DH"
                    className="w-28"
                  />
                  <div className="flex flex-col gap-1 flex-1">
                    <label className="label">Motif <span className="text-danger-400">*</span></label>
                    <input
                      type="text"
                      value={dedReason}
                      onChange={e => setDedReason(e.target.value)}
                      placeholder="Ex: Faute, casse…"
                      className="input-field text-xs py-2 h-9"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onAddDeduction(emp.id)}
                    disabled={!dedReason.trim() || dedAmount <= 0}
                    className="btn-primary text-xs disabled:opacity-40"
                  >
                    <Check size={12} /> Enregistrer
                  </button>
                  <button onClick={() => onShowDeduction(null)} className="btn-icon text-xs">Annuler</button>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              {deductions.length === 0 && !isShowingDeduction && (
                <p className="text-xs text-gray-300 italic">Aucune retenue ce mois</p>
              )}
              {deductions.map(d => (
                <div key={d.id} className="flex items-center gap-2 py-1">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 truncate">{d.reason}</p>
                  </div>
                  <span className="font-mono text-xs font-semibold text-danger-500 flex-shrink-0">
                    −{formatDH(Number(d.amount))}
                  </span>
                  {canWrite && (
                    <button onClick={() => onRemoveDeduction(d.id)} className="btn-icon flex-shrink-0">
                      <X size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {dedTotal > 0 && (
              <div className="flex justify-between text-xs mt-2 pt-2 border-t border-gray-100">
                <span className="text-gray-400">Total retenues</span>
                <span className="font-mono font-semibold text-danger-500">−{formatDH(dedTotal)}</span>
              </div>
            )}
          </div>

          {/* Net summary */}
          {salary > 0 && (
            <div className="mx-4 mb-3 px-3 py-2 rounded-xl bg-gray-50 flex items-center justify-between">
              <span className="text-xs text-gray-500">Net à payer</span>
              <span className={cn('font-mono text-sm font-bold', rest > 0 ? 'text-warning-500' : 'text-brand-500')}>
                {formatDH(Math.max(0, rest))}
              </span>
            </div>
          )}

        </div>
      )}
    </Card>
  )
}
