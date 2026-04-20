-- 011: Ajouter la caisse réelle pour comparer avec la caisse théorique
ALTER TABLE public.daily_entries
  ADD COLUMN IF NOT EXISTS caisse_reelle numeric(10,2) DEFAULT NULL;

-- Recréer la vue daily_summary avec caisse_reelle
DROP VIEW IF EXISTS public.daily_summary;
CREATE VIEW public.daily_summary AS
SELECT
  de.id,
  de.date,
  de.month_key,
  de.tpe_amount,
  de.coffre_depose,
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
