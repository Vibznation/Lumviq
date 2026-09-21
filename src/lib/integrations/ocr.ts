import { VisionOcrProvider } from './ocr-provider'

/**
 * OCR / document-extraction provider interface (e.g. receipt/bill scanning).
 */
export interface ExtractedDocumentFields {
  vendorName?: string
  amount?: string
  issueDate?: string
  dueDate?: string
  lineItems?: Array<{ description: string; amount: string }>
  confidence: number
}

export interface OcrProvider {
  readonly name: string
  isConfigured(): boolean
  extractFromDocument(fileBuffer: Buffer, mimeType: string): Promise<ExtractedDocumentFields>
}

/**
 * In-memory sandbox OCR provider for testing.
 */
export class SandboxOcrProvider implements OcrProvider {
  readonly name = 'Sandbox OCR'

  isConfigured(): boolean {
    return true
  }

  async extractFromDocument(_fileBuffer: Buffer, _mimeType: string): Promise<ExtractedDocumentFields> {
    const today = new Date().toISOString().split('T')[0]
    const due = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    return {
      vendorName: 'Acme Supplies Co.',
      amount: '450.00',
      issueDate: today,
      dueDate: due,
      lineItems: [
        { description: 'Office Equipment & Peripherals', amount: '350.00' },
        { description: 'Shipping & Delivery', amount: '100.00' },
      ],
      confidence: 0.95,
    }
  }
}

let sandboxOcrInstance: SandboxOcrProvider | null = null

export function getOcrProvider(): OcrProvider | undefined {
  const mode = process.env.OCR_PROVIDER_MODE

  if (mode === 'sandbox') {
    if (!sandboxOcrInstance) sandboxOcrInstance = new SandboxOcrProvider()
    return sandboxOcrInstance
  }

  const vision = new VisionOcrProvider()
  if (vision.isConfigured() || mode === 'vision') {
    return vision
  }

  return undefined
}

