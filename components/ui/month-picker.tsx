'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight, Check } from 'lucide-react'
import { MONTHS_FR } from '@/lib/business'
import { cn } from '@/lib/utils'

interface MonthPickerProps {
  value: string          // 'YYYY-MM'
  onChange: (v: string) => void
  className?: string
}

export default function MonthPicker({ value, onChange, className }: MonthPickerProps) {
  const [year, month] = value.split('-').map(Number)
  const [tempYear, setTempYear] = useState(year)
  const [tempMonth, setTempMonth] = useState(month)
  const [open, setOpen] = useState(false)

  const isDirty = tempYear !== year || tempMonth !== month

  const confirm = () => {
    onChange(`${tempYear}-${String(tempMonth).padStart(2, '0')}`)
    setOpen(false)
  }

  const goYear = (delta: number) => setTempYear(y => y + delta)

  const now = new Date()
  const isCurrentMonth = (m: number) => tempYear === now.getFullYear() && m === now.getMonth() + 1
  const isSelected = (m: number) => tempYear === year && m === month

  if (!open) {
    return (
      <button
        onClick={() => { setTempYear(year); setTempMonth(month); setOpen(true) }}
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors',
          className
        )}
      >
        <span className="capitalize">{MONTHS_FR[month - 1]} {year}</span>
        <ChevronRight size={12} className="text-gray-400" />
      </button>
    )
  }

  return (
    <div className={cn('bg-white rounded-2xl border border-gray-200 shadow-lg p-4 w-72 animate-fade-up', className)}>
      {/* Year nav */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => goYear(-1)} className="btn-icon p-1">
          <ChevronLeft size={15} />
        </button>
        <span className="text-sm font-bold tracking-tight text-gray-700">{tempYear}</span>
        <button onClick={() => goYear(1)} className="btn-icon p-1">
          <ChevronRight size={15} />
        </button>
      </div>

      {/* Month grid */}
      <div className="grid grid-cols-3 gap-1.5 mb-3">
        {MONTHS_FR.map((name, i) => {
          const m = i + 1
          const active = tempMonth === m
          const current = isCurrentMonth(m)
          return (
            <button
              key={m}
              onClick={() => setTempMonth(m)}
              className={cn(
                'py-2 rounded-xl text-xs font-medium transition-all',
                active
                  ? 'bg-brand-400 text-white shadow-sm'
                  : current
                  ? 'bg-brand-50 text-brand-500 font-semibold'
                  : 'text-gray-500 hover:bg-gray-50',
              )}
            >
              {name.slice(0, 3)}
            </button>
          )
        })}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => setOpen(false)}
          className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1.5"
        >
          Annuler
        </button>
        <button
          onClick={confirm}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all',
            isDirty || isSelected(tempMonth)
              ? 'bg-brand-400 text-white hover:bg-brand-500 shadow-sm'
              : 'bg-gray-100 text-gray-400'
          )}
        >
          <Check size={12} />
          {MONTHS_FR[tempMonth - 1]} {tempYear}
        </button>
      </div>
    </div>
  )
}
