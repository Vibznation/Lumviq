import React, { useEffect, useRef, useState } from 'react'
import { authHeaders, useAuth } from '../lib/auth-context'

type Notification = {
  id: string
  type: string
  title: string
  message: string
  link: string | null
  read: boolean
  createdAt: string
}

/** In-app notification bell with an unread-count badge and dropdown list. No email/push delivery — in-app only. */
export default function NotificationBell() {
  const { token, currentOrg } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  async function load() {
    if (!currentOrg) return
    try {
      const res = await fetch(`/api/notifications?organizationId=${currentOrg.id}`, { headers: authHeaders(token) })
      if (!res.ok) return
      const json = await res.json()
      setNotifications(json.notifications || [])
      setUnreadCount(json.unreadCount || 0)
    } catch {
      // Best-effort; ignore transient failures.
    }
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrg?.id])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}/read`, { method: 'POST', headers: authHeaders(token) })
    load()
  }

  async function markAllRead() {
    if (!currentOrg) return
    await fetch('/api/notifications/mark-all-read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
      body: JSON.stringify({ organizationId: currentOrg.id }),
    })
    load()
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-md p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-midnight-800"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center h-4 min-w-[1rem] px-1 rounded-full bg-gold-600 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-80 bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-md shadow-lg">
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-midnight-800">
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">Notifications</span>
            {unreadCount > 0 && (
              <button type="button" onClick={markAllRead} className="text-xs text-teal-700 dark:text-teal-400 hover:underline">
                Mark all read
              </button>
            )}
          </div>
          <ul className="max-h-96 overflow-auto">
            {notifications.length === 0 && (
              <li className="px-3 py-4 text-sm text-gray-500 text-center">No notifications yet</li>
            )}
            {notifications.map((n) => (
              <li key={n.id} className={n.read ? '' : 'bg-teal-50/60 dark:bg-midnight-800/60'}>
                <button
                  type="button"
                  onClick={() => !n.read && markRead(n.id)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-midnight-800"
                >
                  <div className="font-medium text-gray-800 dark:text-gray-100">{n.title}</div>
                  <div className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">{n.message}</div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
