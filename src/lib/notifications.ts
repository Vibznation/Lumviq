import prisma from '../server/prisma'

/**
 * In-app notifications. A notification with `userId: null` is
 * organization-wide (shown to every member); one with a `userId` is
 * targeted at a single user. There is no email/push delivery — this is an
 * in-app inbox only (see the bell icon in src/components/AppShell.tsx).
 */
export async function createNotification(
  tx: any,
  params: { organizationId: string; userId?: string | null; type: string; title: string; message: string; link?: string | null }
) {
  return tx.notification.create({
    data: {
      organizationId: params.organizationId,
      userId: params.userId ?? null,
      type: params.type,
      title: params.title,
      message: params.message,
      link: params.link ?? null,
    },
  })
}

export async function listNotifications(organizationId: string, userId: string, opts: { unreadOnly?: boolean } = {}) {
  return prisma.notification.findMany({
    where: {
      organizationId,
      OR: [{ userId: null }, { userId }],
      ...(opts.unreadOnly ? { read: false } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
}

export async function unreadNotificationCount(organizationId: string, userId: string) {
  return prisma.notification.count({
    where: { organizationId, OR: [{ userId: null }, { userId }], read: false },
  })
}

export async function markNotificationRead(id: string) {
  return prisma.notification.update({ where: { id }, data: { read: true } })
}

export async function markAllNotificationsRead(organizationId: string, userId: string) {
  return prisma.notification.updateMany({
    where: { organizationId, OR: [{ userId: null }, { userId }], read: false },
    data: { read: true },
  })
}
