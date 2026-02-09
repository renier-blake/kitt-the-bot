import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { Sidebar } from '@/components/layout/Sidebar'
import { PageShell } from '@/components/layout/PageShell'
import { Dashboard } from '@/pages/system/Dashboard'
import { Health } from '@/pages/system/Health'
import { Database } from '@/pages/system/Database'
import { Tasks } from '@/pages/system/Tasks'
import { Projects } from '@/pages/system/Projects'
import { Triage } from '@/pages/system/Triage'
import { Logs } from '@/pages/system/Logs'

// Standard layout with padding
function StandardLayout() {
  return (
    <PageShell>
      <Outlet />
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
        <Route element={<FullHeightLayout />}>
          <Route path="/logs" element={<Logs />} />
        </Route>
        <Route element={<StandardLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/health" element={<Health />} />
          <Route path="/database" element={<Database />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/triage" element={<Triage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
