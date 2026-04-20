-- ═══════════════════════════════════════════════════════════
-- Le Barista — Migration 008 : Retraits du coffre fort
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.safe_withdrawals (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  date         date        NOT NULL,
  month_key    text        NOT NULL,
  amount       numeric     NOT NULL CHECK (amount > 0),
  reason       text,
  created_by   uuid        REFERENCES auth.users(id),
  created_by_name text,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_safe_withdrawals_month ON public.safe_withdrawals (month_key);

ALTER TABLE public.safe_withdrawals ENABLE ROW LEVEL SECURITY;

-- Tous les utilisateurs connectés peuvent lire
CREATE POLICY "Authenticated users can read withdrawals"
  ON public.safe_withdrawals FOR SELECT TO authenticated
  USING (true);

-- Seuls les super_admin peuvent créer / modifier / supprimer
CREATE POLICY "Super admin can manage withdrawals"
  ON public.safe_withdrawals FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
