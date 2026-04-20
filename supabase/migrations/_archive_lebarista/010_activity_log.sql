-- ═══════════════════════════════════════════════════════════
-- Le Barista — Migration 010 : Journal d'activité
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.activity_log (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at   timestamptz DEFAULT now(),
  user_id      uuid,
  user_name    text        NOT NULL DEFAULT 'Inconnu',
  action       text        NOT NULL,
  category     text        NOT NULL DEFAULT 'other',
  -- categories: coffre_depot | coffre_retrait | commande | avance_salaire | inventaire | autre
  amount       numeric,
  detail       text,
  date         date        NOT NULL,
  month_key    text        NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_activity_log_created  ON public.activity_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_month    ON public.activity_log (month_key);
CREATE INDEX IF NOT EXISTS idx_activity_log_user     ON public.activity_log (user_id);

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- Lecture : tous les utilisateurs connectés
CREATE POLICY "Authenticated read activity"
  ON public.activity_log FOR SELECT TO authenticated
  USING (true);

-- Écriture : tous les utilisateurs connectés peuvent loguer leurs propres actions
CREATE POLICY "Authenticated insert activity"
  ON public.activity_log FOR INSERT TO authenticated
  WITH CHECK (true);
