import React, { useState } from 'react'

export default function ReconcileReview({ suggestions, onApply, onClose }: any) {
  const [selected, setSelected] = useState<Record<string, boolean>>({})

  function toggle(id: string) {
    setSelected(s => ({ ...s, [id]: !s[id] }))
  }

  const items = Object.entries(suggestions || {}) as Array<[string, Array<{ journalLineId: string; description?: string; amount?: string | number; confidence?: number }>]> 

  async function applySelected() {
    const mappings: any[] = []
    for (const [txId, sList] of items) {
      const pick = sList[0]
      if (selected[txId] && pick) mappings.push({ bankTransactionId: txId, journalLineId: pick.journalLineId })
    }
    await onApply(mappings)
    onClose()
  }

  return (
    <div style={{ position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'white', padding: 20, maxWidth: 900, width: '90%', maxHeight: '80%', overflow: 'auto' }}>
        <h2>Review Suggestions</h2>
        <p>Select suggestions to apply.</p>
        <div>
          {items.map(([txId, sList]: any) => (
            <div key={txId} style={{ borderBottom: '1px solid #eee', padding: 8 }}>
              <label><input type="checkbox" checked={!!selected[txId]} onChange={() => toggle(txId)} /> Apply suggestion for {txId}</label>
              <div>
                {sList.map((s: any) => (
                  <div key={s.journalLineId} style={{ marginLeft: 16 }}>
                    {s.description} — {s.amount} — confidence {Math.round((s.confidence || 0) * 100)}%
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12 }}>
          <button onClick={applySelected}>Apply selected</button>
          <button style={{ marginLeft: 8 }} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
