import { createClient } from '@/lib/supabase/client'

export type ActivityCategory =
  | 'coffre_depot'
  | 'coffre_retrait'
  | 'commande'
  | 'avance_salaire'
  | 'inventaire'
  | 'cash_injection'
  | 'autre'

export interface ActivityPayload {
  userId: string
  userName: string
  action: string
  category: ActivityCategory
  amount?: number
  detail?: string
  date: string      // ISO date 'YYYY-MM-DD'
  monthKey: string  // 'YYYY-MM'
}

// Fire-and-forget — never throws, never blocks the UI
export function logActivity(payload: ActivityPayload): void {
  const supabase = createClient()
  supabase
    .from('activity_log')
    .insert({
      user_id:   payload.userId,
      user_name: payload.userName,
      action:    payload.action,
      category:  payload.category,
      amount:    payload.amount ?? null,
      detail:    payload.detail ?? null,
      date:      payload.date,
      month_key: payload.monthKey,
    })
    .then(({ error }) => {
      if (error) console.error('❌ logActivity error:', error.message)
    })
}
