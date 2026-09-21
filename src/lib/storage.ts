import { promises as fs } from 'fs'
import path from 'path'

export interface StorageProvider {
  readonly name: string
  put(storageKey: string, buffer: Buffer, mimeType: string): Promise<void>
  get(storageKey: string): Promise<Buffer>
  delete(storageKey: string): Promise<void>
}

/**
 * Local filesystem storage provider.
 */
export class LocalStorageProvider implements StorageProvider {
  readonly name = 'Local Disk'
  private root: string

  constructor(rootDir: string = path.join(process.cwd(), 'uploads')) {
    this.root = rootDir
  }

  async put(storageKey: string, buffer: Buffer, _mimeType: string): Promise<void> {
    const fullPath = path.join(this.root, storageKey)
    await fs.mkdir(path.dirname(fullPath), { recursive: true })
    await fs.writeFile(fullPath, buffer)
  }

  async get(storageKey: string): Promise<Buffer> {
    const fullPath = path.join(this.root, storageKey)
    return fs.readFile(fullPath)
  }

  async delete(storageKey: string): Promise<void> {
    const fullPath = path.join(this.root, storageKey)
    await fs.unlink(fullPath).catch(() => undefined)
  }
}

/**
 * Supabase Storage provider for cloud object storage.
 * Uses the Supabase Storage REST API directly.
 */
export class SupabaseStorageProvider implements StorageProvider {
  readonly name = 'Supabase Storage'

  constructor(
    private readonly supabaseUrl: string = process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    private readonly serviceKey: string = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    private readonly bucket: string = process.env.SUPABASE_STORAGE_BUCKET || 'documents'
  ) {}

  isConfigured(): boolean {
    return Boolean(this.supabaseUrl && this.serviceKey)
  }

  async put(storageKey: string, buffer: Buffer, mimeType: string): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error('Supabase Storage is not configured.')
    }

    const cleanKey = storageKey.replace(/\\/g, '/')
    const url = `${this.supabaseUrl}/storage/v1/object/${encodeURIComponent(this.bucket)}/${cleanKey}`

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.serviceKey}`,
        apikey: this.serviceKey,
        'Content-Type': mimeType,
        'x-upsert': 'true',
      },
      body: new Uint8Array(buffer),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || `Supabase Storage upload failed (${res.status})`)
    }
  }

  async get(storageKey: string): Promise<Buffer> {
    if (!this.isConfigured()) {
      throw new Error('Supabase Storage is not configured.')
    }

    const cleanKey = storageKey.replace(/\\/g, '/')
    const url = `${this.supabaseUrl}/storage/v1/object/${encodeURIComponent(this.bucket)}/${cleanKey}`

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.serviceKey}`,
        apikey: this.serviceKey,
      },
    })

    if (!res.ok) {
      throw new Error(`Supabase Storage fetch failed (${res.status})`)
    }

    const arrayBuffer = await res.arrayBuffer()
    return Buffer.from(arrayBuffer)
  }

  async delete(storageKey: string): Promise<void> {
    if (!this.isConfigured()) return

    const cleanKey = storageKey.replace(/\\/g, '/')
    const url = `${this.supabaseUrl}/storage/v1/object/${encodeURIComponent(this.bucket)}/${cleanKey}`

    await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${this.serviceKey}`,
        apikey: this.serviceKey,
      },
    }).catch(() => undefined)
  }
}

let defaultStorageProvider: StorageProvider | null = null

export function getStorageProvider(): StorageProvider {
  if (defaultStorageProvider) return defaultStorageProvider

  const mode = process.env.STORAGE_PROVIDER_MODE
  const supabase = new SupabaseStorageProvider()

  if (mode === 'supabase' || (mode !== 'local' && supabase.isConfigured() && process.env.SUPABASE_STORAGE_BUCKET)) {
    defaultStorageProvider = supabase
  } else {
    defaultStorageProvider = new LocalStorageProvider()
  }

  return defaultStorageProvider
}
