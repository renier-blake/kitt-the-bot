import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

interface DetailPanelProps {
  data: Record<string, unknown> | null
  onClose: () => void
}

export function DetailPanel({ data, onClose }: DetailPanelProps) {
  if (!data) return null

  // Format timestamp to readable date
  const formatTimestamp = (value: unknown): string | null => {
    if (typeof value !== 'number' && typeof value !== 'string') return null
    
    const num = typeof value === 'string' ? parseInt(value, 10) : value
    if (isNaN(num) || num === 0) return null
    
    // Assume milliseconds if > 1e10, otherwise seconds
    const ms = num > 10000000000 ? num : num * 1000
    
    const date = new Date(ms)
    if (isNaN(date.getTime())) return null
    
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
  }

  // Check if key is a timestamp field
  const isTimestampField = (key: string): boolean => {
    return key === 'created_at' || key === 'updated_at' || key.endsWith('_at')
  }

  // Format value for display
  const formatValue = (value: unknown, key?: string): string => {
    if (value === null) return 'null'
    if (value === undefined) return 'undefined'
    
    // Format timestamps in detail view
    if (key && isTimestampField(key)) {
      const formatted = formatTimestamp(value)
      if (formatted) {
        const raw = String(value)
        return `${formatted}\n(${raw})`
      }
    }
    
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value, null, 2)
      } catch {
        return String(value)
      }
    }
    return String(value)
  }

  // Check if value is JSON/object
  const isComplexValue = (value: unknown): boolean => {
    if (typeof value === 'object' && value !== null) return true
    if (typeof value === 'string') {
      try {
        JSON.parse(value)
        return true
      } catch {
        return false
      }
    }
    return false
  }

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-96 border-l border-border bg-card shadow-xl animate-in slide-in-from-right duration-300">
      <Card className="h-full rounded-none border-0">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border pb-4">
          <div>
            <CardTitle>Record Details</CardTitle>
            <CardDescription>View all fields</CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="overflow-y-auto p-0">
          <div className="divide-y divide-border">
            {Object.entries(data).map(([key, value]) => (
              <div key={key} className="p-4">
                <div className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {key}
                </div>
                {isComplexValue(value) ? (
                  <pre className="mt-2 max-h-48 overflow-auto rounded-md bg-muted p-2 text-xs">
                    <code>{formatValue(value, key)}</code>
                  </pre>
                ) : (
                  <div className="break-all text-sm whitespace-pre-line">{formatValue(value, key)}</div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
