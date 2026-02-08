import { useEffect, useState } from 'react'
import { Header } from '@/components/layout/Header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { api, type HealthStatus } from '@/lib/api'
import { RefreshCw, Server, Zap, Moon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { HealthCard } from '@/components/widgets/HealthCard'
import { StatSparkline } from '@/components/widgets/StatSparkline'
import { formatRelativeTime } from '@/lib/utils'
import { cn } from '@/lib/utils'

export function Health() {
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
    const interval = setInterval(fetchHealth, 5000)
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
        title="System Health"
        description="Monitor KITT's operational status"
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

      {/* API Status */}
      <Card>
        <CardHeader>
          <CardTitle>API Endpoints</CardTitle>
          <CardDescription>External service health and latency</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {health?.apis.map((api) => (
              <div key={api.name} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'h-2 w-2 rounded-full',
                    api.status === 'healthy' ? 'bg-green-500' : 
                    api.status === 'degraded' ? 'bg-yellow-500' : 'bg-red-500'
                  )} />
                  <span className="font-medium capitalize">{api.name}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className={cn(
                    'text-sm',
                    api.status === 'healthy' ? 'text-green-500' : 
                    api.status === 'degraded' ? 'text-yellow-500' : 'text-red-500'
                  )}>
                    {api.status}
                  </span>
                  <span className="text-sm text-muted-foreground w-16 text-right">
                    {api.latency}ms
                  </span>
                </div>
              </div>
            ))}
            {!health && (
              <div className="text-muted-foreground text-sm">Loading API status...</div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recent Errors */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Errors</CardTitle>
          <CardDescription>Last 10 errors from the system</CardDescription>
        </CardHeader>
        <CardContent>
          {health?.errors.recent && health.errors.recent.length > 0 ? (
            <div className="space-y-2">
              {health.errors.recent.map((error, i) => (
                <div key={i} className="flex items-start gap-3 rounded-md bg-destructive/10 p-3 text-sm">
                  <div className="mt-0.5 h-2 w-2 rounded-full bg-destructive" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">
                        {new Date(error.time).toLocaleTimeString()}
                      </span>
                      <span className="text-xs uppercase text-muted-foreground">[{error.component}]</span>
                    </div>
                    <p className="mt-1 text-destructive">{error.message}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-md bg-muted/50 p-8 text-center">
              <p className="text-muted-foreground">No recent errors</p>
              <p className="text-sm text-muted-foreground mt-1">System is running smoothly</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* System Information */}
      <Card>
        <CardHeader>
          <CardTitle>System Information</CardTitle>
          <CardDescription>Detailed status information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Portal Version</p>
              <p className="text-sm">v0.1.0</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">KITT Version</p>
              <p className="text-sm">v0.1.0</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Think Loop Interval</p>
              <p className="text-sm">5 minutes</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Bridge Started</p>
              <p className="text-sm">{health?.bridge.startedAt ? new Date(health.bridge.startedAt).toLocaleString() : '—'}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
