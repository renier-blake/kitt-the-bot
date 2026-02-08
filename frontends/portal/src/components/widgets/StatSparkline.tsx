import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface StatSparklineProps {
  title: string
  value: number
  unit?: string
  data?: number[]
  trend?: 'up' | 'down' | 'neutral'
  className?: string
}

export function StatSparkline({
  title,
  value,
  unit = '',
  data = [],
  trend = 'neutral',
  className,
}: StatSparklineProps) {
  // Generate simple sparkline path from data
  const generatePath = () => {
    if (data.length < 2) return ''
    
    const max = Math.max(...data, 1)
    const min = Math.min(...data, 0)
    const range = max - min || 1
    
    const width = 100
    const height = 30
    
    return data
      .map((val, i) => {
        const x = (i / (data.length - 1)) * width
        const y = height - ((val - min) / range) * height
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
      })
      .join(' ')
  }

  const trendColors = {
    up: 'text-green-500',
    down: 'text-red-500',
    neutral: 'text-muted-foreground',
  }

  // Generate fake sparkline data if none provided
  const sparklineData = data.length > 0 ? data : [0.1, 0.15, 0.12, 0.18, 0.14, 0.16, 0.13, 0.15, 0.12, 0.14]

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between">
          <div>
            <div className="text-2xl font-bold">
              {value.toFixed(1)}{unit}
            </div>
            <p className={cn('text-xs', trendColors[trend])}>
              {trend === 'up' && '↑ Increasing'}
              {trend === 'down' && '↓ Decreasing'}
              {trend === 'neutral' && '→ Stable'}
            </p>
          </div>
          <svg
            viewBox="0 0 100 30"
            className="h-8 w-24 text-primary"
            preserveAspectRatio="none"
          >
            <path
              d={generatePath() || sparklineData.map((val, i) => {
                const x = (i / (sparklineData.length - 1)) * 100
                const y = 30 - val * 30
                return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
              }).join(' ')}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            />
          </svg>
        </div>
      </CardContent>
    </Card>
  )
}
