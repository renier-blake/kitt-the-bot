import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { Sidebar } from '@/components/layout/Sidebar'
import { PageShell } from '@/components/layout/PageShell'
import { Dashboard } from '@/pages/system/Dashboard'
import { Database } from '@/pages/system/Database'
import { Tasks } from '@/pages/system/Tasks'
import { Projects } from '@/pages/system/Projects'
import { Triage } from '@/pages/system/Triage'
import { Logs } from '@/pages/system/Logs'
import { Integrations } from '@/pages/user/Integrations'
import { Identity } from '@/pages/user/Identity'
import { Skills } from '@/pages/user/Skills'
import { UserSettings } from '@/pages/user/Settings'
import { ContentCalendar } from '@/pages/user/ContentCalendar'
import { SlackPermissions } from '@/pages/system/SlackPermissions'


// Standard layout with padding and proper height
function StandardLayout() {
  return (
    <PageShell className="flex flex-col">
      <div className="flex-1 flex flex-col min-h-0">
        <Outlet />
      </div>
    </PageShell>
  )
}

// Full height layout for logs (no padding, fills screen)
function FullHeightLayout() {
  return (
    <PageShell fullHeight>
      <div className="h-full flex flex-col">
        <Outlet />
      </div>
    </PageShell>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Sidebar />
      <Routes>
        {/* Logs - full height */}
        <Route element={<FullHeightLayout />}>
          <Route path="/logs" element={<Logs />} />
        </Route>
        
        {/* System routes */}
        <Route element={<StandardLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/triage" element={<Triage />} />
          <Route path="/integrations" element={<Integrations />} />
          <Route path="/database" element={<Database />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/skills" element={<Skills />} />
          <Route path="/slack-permissions" element={<SlackPermissions />} />
          <Route path="/health" element={<Navigate to="/" replace />} />
        </Route>

        {/* User routes */}
        <Route element={<StandardLayout />}>
          <Route path="/user/identity" element={<Identity />} />
          <Route path="/user/content" element={<ContentCalendar />} />
          <Route path="/user/settings" element={<UserSettings />} />
        </Route>
        
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
