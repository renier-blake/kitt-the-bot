import { Header } from '@/components/layout/Header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Activity, Database, ListTodo, Terminal } from 'lucide-react'

export function Dashboard() {
  return (
    <div className="space-y-8">
      <Header
        title="Dashboard"
        description="Welcome to the KITT Portal. Monitor your AI assistant."
      />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Health</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Online</div>
            <p className="text-xs text-muted-foreground">Bridge running</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Database</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">View</div>
            <p className="text-xs text-muted-foreground">Browse tables</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasks</CardTitle>
            <ListTodo className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Monitor</div>
            <p className="text-xs text-muted-foreground">Task engine</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Logs</CardTitle>
            <Terminal className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Live</div>
            <p className="text-xs text-muted-foreground">Real-time logs</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quick Links</CardTitle>
            <CardDescription>Common actions and destinations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              • View System Health — Check bridge and Think Loop status
            </p>
            <p className="text-sm text-muted-foreground">
              • Browse Database — Query transcripts and task logs
            </p>
            <p className="text-sm text-muted-foreground">
              • Monitor Tasks — View task executions and schedule
            </p>
            <p className="text-sm text-muted-foreground">
              • Live Logs — Watch real-time system logs
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
