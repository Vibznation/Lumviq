import React, { useState } from 'react'
import Papa from 'papaparse'

export default function BankImportPage() {
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState('')

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return setStatus('No file selected')
    const text = await file.text()
    const parsed = Papa.parse(text, { header: true, skipEmptyLines: true, transform: (v: string) => (v || '').trim() })
    const rows: any[] = []
    // try to map common header names
    const headerMap = (parsed.meta && parsed.meta.fields || []).reduce((acc: any, f: string) => { acc[f.toLowerCase()] = f; return acc }, {})
    for (const r of parsed.data as any[]) {
      const date = r[headerMap.transactiondate] || r[headerMap.date] || r[headerMap.transaction_date] || r[headerMap['date']] || ''
      const amountRaw = r[headerMap.amount] || r[headerMap.value] || r[headerMap['amt']] || r['amount'] || ''
      const description = r[headerMap.description] || r[headerMap.memo] || r[headerMap.details] || ''
      const externalId = r[headerMap.externalid] || r[headerMap.reference] || r[headerMap.ref] || ''
      const amount = parseFloat((amountRaw || '').toString().replace(/[^0-9.-]/g, ''))
      if (isNaN(amount)) continue
      rows.push({ transactionDate: date, amount, description, externalId })
    }

    if (rows.length === 0) return setStatus('No parsable rows found')

    setStatus('Uploading ' + rows.length + ' transactions...')
    const payload = { organizationId: (window as any).ORG_ID || '', bankAccountId: (window as any).BANK_ID || '', transactions: rows }
    try {
      const res = await fetch('/api/banking/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (res.ok) {
        const j = await res.json()
        setStatus('Imported ' + (j.createdCount || rows.length) + ' transactions')
      } else {
        setStatus('Import failed: ' + (await res.text()))
      }
    } catch (err: any) {
      setStatus('Import error: ' + err.message)
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Bank CSV Import</h1>
      <form onSubmit={handleUpload}>
        <input type="file" accept=".csv" onChange={e => setFile(e.target.files?.[0] || null)} />
        <div style={{ marginTop: 10 }}>
          <button type="submit">Upload</button>
        </div>
      </form>
      <div style={{ marginTop: 10 }}>{status}</div>
      <p style={{ marginTop: 20, color: '#666' }}>CSV headers recognized: transactionDate/date, amount/value/amt, description/memo, externalId/reference</p>
    </div>
  )
}
