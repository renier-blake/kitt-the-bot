import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  Database,
  ListTodo,
  LayoutDashboard,
  Terminal,
  FolderKanban,
  Inbox,
  Plug,
  User,
  Settings,
  Wrench,
  Cpu,
  FileText,
  Shield,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface NavItem {
  to: string
  icon: React.ReactNode
  label: string
}

// System mode items (admin/technical)
const systemItems: NavItem[] = [
  { to: '/', icon: <LayoutDashboard className="h-5 w-5" />, label: 'Dashboard' },
  { to: '/projects', icon: <FolderKanban className="h-5 w-5" />, label: 'Projects' },
  { to: '/triage', icon: <Inbox className="h-5 w-5" />, label: 'Triage' },
  { to: '/integrations', icon: <Plug className="h-5 w-5" />, label: 'Integrations' },
  { to: '/database', icon: <Database className="h-5 w-5" />, label: 'Database' },
  { to: '/tasks', icon: <ListTodo className="h-5 w-5" />, label: 'Task Engine' },
  { to: '/skills', icon: <Wrench className="h-5 w-5" />, label: 'Skills' },
  { to: '/slack-permissions', icon: <Shield className="h-5 w-5" />, label: 'Slack Perms' },
  { to: '/logs', icon: <Terminal className="h-5 w-5" />, label: 'Live Logs' },
]

// User mode items (personal)
const userItems: NavItem[] = [
  { to: '/user/identity', icon: <User className="h-5 w-5" />, label: 'Identity' },
  { to: '/user/content', icon: <FileText className="h-5 w-5" />, label: 'Content' },
  { to: '/user/settings', icon: <Settings className="h-5 w-5" />, label: 'Settings' },
]

type PortalMode = 'system' | 'user'

export function Sidebar() {
  const [mode, setMode] = useState<PortalMode>('system')
  const location = useLocation()

  // Check if current path is in user mode
  const isUserPath = location.pathname.startsWith('/user')
  const currentMode = isUserPath ? 'user' : 'system'

  // Sync mode state with URL
  if (currentMode !== mode) {
    setMode(currentMode)
  }

  const navItems = mode === 'system' ? systemItems : userItems

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-border bg-card flex flex-col">
      {/* Header */}
      <div className="flex h-16 items-center border-b border-border px-6">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-primary text-primary-foreground font-bold">
            🚗
          </div>
          <span className="text-lg font-semibold">KITT Portal</span>
        </div>
      </div>

      {/* Mode Toggle */}
      <div className="p-4 pb-2">
        <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg">
          <Button
            variant={mode === 'system' ? 'secondary' : 'ghost'}
            size="sm"
            className="flex-1 justify-center gap-2"
            onClick={() => setMode('system')}
            asChild
          >
            <NavLink to="/">
              <Cpu className="h-4 w-4" />
              <span className="text-xs">System</span>
            </NavLink>
          </Button>
          <Button
            variant={mode === 'user' ? 'secondary' : 'ghost'}
            size="sm"
            className="flex-1 justify-center gap-2"
            onClick={() => setMode('user')}
            asChild
          >
            <NavLink to="/user/identity">
              <User className="h-4 w-4" />
              <span className="text-xs">User</span>
            </NavLink>
          </Button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4 pt-2 overflow-y-auto">
        <div className="mb-4 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {mode === 'system' ? 'System' : 'Personal'}
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

      {/* Footer */}
      <div className="border-t border-border p-4">
        <div className="flex items-center gap-3 rounded-md bg-muted/50 px-3 py-2">
          <div className="h-2 w-2 rounded-full bg-green-500" />
          <span className="text-sm text-muted-foreground">Bridge Online</span>
        </div>
      </div>
    </aside>
  )
}
