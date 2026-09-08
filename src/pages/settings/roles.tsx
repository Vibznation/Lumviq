import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import ProtectedRoute from '../../components/ProtectedRoute'
import { authHeaders, useAuth } from '../../lib/auth-context'

type Permission = { id: string; name: string; description: string | null }
type Role = { id: string; name: string; description: string | null; rolePermissions: Array<{ permission: Permission }> }

/**
 * Custom roles, scoped per organization — role names only need to be
 * unique within the current organization, not across the whole platform.
 */
function RolesContent() {
  const { token, currentOrg } = useAuth()
  const [roles, setRoles] = useState<Role[]>([])
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', permissionIds: [] as string[] })
  const [submitting, setSubmitting] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [editPermissionIds, setEditPermissionIds] = useState<string[]>([])

  async function load() {
    if (!currentOrg) return
    setLoading(true)
    setError(null)
    try {
      const [rRes, pRes] = await Promise.all([
        fetch(`/api/roles?organizationId=${currentOrg.id}`, { headers: authHeaders(token) }),
        fetch(`/api/permissions?organizationId=${currentOrg.id}`, { headers: authHeaders(token) }),
      ])
      if (!rRes.ok) throw new Error('Could not load roles')
      setRoles(await rRes.json())
      setPermissions(pRes.ok ? await pRes.json() : [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrg?.id])

  function togglePermission(list: string[], id: string): string[] {
    return list.includes(id) ? list.filter((p) => p !== id) : [...list, id]
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!currentOrg || !form.name) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ organizationId: currentOrg.id, ...form }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Could not create role')
      }
      setForm({ name: '', description: '', permissionIds: [] })
      setShowForm(false)
      await load()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  function startEdit(role: Role) {
    setEditing(role.id)
    setEditPermissionIds(role.rolePermissions.map((rp) => rp.permission.id))
  }

  async function saveEdit(id: string) {
    if (!currentOrg) return
    setError(null)
    try {
      const res = await fetch(`/api/roles/${id}/permissions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ organizationId: currentOrg.id, permissionIds: editPermissionIds }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Could not update role permissions')
      }
      setEditing(null)
      await load()
    } catch (err: any) {
      setError(err.message)
    }
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-4">
        <Link href="/settings/organization" className="text-sm text-teal-700 dark:text-teal-400 hover:underline">← Back to organization settings</Link>
      </div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-midnight-900 dark:text-white">Custom roles</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{currentOrg?.name} — define roles with specific permission sets</p>
        </div>
        <button onClick={() => setShowForm((s) => !s)} className="rounded-md bg-teal-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-teal-700">
          {showForm ? 'Cancel' : 'New role'}
        </button>
      </div>

      {error && <div role="alert" className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>}

      {showForm && (
        <form onSubmit={handleCreate} className="mb-6 bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-4">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Role name (must be unique within this organization)</label>
              <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Description (optional)</label>
              <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm" />
            </div>
          </div>
          <p className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Permissions</p>
          <div className="flex flex-wrap gap-2 mb-4">
            {permissions.map((p) => (
              <label key={p.id} className="flex items-center gap-1 text-xs bg-gray-50 dark:bg-midnight-800 border border-gray-200 dark:border-midnight-700 rounded-md px-2 py-1">
                <input type="checkbox" checked={form.permissionIds.includes(p.id)} onChange={() => setForm((f) => ({ ...f, permissionIds: togglePermission(f.permissionIds, p.id) }))} />
                {p.name}
              </label>
            ))}
          </div>
          <button type="submit" disabled={submitting} className="rounded-md bg-teal-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
            {submitting ? 'Saving…' : 'Save role'}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : roles.length === 0 ? (
        <p className="text-sm text-gray-500">No custom roles yet.</p>
      ) : (
        <div className="space-y-3">
          {roles.map((r) => (
            <div key={r.id} className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{r.name}</h3>
                {editing === r.id ? (
                  <div className="flex gap-2">
                    <button onClick={() => saveEdit(r.id)} className="text-xs text-teal-700 dark:text-teal-400 hover:underline">Save</button>
                    <button onClick={() => setEditing(null)} className="text-xs text-gray-500 hover:underline">Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => startEdit(r)} className="text-xs text-teal-700 dark:text-teal-400 hover:underline">Edit permissions</button>
                )}
              </div>
              {r.description && <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{r.description}</p>}
              {editing === r.id ? (
                <div className="flex flex-wrap gap-2">
                  {permissions.map((p) => (
                    <label key={p.id} className="flex items-center gap-1 text-xs bg-gray-50 dark:bg-midnight-800 border border-gray-200 dark:border-midnight-700 rounded-md px-2 py-1">
                      <input type="checkbox" checked={editPermissionIds.includes(p.id)} onChange={() => setEditPermissionIds((ids) => togglePermission(ids, p.id))} />
                      {p.name}
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {r.rolePermissions.length === 0 ? 'No permissions assigned' : r.rolePermissions.map((rp) => rp.permission.name).join(', ')}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function RolesPage() {
  return (
    <ProtectedRoute>
      <RolesContent />
    </ProtectedRoute>
  )
}
