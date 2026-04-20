-- ═══════════════════════════════════════════════════════════
-- Le Barista — Migration 004 : Lien Employé ↔ Profil
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

-- Ajoute un lien optionnel entre un employé et un compte utilisateur
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_employees_profile_id ON public.employees(profile_id);
