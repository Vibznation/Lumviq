import { describe, it, expect } from 'vitest'
import { SandboxOcrProvider, getOcrProvider } from '../src/lib/integrations/ocr'
import { VisionOcrProvider } from '../src/lib/integrations/ocr-provider'

describe('ocr integration', () => {
  it('SandboxOcrProvider extracts vendor, amounts, and dates', async () => {
    const sandbox = new SandboxOcrProvider()
    expect(sandbox.isConfigured()).toBe(true)
    expect(sandbox.name).toBe('Sandbox OCR')

    const buffer = Buffer.from('dummy image buffer')
    const extracted = await sandbox.extractFromDocument(buffer, 'image/jpeg')

    expect(extracted.vendorName).toBe('Acme Supplies Co.')
    expect(extracted.amount).toBe('450.00')
    expect(extracted.issueDate).toBeDefined()
    expect(extracted.dueDate).toBeDefined()
    expect(extracted.lineItems).toHaveLength(2)
    expect(extracted.confidence).toBeGreaterThan(0.9)
  })

  it('getOcrProvider returns sandbox when OCR_PROVIDER_MODE is sandbox', () => {
    const originalMode = process.env.OCR_PROVIDER_MODE
    try {
      process.env.OCR_PROVIDER_MODE = 'sandbox'
      const provider = getOcrProvider()
      expect(provider).toBeDefined()
      expect(provider?.name).toBe('Sandbox OCR')
    } finally {
      process.env.OCR_PROVIDER_MODE = originalMode
    }
  })

  it('VisionOcrProvider reports unconfigured when no API key provided', () => {
    const vision = new VisionOcrProvider('')
    expect(vision.isConfigured()).toBe(false)
    expect(vision.name).toBe('AI Vision OCR')
  })
})
