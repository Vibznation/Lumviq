import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import ProtectedRoute from '../../components/ProtectedRoute'
import PageHeader from '../../components/PageHeader'
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
  const [emailConfigured, setEmailConfigured] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null)

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

  async function handleRoleChange(memberId: string, newRole: string) {
    if (!currentOrg || !token) return
    setUpdatingRoleId(memberId)
    try {
      const res = await fetch('/api/orgs/members', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ organizationId: currentOrg.id, memberId, role: newRole }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Failed to update member role')
      }
      await loadMembers()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setUpdatingRoleId(null)
    }
  }

  useEffect(() => {
    loadMembers()
    if (token) {
      fetch('/api/integrations/status', { headers: authHeaders(token) })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.email?.configured) setEmailConfigured(true)
        })
        .catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrg?.id, token])

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
      if (emailConfigured) {
        setInviteStatus(`Invitation queued/sent to ${inviteEmail}. Token: ${invite.token}`)
      } else {
        setInviteStatus(`Invitation created. Share this token with ${inviteEmail}: ${invite.token}`)
      }
      setInviteEmail('')
    } catch (err: any) {
      setInviteStatus(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <PageHeader
        icon="⚙️"
        eyebrow="Settings"
        title="Organization Settings"
        subtitle={currentOrg?.name}
        quickLinks={[
          { label: 'Multi-Entity', href: '/settings/multi-entity', icon: '🏢' },
          { label: 'Intercompany', href: '/settings/intercompany-transactions', icon: '🔄' },
          { label: 'Tax Rates', href: '/settings/tax-rates', icon: '🧾' },
          { label: 'Branding', href: '/settings/branding', icon: '🎨' },
          { label: 'Integrations', href: '/settings/integrations', icon: '🔌' },
          { label: 'Billing', href: '/settings/billing', icon: '💳' },
          { label: 'Dimensions', href: '/settings/dimensions', icon: '🏷️' },
          { label: 'Currencies', href: '/settings/currencies', icon: '💱' },
          { label: 'Funds & Grants', href: '/settings/funds', icon: '🎁' },
          { label: 'Contractors', href: '/settings/contractors', icon: '🧑\u200d💼' },
          { label: 'Webhooks', href: '/settings/webhooks', icon: '🔗' },
          { label: 'Background Jobs', href: '/settings/jobs', icon: '⚡' },
          { label: 'Custom Roles', href: '/settings/roles', icon: '👥' },
          { label: 'Custom Fields', href: '/settings/custom-fields', icon: '🧱' },
          { label: 'Workflows', href: '/settings/workflows', icon: '🤖' },
          { label: 'Approval Thresholds', href: '/settings/approval-thresholds', icon: '🚦' },
          { label: 'Audit History', href: '/settings/audit-log', icon: '📜' },
        ]}
      />

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
                  <td className="px-3 py-2 text-gray-500 dark:text-gray-400">
                    <select
                      value={m.role}
                      disabled={updatingRoleId === m.id}
                      onChange={(e) => handleRoleChange(m.id, e.target.value)}
                      className="text-xs rounded border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-200 px-2 py-1 font-medium capitalize"
                    >
                      <option value="owner">Owner (Full admin & approver)</option>
                      <option value="member">Member</option>
                      <option value="accountant">Accountant</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </td>
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
          {emailConfigured
            ? 'Email delivery is connected. Invites will be dispatched automatically via background email jobs.'
            : 'Email delivery is currently in console mode — you can also check Integrations settings to connect SMTP or Resend.'}
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
