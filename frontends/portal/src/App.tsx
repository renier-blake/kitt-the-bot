import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Sidebar } from '@/components/layout/Sidebar'
import { PageShell } from '@/components/layout/PageShell'
import { Dashboard } from '@/pages/system/Dashboard'
import { Health } from '@/pages/system/Health'
import { Database } from '@/pages/system/Database'
import { Tasks } from '@/pages/system/Tasks'
import { Logs } from '@/pages/system/Logs'

function App() {
  return (
    <BrowserRouter>
      <Sidebar />
      <PageShell>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/health" element={<Health />} />
          <Route path="/database" element={<Database />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/logs" element={<Logs />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </PageShell>
    </BrowserRouter>
  )
}

export default App
