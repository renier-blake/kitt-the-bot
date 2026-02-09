import { useEffect, useState } from 'react'
import { Header } from '@/components/layout/Header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { api, type HealthStatus } from '@/lib/api'
import { Activity, Database, ListTodo, Terminal, RefreshCw, Server, Zap, Moon, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { HealthCard } from '@/components/widgets/HealthCard'
import { StatSparkline } from '@/components/widgets/StatSparkline'
import { formatRelativeTime } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { NavLink } from 'react-router-dom'

export function Dashboard() {
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchHealth = async () => {
    try {
      setLoading(true)
      const data = await api.getHealth()
      setHealth(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch health')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHealth()
    const interval = setInterval(fetchHealth, 30000) // Refresh every 30s
    return () => clearInterval(interval)
  }, [])

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  return (
    <div className="space-y-8">
      <Header
        title="Dashboard"
        description="Welcome to the KITT Portal. Monitor your AI assistant."
      >
        <Button
          variant="outline"
          size="sm"
          onClick={fetchHealth}
          disabled={loading}
        >
          <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
          Refresh
        </Button>
      </Header>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          {error}
        </div>
      )}

      {/* System Health Section */}
      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Activity className="h-5 w-5" />
          System Health
        </h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <HealthCard
            title="Bridge Status"
            status={health?.bridge.status === 'connected' ? 'healthy' : 'down'}
            value={health?.bridge.status === 'connected' ? 'Connected' : 'Disconnected'}
            description={health?.bridge.startedAt ? `Running for ${formatDuration(health.bridge.uptime)}` : 'Loading...'}
            icon={<Server className="h-4 w-4 text-muted-foreground" />}
          />

          <HealthCard
            title="Think Loop"
            status={health?.thinkLoop.status || 'running'}
            value={health?.thinkLoop.status === 'running' ? 'Running' : health?.thinkLoop.status || 'Unknown'}
            description={health?.thinkLoop.lastTick 
              ? `Last tick ${formatRelativeTime(new Date(health.thinkLoop.lastTick).getTime())}` 
              : 'Loading...'}
            icon={<Zap className="h-4 w-4 text-muted-foreground" />}
          />

          <HealthCard
            title="Sleep Status"
            status="healthy"
            value={health?.thinkLoop.tickDuration && health.thinkLoop.tickDuration > 5 * 60 * 1000 ? 'Sleeping' : 'Awake'}
            description={health?.thinkLoop.tickDuration && health.thinkLoop.tickDuration > 5 * 60 * 1000 ? 'Think loop paused' : 'Processing normally'}
            icon={<Moon className="h-4 w-4 text-muted-foreground" />}
          />

          <StatSparkline
            title="Error Rate"
            value={health?.errors.perMinute || 0}
            unit="/min"
            trend={health?.errors.perMinute ? (health.errors.perMinute > 0.5 ? 'up' : 'neutral') : 'neutral'}
          />
        </div>
      </div>

      {/* Quick Navigation */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Quick Navigation</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <NavLink to="/projects">
            <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Projects</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">Manage</div>
                <p className="text-xs text-muted-foreground">Track issues & features</p>
                <div className="mt-2 flex items-center text-xs text-primary">
                  Go to Projects <ArrowRight className="ml-1 h-3 w-3" />
                </div>
              </CardContent>
            </Card>
          </NavLink>

          <NavLink to="/integrations">
            <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Integrations</CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">Connect</div>
                <p className="text-xs text-muted-foreground">Apps & services</p>
                <div className="mt-2 flex items-center text-xs text-primary">
                  Go to Integrations <ArrowRight className="ml-1 h-3 w-3" />
                </div>
              </CardContent>
            </Card>
          </NavLink>

          <NavLink to="/tasks">
            <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Tasks</CardTitle>
                <ListTodo className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">Monitor</div>
                <p className="text-xs text-muted-foreground">Task engine</p>
                <div className="mt-2 flex items-center text-xs text-primary">
                  Go to Tasks <ArrowRight className="ml-1 h-3 w-3" />
                </div>
              </CardContent>
            </Card>
          </NavLink>

          <NavLink to="/logs">
            <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Logs</CardTitle>
                <Terminal className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">Live</div>
                <p className="text-xs text-muted-foreground">Real-time logs</p>
                <div className="mt-2 flex items-center text-xs text-primary">
                  Go to Logs <ArrowRight className="ml-1 h-3 w-3" />
                </div>
              </CardContent>
            </Card>
          </NavLink>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks and workflows</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              • <NavLink to="/triage" className="text-primary hover:underline">Review Triage</NavLink> — Process incoming ideas and feature requests
            </p>
            <p className="text-sm text-muted-foreground">
              • <NavLink to="/integrations" className="text-primary hover:underline">Connect Apps</NavLink> — Link Gmail, Calendar, Slack, etc.
            </p>
            <p className="text-sm text-muted-foreground">
              • <NavLink to="/database" className="text-primary hover:underline">Browse Database</NavLink> — Query transcripts and logs
            </p>
            <p className="text-sm text-muted-foreground">
              • <NavLink to="/user/skills" className="text-primary hover:underline">Manage Skills</NavLink> — Install or update skills
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>About KITT</CardTitle>
            <CardDescription>Knowledge Interface for Transparent Tasks</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              KITT is your personal AI assistant that helps you track nutrition, monitor health,
              manage reminders, and automate tasks. Built with transparency and control in mind.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
