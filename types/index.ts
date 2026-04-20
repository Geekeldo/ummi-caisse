// ═══════════════════════════════════════════════════════════
// UMMI — Type Definitions
// ═══════════════════════════════════════════════════════════

// ─── Auth & Roles ────────────────────────────────────────
export type UserRole = 'super_admin' | 'admin' | 'serveur' | 'cuisinier' | string

export interface Permission {
  id: string
  key: string // e.g. 'daily.write', 'employees.read', 'admin.manage_roles'
  label: string
  description: string
  module: AppModule
}

export type AppModule =
  | 'dashboard'
  | 'daily'
  | 'employees'
  | 'suppliers'
  | 'orders'
  | 'charges'
  | 'safe'
  | 'inventory'
  | 'admin'

export interface Role {
  id: string
  name: string
  label: string
  color: string
  is_system: boolean // super_admin, admin are system roles
  permissions: string[] // permission keys
  created_at: string
}

export interface AppUser {
  id: string
  email: string
  full_name: string
  avatar_url?: string
  role_id: string
  role?: Role
  is_active: boolean
  created_at: string
}

// ─── Business Entities ───────────────────────────────────
export interface Product {
  id: string
  name: string
  unit: 'KG' | 'G' | 'Pce' | 'L'
  unit_price: number
  category: 'food' | 'drink' | 'snack' | 'other'
  is_active: boolean
  sort_order: number
}

export interface Supplier {
  id: string
  name: string
  phone?: string
  items: string[] // stored as JSONB
  is_active: boolean
  created_at: string
}

export interface Employee {
  id: string
  name: string
  base_salary: number
  position: string
  is_active: boolean
  hire_date: string
}

export interface MonthlyCharge {
  id: string
  label: string
  amount: number
  payment_method: string
  month_key: string // '2026-04'
}

// ─── Daily Entry (the CORE input) ────────────────────────
export interface DailyEntry {
  id: string
  date: string // ISO date '2026-04-15'
  month_key: string // '2026-04'
  filled_by: string // user id
  filled_by_name?: string
  tpe_amount: number
  coffre_depose: number
  created_at: string
  updated_at: string
}

export interface RevenueLine {
  id: string
  daily_entry_id: string
  server_name: string
  amount: number
  sort_order: number
}

export interface ExpenseLine {
  id: string
  daily_entry_id: string
  designation: string
  amount: number
  sort_order: number
}

export interface SalaryLine {
  id: string
  daily_entry_id: string
  employee_id?: string
  employee_name: string
  amount: number
}

export interface SupplierDailyAmount {
  id: string
  daily_entry_id: string
  supplier_id: string
  amount: number
}

export interface InventoryLine {
  id: string
  daily_entry_id: string
  product_id: string
  stock_initial: number
  purchased: number
  remaining: number
  // computed: consumed = stock_initial + purchased - remaining
  // computed: cost_value = consumed * product.unit_price
}

// ─── Computed / View types ───────────────────────────────
export interface CaisseState {
  total_revenue: number
  total_expense: number
  total_salary: number
  tpe_amount: number
  recette_espece: number // revenue - tpe
  restant_veille: number // previous day solde or CAISSE_INIT
  total_entree: number // restant_veille + recette_espece
  total_sortie: number // expense + salary
  solde: number // entree - sortie
  coffre_depose: number
  reste_en_caisse: number // solde - coffre
}

export interface MonthlyStats {
  total_revenue: number
  total_expense: number
  total_salary: number
  total_advances: number
  total_tpe: number
  total_coffre: number
  total_charges: number
  benefice: number
  food_cost_pct: number
  masse_salariale_pct: number
  marge_nette_pct: number
  avg_daily_revenue: number
  best_day: { day: number; amount: number } | null
  worst_day: { day: number; amount: number } | null
  daily_data: { day: number; revenue: number; expense: number; salary: number; tpe: number }[]
}

// ─── Salary Advance (per-employee per-month) ─────────────
export interface SalaryAdvance {
  id: string
  employee_id: string
  month_key: string
  day_number: number
  amount: number
  created_at: string
}

// ─── Constants ───────────────────────────────────────────
export const CAISSE_INIT = 5000

export const DEFAULT_PERMISSIONS: Permission[] = [
  { id: 'p1', key: 'dashboard.read', label: 'Voir le tableau de bord', description: 'Accès au dashboard mensuel', module: 'dashboard' },
  { id: 'p2', key: 'daily.read', label: 'Voir les journées', description: 'Consulter les entrées journalières', module: 'daily' },
  { id: 'p3', key: 'daily.write', label: 'Saisir les journées', description: 'Créer et modifier les entrées journalières', module: 'daily' },
  { id: 'p4', key: 'employees.read', label: 'Voir les employés', description: 'Consulter la liste et les avances', module: 'employees' },
  { id: 'p5', key: 'employees.write', label: 'Gérer les employés', description: 'Ajouter avances, modifier employés', module: 'employees' },
  { id: 'p6', key: 'suppliers.read', label: 'Voir les fournisseurs', description: 'Consulter les fournisseurs', module: 'suppliers' },
  { id: 'p7', key: 'suppliers.write', label: 'Gérer les fournisseurs', description: 'Ajouter, modifier, supprimer', module: 'suppliers' },
  { id: 'p8', key: 'safe.read', label: 'Voir le coffre', description: 'Consulter les dépôts journaliers', module: 'safe' },
  { id: 'p9', key: 'safe.write', label: 'Gérer le coffre', description: 'Modifier les dépôts au coffre', module: 'safe' },
  { id: 'p15', key: 'charges.read', label: 'Voir les charges', description: 'Consulter les charges fixes', module: 'charges' },
  { id: 'p16', key: 'charges.write', label: 'Gérer les charges', description: 'Ajouter, modifier, supprimer les charges fixes', module: 'charges' },
  { id: 'p10', key: 'inventory.read', label: 'Voir le stock', description: 'Consulter l\'inventaire', module: 'inventory' },
  { id: 'p11', key: 'inventory.write', label: 'Gérer le stock', description: 'Saisir l\'inventaire', module: 'inventory' },
  { id: 'p17', key: 'orders.read', label: 'Voir les commandes', description: 'Consulter les bons de commande', module: 'orders' },
  { id: 'p18', key: 'orders.write', label: 'Créer des commandes', description: 'Créer et envoyer des bons de commande', module: 'orders' },
  { id: 'p12', key: 'admin.manage_users', label: 'Gérer les utilisateurs', description: 'CRUD utilisateurs', module: 'admin' },
  { id: 'p13', key: 'admin.manage_roles', label: 'Gérer les rôles', description: 'Créer et configurer les rôles', module: 'admin' },
  { id: 'p14', key: 'admin.manage_settings', label: 'Paramètres', description: 'Configuration globale', module: 'admin' },
]

export const DEFAULT_ROLES: Omit<Role, 'created_at'>[] = [
  {
    id: 'role_super_admin',
    name: 'super_admin',
    label: 'Super Admin',
    color: '#7C3AED',
    is_system: true,
    permissions: DEFAULT_PERMISSIONS.map(p => p.key),
  },
  {
    id: 'role_admin',
    name: 'admin',
    label: 'Admin',
    color: '#2D8B75',
    is_system: true,
    permissions: DEFAULT_PERMISSIONS.filter(p => p.key !== 'admin.manage_roles').map(p => p.key),
  },
  {
    id: 'role_serveur',
    name: 'serveur',
    label: 'Serveur',
    color: '#378ADD',
    is_system: false,
    permissions: ['daily.read', 'daily.write'],
  },
  {
    id: 'role_cuisinier',
    name: 'cuisinier',
    label: 'Cuisinier',
    color: '#B8956A',
    is_system: false,
    // Cuisinier: orders + inventory + suppliers (lecture)
    permissions: ['orders.read', 'orders.write', 'inventory.read', 'inventory.write', 'suppliers.read'],
  },
]
