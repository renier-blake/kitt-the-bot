import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { Activity, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'

interface HealthCardProps {
  title: string
  status: 'healthy' | 'degraded' | 'down' | 'running' | 'slow' | 'stalled'
  value: string
  description?: string
  icon?: React.ReactNode
  className?: string
}

const statusConfig = {
  healthy: { color: 'text-green-500', bg: 'bg-green-500', icon: CheckCircle },
  running: { color: 'text-green-500', bg: 'bg-green-500', icon: CheckCircle },
  degraded: { color: 'text-yellow-500', bg: 'bg-yellow-500', icon: AlertTriangle },
  slow: { color: 'text-yellow-500', bg: 'bg-yellow-500', icon: AlertTriangle },
  down: { color: 'text-red-500', bg: 'bg-red-500', icon: XCircle },
  stalled: { color: 'text-red-500', bg: 'bg-red-500', icon: XCircle },
}

export function HealthCard({
  title,
  status,
  value,
  description,
  icon,
  className,
}: HealthCardProps) {
  const config = statusConfig[status]

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon || <Activity className="h-4 w-4 text-muted-foreground" />}
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <div className={cn('h-3 w-3 rounded-full', config.bg)} />
          <div className="text-2xl font-bold">{value}</div>
        </div>
        {description && (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  )
}
