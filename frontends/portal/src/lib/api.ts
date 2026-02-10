const API_BASE = '/api'

export interface KITTStatus {
  sleep: {
    isSleeping: boolean
    sleepUntil: number | null
    display: string
  }
  thinkLoop: {
    lastRun: number | null
    lastRunDisplay: string | null
  }
}

export interface HealthStatus {
  bridge: {
    status: 'connected' | 'disconnected'
    uptime: number
    startedAt: string
  }
  thinkLoop: {
    status: 'running' | 'slow' | 'stalled'
    lastTick: string | null
    tickDuration: number | null
  }
  apis: Array<{
    name: string
    status: 'healthy' | 'degraded' | 'down'
    latency: number
  }>
  errors: {
    count: number
    perMinute: number
    recent: Array<{
      time: string
      component: string
      level: 'error' | 'warn' | 'info'
      message: string
    }>
  }
}

export interface Task {
  id: number
  title: string
  description: string | null
  frequency: 'once' | 'daily' | 'weekly' | 'monthly'
  priority: 'high' | 'medium' | 'low'
  timeWindowStart: string | null
  timeWindowEnd: string | null
  skillRefs: string[]
  active: boolean
  snoozedUntil: number | null
  gracePeriodMinutes: number
  createdBy: string
  createdAt: number
}

export interface TaskExecution {
  id: string
  taskId: number | null
  taskTitle: string
  status: 'reminder' | 'completed' | 'skipped' | 'deferred' | 'unknown'
  notes: string | null
  executedAt: number
}

export interface TaskStats {
  total: number
  active: number
  executionsToday: number
  statusBreakdown: Record<string, number>
}

export interface DBStats {
  path: string
  transcripts: number
  transcripts_today: number
  chunks: number
  kitt_tasks: number
  foods: number
  food_log: number
  food_log_today: number
}

export interface TableData {
  rows: Record<string, unknown>[]
  total: number
  page: number
  limit: number
}

export interface DBTable {
  name: string
  label: string
  count: number
}

export interface TablesList {
  tables: DBTable[]
}

// Integration types
export interface Integration {
  id: string
  name: string
  description: string
  icon: string
  category: string
  auth_type: 'oauth' | 'api_key' | 'token' | 'credentials'
  provider: 'nango' | 'custom'
  auth_config: Record<string, unknown>
  connected: boolean
  connection: { id: string; createdAt: string } | null
}

export interface MigrationResult {
  success: boolean
  migrated: string[]
  skipped: string[]
  failed: Array<{ key: string; error: string }>
}

export const api = {
  // Status
  async getStatus(): Promise<KITTStatus> {
    const res = await fetch(`${API_BASE}/status`)
    if (!res.ok) throw new Error('Failed to fetch status')
    return res.json()
  },

  // Health
  async getHealth(): Promise<HealthStatus> {
    const res = await fetch(`${API_BASE}/health`)
    if (!res.ok) throw new Error('Failed to fetch health')
    return res.json()
  },

  // Database
  async getDBStats(): Promise<DBStats> {
    const res = await fetch(`${API_BASE}/db/stats`)
    if (!res.ok) throw new Error('Failed to fetch DB stats')
    return res.json()
  },

  async getTables(): Promise<TablesList> {
    const res = await fetch(`${API_BASE}/db/tables`)
    if (!res.ok) throw new Error('Failed to fetch tables')
    return res.json()
  },

  async getTableData(table: string, page = 1, limit = 50, search = '', period = 'all'): Promise<TableData> {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) })
    if (search) params.append('search', search)
    if (period && period !== 'all') params.append('period', period)
    
    const res = await fetch(`${API_BASE}/db/table/${table}?${params}`)
    if (!res.ok) throw new Error('Failed to fetch table data')
    return res.json()
  },

  async query(sql: string): Promise<{ rows: Record<string, unknown>[] }> {
    const res = await fetch(`${API_BASE}/db/query?sql=${encodeURIComponent(sql)}`)
    if (!res.ok) throw new Error('Failed to execute query')
    return res.json()
  },

  // Tasks
  async getTasks(): Promise<{ tasks: Task[] }> {
    const res = await fetch(`${API_BASE}/tasks`)
    if (!res.ok) throw new Error('Failed to fetch tasks')
    return res.json()
  },

  async updateTask(taskId: number, updates: { active?: boolean; snoozedUntil?: number | null }): Promise<void> {
    const res = await fetch(`${API_BASE}/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    if (!res.ok) throw new Error('Failed to update task')
  },

  async getTaskExecutions(period = 'today'): Promise<{ executions: TaskExecution[] }> {
    const res = await fetch(`${API_BASE}/task-executions?period=${period}`)
    if (!res.ok) throw new Error('Failed to fetch task executions')
    return res.json()
  },

  async getTaskStats(): Promise<TaskStats> {
    const res = await fetch(`${API_BASE}/tasks/stats`)
    if (!res.ok) throw new Error('Failed to fetch task stats')
    return res.json()
  },

  // Integrations
  async getIntegrations(): Promise<{ integrations: Integration[] }> {
    const res = await fetch(`${API_BASE}/integrations`)
    if (!res.ok) throw new Error('Failed to fetch integrations')
    return res.json()
  },

  async createConnectSession(integrationId: string): Promise<{ token: string; expiresAt: string }> {
    const res = await fetch(`${API_BASE}/integrations/${integrationId}/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    if (!res.ok) throw new Error('Failed to create connect session')
    return res.json()
  },

  async setIntegrationAuth(integrationId: string, data: Record<string, string>): Promise<void> {
    const res = await fetch(`${API_BASE}/integrations/${integrationId}/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error('Failed to set auth')
  },

  async removeIntegrationAuth(integrationId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/integrations/${integrationId}/auth`, {
      method: 'DELETE',
    })
    if (!res.ok) throw new Error('Failed to remove auth')
  },

  async testIntegration(integrationId: string): Promise<{ success: boolean; preview?: string; error?: string }> {
    const res = await fetch(`${API_BASE}/integrations/${integrationId}/test`, {
      method: 'POST',
    })
    if (!res.ok) throw new Error('Failed to test integration')
    return res.json()
  },

  async migrateIntegrations(): Promise<MigrationResult> {
    const res = await fetch(`${API_BASE}/integrations/migrate`, {
      method: 'POST',
    })
    if (!res.ok) throw new Error('Migration failed')
    return res.json()
  },

  // Multi-account connections (Nango OAuth)
  async getConnections(integrationId: string): Promise<{ connections: Array<{
    id: number
    integrationId: string
    connectionId: string
    label: string
    accountEmail: string | null
    isDefault: boolean
    createdAt: number
  }> }> {
    const res = await fetch(`${API_BASE}/integrations/${integrationId}/connections`)
    if (!res.ok) throw new Error('Failed to fetch connections')
    return res.json()
  },

  async registerConnection(
    integrationId: string,
    connectionId: string,
    label: string,
    accountEmail?: string,
    isDefault?: boolean
  ): Promise<void> {
    const res = await fetch(`${API_BASE}/integrations/${integrationId}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ connectionId, label, accountEmail, isDefault }),
    })
    if (!res.ok) throw new Error('Failed to register connection')
  },

  async setDefaultConnection(integrationId: string, connectionId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/integrations/${integrationId}/connections/${connectionId}/default`, {
      method: 'POST',
    })
    if (!res.ok) throw new Error('Failed to set default connection')
  },

  // Config
  async getConfig(): Promise<{ config: {
    userId: string
    userEmail: string
    userName: string
    timezone: string
  } }> {
    const res = await fetch(`${API_BASE}/config`)
    if (!res.ok) throw new Error('Failed to fetch config')
    return res.json()
  },

  async updateConfig(key: string, value: string, description?: string): Promise<void> {
    const res = await fetch(`${API_BASE}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value, description }),
    })
    if (!res.ok) throw new Error('Failed to update config')
  },

  // WhatsApp Channel
  async getWhatsAppStatus(): Promise<WhatsAppStatus> {
    const res = await fetch(`${API_BASE}/channels/whatsapp/status`)
    if (!res.ok) throw new Error('Failed to fetch WhatsApp status')
    return res.json()
  },

  async disconnectWhatsApp(): Promise<void> {
    const res = await fetch(`${API_BASE}/channels/whatsapp/disconnect`, {
      method: 'POST',
    })
    if (!res.ok) throw new Error('Failed to disconnect WhatsApp')
  },

}

// WhatsApp status type
export interface WhatsAppStatus {
  enabled: boolean
  connected: boolean
  status: 'disabled' | 'disconnected' | 'awaiting_scan' | 'connected'
  user: {
    id: string
    name: string
  } | null
  qrCode: string | null
  qrCodeGeneratedAt: string | null
  lastError: string | null
}

// WebSocket connection for live logs
export function connectWebSocket(onMessage: (data: unknown) => void): WebSocket {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = window.location.host.includes(':3000') ? 'localhost:8000' : window.location.host
  const ws = new WebSocket(`${protocol}//${host}/ws`)
  
  ws.onopen = () => {
    console.log('[portal] WebSocket connected')
  }
  
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      onMessage(data)
    } catch {
      onMessage(event.data)
    }
  }
  
  ws.onerror = (error) => {
    console.error('[portal] WebSocket error:', error)
  }
  
  ws.onclose = () => {
    console.log('[portal] WebSocket disconnected')
  }
  
  return ws
}
