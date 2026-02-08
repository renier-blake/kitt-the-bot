import { NavLink } from 'react-router-dom'
import { Activity, Database, ListTodo, LayoutDashboard, Terminal } from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavItem {
  to: string
  icon: React.ReactNode
  label: string
}

const navItems: NavItem[] = [
  { to: '/', icon: <LayoutDashboard className="h-5 w-5" />, label: 'Dashboard' },
  { to: '/health', icon: <Activity className="h-5 w-5" />, label: 'System Health' },
  { to: '/database', icon: <Database className="h-5 w-5" />, label: 'Database' },
  { to: '/tasks', icon: <ListTodo className="h-5 w-5" />, label: 'Task Engine' },
  { to: '/logs', icon: <Terminal className="h-5 w-5" />, label: 'Live Logs' },
]

export function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-border bg-card">
      <div className="flex h-16 items-center border-b border-border px-6">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-primary text-primary-foreground font-bold">
            🚗
          </div>
          <span className="text-lg font-semibold">KITT Portal</span>
        </div>
      </div>

      <nav className="space-y-1 p-4">
        <div className="mb-4 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          System
        </div>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )
            }
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="absolute bottom-0 left-0 right-0 border-t border-border p-4">
        <div className="flex items-center gap-3 rounded-md bg-muted/50 px-3 py-2">
          <div className="h-2 w-2 rounded-full bg-green-500" />
          <span className="text-sm text-muted-foreground">Bridge Online</span>
        </div>
      </div>
    </aside>
  )
}
