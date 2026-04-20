'use client'

import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { getDaysInMonth, MONTHS_FR } from '@/lib/business'

const DAYS_SHORT = ['D', 'L', 'M', 'M', 'J', 'V', 'S']

interface CalendarPickerProps {
  year: number
  month: number
  day: number
  onChange: (year: number, month: number, day: number) => void
}

export default function CalendarPicker({ year, month, day, onChange }: CalendarPickerProps) {
  const daysInMonth = getDaysInMonth(year, month)
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay()
  const today = new Date()
  const isToday = (d: number) =>
    today.getFullYear() === year && today.getMonth() + 1 === month && today.getDate() === d

  const prevMonth = () => {
    if (month === 1) onChange(year - 1, 12, 1)
    else onChange(year, month - 1, 1)
  }
  const nextMonth = () => {
    if (month === 12) onChange(year + 1, 1, 1)
    else onChange(year, month + 1, 1)
  }

  const cells: (number | null)[] = []
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null)
  for (let i = 1; i <= daysInMonth; i++) cells.push(i)

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <button onClick={prevMonth} className="btn-icon p-1">
          <ChevronLeft size={15} />
        </button>
        <span className="text-xs font-bold tracking-tight text-gray-700">
          {MONTHS_FR[month - 1]} {year}
        </span>
        <button onClick={nextMonth} className="btn-icon p-1">
          <ChevronRight size={15} />
        </button>
      </div>

      {/* Day names */}
      <div className="grid grid-cols-7 mb-0.5">
        {DAYS_SHORT.map((d, i) => (
          <div key={i} className="text-center text-[9px] font-semibold text-gray-300 py-0.5">
            {d}
          </div>
        ))}
      </div>

      {/* Days */}
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((d, i) =>
          d === null ? (
            <div key={`e-${i}`} />
          ) : (
            <button
              key={d}
              onClick={() => onChange(year, month, d)}
              className={cn(
                'h-7 w-full rounded-lg text-xs font-mono transition-all duration-100 relative',
                'hover:bg-gray-50 active:scale-95',
                d === day
                  ? 'bg-brand-400 text-white font-bold shadow-sm shadow-brand-400/30'
                  : isToday(d)
                  ? 'text-brand-400 font-semibold'
                  : 'text-gray-600',
              )}
            >
              {d}
              {isToday(d) && d !== day && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-0.5 h-0.5 rounded-full bg-brand-400" />
              )}
            </button>
          )
        )}
      </div>
    </div>
  )
}
