-- ═══════════════════════════════════════════════════════════════════════
--  001 — Cash injection (daily) + Charges category (fixed / other)
-- ═══════════════════════════════════════════════════════════════════════

-- ─── DAILY ENTRIES : cash_injection (super-admin only) ────────────────
ALTER TABLE public.daily_entries
  ADD COLUMN IF NOT EXISTS cash_injection numeric(10,2) NOT NULL DEFAULT 0;

-- ─── MONTHLY CHARGES : category ───────────────────────────────────────
ALTER TABLE public.monthly_charges
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'fixed';

ALTER TABLE public.monthly_charges
  DROP CONSTRAINT IF EXISTS monthly_charges_category_check;

ALTER TABLE public.monthly_charges
  ADD CONSTRAINT monthly_charges_category_check
  CHECK (category IN ('fixed', 'other'));

-- ─── Rebuild daily_summary view to expose cash_injection ──────────────
CREATE OR REPLACE VIEW public.daily_summary AS
SELECT
  de.id,
  de.date,
  de.month_key,
  de.tpe_amount,
  de.coffre_depose,
  de.cash_injection,
  de.reste_en_caisse,
  de.caisse_reelle,
  de.filled_by,
  p.full_name AS filled_by_name,
  COALESCE((SELECT sum(amount) FROM public.revenue_lines WHERE daily_entry_id = de.id), 0) AS total_revenue,
  COALESCE((SELECT sum(amount) FROM public.expense_lines WHERE daily_entry_id = de.id), 0) AS total_expense,
  COALESCE((SELECT sum(amount) FROM public.salary_lines WHERE daily_entry_id = de.id), 0) AS total_salary,
  COALESCE((SELECT sum(amount) FROM public.supplier_daily_amounts WHERE daily_entry_id = de.id), 0) AS total_suppliers,
  COALESCE((SELECT sum(amount) FROM public.revenue_cancellations WHERE daily_entry_id = de.id), 0) AS total_cancellations
FROM public.daily_entries de
LEFT JOIN public.profiles p ON p.id = de.filled_by;
