import { useEffect, useState, useCallback } from 'react'
import { Header } from '@/components/layout/Header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { api, type Task, type TaskExecution, type TaskStats } from '@/lib/api'
import { ListTodo, CheckCircle2, XCircle, Clock, Bell, BellOff, Play, Pause, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

const PERIOD_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Last 7 Days' },
  { value: 'month', label: 'Last 30 Days' },
]

// Color mappings
const priorityColors: Record<string, string> = {
  high: 'bg-red-500/20 text-red-400 border-red-500/30',
  medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  low: 'bg-green-500/20 text-green-400 border-green-500/30',
}

const statusColors: Record<string, string> = {
  reminder: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  completed: 'bg-green-500/20 text-green-400 border-green-500/30',
  skipped: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  deferred: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  unknown: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
}

const frequencyIcons: Record<string, string> = {
  daily: '📅',
  weekly: '📆',
  monthly: '🗓️',
  once: '⏱️',
}

function Badge({ value, type }: { value: string; type: 'priority' | 'status' }) {
  const colors = type === 'priority' ? priorityColors : statusColors
  const colorClass = colors[value?.toLowerCase()] || colors.unknown
  
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border', colorClass)}>
      {value}
    </span>
  )
}

export function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [executions, setExecutions] = useState<TaskExecution[]>([])
  const [stats, setStats] = useState<TaskStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [executionPeriod, setExecutionPeriod] = useState('today')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [tasksData, executionsData, statsData] = await Promise.all([
        api.getTasks(),
        api.getTaskExecutions(executionPeriod),
        api.getTaskStats(),
      ])
      setTasks(tasksData.tasks)
      setExecutions(executionsData.executions)
      setStats(statsData)
    } catch (err) {
      console.error('Failed to fetch task data:', err)
    } finally {
      setLoading(false)
    }
  }, [executionPeriod])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000) // Refresh every 30s
    return () => clearInterval(interval)
  }, [fetchData])

  const toggleTaskActive = async (task: Task) => {
    try {
      await api.updateTask(task.id, { active: !task.active })
      fetchData()
    } catch (err) {
      console.error('Failed to toggle task:', err)
    }
  }

  const snoozeTask = async (task: Task, minutes: number) => {
    try {
      const snoozedUntil = Date.now() + minutes * 60 * 1000
      await api.updateTask(task.id, { snoozedUntil })
      fetchData()
    } catch (err) {
      console.error('Failed to snooze task:', err)
    }
  }

  const unsnoozeTask = async (task: Task) => {
    try {
      await api.updateTask(task.id, { snoozedUntil: null })
      fetchData()
    } catch (err) {
      console.error('Failed to unsnooze task:', err)
    }
  }

  const formatTimeWindow = (task: Task) => {
    if (task.timeWindowStart && task.timeWindowEnd) {
      return `${task.timeWindowStart} - ${task.timeWindowEnd}`
    }
    if (task.timeWindowStart) {
      return `From ${task.timeWindowStart}`
    }
    if (task.timeWindowEnd) {
      return `Until ${task.timeWindowEnd}`
    }
    return 'Any time'
  }

  const formatTimestamp = (ts: number) => {
    return new Date(ts).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="space-y-6">
      <Header
        title="Task Engine"
        description="Monitor and manage KITT's scheduled tasks"
      />

      {loading && (
        <div className="text-sm text-muted-foreground">Loading...</div>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
            <ListTodo className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total || '—'}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.active || 0} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Executed Today</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.executionsToday || '—'}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.statusBreakdown?.completed || 0} completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Skipped Today</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.statusBreakdown?.skipped || '—'}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.statusBreakdown?.deferred || 0} deferred
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reminders</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.statusBreakdown?.reminder || '—'}</div>
            <p className="text-xs text-muted-foreground">Sent today</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="tasks" className="space-y-4">
        <TabsList>
          <TabsTrigger value="tasks">
            <ListTodo className="mr-2 h-4 w-4" />
            Tasks
          </TabsTrigger>
          <TabsTrigger value="executions">
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Executions
          </TabsTrigger>
          <TabsTrigger value="schedule">
            <Calendar className="mr-2 h-4 w-4" />
            Schedule
          </TabsTrigger>
        </TabsList>

        {/* Tasks Tab */}
        <TabsContent value="tasks">
          <Card>
            <CardHeader>
              <CardTitle>Configured Tasks</CardTitle>
              <CardDescription>Manage KITT's scheduled tasks</CardDescription>
            </CardHeader>
            <CardContent>
              {tasks.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  No tasks configured
                </div>
              ) : (
                <div className="space-y-4">
                  {tasks.map((task) => (
                    <div
                      key={task.id}
                      className={cn(
                        'flex items-center justify-between p-4 rounded-lg border',
                        task.active ? 'bg-card' : 'bg-muted/50 opacity-60'
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{frequencyIcons[task.frequency] || '⏱️'}</span>
                          <span className="font-medium">{task.title}</span>
                          {task.snoozedUntil && task.snoozedUntil > Date.now() && (
                            <Badge value="snoozed" type="status" />
                          )}
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {task.description || 'No description'}
                        </div>
                        <div className="mt-2 flex items-center gap-2 text-xs">
                          <Badge value={task.priority} type="priority" />
                          <span className="text-muted-foreground">{formatTimeWindow(task)}</span>
                          {task.skillRefs.length > 0 && (
                            <span className="text-muted-foreground">
                              → {task.skillRefs.join(', ')}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 ml-4">
                        {task.snoozedUntil && task.snoozedUntil > Date.now() ? (
                          <>
                            <span className="text-xs text-muted-foreground">
                              Until {formatTimestamp(task.snoozedUntil)}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => unsnoozeTask(task)}
                            >
                              <Bell className="mr-2 h-4 w-4" />
                              Unsnooze
                            </Button>
                          </>
                        ) : (
                          <>
                            <Select onValueChange={(v) => snoozeTask(task, parseInt(v))}>
                              <SelectTrigger className="w-[130px]">
                                <BellOff className="mr-2 h-4 w-4" />
                                <span>Snooze</span>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="30">30 min</SelectItem>
                                <SelectItem value="60">1 hour</SelectItem>
                                <SelectItem value="240">4 hours</SelectItem>
                                <SelectItem value="1440">1 day</SelectItem>
                              </SelectContent>
                            </Select>
                          </>
                        )}
                        
                        <Button
                          variant={task.active ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => toggleTaskActive(task)}
                        >
                          {task.active ? (
                            <><Pause className="mr-2 h-4 w-4" /> Pause</>
                          ) : (
                            <><Play className="mr-2 h-4 w-4" /> Resume</>
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Executions Tab */}
        <TabsContent value="executions">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Task Executions</CardTitle>
                <CardDescription>History of task runs</CardDescription>
              </div>
              <Select value={executionPeriod} onValueChange={setExecutionPeriod}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIOD_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              {executions.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  No executions found for this period
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background">
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>Task</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {executions.map((exec) => (
                        <TableRow key={exec.id}>
                          <TableCell className="whitespace-nowrap text-muted-foreground text-sm">
                            {formatTimestamp(exec.executedAt)}
                          </TableCell>
                          <TableCell className="font-medium">{exec.taskTitle}</TableCell>
                          <TableCell>
                            <Badge value={exec.status} type="status" />
                          </TableCell>
                          <TableCell className="max-w-[300px] truncate text-muted-foreground text-sm">
                            {exec.notes || '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Schedule Tab */}
        <TabsContent value="schedule">
          <Card>
            <CardHeader>
              <CardTitle>Weekly Schedule</CardTitle>
              <CardDescription>Overview of task times</CardDescription>
            </CardHeader>
            <CardContent>
              {tasks.filter(t => t.active).length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  No active tasks scheduled
                </div>
              ) : (
                <div className="space-y-4">
                  {tasks
                    .filter((t) => t.active)
                    .sort((a, b) => (a.timeWindowStart || '').localeCompare(b.timeWindowStart || ''))
                    .map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center gap-4 p-3 rounded-lg border"
                      >
                        <div className="w-20 font-mono text-sm text-muted-foreground">
                          {task.timeWindowStart || '—'}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium">{task.title}</div>
                          <div className="text-sm text-muted-foreground">
                            {task.frequency} • {formatTimeWindow(task)}
                          </div>
                        </div>
                        <Badge value={task.priority} type="priority" />
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
