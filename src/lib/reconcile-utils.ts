export function tokens(text: string) {
  return (text || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
}

export function jaccard(a: string, b: string) {
  const A = new Set(tokens(a))
  const B = new Set(tokens(b))
  if (A.size === 0 && B.size === 0) return 0
  let inter = 0
  for (const x of A) if (B.has(x)) inter++
  const union = new Set([...A, ...B]).size
  return union === 0 ? 0 : inter / union
}

export function daysBetween(a?: string | Date, b?: string | Date) {
  if (!a || !b) return 3650
  const da = new Date(a)
  const db = new Date(b)
  const diff = Math.abs(da.getTime() - db.getTime())
  return Math.round(diff / (1000 * 60 * 60 * 24))
}
