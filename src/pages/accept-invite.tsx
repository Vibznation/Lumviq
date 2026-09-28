import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { brand } from '../lib/brand'
import { authHeaders, useAuth } from '../lib/auth-context'

interface InviteDetails {
  organizationId: string
  organizationName: string
  logoUrl?: string | null
  email: string
  role: string
  expired: boolean
  createdAt?: string
}

export default function AcceptInvitePage() {
  const router = useRouter()
  const { token: inviteToken } = router.query
  const { user, token: authToken, refresh } = useAuth()

  const [invite, setInvite] = useState<InviteDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [accepting, setAccepting] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!router.isReady) return
    const tokenStr = typeof inviteToken === 'string' ? inviteToken : Array.isArray(inviteToken) ? inviteToken[0] : ''
    if (!tokenStr) {
      setError('No invitation token provided in URL.')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    fetch(`/api/orgs/accept-invite?token=${encodeURIComponent(tokenStr)}`)
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to fetch invitation details')
        setInvite(data)
      })
      .catch((err: any) => {
        setError(err.message || 'Invitation not found or has expired')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [router.isReady, inviteToken])

  async function handleAccept() {
    const tokenStr = typeof inviteToken === 'string' ? inviteToken : Array.isArray(inviteToken) ? inviteToken[0] : ''
    if (!tokenStr || !authToken) return

    setAccepting(true)
    setError(null)

    try {
      const res = await fetch('/api/orgs/accept-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(authToken) },
        body: JSON.stringify({ token: tokenStr }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not accept invitation')

      setSuccessMessage(`You have joined ${data.organizationName || invite?.organizationName || 'the organization'}!`)
      if (refresh) {
        await refresh().catch(() => {})
      }
      setTimeout(() => {
        router.push('/dashboard').catch(() => {
          window.location.href = '/dashboard'
        })
      }, 1500)
    } catch (err: any) {
      setError(err.message || 'Failed to accept invitation')
      setAccepting(false)
    }
  }

  const tokenStr = typeof inviteToken === 'string' ? inviteToken : ''

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-midnight-950 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="text-xl font-semibold text-midnight-800 dark:text-white">
            {brand.name}
          </Link>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Organization Invitation</p>
        </div>

        <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-6 shadow-sm">
          {loading ? (
            <div className="py-8 text-center text-gray-500 text-sm">Loading invitation details…</div>
          ) : error ? (
            <div className="space-y-4">
              <div role="alert" className="text-sm text-red-700 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-md p-4 text-center">
                <p className="font-medium">Invitation Issue</p>
                <p className="text-xs mt-1 text-red-600 dark:text-red-400">{error}</p>
              </div>
              <div className="text-center">
                <Link href="/login" className="text-xs text-teal-600 hover:underline">
                  Return to Sign In →
                </Link>
              </div>
            </div>
          ) : successMessage ? (
            <div className="text-center py-6 space-y-3">
              <div className="w-12 h-12 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-2xl">
                ✓
              </div>
              <h2 className="text-lg font-semibold text-midnight-900 dark:text-white">Welcome aboard!</h2>
              <p className="text-sm text-gray-600 dark:text-gray-300">{successMessage}</p>
              <p className="text-xs text-gray-400">Redirecting to dashboard…</p>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 font-bold text-xl mb-3">
                  🏢
                </div>
                <h2 className="text-lg font-semibold text-midnight-900 dark:text-white">
                  Join {invite?.organizationName}
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  You were invited as a <span className="font-semibold text-midnight-800 dark:text-gray-200 uppercase">{invite?.role}</span>
                </p>
                <p className="text-xs text-gray-400 mt-0.5">Invitee email: {invite?.email}</p>
              </div>

              {invite?.expired ? (
                <div className="text-xs text-amber-700 bg-amber-50 rounded-md p-3 border border-amber-200 text-center">
                  This invitation has expired. Please request a new invite from the organization administrator.
                </div>
              ) : !authToken ? (
                <div className="space-y-3 pt-2">
                  <p className="text-xs text-gray-600 dark:text-gray-400 text-center">
                    To accept this invitation, sign in or create an account with{' '}
                    <span className="font-medium text-midnight-900 dark:text-white">{invite?.email}</span>.
                  </p>
                  <div className="flex gap-2">
                    <Link
                      href={`/login?redirect=${encodeURIComponent(`/accept-invite?token=${tokenStr}`)}`}
                      className="flex-1 text-center py-2 px-3 text-sm font-medium rounded-md bg-teal-600 text-white hover:bg-teal-700 shadow-sm"
                    >
                      Sign In & Accept
                    </Link>
                    <Link
                      href={`/register?email=${encodeURIComponent(invite?.email || '')}&redirect=${encodeURIComponent(`/accept-invite?token=${tokenStr}`)}`}
                      className="flex-1 text-center py-2 px-3 text-sm font-medium rounded-md border border-gray-300 dark:border-midnight-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-midnight-800"
                    >
                      Create Account
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 pt-2">
                  <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-midnight-800 p-2.5 rounded text-center">
                    Signed in as <span className="font-medium text-midnight-900 dark:text-white">{user?.email}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAccept}
                    disabled={accepting}
                    className="w-full py-2.5 px-4 text-sm font-medium rounded-md bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50 transition-colors shadow-sm"
                  >
                    {accepting ? 'Joining organization…' : `Accept & Join ${invite?.organizationName}`}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
