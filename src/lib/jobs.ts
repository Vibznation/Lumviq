/**
 * Durable background job queue. Recurring templates, workflow rules,
 * webhook deliveries, and outbound email all enqueue work here instead of
 * executing inline, so retries/backoff/failure visibility are consistent.
 *
 * There is no in-process timer — processing happens when
 * POST /api/jobs/process is called. Wire an external scheduler (e.g. a
 * Vercel Cron Job or any periodic HTTP caller) to that endpoint on an
 * interval; see docs/deployment.md. This keeps Lumviq's server stateless
 * and avoids "hidden background magic" that silently breaks in serverless
 * environments.
 */
import prisma from '../server/prisma'

export type JobType =
  | 'webhook.delivery'
  | 'email.send'
  | 'recurring.run'

const BACKOFF_MINUTES = [1, 5, 15, 60, 240]

export async function enqueueJob(
  tx: any,
  params: { organizationId?: string | null; type: JobType; payload: unknown; runAt?: Date }
) {
  return tx.backgroundJob.create({
    data: {
      organizationId: params.organizationId ?? null,
      type: params.type,
      payload: params.payload as any,
      runAt: params.runAt ?? new Date(),
    },
  })
}

/** Fetches due jobs (status pending, runAt <= now) up to `limit`, oldest first. */
export async function fetchDueJobs(limit = 20) {
  return prisma.backgroundJob.findMany({
    where: { status: 'pending', runAt: { lte: new Date() } },
    orderBy: { runAt: 'asc' },
    take: limit,
  })
}

export async function markJobSucceeded(jobId: string) {
  return prisma.backgroundJob.update({ where: { id: jobId }, data: { status: 'succeeded' } })
}

/** Marks a job failed; reschedules with exponential backoff unless attempts are exhausted. */
export async function markJobFailed(jobId: string, error: string) {
  const job = await prisma.backgroundJob.findUnique({ where: { id: jobId } })
  if (!job) return null
  const attempts = job.attempts + 1
  if (attempts >= job.maxAttempts) {
    return prisma.backgroundJob.update({
      where: { id: jobId },
      data: { status: 'failed', attempts, lastError: error },
    })
  }
  const backoffMinutes = BACKOFF_MINUTES[Math.min(attempts - 1, BACKOFF_MINUTES.length - 1)]
  return prisma.backgroundJob.update({
    where: { id: jobId },
    data: {
      status: 'pending',
      attempts,
      lastError: error,
      runAt: new Date(Date.now() + backoffMinutes * 60_000),
    },
  })
}

async function markJobProcessing(jobId: string) {
  return prisma.backgroundJob.update({ where: { id: jobId }, data: { status: 'processing' } })
}

/**
 * Processes up to `limit` due jobs, one at a time, dispatching each to its
 * handler. Returns per-job outcomes so /api/jobs/process can report them.
 */
export async function processDueJobs(
  handlers: Partial<Record<JobType, (payload: any) => Promise<void>>>,
  limit = 20
) {
  const jobs = await fetchDueJobs(limit)
  const results: Array<{ id: string; type: string; status: 'succeeded' | 'failed'; error?: string }> = []
  for (const job of jobs) {
    await markJobProcessing(job.id)
    const handler = handlers[job.type as JobType]
    try {
      if (!handler) throw new Error(`No handler registered for job type "${job.type}"`)
      await handler(job.payload)
      await markJobSucceeded(job.id)
      results.push({ id: job.id, type: job.type, status: 'succeeded' })
    } catch (err: any) {
      await markJobFailed(job.id, err?.message ?? String(err))
      results.push({ id: job.id, type: job.type, status: 'failed', error: err?.message ?? String(err) })
    }
  }
  return results
}
