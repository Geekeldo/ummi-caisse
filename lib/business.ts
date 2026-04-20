import type { CaisseState, MonthlyStats } from '@/types'
import { CAISSE_INIT } from '@/types'

// ─── Caisse computation ──────────────────────────────────
// The ONLY inputs are: revenues, expenses, salaries, TPE, coffre_depose
// Everything else is COMPUTED from these + the previous day's solde.
export function computeCaisse(
  totalRevenue: number,  // recettes nettes (après annulations)
  totalExpense: number,
  totalSalary: number,
  tpeAmount: number,
  coffreDepose: number,
  previousDaySolde: number | null // null = first day of month
): CaisseState {
  const restantVeille = previousDaySolde ?? CAISSE_INIT
  // Toutes les recettes (espèces + carte) entrent dans la caisse
  const recetteEspece = totalRevenue
  const totalEntree = restantVeille + recetteEspece
  // TPE = argent viré à la banque (sort de la caisse physique)
  // Coffre = argent déposé au coffre (sort de la caisse physique)
  const totalSortie = tpeAmount + totalExpense + totalSalary + coffreDepose
  const solde = totalEntree - totalSortie
  const resteEnCaisse = solde

  return {
    total_revenue: totalRevenue,
    total_expense: totalExpense,
    total_salary: totalSalary,
    tpe_amount: tpeAmount,
    recette_espece: recetteEspece,
    restant_veille: restantVeille,
    total_entree: totalEntree,
    total_sortie: totalSortie,
    solde,
    coffre_depose: coffreDepose,
    reste_en_caisse: resteEnCaisse,
  }
}

// ─── Monthly stats computation ───────────────────────────
export function computeMonthlyStats(
  dailyData: {
    day: number
    revenue: number
    expense: number
    salary: number
    tpe: number
    coffre: number
  }[],
  totalAdvances: number,
  totalCharges: number
): MonthlyStats {
  let totalRevenue = 0
  let totalExpense = 0
  let totalSalary = 0
  let totalTpe = 0
  let totalCoffre = 0

  const chartData: MonthlyStats['daily_data'] = []

  for (const d of dailyData) {
    totalRevenue += d.revenue
    totalExpense += d.expense
    totalSalary += d.salary
    totalTpe += d.tpe
    totalCoffre += d.coffre
    chartData.push({ day: d.day, revenue: d.revenue, expense: d.expense, salary: d.salary, tpe: d.tpe })
  }

  const benefice = totalRevenue - totalExpense - totalSalary - totalAdvances - totalCharges
  const activeDays = chartData.filter(d => d.revenue > 0)
  const avgDailyRevenue = activeDays.length > 0 ? totalRevenue / activeDays.length : 0

  let bestDay: MonthlyStats['best_day'] = null
  let worstDay: MonthlyStats['worst_day'] = null

  if (activeDays.length > 0) {
    const sorted = [...activeDays].sort((a, b) => b.revenue - a.revenue)
    bestDay = { day: sorted[0].day, amount: sorted[0].revenue }
    worstDay = { day: sorted[sorted.length - 1].day, amount: sorted[sorted.length - 1].revenue }
  }

  return {
    total_revenue: totalRevenue,
    total_expense: totalExpense,
    total_salary: totalSalary,
    total_advances: totalAdvances,
    total_tpe: totalTpe,
    total_coffre: totalCoffre,
    total_charges: totalCharges,
    benefice,
    food_cost_pct: totalRevenue > 0 ? (totalExpense / totalRevenue) * 100 : 0,
    masse_salariale_pct: totalRevenue > 0 ? ((totalSalary + totalAdvances) / totalRevenue) * 100 : 0,
    marge_nette_pct: totalRevenue > 0 ? (benefice / totalRevenue) * 100 : 0,
    avg_daily_revenue: avgDailyRevenue,
    best_day: bestDay,
    worst_day: worstDay,
    daily_data: chartData,
  }
}

// ─── Format helpers ──────────────────────────────────────
export function formatDH(n: number): string {
  return `${n.toLocaleString('fr-MA', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} DH`
}

export function formatNumber(n: number): string {
  return n.toLocaleString('fr-MA', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

export function formatPercent(n: number): string {
  return `${n.toFixed(1)}%`
}

// ─── Date helpers ────────────────────────────────────────
export function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

export const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
]
