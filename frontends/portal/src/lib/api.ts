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
