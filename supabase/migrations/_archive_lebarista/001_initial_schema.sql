-- ═══════════════════════════════════════════════════════════
-- Le Barista — Database Schema
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

-- Enable UUID
create extension if not exists "uuid-ossp";

-- ─── ROLES ──────────────────────────────────────────────
create table public.roles (
  id uuid primary key default uuid_generate_v4(),
  name text unique not null,
  label text not null,
  color text not null default '#6B7280',
  is_system boolean not null default false,
  permissions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- ─── PROFILES (extends auth.users) ─────────────────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null,
  avatar_url text,
  role_id uuid not null references public.roles(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ─── PRODUCTS ───────────────────────────────────────────
create table public.products (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  unit text not null check (unit in ('KG', 'G', 'Pce', 'L')),
  unit_price numeric(10,2) not null default 0,
  category text not null check (category in ('food', 'drink', 'snack', 'other')),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- ─── SUPPLIERS ──────────────────────────────────────────
create table public.suppliers (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  phone text,
  items jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ─── EMPLOYEES ──────────────────────────────────────────
create table public.employees (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  base_salary numeric(10,2) not null default 0,
  position text not null default 'Serveur',
  is_active boolean not null default true,
  hire_date date not null default current_date,
  created_at timestamptz not null default now()
);

-- ─── DAILY ENTRIES (core input table) ───────────────────
create table public.daily_entries (
  id uuid primary key default uuid_generate_v4(),
  date date not null,
  month_key text not null, -- '2026-04'
  filled_by uuid not null references public.profiles(id),
  tpe_amount numeric(10,2) not null default 0,
  coffre_depose numeric(10,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(date) -- one entry per day
);

create index idx_daily_entries_month on public.daily_entries(month_key);
create index idx_daily_entries_date on public.daily_entries(date);

-- ─── REVENUE LINES ──────────────────────────────────────
create table public.revenue_lines (
  id uuid primary key default uuid_generate_v4(),
  daily_entry_id uuid not null references public.daily_entries(id) on delete cascade,
  server_name text not null default '',
  amount numeric(10,2) not null default 0,
  sort_order integer not null default 0
);

create index idx_revenue_lines_entry on public.revenue_lines(daily_entry_id);

-- ─── EXPENSE LINES ──────────────────────────────────────
create table public.expense_lines (
  id uuid primary key default uuid_generate_v4(),
  daily_entry_id uuid not null references public.daily_entries(id) on delete cascade,
  designation text not null default '',
  amount numeric(10,2) not null default 0,
  sort_order integer not null default 0
);

create index idx_expense_lines_entry on public.expense_lines(daily_entry_id);

-- ─── SALARY LINES (daily) ───────────────────────────────
create table public.salary_lines (
  id uuid primary key default uuid_generate_v4(),
  daily_entry_id uuid not null references public.daily_entries(id) on delete cascade,
  employee_id uuid references public.employees(id),
  employee_name text not null default '',
  amount numeric(10,2) not null default 0
);

create index idx_salary_lines_entry on public.salary_lines(daily_entry_id);

-- ─── SUPPLIER DAILY AMOUNTS ─────────────────────────────
create table public.supplier_daily_amounts (
  id uuid primary key default uuid_generate_v4(),
  daily_entry_id uuid not null references public.daily_entries(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id),
  amount numeric(10,2) not null default 0,
  unique(daily_entry_id, supplier_id)
);

create index idx_supplier_amounts_entry on public.supplier_daily_amounts(daily_entry_id);

-- ─── INVENTORY LINES ────────────────────────────────────
create table public.inventory_lines (
  id uuid primary key default uuid_generate_v4(),
  daily_entry_id uuid not null references public.daily_entries(id) on delete cascade,
  product_id uuid not null references public.products(id),
  stock_initial numeric(10,3) not null default 0,
  purchased numeric(10,3) not null default 0,
  remaining numeric(10,3) not null default 0,
  unique(daily_entry_id, product_id)
);

create index idx_inventory_lines_entry on public.inventory_lines(daily_entry_id);

-- ─── SALARY ADVANCES (per employee per month) ───────────
create table public.salary_advances (
  id uuid primary key default uuid_generate_v4(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  month_key text not null,
  day_number integer not null check (day_number between 1 and 31),
  amount numeric(10,2) not null default 0,
  created_at timestamptz not null default now()
);

create index idx_salary_advances_month on public.salary_advances(month_key);
create index idx_salary_advances_employee on public.salary_advances(employee_id);

-- ─── MONTHLY CHARGES ────────────────────────────────────
create table public.monthly_charges (
  id uuid primary key default uuid_generate_v4(),
  label text not null,
  amount numeric(10,2) not null default 0,
  payment_method text not null default 'Espèces',
  month_key text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index idx_monthly_charges_month on public.monthly_charges(month_key);

-- ─── ROW LEVEL SECURITY ─────────────────────────────────
alter table public.roles enable row level security;
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.suppliers enable row level security;
alter table public.employees enable row level security;
alter table public.daily_entries enable row level security;
alter table public.revenue_lines enable row level security;
alter table public.expense_lines enable row level security;
alter table public.salary_lines enable row level security;
alter table public.supplier_daily_amounts enable row level security;
alter table public.inventory_lines enable row level security;
alter table public.salary_advances enable row level security;
alter table public.monthly_charges enable row level security;

-- Authenticated users can read all data
create policy "Authenticated read" on public.roles for select to authenticated using (true);
create policy "Authenticated read" on public.profiles for select to authenticated using (true);
create policy "Authenticated read" on public.products for select to authenticated using (true);
create policy "Authenticated read" on public.suppliers for select to authenticated using (true);
create policy "Authenticated read" on public.employees for select to authenticated using (true);
create policy "Authenticated read" on public.daily_entries for select to authenticated using (true);
create policy "Authenticated read" on public.revenue_lines for select to authenticated using (true);
create policy "Authenticated read" on public.expense_lines for select to authenticated using (true);
create policy "Authenticated read" on public.salary_lines for select to authenticated using (true);
create policy "Authenticated read" on public.supplier_daily_amounts for select to authenticated using (true);
create policy "Authenticated read" on public.inventory_lines for select to authenticated using (true);
create policy "Authenticated read" on public.salary_advances for select to authenticated using (true);
create policy "Authenticated read" on public.monthly_charges for select to authenticated using (true);

-- Write policies: authenticated users can insert/update/delete
-- In production, refine these based on role permissions via RPC
create policy "Auth write" on public.daily_entries for all to authenticated using (true) with check (true);
create policy "Auth write" on public.revenue_lines for all to authenticated using (true) with check (true);
create policy "Auth write" on public.expense_lines for all to authenticated using (true) with check (true);
create policy "Auth write" on public.salary_lines for all to authenticated using (true) with check (true);
create policy "Auth write" on public.supplier_daily_amounts for all to authenticated using (true) with check (true);
create policy "Auth write" on public.inventory_lines for all to authenticated using (true) with check (true);
create policy "Auth write" on public.salary_advances for all to authenticated using (true) with check (true);
create policy "Auth write" on public.monthly_charges for all to authenticated using (true) with check (true);
create policy "Auth write" on public.products for all to authenticated using (true) with check (true);
create policy "Auth write" on public.suppliers for all to authenticated using (true) with check (true);
create policy "Auth write" on public.employees for all to authenticated using (true) with check (true);
create policy "Auth write" on public.roles for all to authenticated using (true) with check (true);
create policy "Auth write" on public.profiles for all to authenticated using (true) with check (true);

-- ─── AUTO-UPDATE updated_at ─────────────────────────────
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at
  before update on public.daily_entries
  for each row execute function public.handle_updated_at();

-- ─── AUTO-CREATE PROFILE ON SIGNUP ──────────────────────
create or replace function public.handle_new_user()
returns trigger as $$
declare
  default_role_id uuid;
begin
  select id into default_role_id from public.roles where name = 'serveur' limit 1;
  insert into public.profiles (id, email, full_name, role_id)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    default_role_id
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── COMPUTED VIEW: daily summary ───────────────────────
create or replace view public.daily_summary as
select
  de.id,
  de.date,
  de.month_key,
  de.tpe_amount,
  de.coffre_depose,
  de.filled_by,
  p.full_name as filled_by_name,
  coalesce((select sum(amount) from public.revenue_lines where daily_entry_id = de.id), 0) as total_revenue,
  coalesce((select sum(amount) from public.expense_lines where daily_entry_id = de.id), 0) as total_expense,
  coalesce((select sum(amount) from public.salary_lines where daily_entry_id = de.id), 0) as total_salary,
  coalesce((select sum(amount) from public.supplier_daily_amounts where daily_entry_id = de.id), 0) as total_suppliers
from public.daily_entries de
left join public.profiles p on p.id = de.filled_by;
