import { promises as fs } from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import prisma from '../server/prisma'

/**
 * Document storage. Files are stored on local disk under `/uploads`
 * (outside `src/`), keyed by organization, with metadata in the
 * `documents` table. There is no cloud-storage provider configured — see
 * src/lib/integrations/ — so this is local development/demo storage only,
 * not durable production storage (files are lost if the disk/container is
 * recreated). Uploads are accepted as base64-encoded JSON rather than
 * multipart form data to avoid adding a new dependency; see
 * src/pages/api/documents/index.ts.
 */
const UPLOADS_ROOT = path.join(process.cwd(), 'uploads')
const MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB

export async function saveDocument(params: {
  organizationId: string
  fileName: string
  mimeType: string
  base64Data: string
  relatedType?: string | null
  relatedId?: string | null
  uploadedByUserId?: string | null
}) {
  const buffer = Buffer.from(params.base64Data, 'base64')
  if (buffer.byteLength === 0) throw new Error('File is empty')
  if (buffer.byteLength > MAX_SIZE_BYTES) throw new Error('File exceeds the 10 MB upload limit')

  const safeName = params.fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storedName = `${randomUUID()}-${safeName}`
  const orgDir = path.join(UPLOADS_ROOT, params.organizationId)
  await fs.mkdir(orgDir, { recursive: true })
  const fullPath = path.join(orgDir, storedName)
  await fs.writeFile(fullPath, buffer)

  const storagePath = path.join(params.organizationId, storedName)

  return prisma.document.create({
    data: {
      organizationId: params.organizationId,
      fileName: params.fileName,
      mimeType: params.mimeType,
      sizeBytes: buffer.byteLength,
      storagePath,
      relatedType: params.relatedType ?? null,
      relatedId: params.relatedId ?? null,
      uploadedByUserId: params.uploadedByUserId ?? null,
    },
  })
}

export async function listDocuments(organizationId: string, relatedType?: string, relatedId?: string) {
  return prisma.document.findMany({
    where: { organizationId, ...(relatedType ? { relatedType } : {}), ...(relatedId ? { relatedId } : {}) },
    orderBy: { createdAt: 'desc' },
  })
}

export async function readDocumentFile(doc: { storagePath: string }) {
  const fullPath = path.join(UPLOADS_ROOT, doc.storagePath)
  return fs.readFile(fullPath)
}

export async function deleteDocument(doc: { id: string; storagePath: string }) {
  const fullPath = path.join(UPLOADS_ROOT, doc.storagePath)
  await fs.unlink(fullPath).catch(() => undefined)
  await prisma.document.delete({ where: { id: doc.id } })
}
