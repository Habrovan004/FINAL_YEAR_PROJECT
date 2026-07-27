import { useEffect, useRef, useState } from 'react'
import { Bell } from 'lucide-react'
import api from '../../api/client'
import { useAuth } from '../../context/AuthContext'

interface NotificationRow {
  id: number
  verb: string
  message: string
  link: string
  is_read: boolean
  created_at: string
}

interface NotificationBellProps {
  /** 'floating' (default) is the fixed, top-right corner placement used
   * app-wide. 'inline' drops the fixed positioning so the same bell/badge/
   * dropdown can sit naturally inside a screen's own header row — used by
   * the chat headers, which show their own bell instead of the global one. */
  variant?: 'floating' | 'inline'
}

export default function NotificationBell({ variant = 'floating' }: NotificationBellProps) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationRow[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const pollRef = useRef<number | null>(null)

  const loadUnreadCount = async () => {
    try {
      const r = await api.get<NotificationRow[]>('/notifications/?unread=1')
      setUnreadCount(r.data.length)
    } catch { /* ignore */ }
  }

  useEffect(() => {
    if (!user) return
    void loadUnreadCount()
    pollRef.current = window.setInterval(() => void loadUnreadCount(), 4000)
    return () => { if (pollRef.current) window.clearInterval(pollRef.current) }
  }, [user])

  const openPanel = async () => {
    setOpen(prev => !prev)
    if (open) return
    try {
      const r = await api.get<NotificationRow[]>('/notifications/')
      setNotifications(r.data)
      await api.post('/notifications/mark-all-read/')
      setUnreadCount(0)
    } catch { /* ignore */ }
  }

  if (!user) return null

  return (
    <div className={variant === 'inline' ? 'notif-bell-wrap notif-bell-wrap--inline' : 'notif-bell-wrap'}>
      <button
        type="button"
        className="notif-bell-btn"
        onClick={() => void openPanel()}
        aria-label="Notifications"
      >
        <Bell size={16} />
        {unreadCount > 0 && <span className="notif-bell-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>

      {open && (
        <div className="notif-bell-panel" role="dialog" aria-label="Notifications">
          {notifications.length === 0 ? (
            <p className="notif-bell-empty">No notifications yet.</p>
          ) : (
            notifications.map(n => (
              <div key={n.id} className="notif-bell-row">
                <p className="notif-bell-message">{n.message}</p>
                <p className="notif-bell-time">{new Date(n.created_at).toLocaleString()}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
