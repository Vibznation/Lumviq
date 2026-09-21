import { randomUUID } from 'crypto'
import prisma from '../server/prisma'
import { getStorageProvider } from './storage'

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
  const storagePath = `${params.organizationId}/${storedName}`

  const storage = getStorageProvider()
  await storage.put(storagePath, buffer, params.mimeType)

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
  const storage = getStorageProvider()
  return storage.get(doc.storagePath)
}

export async function deleteDocument(doc: { id: string; storagePath: string }) {
  const storage = getStorageProvider()
  await storage.delete(doc.storagePath)
  await prisma.document.delete({ where: { id: doc.id } })
}
