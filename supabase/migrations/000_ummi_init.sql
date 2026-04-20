-- ═══════════════════════════════════════════════════════════════════════
--  UMMI — Migration unique d'initialisation
--  À exécuter UNE SEULE FOIS dans un NOUVEAU projet Supabase
--  (Supabase Dashboard → SQL Editor → Run)
--
--  Consolide : schéma complet + seed data + super admin salah@ummi.ma
-- ═══════════════════════════════════════════════════════════════════════

-- ─── EXTENSIONS ────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ═══════════════════════════════════════════════════════════════════════
--  SCHÉMA
-- ═══════════════════════════════════════════════════════════════════════

-- ─── ROLES ─────────────────────────────────────────────────────────
CREATE TABLE public.roles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text UNIQUE NOT NULL,
  label text NOT NULL,
  color text NOT NULL DEFAULT '#6B7280',
  is_system boolean NOT NULL DEFAULT false,
  permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ─── PROFILES (extends auth.users) ─────────────────────────────────
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL,
  avatar_url text,
  role_id uuid NOT NULL REFERENCES public.roles(id),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ─── PRODUCTS ──────────────────────────────────────────────────────
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  unit text NOT NULL CHECK (unit IN ('KG', 'G', 'Pce', 'L')),
  unit_price numeric(10,2) NOT NULL DEFAULT 0,
  category text NOT NULL CHECK (category IN ('food', 'drink', 'snack', 'other')),
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ─── SUPPLIERS ─────────────────────────────────────────────────────
CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  phone text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ─── EMPLOYEES ─────────────────────────────────────────────────────
CREATE TABLE public.employees (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  base_salary numeric(10,2) NOT NULL DEFAULT 0,
  position text NOT NULL DEFAULT 'Serveur',
  is_active boolean NOT NULL DEFAULT true,
  hire_date date NOT NULL DEFAULT current_date,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_employees_profile_id ON public.employees(profile_id);

-- ─── DAILY ENTRIES (core input table) ──────────────────────────────
CREATE TABLE public.daily_entries (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  date date NOT NULL,
  month_key text NOT NULL,
  filled_by uuid NOT NULL REFERENCES public.profiles(id),
  tpe_amount numeric(10,2) NOT NULL DEFAULT 0,
  coffre_depose numeric(10,2) NOT NULL DEFAULT 0,
  reste_en_caisse numeric DEFAULT 0,
  caisse_reelle numeric(10,2) DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(date)
);
CREATE INDEX idx_daily_entries_month ON public.daily_entries(month_key);
CREATE INDEX idx_daily_entries_date  ON public.daily_entries(date);

-- ─── REVENUE LINES ─────────────────────────────────────────────────
CREATE TABLE public.revenue_lines (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  daily_entry_id uuid NOT NULL REFERENCES public.daily_entries(id) ON DELETE CASCADE,
  server_name text NOT NULL DEFAULT '',
  amount numeric(10,2) NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  photo_url text
);
CREATE INDEX idx_revenue_lines_entry ON public.revenue_lines(daily_entry_id);

-- ─── EXPENSE LINES ─────────────────────────────────────────────────
CREATE TABLE public.expense_lines (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  daily_entry_id uuid NOT NULL REFERENCES public.daily_entries(id) ON DELETE CASCADE,
  designation text NOT NULL DEFAULT '',
  amount numeric(10,2) NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  photo_url text
);
CREATE INDEX idx_expense_lines_entry ON public.expense_lines(daily_entry_id);

-- ─── SALARY LINES (daily) ──────────────────────────────────────────
CREATE TABLE public.salary_lines (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  daily_entry_id uuid NOT NULL REFERENCES public.daily_entries(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES public.employees(id),
  employee_name text NOT NULL DEFAULT '',
  amount numeric(10,2) NOT NULL DEFAULT 0
);
CREATE INDEX idx_salary_lines_entry ON public.salary_lines(daily_entry_id);

-- ─── SUPPLIER DAILY AMOUNTS ────────────────────────────────────────
CREATE TABLE public.supplier_daily_amounts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  daily_entry_id uuid NOT NULL REFERENCES public.daily_entries(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id),
  amount numeric(10,2) NOT NULL DEFAULT 0,
  UNIQUE(daily_entry_id, supplier_id)
);
CREATE INDEX idx_supplier_amounts_entry ON public.supplier_daily_amounts(daily_entry_id);

-- ─── INVENTORY LINES (legacy, par daily_entry) ─────────────────────
CREATE TABLE public.inventory_lines (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  daily_entry_id uuid NOT NULL REFERENCES public.daily_entries(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id),
  stock_initial numeric(10,3) NOT NULL DEFAULT 0,
  purchased numeric(10,3) NOT NULL DEFAULT 0,
  remaining numeric(10,3) NOT NULL DEFAULT 0,
  UNIQUE(daily_entry_id, product_id)
);
CREATE INDEX idx_inventory_lines_entry ON public.inventory_lines(daily_entry_id);

-- ─── SALARY ADVANCES ───────────────────────────────────────────────
CREATE TABLE public.salary_advances (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  month_key text NOT NULL,
  day_number integer NOT NULL CHECK (day_number BETWEEN 1 AND 31),
  amount numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_salary_advances_month    ON public.salary_advances(month_key);
CREATE INDEX idx_salary_advances_employee ON public.salary_advances(employee_id);

-- ─── MONTHLY CHARGES ───────────────────────────────────────────────
CREATE TABLE public.monthly_charges (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  label text NOT NULL,
  amount numeric(10,2) NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'Espèces',
  month_key text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_monthly_charges_month ON public.monthly_charges(month_key);

-- ─── REVENUE CANCELLATIONS ─────────────────────────────────────────
CREATE TABLE public.revenue_cancellations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  daily_entry_id uuid NOT NULL REFERENCES public.daily_entries(id) ON DELETE CASCADE,
  revenue_line_id uuid REFERENCES public.revenue_lines(id) ON DELETE CASCADE,
  server_name text NOT NULL DEFAULT '',
  amount numeric(10,2) NOT NULL DEFAULT 0,
  reason text NOT NULL,
  photo_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_revenue_cancellations_entry ON public.revenue_cancellations(daily_entry_id);
CREATE INDEX idx_revenue_cancellations_line  ON public.revenue_cancellations(revenue_line_id);

-- ─── SALARY DEDUCTIONS ─────────────────────────────────────────────
CREATE TABLE public.salary_deductions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  month_key text NOT NULL,
  amount numeric(10,2) NOT NULL DEFAULT 0,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_salary_deductions_month    ON public.salary_deductions(month_key);
CREATE INDEX idx_salary_deductions_employee ON public.salary_deductions(employee_id);

-- ─── PURCHASE ORDERS ───────────────────────────────────────────────
CREATE TABLE public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  month_key text NOT NULL,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  supplier_name text NOT NULL,
  items jsonb NOT NULL DEFAULT '[]',
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_name text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_purchase_orders_date     ON public.purchase_orders(date);
CREATE INDEX idx_purchase_orders_supplier ON public.purchase_orders(supplier_id);

-- ─── INVENTORY ITEMS + ENTRIES (nouveau système) ───────────────────
CREATE TABLE public.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  unit text NOT NULL DEFAULT 'kg',
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.inventory_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  month_key text NOT NULL,
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  initial_stock numeric NOT NULL DEFAULT 0,
  purchases numeric NOT NULL DEFAULT 0,
  other_entries numeric NOT NULL DEFAULT 0,
  remaining numeric NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(date, item_id)
);
CREATE INDEX idx_inventory_entries_date ON public.inventory_entries(date);
CREATE INDEX idx_inventory_entries_item ON public.inventory_entries(item_id);

-- ─── APP SETTINGS ──────────────────────────────────────────────────
CREATE TABLE public.app_settings (
  key text PRIMARY KEY,
  value text,
  updated_at timestamptz DEFAULT now()
);

-- ─── SAFE WITHDRAWALS ──────────────────────────────────────────────
CREATE TABLE public.safe_withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  month_key text NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  reason text,
  created_by uuid REFERENCES auth.users(id),
  created_by_name text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_safe_withdrawals_month ON public.safe_withdrawals(month_key);

-- ─── ACTIVITY LOG ──────────────────────────────────────────────────
CREATE TABLE public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  user_id uuid,
  user_name text NOT NULL DEFAULT 'Inconnu',
  action text NOT NULL,
  category text NOT NULL DEFAULT 'other',
  amount numeric,
  detail text,
  date date NOT NULL,
  month_key text NOT NULL
);
CREATE INDEX idx_activity_log_created ON public.activity_log(created_at DESC);
CREATE INDEX idx_activity_log_month   ON public.activity_log(month_key);
CREATE INDEX idx_activity_log_user    ON public.activity_log(user_id);

-- ═══════════════════════════════════════════════════════════════════════
--  FONCTIONS + TRIGGERS
-- ═══════════════════════════════════════════════════════════════════════

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.daily_entries
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Auto-create profile on signup (rôle 'serveur' par défaut)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  default_role_id uuid;
BEGIN
  SELECT id INTO default_role_id FROM public.roles WHERE name = 'serveur' LIMIT 1;
  INSERT INTO public.profiles (id, email, full_name, role_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    default_role_id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Vue daily_summary
CREATE OR REPLACE VIEW public.daily_summary AS
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

-- ═══════════════════════════════════════════════════════════════════════
--  ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE public.roles                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_entries           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revenue_lines           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_lines           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_lines            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_daily_amounts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_lines         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_advances         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_charges         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revenue_cancellations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_deductions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_entries       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.safe_withdrawals        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log            ENABLE ROW LEVEL SECURITY;

-- Policies : lecture + écriture pour les utilisateurs authentifiés
CREATE POLICY "Auth read"  ON public.roles                  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth write" ON public.roles                  FOR ALL    TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth read"  ON public.profiles               FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth write" ON public.profiles               FOR ALL    TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth read"  ON public.products               FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth write" ON public.products               FOR ALL    TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth read"  ON public.suppliers              FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth write" ON public.suppliers              FOR ALL    TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth read"  ON public.employees              FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth write" ON public.employees              FOR ALL    TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth read"  ON public.daily_entries          FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth write" ON public.daily_entries          FOR ALL    TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth read"  ON public.revenue_lines          FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth write" ON public.revenue_lines          FOR ALL    TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth read"  ON public.expense_lines          FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth write" ON public.expense_lines          FOR ALL    TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth read"  ON public.salary_lines           FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth write" ON public.salary_lines           FOR ALL    TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth read"  ON public.supplier_daily_amounts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth write" ON public.supplier_daily_amounts FOR ALL    TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth read"  ON public.inventory_lines        FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth write" ON public.inventory_lines        FOR ALL    TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth read"  ON public.salary_advances        FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth write" ON public.salary_advances        FOR ALL    TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth read"  ON public.monthly_charges        FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth write" ON public.monthly_charges        FOR ALL    TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth read"  ON public.revenue_cancellations  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth write" ON public.revenue_cancellations  FOR ALL    TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth read"  ON public.salary_deductions      FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth write" ON public.salary_deductions      FOR ALL    TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth write" ON public.purchase_orders        FOR ALL    TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth write" ON public.inventory_items        FOR ALL    TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth write" ON public.inventory_entries      FOR ALL    TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth read"  ON public.app_settings           FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth write" ON public.app_settings           FOR ALL    TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth read"  ON public.safe_withdrawals       FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth write" ON public.safe_withdrawals       FOR ALL    TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth read"  ON public.activity_log           FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert" ON public.activity_log          FOR INSERT TO authenticated WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════════
--  STORAGE BUCKETS
-- ═══════════════════════════════════════════════════════════════════════

-- Bucket "brand" (logo)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('brand', 'brand', true, 5242880,
        ARRAY['image/png','image/jpeg','image/webp','image/svg+xml'])
ON CONFLICT (id) DO NOTHING;

-- Bucket "receipts" (photos de reçus)
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO NOTHING;

-- Policies storage
DROP POLICY IF EXISTS "Public read brand"   ON storage.objects;
DROP POLICY IF EXISTS "Auth upload brand"   ON storage.objects;
DROP POLICY IF EXISTS "Auth update brand"   ON storage.objects;
DROP POLICY IF EXISTS "Auth delete brand"   ON storage.objects;
DROP POLICY IF EXISTS "Public read receipts" ON storage.objects;
DROP POLICY IF EXISTS "Auth manage receipts" ON storage.objects;

CREATE POLICY "Public read brand"   ON storage.objects FOR SELECT USING (bucket_id = 'brand');
CREATE POLICY "Auth upload brand"   ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'brand');
CREATE POLICY "Auth update brand"   ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'brand');
CREATE POLICY "Auth delete brand"   ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'brand');
CREATE POLICY "Public read receipts" ON storage.objects FOR SELECT USING (bucket_id = 'receipts');
CREATE POLICY "Auth manage receipts" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'receipts') WITH CHECK (bucket_id = 'receipts');

-- ═══════════════════════════════════════════════════════════════════════
--  SEED : ROLES
-- ═══════════════════════════════════════════════════════════════════════

INSERT INTO public.roles (id, name, label, color, is_system, permissions) VALUES
  ('00000000-0000-0000-0000-000000000001', 'super_admin', 'Super Admin', '#C49A58', true,
   '["dashboard.read","daily.read","daily.write","employees.read","employees.write","suppliers.read","suppliers.write","safe.read","safe.write","inventory.read","inventory.write","charges.read","charges.write","orders.read","orders.write","admin.manage_users","admin.manage_roles","admin.manage_settings"]'::jsonb),
  ('00000000-0000-0000-0000-000000000002', 'admin', 'Admin', '#3F5E5A', true,
   '["dashboard.read","daily.read","daily.write","employees.read","employees.write","suppliers.read","suppliers.write","safe.read","safe.write","inventory.read","inventory.write","charges.read","charges.write","orders.read","orders.write","admin.manage_users","admin.manage_settings"]'::jsonb),
  ('00000000-0000-0000-0000-000000000003', 'serveur', 'Serveur', '#5E8981', false,
   '["dashboard.read","daily.read","daily.write","inventory.read","inventory.write"]'::jsonb),
  ('00000000-0000-0000-0000-000000000004', 'cuisinier', 'Cuisinier', '#B8956A', false,
   '["dashboard.read","daily.read","inventory.read","inventory.write","suppliers.read","orders.read","orders.write"]'::jsonb);

-- ═══════════════════════════════════════════════════════════════════════
--  SEED : APP SETTINGS
-- ═══════════════════════════════════════════════════════════════════════

INSERT INTO public.app_settings (key, value) VALUES
  ('logo_url', ''),
  ('app_name', 'UMMI')
ON CONFLICT (key) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════
--  SEED : PRODUITS (modifiables depuis l'app)
-- ═══════════════════════════════════════════════════════════════════════

INSERT INTO public.products (name, unit, unit_price, category, sort_order) VALUES
  ('Poulet',            'KG',  15,   'food', 1),
  ('VH',                'KG',  120,  'food', 2),
  ('Crevette',          'G',   190,  'food', 3),
  ('Calamar',           'G',   75,   'food', 4),
  ('Mozzarella',        'KG',  58,   'food', 5),
  ('Frites surgelées',  'KG',  22,   'food', 6),
  ('Eau 33cl',          'Pce', 1.7,  'drink', 7),
  ('Eau 50cl',          'Pce', 5,    'drink', 8),
  ('Boisson 250ml',     'Pce', 3.5,  'drink', 9),
  ('Boisson 330ml',     'Pce', 7.5,  'drink', 10),
  ('Oulmès',            'Pce', 4.6,  'drink', 11),
  ('Red Bull',          'Pce', 18,   'drink', 12),
  ('Café',              'KG',  115,  'drink', 13),
  ('Papier serviette',  'Pce', 8.5,  'other', 14);

-- ═══════════════════════════════════════════════════════════════════════
--  SEED : SUPER ADMIN  (salah@ummi.ma / Azerty1234@@)
--  ⚠️ Changer le mot de passe après la première connexion
-- ═══════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_user_id    uuid := gen_random_uuid();
  v_super_role uuid := '00000000-0000-0000-0000-000000000001';
  v_email      text := 'salah@ummi.ma';
  v_password   text := 'Azerty1234@@';
BEGIN
  -- 1) Créer le user dans auth.users (déclenche handle_new_user → profil auto en 'serveur')
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    v_email,
    crypt(v_password, gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', 'Salah'),
    now(),
    now(),
    '', '', '', ''
  );

  -- 2) Identité email (nécessaire pour la connexion mot-de-passe)
  INSERT INTO auth.identities (
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    v_user_id::text,
    v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true),
    'email',
    now(), now(), now()
  );

  -- 3) Promouvoir le profil en super_admin + nom complet
  UPDATE public.profiles
     SET role_id   = v_super_role,
         full_name = 'Salah'
   WHERE id = v_user_id;
END
$$;

-- ═══════════════════════════════════════════════════════════════════════
--  ✅ FIN — Vérifier le résultat
-- ═══════════════════════════════════════════════════════════════════════
-- SELECT p.email, p.full_name, r.name AS role
-- FROM public.profiles p JOIN public.roles r ON r.id = p.role_id;
