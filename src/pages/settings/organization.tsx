import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import ProtectedRoute from '../../components/ProtectedRoute'
import { authHeaders, useAuth } from '../../lib/auth-context'

type Member = {
  id: string
  email: string
  name: string | null
  role: string
  joinedAt: string
}

function OrganizationSettingsContent() {
  const { token, currentOrg } = useAuth()
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [inviteStatus, setInviteStatus] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function loadMembers() {
    if (!currentOrg) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/orgs/members?organizationId=${currentOrg.id}`, { headers: authHeaders(token) })
      if (!res.ok) throw new Error('Could not load members')
      setMembers(await res.json())
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMembers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrg?.id])

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!currentOrg) return
    setSubmitting(true)
    setInviteStatus(null)
    try {
      const res = await fetch('/api/orgs/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ organizationId: currentOrg.id, email: inviteEmail, role: inviteRole }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Could not send invitation')
      }
      const invite = await res.json()
      setInviteStatus(`Invitation created. Share this token with ${inviteEmail}: ${invite.token}`)
      setInviteEmail('')
    } catch (err: any) {
      setInviteStatus(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold text-midnight-900 dark:text-white mb-1">Organization settings</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{currentOrg?.name}</p>

      <div className="mb-6 flex gap-4 text-sm flex-wrap">
        <Link href="/settings/multi-entity" className="text-teal-700 dark:text-teal-400 hover:underline">Multi-entity management</Link>
        <Link href="/settings/tax-rates" className="text-teal-700 dark:text-teal-400 hover:underline">Tax rates</Link>
        <Link href="/settings/integrations" className="text-teal-700 dark:text-teal-400 hover:underline">Integrations</Link>
        <Link href="/settings/billing" className="text-teal-700 dark:text-teal-400 hover:underline">Billing</Link>
        <Link href="/settings/dimensions" className="text-teal-700 dark:text-teal-400 hover:underline">Dimensions</Link>
        <Link href="/settings/currencies" className="text-teal-700 dark:text-teal-400 hover:underline">Currencies</Link>
        <Link href="/settings/funds" className="text-teal-700 dark:text-teal-400 hover:underline">Funds &amp; grants</Link>
        <Link href="/settings/contractors" className="text-teal-700 dark:text-teal-400 hover:underline">Contractors</Link>
        <Link href="/settings/webhooks" className="text-teal-700 dark:text-teal-400 hover:underline">Webhooks</Link>
      </div>

      {error && (
        <div role="alert" className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Members</h2>
        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : (
          <table className="w-full text-sm border border-gray-200 dark:border-midnight-800 rounded-md overflow-hidden">
            <thead className="bg-gray-50 dark:bg-midnight-900 text-left text-gray-500 dark:text-gray-400">
              <tr>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Email</th>
                <th className="px-3 py-2 font-medium">Role</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-t border-gray-100 dark:border-midnight-800">
                  <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{m.name || '—'}</td>
                  <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{m.email}</td>
                  <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{m.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Invite a teammate</h2>
        <form onSubmit={handleInvite} className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-4 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label htmlFor="inviteEmail" className="block text-xs font-medium text-gray-600 dark:text-gray-400">Email</label>
            <input
              id="inviteEmail"
              type="email"
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label htmlFor="inviteRole" className="block text-xs font-medium text-gray-600 dark:text-gray-400">Role</label>
            <select
              id="inviteRole"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="mt-1 rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm"
            >
              <option value="member">Member</option>
              <option value="owner">Owner</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-teal-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-teal-700 disabled:opacity-60"
          >
            {submitting ? 'Sending…' : 'Send invite'}
          </button>
        </form>
        {inviteStatus && <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{inviteStatus}</p>}
        <p className="mt-2 text-xs text-gray-400">
          Email delivery is not yet configured — invitees currently need the token shared manually.
        </p>
      </section>
    </div>
  )
}

export default function OrganizationSettingsPage() {
  return (
    <ProtectedRoute>
      <OrganizationSettingsContent />
    </ProtectedRoute>
  )
}
