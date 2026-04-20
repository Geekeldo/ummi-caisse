-- ═══════════════════════════════════════════════════════════
-- Le Barista — Migration 006 : Bons de commande + Inventaire
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

-- ── Bons de commande ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id           uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  date         date    NOT NULL,
  month_key    text    NOT NULL,
  supplier_id  uuid    REFERENCES public.suppliers(id) ON DELETE SET NULL,
  supplier_name text   NOT NULL,
  items        jsonb   NOT NULL DEFAULT '[]',   -- [{name, qty, unit}]
  notes        text,
  created_by   uuid   REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_name text,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users manage purchase_orders"
  ON public.purchase_orders FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_date     ON public.purchase_orders(date);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON public.purchase_orders(supplier_id);

-- ── Articles suivis en inventaire ────────────────────────
CREATE TABLE IF NOT EXISTS public.inventory_items (
  id         uuid  DEFAULT gen_random_uuid() PRIMARY KEY,
  name       text  NOT NULL UNIQUE,
  unit       text  NOT NULL DEFAULT 'kg',
  is_active  boolean NOT NULL DEFAULT true,
  sort_order int   NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users manage inventory_items"
  ON public.inventory_items FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ── Saisies journalières d'inventaire ────────────────────
CREATE TABLE IF NOT EXISTS public.inventory_entries (
  id            uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  date          date    NOT NULL,
  month_key     text    NOT NULL,
  item_id       uuid    NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  initial_stock numeric NOT NULL DEFAULT 0,  -- stock veille (auto)
  purchases     numeric NOT NULL DEFAULT 0,  -- achats du jour
  other_entries numeric NOT NULL DEFAULT 0,  -- autres entrées
  remaining     numeric NOT NULL DEFAULT 0,  -- reste fin de journée
  -- consommation = initial_stock + purchases + other_entries - remaining (calculé côté client)
  created_by    uuid   REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at    timestamptz DEFAULT now(),
  created_at    timestamptz DEFAULT now(),
  UNIQUE(date, item_id)
);

ALTER TABLE public.inventory_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users manage inventory_entries"
  ON public.inventory_entries FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_inventory_entries_date    ON public.inventory_entries(date);
CREATE INDEX IF NOT EXISTS idx_inventory_entries_item    ON public.inventory_entries(item_id);
