/**
 * Minor-unit (6-decimal) integer arithmetic for money, matching the
 * precision used by prisma's Decimal(20,6) columns and src/lib/ledger.ts.
 * Never use floating-point arithmetic for money.
 */
const SCALE = BigInt(1_000_000)

export function toMinorUnits(amount: string | number): bigint {
  const str = typeof amount === 'number' ? amount.toFixed(6) : amount
  const negative = str.trim().startsWith('-')
  const unsigned = str.trim().replace(/^-/, '')
  const [wholeRaw, fracRaw = ''] = unsigned.split('.')
  const whole = BigInt(wholeRaw || '0')
  const frac = fracRaw.padEnd(6, '0').slice(0, 6)
  const value = whole * SCALE + BigInt(frac || '0')
  return negative ? -value : value
}

export function fromMinorUnits(value: bigint): string {
  const negative = value < BigInt(0)
  const abs = negative ? -value : value
  const whole = abs / SCALE
  const frac = abs % SCALE
  return (negative ? '-' : '') + whole.toString() + '.' + frac.toString().padStart(6, '0')
}

export function addMinor(...values: bigint[]): bigint {
  return values.reduce((a, b) => a + b, BigInt(0))
}

/** Multiplies two minor-unit values (e.g. quantity * unitPrice), rescaling the result back to 6 decimals. */
export function multiplyMinor(a: bigint, b: bigint): bigint {
  return (a * b) / SCALE
}
