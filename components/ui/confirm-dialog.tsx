'use client'

import { useEffect, useRef } from 'react'
import { X, Loader2, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  title?: string
  message?: string
  loading?: boolean
  children?: React.ReactNode
}

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = 'Confirmer la suppression',
  message = 'Cette action est irréversible. Êtes-vous sûr ?',
  loading = false,
  children,
}: ConfirmDialogProps) {
  const backdropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  if (!open) return null

  const handleConfirm = async () => {
    await onConfirm()
    onClose()
  }

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-4 sm:p-8"
      ref={backdropRef}
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className={cn(
        "relative bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-md w-full max-h-[90vh] overflow-y-auto",
        "transform transition-all duration-300 ease-out",
        open ? "translate-y-0 scale-100 opacity-100" : "translate-y-8 scale-95 opacity-0"
      )}>
        {/* Header */}
        <div className="p-6 pb-4 border-b border-gray-100 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-danger-50 flex items-center justify-center flex-shrink-0 mt-0.5">
            <AlertTriangle size={20} className="text-danger-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-gray-900">{title}</h3>
            <p className="text-sm text-gray-600 mt-1">{message}</p>
            {children && <div className="mt-2 text-sm text-gray-500">{children}</div>}
          </div>
          <button
            onClick={onClose}
            className="btn-icon text-gray-400 hover:text-gray-600 p-1 -m-1"
            disabled={loading}
          >
            <X size={20} />
          </button>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-4 flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
            disabled={loading}
          >
            Annuler
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-danger-500 text-white rounded-xl hover:bg-danger-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {loading ? 'Suppression...' : 'Supprimer'}
          </button>
        </div>
      </div>
    </div>
  )
}

