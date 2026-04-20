-- ═══════════════════════════════════════════════════════════
-- Le Barista — Migration 005 : Annulations par ligne + Photos
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

-- Lier chaque annulation à une ligne de recette précise
ALTER TABLE public.revenue_cancellations
  ADD COLUMN IF NOT EXISTS revenue_line_id uuid REFERENCES public.revenue_lines(id) ON DELETE CASCADE;

-- Photo du bon d'annulation
ALTER TABLE public.revenue_cancellations
  ADD COLUMN IF NOT EXISTS photo_url text;

CREATE INDEX IF NOT EXISTS idx_revenue_cancellations_line ON public.revenue_cancellations(revenue_line_id);

-- Photo du bon de dépense
ALTER TABLE public.expense_lines
  ADD COLUMN IF NOT EXISTS photo_url text;
