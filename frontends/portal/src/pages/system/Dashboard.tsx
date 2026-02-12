import { useEffect, useState } from 'react'
import { Header } from '@/components/layout/Header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { api, type HealthStatus, type AgentsData, type ActiveAgent, type RecentAgent } from '@/lib/api'
import { Activity, Database, ListTodo, Terminal, RefreshCw, Server, Zap, Moon, ArrowRight, Bot, Clock, AlertTriangle, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { HealthCard } from '@/components/widgets/HealthCard'
import { StatSparkline } from '@/components/widgets/StatSparkline'
import { formatRelativeTime } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { NavLink } from 'react-router-dom'

export function Dashboard() {
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [agents, setAgents] = useState<AgentsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [agentsLoading, setAgentsLoading] = useState(true)
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

  const fetchAgents = async () => {
    try {
      setAgentsLoading(true)
      const data = await api.getAgents()
      setAgents(data)
    } catch {
      // Silently fail — agents endpoint may not be available yet
    } finally {
      setAgentsLoading(false)
    }
  }

  useEffect(() => {
    fetchHealth()
    fetchAgents()
    const healthInterval = setInterval(fetchHealth, 30000)
    const agentsInterval = setInterval(fetchAgents, 5000) // Agents refresh faster
    return () => {
      clearInterval(healthInterval)
      clearInterval(agentsInterval)
    }
  }, [])

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  const statusIcon = (status: string) => {
    switch (status) {
      case 'starting': return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      case 'running': return <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
      case 'completed': return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'timeout': return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case 'error': return <XCircle className="h-4 w-4 text-red-500" />
      default: return <Clock className="h-4 w-4 text-muted-foreground" />
    }
  }

  const typeBadgeColor = (type: string) => {
    switch (type) {
      case 'chat': return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      case 'think': return 'bg-purple-500/20 text-purple-400 border-purple-500/30'
      case 'think-sub': return 'bg-violet-500/20 text-violet-400 border-violet-500/30'
      case 'background': return 'bg-orange-500/20 text-orange-400 border-orange-500/30'
      default: return ''
    }
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
          onClick={() => { fetchHealth(); fetchAgents() }}
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

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">
            <Activity className="mr-2 h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="agents">
            <Bot className="mr-2 h-4 w-4" />
            Agents
            {agents && agents.active.length > 0 && (
              <span className="ml-2 rounded-full bg-blue-500/20 px-2 py-0.5 text-xs text-blue-400">
                {agents.active.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ==================== Overview Tab ==================== */}
        <TabsContent value="overview" className="space-y-8">
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
        </TabsContent>

        {/* ==================== Agents Tab ==================== */}
        <TabsContent value="agents" className="space-y-6">
          {/* Stats Overview */}
          {agents?.stats && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">{agents.stats.totalToday}</div>
                  <p className="text-xs text-muted-foreground">Total Today</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-blue-400">{agents.stats.active}</div>
                  <p className="text-xs text-muted-foreground">Active Now</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-green-500">{agents.stats.completed}</div>
                  <p className="text-xs text-muted-foreground">Completed</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-yellow-500">{agents.stats.timeouts}</div>
                  <p className="text-xs text-muted-foreground">Timeouts</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-red-500">{agents.stats.errors}</div>
                  <p className="text-xs text-muted-foreground">Errors</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Active Agents */}
          <div>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Loader2 className={cn("h-5 w-5", agents && agents.active.length > 0 ? "animate-spin text-blue-400" : "text-muted-foreground")} />
              Active Agents
              {agents && agents.active.length > 0 && (
                <Badge variant="secondary" className="ml-2">{agents.active.length}</Badge>
              )}
            </h2>
            {agentsLoading && !agents ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Loading...
                </CardContent>
              </Card>
            ) : agents && agents.active.length > 0 ? (
              <div className="space-y-2">
                {agents.active.map((agent: ActiveAgent) => (
                  <Card key={agent.id}>
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {statusIcon(agent.status)}
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm">{agent.id}</span>
                              <Badge className={typeBadgeColor(agent.type)}>{agent.type}</Badge>
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                              {agent.chatId && <span>Chat: {agent.chatId}</span>}
                              {agent.capabilityId && <span>Capability: {agent.capabilityId}</span>}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono text-sm">{agent.duration}</div>
                          <div className="text-xs text-muted-foreground">{agent.status}</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No active agents
                </CardContent>
              </Card>
            )}
          </div>

          {/* Recent Agents */}
          <div>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Recent
            </h2>
            {agents && agents.recent.length > 0 ? (
              <Card>
                <CardContent className="p-0">
                  <div className="divide-y divide-border">
                    {agents.recent.map((agent: RecentAgent) => (
                      <div key={agent.id} className="flex items-center justify-between px-4 py-3">
                        <div className="flex items-center gap-3">
                          {statusIcon(agent.status)}
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm">{agent.id}</span>
                              <Badge className={typeBadgeColor(agent.type)}>{agent.type}</Badge>
                            </div>
                            <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                              {agent.capabilityId && <span>{agent.capabilityId}</span>}
                              {agent.resultLength !== undefined && <span>{agent.resultLength} chars</span>}
                              {agent.error && <span className="text-red-400 truncate max-w-[300px]">{agent.error}</span>}
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-mono text-sm">{agent.duration}</div>
                          {agent.completedAt && (
                            <div className="text-xs text-muted-foreground">
                              {formatRelativeTime(agent.completedAt)}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No recent agents
                </CardContent>
              </Card>
            )}
          </div>

          {/* Per-Type Breakdown */}
          {agents?.stats?.byType && (
            <div>
              <h2 className="text-lg font-semibold mb-4">By Type</h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {(Object.entries(agents.stats.byType) as [string, { total: number; active: number; timeouts: number; errors: number }][]).map(([type, data]) => (
                  <Card key={type}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Badge className={typeBadgeColor(type)}>{type}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Total:</span> {data.total}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Active:</span> {data.active}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Timeouts:</span> {data.timeouts}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Errors:</span> {data.errors}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
