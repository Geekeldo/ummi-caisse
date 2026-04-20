// src/app/admin/page.tsx
'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { getRoleColor } from '@/lib/permissions'
import { Card, InputField, Pill } from '@/components/ui'
import { DEFAULT_PERMISSIONS } from '@/types'
import type { AppModule } from '@/types'
import { formatDH, getMonthKey, MONTHS_FR } from '@/lib/business'
import { Plus, X, Check, Shield, Users, Settings, Activity, Eye, EyeOff, Upload, ImageIcon, Vault, TrendingDown, ShoppingCart, Coins, Trash2, Pencil, Loader2 } from 'lucide-react'
import MonthPicker from '@/components/ui/month-picker'

function checkSuperAdmin(roles: any[], roleId: string | null): boolean {
  if (!roleId) return false
  const role = roles.find(r => r.id === roleId)
  if (!role) return false
  return role.name === 'super_admin' || (role.permissions as string[])?.includes('super_admin')
}

const moduleLabels: Record<AppModule, string> = {
  dashboard: 'Tableau de bord',
  daily: 'Journée',
  employees: 'Équipe',
  suppliers: 'Fournisseurs',
  orders: 'Commandes',
  charges: 'Charges fixes',
  safe: 'Coffre',
  inventory: 'Stock',
  admin: 'Administration',
}

const permModules = [...new Set(DEFAULT_PERMISSIONS.map(p => p.module))] as AppModule[]

export default function AdminPage() {
  const { user, refreshUser } = useAuth()
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  const [tab, setTab] = useState<'users' | 'roles' | 'suivi' | 'settings'>('users')
  const [users, setUsers] = useState<any[]>([])
  const [roles, setRoles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const loadedRef = useRef(false)

  const [editRoleId, setEditRoleId] = useState<string | null>(null)
  const [showAddRole, setShowAddRole] = useState(false)
  const [newRoleName, setNewRoleName] = useState('')
  const [newRoleLabel, setNewRoleLabel] = useState('')
  const [newRoleColor, setNewRoleColor] = useState('#378ADD')

  // ── Create user form ──
  const [showCreateUser, setShowCreateUser] = useState(false)
  const [createForm, setCreateForm] = useState({ full_name: '', email: '', password: '', role_id: '' })
  const [showPwd, setShowPwd] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // ── Edit / Delete user ──
  const [editUserId, setEditUserId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ full_name: '', email: '', role_id: '', password: '' })
  const [showEditPwd, setShowEditPwd] = useState(false)
  const [editSaving, setEditSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // ── Journal d'activité ──
  const [suiviMonth, setSuiviMonth] = useState(() => getMonthKey(new Date()))
  const [journalItems, setJournalItems] = useState<any[]>([])
  const [suiviLoading, setSuiviLoading] = useState(false)

  // ── Settings / Logo ──
  const [logoUrl, setLogoUrl] = useState<string>('')
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoSaved, setLogoSaved] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)

  const currentUserRoleId = users.find(u => u.id === user?.id)?.role_id ?? user?.role_id
  const isCurrentUserSuperAdmin = checkSuperAdmin(roles, currentUserRoleId)

  const uploadLogo = async (file: File) => {
    setLogoUploading(true)
    setLogoSaved(false)
    try {
      const ext = file.name.split('.').pop() || 'png'
      const path = `logo.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('brand')
        .upload(path, file, { upsert: true, contentType: file.type })
      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage.from('brand').getPublicUrl(path)
      const url = urlData.publicUrl + `?v=${Date.now()}`

      await supabase.from('app_settings')
        .upsert({ key: 'logo_url', value: url, updated_at: new Date().toISOString() })

      setLogoUrl(url)
      // Broadcast to other tabs via localStorage
      localStorage.setItem('lb_logo_url', url)
      setLogoSaved(true)
      setTimeout(() => setLogoSaved(false), 3000)
    } catch (err: any) {
      setError(`Upload logo : ${err.message}`)
    } finally {
      setLogoUploading(false)
    }
  }

  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true

    async function load() {
      try {
        setLoading(true)
        setError(null)
        const [uRes, rRes, settingsRes] = await Promise.all([
          supabase.from('profiles').select('*, role:roles(*)').order('created_at'),
          supabase.from('roles').select('*').order('name'),
          supabase.from('app_settings').select('key, value').in('key', ['logo_url']),
        ])
        if (uRes.error) throw uRes.error
        if (rRes.error) throw rRes.error
        setUsers(uRes.data || [])
        setRoles(rRes.data || [])
        const logoSetting = (settingsRes.data || []).find((s: any) => s.key === 'logo_url')
        if (logoSetting?.value) setLogoUrl(logoSetting.value)
      } catch (err: any) {
        setError(err.message || 'Erreur de chargement')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // Load journal d'activité when tab or month changes
  // Only reads from activity_log — all actions (coffre, orders, salaries) are logged there
  // via logActivity(). No need to union with safe_withdrawals / purchase_orders (caused duplicates).
  useEffect(() => {
    if (tab !== 'suivi') return
    const loadJournal = async () => {
      setSuiviLoading(true)
      try {
        const { data } = await supabase
          .from('activity_log')
          .select('*')
          .eq('month_key', suiviMonth)
          .order('created_at', { ascending: false })

        setJournalItems((data || []).map((a: any) => ({
          id: a.id, created_at: a.created_at,
          user_name: a.user_name,
          action: a.action, category: a.category,
          amount: a.amount, date: a.date,
        })))
      } finally {
        setSuiviLoading(false)
      }
    }
    loadJournal()
  }, [tab, suiviMonth])

  const updateUserRole = async (userId: string, roleId: string) => {
    try {
      const { error: err } = await supabase.from('profiles').update({ role_id: roleId }).eq('id', userId)
      if (err) throw err
      const newRole = roles.find(r => r.id === roleId)
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role_id: roleId, role: newRole } : u))
      if (userId === user?.id && typeof refreshUser === 'function') {
        await new Promise(r => setTimeout(r, 300))
        await refreshUser()
      }
    } catch (err: any) { setError(err.message) }
  }

  const toggleActive = async (userId: string, current: boolean) => {
    try {
      await supabase.from('profiles').update({ is_active: !current }).eq('id', userId)
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_active: !current } : u))
    } catch (err: any) { setError(err.message) }
  }

  const createUser = async () => {
    if (!createForm.full_name.trim() || !createForm.email.trim() || !createForm.password || !createForm.role_id) {
      setCreateError('Tous les champs sont obligatoires')
      return
    }
    setCreating(true)
    setCreateError(null)
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erreur création')
      // Reload users
      const { data } = await supabase.from('profiles').select('*, role:roles(*)').order('created_at')
      setUsers(data || [])
      setShowCreateUser(false)
      setCreateForm({ full_name: '', email: '', password: '', role_id: '' })
    } catch (err: any) {
      setCreateError(err.message)
    } finally {
      setCreating(false)
    }
  }

  const startEditUser = (u: any) => {
    setEditUserId(u.id)
    setEditForm({ full_name: u.full_name || '', email: u.email || '', role_id: u.role_id || '', password: '' })
    setShowEditPwd(false)
    setCreateError(null)
  }

  const saveEditUser = async () => {
    if (!editUserId) return
    setEditSaving(true)
    setCreateError(null)
    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: editUserId, ...editForm }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erreur modification')
      // Reload users
      const { data } = await supabase.from('profiles').select('*, role:roles(*)').order('created_at')
      setUsers(data || [])
      setEditUserId(null)
    } catch (err: any) {
      setCreateError(err.message)
    } finally {
      setEditSaving(false)
    }
  }

  const deleteUser = async (userId: string) => {
    setDeleting(true)
    setError(null)
    try {
      const res = await fetch(`/api/users?id=${userId}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erreur suppression')
      setUsers(prev => prev.filter(u => u.id !== userId))
      setDeleteConfirm(null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setDeleting(false)
    }
  }

  const togglePermission = async (roleId: string, permKey: string) => {
    const role = roles.find(r => r.id === roleId)
    if (!role) return
    if (role.is_system && !isCurrentUserSuperAdmin) return
    const perms = (role.permissions || []) as string[]
    const updated = perms.includes(permKey) ? perms.filter((p: string) => p !== permKey) : [...perms, permKey]
    try {
      const { error: err } = await supabase.from('roles').update({ permissions: updated }).eq('id', roleId)
      if (err) throw err
      setRoles(prev => prev.map(r => r.id === roleId ? { ...r, permissions: updated } : r))
      if (roleId === currentUserRoleId && typeof refreshUser === 'function') {
        await new Promise(r => setTimeout(r, 300))
        await refreshUser()
      }
    } catch (err: any) { setError(err.message) }
  }

  const toggleAllModulePerms = async (roleId: string, modPerms: typeof DEFAULT_PERMISSIONS, allChecked: boolean) => {
    const role = roles.find(r => r.id === roleId)
    if (!role) return
    const currentPerms = (role.permissions || []) as string[]
    const updated = allChecked
      ? currentPerms.filter(p => !new Set(modPerms.map(x => x.key)).has(p))
      : [...new Set([...currentPerms, ...modPerms.map(p => p.key)])]
    try {
      const { error: err } = await supabase.from('roles').update({ permissions: updated }).eq('id', roleId)
      if (err) throw err
      setRoles(prev => prev.map(r => r.id === roleId ? { ...r, permissions: updated } : r))
    } catch (err: any) { setError(err.message) }
  }

  const addRole = async () => {
    if (!newRoleName.trim() || !newRoleLabel.trim()) return
    try {
      const { data, error: err } = await supabase.from('roles').insert({
        name: newRoleName.trim().toLowerCase().replace(/\s+/g, '_'),
        label: newRoleLabel.trim(),
        color: newRoleColor,
        permissions: [],
        is_system: false,
      }).select().single()
      if (err) throw err
      if (data) { setRoles(prev => [...prev, data]); setNewRoleName(''); setNewRoleLabel(''); setShowAddRole(false) }
    } catch (err: any) { setError(err.message) }
  }

  const deleteRole = async (id: string) => {
    const role = roles.find(r => r.id === id)
    if (role?.is_system) return
    const count = users.filter(u => u.role_id === id).length
    if (count > 0) { setError(`Impossible : ${count} utilisateur(s) utilisent ce rôle`); return }
    try {
      const { error: err } = await supabase.from('roles').delete().eq('id', id)
      if (err) throw err
      setRoles(prev => prev.filter(r => r.id !== id))
      if (editRoleId === id) setEditRoleId(null)
    } catch (err: any) { setError(err.message) }
  }

  const [suiviMonth_year, suiviMonth_month] = suiviMonth.split('-').map(Number)
  const suiviMonthLabel = `${MONTHS_FR[suiviMonth_month - 1]} ${suiviMonth_year}`

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-gray-200 border-t-brand-400 rounded-full animate-spin" /></div>
  }

  const currentRole = roles.find(r => r.id === currentUserRoleId)
  const isCurrentUserAdmin = isCurrentUserSuperAdmin || currentRole?.name === 'admin'
  if (!isCurrentUserAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Shield size={40} className="text-gray-300" />
        <p className="text-sm text-gray-400">Accès non autorisé</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold tracking-tight">Administration</h2>
        <p className="text-xs text-gray-400">Gestion des utilisateurs, rôles et suivi</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl px-4 py-3 flex items-center justify-between animate-fade-up">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="btn-icon"><X size={14} /></button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-2xl bg-gray-100 w-fit">
        {[
          { id: 'users' as const, l: 'Utilisateurs', i: <Users size={14} /> },
          { id: 'roles' as const, l: 'Rôles & Permissions', i: <Shield size={14} /> },
          { id: 'suivi' as const, l: 'Suivi', i: <Activity size={14} /> },
          { id: 'settings' as const, l: 'Paramètres', i: <Settings size={14} /> },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium transition-all ${
              tab === t.id ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {t.i} {t.l}
          </button>
        ))}
      </div>

      {/* ═══ USERS ═══ */}
      {tab === 'users' && (
        <div className="space-y-4">
          {/* Create user button */}
          {isCurrentUserSuperAdmin && (
            <div className="flex justify-end">
              <button onClick={() => { setShowCreateUser(!showCreateUser); setCreateError(null) }} className="btn-primary text-xs">
                <Plus size={14} /> Créer un compte
              </button>
            </div>
          )}

          {/* Create user form */}
          {showCreateUser && isCurrentUserSuperAdmin && (
            <Card className="animate-fade-up">
              <div className="card-body space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Nouveau compte</p>

                {createError && (
                  <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{createError}</p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <InputField
                    label="Nom complet"
                    type="text"
                    value={createForm.full_name}
                    onChange={v => setCreateForm(s => ({ ...s, full_name: v }))}
                    placeholder="Prénom Nom"
                  />
                  <InputField
                    label="Email"
                    type="text"
                    value={createForm.email}
                    onChange={v => setCreateForm(s => ({ ...s, email: v }))}
                    placeholder="email@example.com"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="label">Mot de passe</label>
                    <div className="relative">
                      <input
                        type={showPwd ? 'text' : 'password'}
                        value={createForm.password}
                        onChange={e => setCreateForm(s => ({ ...s, password: e.target.value }))}
                        placeholder="Min. 6 caractères"
                        className="input-field w-full pr-9"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPwd(!showPwd)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="label">Rôle</label>
                    <select
                      value={createForm.role_id}
                      onChange={e => setCreateForm(s => ({ ...s, role_id: e.target.value }))}
                      className="input-field text-sm"
                    >
                      <option value="">— Choisir un rôle —</option>
                      {roles.map(r => (
                        <option key={r.id} value={r.id}>{r.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={createUser}
                    disabled={creating}
                    className="btn-primary text-xs disabled:opacity-50"
                  >
                    {creating ? 'Création…' : 'Créer le compte'}
                  </button>
                  <button onClick={() => setShowCreateUser(false)} className="btn-icon text-xs px-3">Annuler</button>
                </div>
              </div>
            </Card>
          )}

          <Card title={`Utilisateurs (${users.length})`} noPad>
            <div className="divide-y divide-gray-100">
              {users.map(u => {
                const userRole = u.role || roles.find(r => r.id === u.role_id)
                const isActive = u.is_active !== false
                const isSelf = u.id === user?.id
                const isEditing = editUserId === u.id
                const isDelConfirm = deleteConfirm === u.id

                // ── Inline edit form ──
                if (isEditing) {
                  return (
                    <div key={u.id} className="px-5 py-4 bg-brand-50/30 space-y-3 animate-fade-up">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Modifier le profil</p>
                      {createError && (
                        <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{createError}</p>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1">
                          <label className="label">Nom complet</label>
                          <input
                            type="text"
                            value={editForm.full_name}
                            onChange={e => setEditForm(s => ({ ...s, full_name: e.target.value }))}
                            className="input-field text-sm"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="label">Email</label>
                          <input
                            type="email"
                            value={editForm.email}
                            onChange={e => setEditForm(s => ({ ...s, email: e.target.value }))}
                            className="input-field text-sm"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="label">Rôle</label>
                          <select
                            value={editForm.role_id}
                            onChange={e => setEditForm(s => ({ ...s, role_id: e.target.value }))}
                            className="input-field text-sm"
                          >
                            {roles.map(r => (
                              <option key={r.id} value={r.id}>{r.label}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="label">Nouveau mot de passe</label>
                          <div className="relative">
                            <input
                              type={showEditPwd ? 'text' : 'password'}
                              value={editForm.password}
                              onChange={e => setEditForm(s => ({ ...s, password: e.target.value }))}
                              placeholder="Laisser vide pour ne pas changer"
                              className="input-field text-sm w-full pr-9"
                            />
                            <button
                              type="button"
                              onClick={() => setShowEditPwd(!showEditPwd)}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                              {showEditPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={saveEditUser} disabled={editSaving} className="btn-primary text-xs disabled:opacity-50">
                          {editSaving ? <><Loader2 size={12} className="animate-spin" /> Enregistrement…</> : <><Check size={12} /> Enregistrer</>}
                        </button>
                        <button onClick={() => { setEditUserId(null); setCreateError(null) }} className="btn-icon text-xs px-3">Annuler</button>
                      </div>
                    </div>
                  )
                }

                return (
                  <div key={u.id} className="flex items-center gap-4 px-5 py-3.5">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                      style={{ background: getRoleColor(userRole) }}
                    >
                      {u.full_name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {u.full_name}
                        {isSelf && (
                          <span className="ml-1.5 text-[10px] text-brand-400 font-normal">(vous)</span>
                        )}
                      </p>
                      <p className="text-[11px] text-gray-400 truncate">{u.email}</p>
                    </div>

                    {isCurrentUserSuperAdmin ? (
                      <select
                        value={u.role_id}
                        onChange={e => updateUserRole(u.id, e.target.value)}
                        className="input-field w-auto text-xs py-1.5 px-2"
                      >
                        {roles.map(r => (
                          <option key={r.id} value={r.id}>{r.label}</option>
                        ))}
                      </select>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-gray-100 text-xs text-gray-600"
                        style={{ borderLeft: `3px solid ${userRole?.color || '#6B7280'}` }}
                      >
                        {userRole?.label || 'Inconnu'}
                      </span>
                    )}

                    {isCurrentUserSuperAdmin && !isSelf ? (
                      <button
                        onClick={() => toggleActive(u.id, isActive)}
                        className={`text-[10px] font-semibold px-2.5 py-1 rounded-full transition-colors ${
                          isActive
                            ? 'bg-brand-50 text-brand-500 hover:bg-danger-50 hover:text-danger-500'
                            : 'bg-gray-100 text-gray-400 hover:bg-brand-50 hover:text-brand-500'
                        }`}
                      >
                        {isActive ? 'Actif' : 'Inactif'}
                      </button>
                    ) : (
                      <Pill variant={isActive ? 'brand' : 'gray'}>
                        {isActive ? 'Actif' : 'Inactif'}
                      </Pill>
                    )}

                    {/* Edit + Delete buttons (super_admin only, not self) */}
                    {isCurrentUserSuperAdmin && !isSelf && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => startEditUser(u)}
                          className="btn-icon text-gray-400 hover:text-brand-500"
                          title="Modifier"
                        >
                          <Pencil size={13} />
                        </button>

                        {isDelConfirm ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => deleteUser(u.id)}
                              disabled={deleting}
                              className="text-[10px] font-semibold px-2 py-1 rounded-full bg-danger-500 text-white hover:bg-danger-600 disabled:opacity-50"
                            >
                              {deleting ? '...' : 'Confirmer'}
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(null)}
                              className="btn-icon text-gray-400"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirm(u.id)}
                            className="btn-icon text-gray-300 hover:text-danger-500"
                            title="Supprimer"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
              {users.length === 0 && (
                <div className="py-10 text-center text-xs text-gray-400">Aucun utilisateur</div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* ═══ ROLES ═══ */}
      {tab === 'roles' && (
        <div className="space-y-4">
          {isCurrentUserSuperAdmin && (
            <div className="flex justify-end">
              <button onClick={() => setShowAddRole(!showAddRole)} className="btn-primary text-xs">
                <Plus size={14} /> Nouveau rôle
              </button>
            </div>
          )}

          {showAddRole && (
            <div className="card animate-fade-up">
              <div className="card-body">
                <div className="flex gap-2 items-end flex-wrap">
                  <InputField label="Nom technique" type="text" value={newRoleName} onChange={setNewRoleName} placeholder="ex: manager" className="flex-1 min-w-[120px]" />
                  <InputField label="Libellé" type="text" value={newRoleLabel} onChange={setNewRoleLabel} placeholder="ex: Manager" className="flex-1 min-w-[120px]" />
                  <div className="flex flex-col gap-1">
                    <label className="label">Couleur</label>
                    <input type="color" value={newRoleColor} onChange={e => setNewRoleColor(e.target.value)} className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer" />
                  </div>
                  <button onClick={addRole} className="btn-primary text-xs">Créer</button>
                  <button onClick={() => setShowAddRole(false)} className="btn-icon"><X size={14} /></button>
                </div>
              </div>
            </div>
          )}

          {roles.map(role => {
            const isEdit = editRoleId === role.id
            const perms = (role.permissions || []) as string[]
            const usersCount = users.filter(u => u.role_id === role.id).length

            return (
              <div key={role.id} className="card">
                <div className="card-header">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: role.color }} />
                    <span className="text-sm font-semibold">{role.label}</span>
                    {role.is_system && <Pill variant="gray">Système</Pill>}
                    <span className="text-[10px] text-gray-400">{usersCount} utilisateur{usersCount !== 1 ? 's' : ''}</span>
                  </div>
                  {isCurrentUserSuperAdmin ? (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-400">{perms.length} permission{perms.length !== 1 ? 's' : ''}</span>
                      <button onClick={() => setEditRoleId(isEdit ? null : role.id)} className="btn-icon">
                        {isEdit ? <Check size={14} /> : <Settings size={14} />}
                      </button>
                      {!role.is_system && (
                        <button onClick={() => deleteRole(role.id)} className="btn-icon text-red-500"><X size={14} /></button>
                      )}
                    </div>
                  ) : (
                    <span className="text-[10px] text-gray-400">{perms.length} permission{perms.length !== 1 ? 's' : ''}</span>
                  )}
                </div>

                <div className="card-body">
                  {isEdit ? (
                    <div className="space-y-4">
                      {permModules.map(mod => {
                        const modPerms = DEFAULT_PERMISSIONS.filter(p => p.module === mod)
                        const allChecked = modPerms.every(p => perms.includes(p.key))
                        return (
                          <div key={mod}>
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-xs font-semibold text-gray-500">{moduleLabels[mod]}</p>
                              <button onClick={() => toggleAllModulePerms(role.id, modPerms, allChecked)} className="text-[10px] text-brand-400 hover:text-brand-600 font-medium">
                                {allChecked ? 'Tout retirer' : 'Tout cocher'}
                              </button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                              {modPerms.map(perm => {
                                const checked = perms.includes(perm.key)
                                return (
                                  <label key={perm.key} className={`flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-pointer transition-colors ${checked ? 'bg-brand-50' : 'bg-gray-50 hover:bg-gray-100'}`}>
                                    <span className={`w-4 h-4 rounded flex items-center justify-center border transition-colors flex-shrink-0 ${checked ? 'bg-brand-400 border-brand-400' : 'border-gray-300'}`}>
                                      {checked && <Check size={10} className="text-white" />}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-medium">{perm.label}</p>
                                      {perm.description && <p className="text-[10px] text-gray-400 truncate">{perm.description}</p>}
                                    </div>
                                    <input type="checkbox" checked={checked} onChange={() => togglePermission(role.id, perm.key)} className="hidden" />
                                  </label>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {perms.length > 0 ? perms.map(p => {
                        const perm = DEFAULT_PERMISSIONS.find(x => x.key === p)
                        return <span key={p} className="px-2 py-0.5 rounded-full bg-gray-50 text-[10px] text-gray-500">{perm?.label || p}</span>
                      }) : <span className="text-[10px] text-gray-400 italic">Aucune permission</span>}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ═══ JOURNAL D'ACTIVITÉ ═══ */}
      {tab === 'suivi' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-semibold">Journal d'activité</h3>
              <p className="text-xs text-gray-400">Toutes les actions tracées — dépôts, retraits, commandes, avances</p>
            </div>
            <MonthPicker value={suiviMonth} onChange={setSuiviMonth} />
          </div>

          {suiviLoading ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-6 h-6 border-2 border-gray-100 border-t-brand-400 rounded-full animate-spin" />
            </div>
          ) : journalItems.length === 0 ? (
            <Card>
              <div className="card-body text-center py-6">
                <Activity size={28} className="text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-300">Aucune activité pour {suiviMonthLabel}</p>
              </div>
            </Card>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="divide-y divide-gray-50">
                {journalItems.map((item: any) => {
                  const dt = new Date(item.created_at)
                  const timeLabel = dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                  const dateLabel = dt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })

                  // Icon + color based on category
                  const cfg: Record<string, { icon: React.ReactNode; bg: string; text: string }> = {
                    coffre_depot:    { icon: <Vault size={14} />,        bg: 'bg-brand-50',   text: 'text-brand-500' },
                    coffre_retrait:  { icon: <TrendingDown size={14} />, bg: 'bg-red-50',     text: 'text-danger-500' },
                    commande:        { icon: <ShoppingCart size={14} />, bg: 'bg-blue-50',    text: 'text-blue-500' },
                    avance_salaire:  { icon: <Coins size={14} />,        bg: 'bg-orange-50',  text: 'text-orange-500' },
                    autre:           { icon: <Activity size={14} />,     bg: 'bg-gray-50',    text: 'text-gray-400' },
                  }
                  const { icon, bg, text } = cfg[item.category] ?? cfg.autre

                  return (
                    <div key={item.id + item.created_at} className="flex items-center gap-4 px-5 py-3.5">
                      {/* Icon */}
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${bg} ${text}`}>
                        {icon}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{item.action}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1">
                          <span className="font-semibold text-gray-500">{item.user_name}</span>
                          <span className="text-gray-200">·</span>
                          <span>{dateLabel}</span>
                          <span className="text-gray-200">·</span>
                          <span className="font-mono">{timeLabel}</span>
                        </p>
                      </div>

                      {/* Amount */}
                      {item.amount != null && (
                        <span className={`font-mono text-sm font-bold flex-shrink-0 ${
                          item.category === 'coffre_retrait' ? 'text-danger-600' : 'text-gray-700'
                        }`}>
                          {item.category === 'coffre_retrait' ? '−' : ''}{formatDH(Number(item.amount))}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
              <div className="px-5 py-2 border-t border-gray-50 text-[10px] text-gray-300">
                {journalItems.length} événement{journalItems.length > 1 ? 's' : ''} — {suiviMonthLabel}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ SETTINGS ═══ */}
      {tab === 'settings' && (
        <div className="space-y-4 max-w-lg">
          <Card>
            <div className="card-header">
              <div className="flex items-center gap-2">
                <ImageIcon size={14} className="text-gray-400" />
                <h3 className="text-sm font-semibold">Logo de l'application</h3>
              </div>
            </div>
            <div className="card-body space-y-4">
              {/* Current logo preview */}
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-2xl bg-[#111] flex items-center justify-center flex-shrink-0 overflow-hidden border border-gray-100">
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
                  ) : (
                    <ImageIcon size={24} className="text-white/20" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-700">
                    {logoUrl ? 'Logo actuel' : 'Aucun logo'}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Formats acceptés : PNG, JPG, WebP, SVG<br />
                    Taille recommandée : 512×512 px minimum
                  </p>
                  {logoSaved && (
                    <p className="text-xs text-brand-500 font-semibold mt-1 flex items-center gap-1">
                      <Check size={12} /> Logo mis à jour avec succès
                    </p>
                  )}
                </div>
              </div>

              {/* Upload button */}
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (file) uploadLogo(file)
                  e.target.value = ''
                }}
              />
              <button
                onClick={() => logoInputRef.current?.click()}
                disabled={logoUploading}
                className="btn-primary disabled:opacity-50 w-full justify-center"
              >
                {logoUploading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Envoi en cours…
                  </>
                ) : (
                  <>
                    <Upload size={14} />
                    {logoUrl ? 'Remplacer le logo' : 'Téléverser le logo'}
                  </>
                )}
              </button>

              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-700">
                <strong>Prérequis :</strong> Créez un bucket <code className="bg-amber-100 px-1 rounded">brand</code> dans
                Supabase Dashboard → Storage (public, permettre images).
                Puis exécutez la migration 007 en SQL Editor.
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
