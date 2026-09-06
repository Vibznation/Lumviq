import React, { useEffect, useState } from 'react'

export default function ReconcileIndex() {
  const [sessions, setSessions] = useState<any[]>([])
  const [status, setStatus] = useState('')

  useEffect(() => { fetchSessions() }, [])
  async function fetchSessions() {
    const res = await fetch('/api/banking/reconcile/list')
    const json = await res.json()
    setSessions(json || [])
  }

  async function start() {
    const orgId = (window as any).ORG_ID || ''
    const bankAccountId = (window as any).BANK_ID || ''
    const startDate = new Date().toISOString().slice(0,10)
    const endDate = startDate
    const res = await fetch('/api/banking/reconcile/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ organizationId: orgId, bankAccountId, startDate, endDate }) })
    if (res.ok) { setStatus('Session started'); fetchSessions() }
    else setStatus('Failed to start')
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Reconciliation Sessions</h1>
      <button onClick={start}>Start New Session</button>
      <div style={{ marginTop: 10 }}>{status}</div>
      <ul>
        {sessions.map(s => (
          <li key={s.id}><a href={`/banking/reconcile/session?id=${s.id}`}>{s.id} - {s.status}</a></li>
        ))}
      </ul>
    </div>
  )
}
