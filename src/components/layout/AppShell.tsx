import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getNotifications, getUnreadNotificationCount, markNotificationRead, type UserNotification } from '../../api/notifications'
import { useAuth } from '../../context/AuthContext'

function displayName(name: string) {
  return name
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function relativeTime(value: string) {
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000))
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 60 * 60 * 24 * 365], ['month', 60 * 60 * 24 * 30], ['week', 60 * 60 * 24 * 7],
    ['day', 60 * 60 * 24], ['hour', 60 * 60], ['minute', 60], ['second', 1],
  ]
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
  const [unit, seconds] = units.find(([, size]) => elapsedSeconds >= size) ?? ['second', 1]
  return formatter.format(-Math.floor(elapsedSeconds / seconds), unit)
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState<UserNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [notificationError, setNotificationError] = useState('')
  const [isDarkTheme, setIsDarkTheme] = useState(() => window.localStorage.getItem('medscan-theme') === 'dark')

  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = isDarkTheme ? 'dark' : 'light'
    root.classList.toggle('dark', isDarkTheme)
    window.localStorage.setItem('medscan-theme', isDarkTheme ? 'dark' : 'light')
  }, [isDarkTheme])

  useEffect(() => {
    if (!user) {
      setNotifications([])
      setUnreadCount(0)
      return
    }
    let active = true
    const refreshNotifications = async () => {
      try {
        const [items, count] = await Promise.all([getNotifications(), getUnreadNotificationCount()])
        if (!active) return
        setNotifications(items)
        setUnreadCount(count)
        setNotificationError('')
      } catch {
        // Notification polling is secondary UI; keep the rest of the page usable.
        if (active) setNotificationError('Notifications are temporarily unavailable.')
      }
    }
    void refreshNotifications()
    const timer = window.setInterval(() => void refreshNotifications(), 30_000)
    return () => { active = false; window.clearInterval(timer) }
  }, [user?.id])

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  async function handleNotificationClick(notification: UserNotification) {
    try {
      await markNotificationRead(notification.id)
      setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, is_read: true } : item))
      if (!notification.is_read) setUnreadCount((count) => Math.max(0, count - 1))
      setIsPanelOpen(false)
      if (user?.role === 'doctor') navigate('/doctor')
      else if (user?.role === 'patient' && notification.scan_id) navigate(`/patient/scans/${notification.scan_id}/result`)
    } catch {
      setNotificationError('Could not mark this notification as read. Please try again.')
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Vital Scan AI home">
          <span className="brand-mark" aria-hidden="true">VS</span>
          <span>Vital Scan AI</span>
        </a>
        <div className="account-area">
          <div className="notification-control">
            <button
              className="notification-bell"
              type="button"
              aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
              aria-expanded={isPanelOpen}
              aria-controls="notification-panel"
              onClick={() => setIsPanelOpen((open) => !open)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
              {unreadCount > 0 ? <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span> : null}
            </button>
            {isPanelOpen ? <section className="notification-panel" id="notification-panel" aria-label="Notifications">
              <div className="notification-panel-heading"><h2>Notifications</h2><span>{unreadCount} unread</span></div>
              {notificationError ? <p className="notification-error" role="status">{notificationError}</p> : null}
              {notifications.length === 0 ? <p className="notification-empty">You’re all caught up.</p> : <ul className="notification-list">
                {notifications.map((notification) => <li key={notification.id}>
                  <button className={`notification-item ${notification.is_read ? 'read' : 'unread'}`} type="button" onClick={() => void handleNotificationClick(notification)}>
                    <span className="notification-message">{notification.message}</span>
                    <time dateTime={notification.created_at}>{relativeTime(notification.created_at)}</time>
                  </button>
                </li>)}
              </ul>}
            </section> : null}
          </div>
          <button
            className="theme-toggle"
            type="button"
            aria-label={`Switch to ${isDarkTheme ? 'light' : 'dark'} mode`}
            title={`Switch to ${isDarkTheme ? 'light' : 'dark'} mode`}
            onClick={() => setIsDarkTheme((current) => !current)}
          >
            {isDarkTheme ? (
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.9 13A8.5 8.5 0 0 1 11 3.1 8.5 8.5 0 1 0 20.9 13Z" /></svg>
            )}
          </button>
          {user?.role === 'doctor' ? <Link className="button button-quiet edit-profile-button" to="/doctor/profile">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5" /><path d="M5 20c.7-3.5 3.1-5.3 7-5.3s6.3 1.8 7 5.3" /></svg>
            <span>Edit profile</span>
          </Link> : null}
          <span className="account-name">{user ? displayName(user.full_name) : ''}</span>
          <button className="button button-quiet" onClick={handleLogout}>Log out</button>
        </div>
      </header>
      <main className="page-content">{children}</main>
    </div>
  )
}

export { displayName }
