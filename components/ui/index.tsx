import { cn } from '@/lib/utils'
import { formatNumber } from '@/lib/business'
import type { ReactNode } from 'react'

// ─── Card ────────────────────────────────────────────────
export function Card({
  children, title, action, noPad, className
}: {
  children: ReactNode; title?: string; action?: ReactNode; noPad?: boolean; className?: string
}) {
  return (
    <div className={cn('card animate-fade-up', className)}>
      {title && (
        <div className="card-header">
          <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
          {action}
        </div>
      )}
      <div className={noPad ? '' : 'card-body'}>{children}</div>
    </div>
  )
}

// ─── KPI Card ────────────────────────────────────────────
export function KpiCard({
  label, value, suffix = 'DH', color = 'text-gray-900'
}: {
  label: string; value: number; suffix?: string; color?: string
}) {
  return (
    <div className="kpi-card animate-fade-up">
      <p className="label">{label}</p>
      <p className={cn('mono-num text-xl', color)}>
        {formatNumber(value)}
        <span className="text-xs font-normal text-gray-400 ml-1">{suffix}</span>
      </p>
    </div>
  )
}

// ─── Pill ────────────────────────────────────────────────
export function Pill({
  children, variant = 'brand'
}: {
  children: ReactNode; variant?: 'brand' | 'danger' | 'warning' | 'gray'
}) {
  const styles = {
    brand: 'bg-brand-50 text-brand-500',
    danger: 'bg-danger-50 text-danger-600',
    warning: 'bg-warning-50 text-warning-600',
    gray: 'bg-gray-100 text-gray-500',
  }
  return <span className={cn('pill', styles[variant])}>{children}</span>
}

// ─── MonoNum ─────────────────────────────────────────────
export function MonoNum({
  value, size = 'text-xl', color = 'text-gray-900', suffix
}: {
  value: number; size?: string; color?: string; suffix?: string
}) {
  return (
    <span className={cn('mono-num', size, color)}>
      {formatNumber(value)}
      {suffix && <span className="text-[55%] font-normal text-gray-400 ml-1">{suffix}</span>}
    </span>
  )
}

// ─── Input ───────────────────────────────────────────────
export function InputField({
  label, value, onChange, type = 'number', placeholder, mono, suffix, className
}: {
  label?: string; value: string | number; onChange: (v: any) => void;
  type?: string; placeholder?: string; mono?: boolean; suffix?: string; className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {label && <label className="label">{label}</label>}
      <div className="relative">
        <input
          type={type}
          value={value === 0 && type === 'number' ? '' : value}
          onChange={e => onChange(type === 'number' ? (e.target.value === '' ? 0 : Number(e.target.value)) : e.target.value)}
          placeholder={placeholder || '0'}
          className={cn(mono ? 'input-mono' : 'input-field', suffix && 'pr-10')}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">
            {suffix}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Summary Row ─────────────────────────────────────────
export function SummaryRow({
  label, value, variant = 'brand'
}: {
  label: string; value: number; variant?: 'brand' | 'danger' | 'warning'
}) {
  const styles = {
    brand: 'bg-brand-50 text-brand-500',
    danger: 'bg-danger-50 text-danger-600',
    warning: 'bg-warning-50 text-warning-600',
  }
  return (
    <div className={cn('flex items-center justify-between px-4 py-2.5 rounded-xl mt-3', styles[variant])}>
      <span className="text-xs font-semibold">Total {label}</span>
      <MonoNum value={value} size="text-sm" color="inherit" suffix="DH" />
    </div>
  )
}

// ─── Empty State ─────────────────────────────────────────
export function EmptyState({ message }: { message: string }) {
  return (
    <p className="text-center text-sm text-gray-300 py-6">{message}</p>
  )
}

// ─── Progress Bar ────────────────────────────────────────
export function ProgressBar({
  value, max, color = 'bg-brand-400'
}: {
  value: number; max: number; color?: string
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
      <div
        className={cn('h-full rounded-full transition-all duration-500', color)}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
