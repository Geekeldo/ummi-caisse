-- ═══════════════════════════════════════════════════════════
-- Le Barista — Migration 003 : Annulations, Retenues, Photos
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

-- ─── ANNULATIONS DE RECETTES ────────────────────────────────
-- Enregistre les annulations/erreurs de caisse par journée
CREATE TABLE IF NOT EXISTS public.revenue_cancellations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  daily_entry_id uuid NOT NULL REFERENCES public.daily_entries(id) ON DELETE CASCADE,
  server_name text NOT NULL DEFAULT '',
  amount numeric(10,2) NOT NULL DEFAULT 0,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_revenue_cancellations_entry ON public.revenue_cancellations(daily_entry_id);

ALTER TABLE public.revenue_cancellations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read" ON public.revenue_cancellations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth write" ON public.revenue_cancellations FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── RETENUES SALARIALES ────────────────────────────────────
-- Déductions sur salaire (fautes, erreurs, etc.)
CREATE TABLE IF NOT EXISTS public.salary_deductions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  month_key text NOT NULL,
  amount numeric(10,2) NOT NULL DEFAULT 0,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_salary_deductions_month ON public.salary_deductions(month_key);
CREATE INDEX IF NOT EXISTS idx_salary_deductions_employee ON public.salary_deductions(employee_id);

ALTER TABLE public.salary_deductions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read" ON public.salary_deductions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth write" ON public.salary_deductions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── PHOTOS DE REÇUS SUR LIGNES DE RECETTES ─────────────────
-- Ajoute une URL photo à chaque ligne de recette
ALTER TABLE public.revenue_lines
  ADD COLUMN IF NOT EXISTS photo_url text;

-- ─── CHARGES FIXES : AJOUTER PAYMENT_METHOD DEFAULT ─────────
-- (déjà existant, pas de changement nécessaire)

-- ─── VUE : DAILY SUMMARY ÉTENDUE ────────────────────────────
-- Remplace la vue existante pour inclure les annulations
CREATE OR REPLACE VIEW public.daily_summary AS
SELECT
  de.id,
  de.date,
  de.month_key,
  de.tpe_amount,
  de.coffre_depose,
  de.filled_by,
  p.full_name AS filled_by_name,
  COALESCE((SELECT sum(amount) FROM public.revenue_lines WHERE daily_entry_id = de.id), 0) AS total_revenue,
  COALESCE((SELECT sum(amount) FROM public.expense_lines WHERE daily_entry_id = de.id), 0) AS total_expense,
  COALESCE((SELECT sum(amount) FROM public.salary_lines WHERE daily_entry_id = de.id), 0) AS total_salary,
  COALESCE((SELECT sum(amount) FROM public.supplier_daily_amounts WHERE daily_entry_id = de.id), 0) AS total_suppliers,
  COALESCE((SELECT sum(amount) FROM public.revenue_cancellations WHERE daily_entry_id = de.id), 0) AS total_cancellations
FROM public.daily_entries de
LEFT JOIN public.profiles p ON p.id = de.filled_by;

-- ─── SUPABASE STORAGE BUCKET (instructions) ─────────────────
-- Créer manuellement dans Supabase Dashboard > Storage :
-- Bucket name: "receipts" (public)
-- Policies: allow authenticated users to upload/read
-- INSERT INTO storage.buckets (id, name, public) VALUES ('receipts', 'receipts', true)
--   ON CONFLICT (id) DO NOTHING;
