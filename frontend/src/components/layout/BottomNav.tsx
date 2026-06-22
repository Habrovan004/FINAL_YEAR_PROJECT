import { NavLink, useLocation } from 'react-router-dom'
import { Home, Activity, BookOpen, Calendar, User } from 'lucide-react'

const tabs = [
  { to: '/home', icon: Home, label: 'Home', activePaths: ['/home', '/baby-growth'] },
  { to: '/track', icon: Activity, label: 'Track', activePaths: ['/track'] },
  { to: '/appointments', icon: Calendar, label: 'Appointments', activePaths: ['/appointments'] },
  { to: '/learn', icon: BookOpen, label: 'Learn', activePaths: ['/learn'] },
  { to: '/profile', icon: User, label: 'Profile', activePaths: ['/profile'] },
]

export default function BottomNav() {
  const location = useLocation()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 border-t flex z-50"
      style={{maxWidth:'480px',margin:'0 auto',background:'var(--bg-card, #fff)',borderColor:'var(--border, #f3f4f6)'}}
    >
      {tabs.map(({ to, icon: Icon, label, activePaths }) => {
        const active = activePaths.some(path => location.pathname === path || location.pathname.startsWith(`${path}/`))

        return (
          <NavLink
            key={to}
            to={to}
            className={`flex-1 flex flex-col items-center py-3 gap-1 text-[10px] font-semibold transition-colors ${active ? 'text-rose-500' : 'text-gray-400'}`}
          >
            <div className={`p-1.5 rounded-full transition-all ${active ? 'bg-rose-50' : ''}`}>
              <Icon size={19} strokeWidth={active ? 2.5 : 1.5} />
            </div>
            {label}
          </NavLink>
        )
      })}
    </nav>
  )
}
