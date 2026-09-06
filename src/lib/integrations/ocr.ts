/**
 * OCR / document-extraction provider interface (e.g. receipt/bill scanning).
 *
 * NOT IMPLEMENTED: no OCR provider is wired up. Bill and receipt line
 * items must be entered manually until a real provider adapter is
 * registered here — never present extracted fields as real without one.
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
