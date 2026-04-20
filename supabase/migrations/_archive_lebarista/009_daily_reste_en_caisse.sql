-- ═══════════════════════════════════════════════════════════
-- Le Barista — Migration 009 : Reste en caisse journalier
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════
-- Stocker le reste en caisse calculé dans daily_entries
-- Permet de chaîner les jours sans recalcul récursif

ALTER TABLE public.daily_entries
  ADD COLUMN IF NOT EXISTS reste_en_caisse numeric DEFAULT 0;
