import type { ExtractedDocumentFields, OcrProvider } from './ocr'

/**
 * AI/Vision-based OCR extraction provider for bills and receipts.
 * Uses standard vision extraction endpoints when configured with OPENAI_API_KEY or OCR_API_KEY.
 */
export class VisionOcrProvider implements OcrProvider {
  readonly name = 'AI Vision OCR'

  constructor(
    private readonly apiKey: string = process.env.OCR_API_KEY || process.env.OPENAI_API_KEY || '',
    private readonly baseUrl: string = process.env.OCR_BASE_URL || 'https://api.openai.com/v1'
  ) {}

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0)
  }

  async extractFromDocument(fileBuffer: Buffer, mimeType: string): Promise<ExtractedDocumentFields> {
    if (!this.isConfigured()) {
      throw new Error('OCR is not configured. Missing OCR_API_KEY or OPENAI_API_KEY.')
    }

    const base64Data = fileBuffer.toString('base64')
    const dataUrl = `data:${mimeType};base64,${base64Data}`

    const prompt = `You are a specialized accounting document extraction system. 
Extract the following fields from this invoice or receipt image as strictly formatted JSON:
{
  "vendorName": string | null,
  "amount": string (e.g. "124.50") | null,
  "issueDate": string (YYYY-MM-DD) | null,
  "dueDate": string (YYYY-MM-DD) | null,
  "lineItems": [{"description": string, "amount": string}],
  "confidence": number between 0.0 and 1.0
}`

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: dataUrl } },
            ],
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      }),
    })

    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(json?.error?.message || `OCR API request failed (${res.status})`)
    }

    const content = json.choices?.[0]?.message?.content
    if (!content) {
      return { confidence: 0 }
    }

    try {
      const parsed = JSON.parse(content)
      return {
        vendorName: parsed.vendorName || undefined,
        amount: parsed.amount || undefined,
        issueDate: parsed.issueDate || undefined,
        dueDate: parsed.dueDate || undefined,
        lineItems: Array.isArray(parsed.lineItems) ? parsed.lineItems : undefined,
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.85,
      }
    } catch {
      return { confidence: 0 }
    }
  }
}
