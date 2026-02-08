import { useEffect, useRef, useState } from 'react'
import { Header } from '@/components/layout/Header'
import { Card, CardContent } from '@/components/ui/card'
import { connectWebSocket } from '@/lib/api'
import { Terminal, Pause, Play, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface LogEntry {
  ts: number
  level: 'debug' | 'info' | 'warn' | 'error'
  content: string
  source?: string
}

export function Logs() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [autoScroll, setAutoScroll] = useState(true)
  const [connected, setConnected] = useState(false)
  const logsEndRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const ws = connectWebSocket((data) => {
      if (typeof data === 'object' && data !== null) {
        setLogs((prev) => [...prev.slice(-500), data as LogEntry])
      }
    })

    ws.onopen = () => setConnected(true)
    ws.onclose = () => setConnected(false)

    return () => {
      ws.close()
    }
  }, [])

  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs, autoScroll])

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error':
        return 'text-red-400'
      case 'warn':
        return 'text-yellow-400'
      case 'info':
        return 'text-blue-400'
      default:
        return 'text-muted-foreground'
    }
  }

  const getSourceColor = (source?: string) => {
    switch (source) {
      case 'think-loop':
        return 'text-cyan-400'
      case 'agent':
        return 'text-purple-400'
      case 'scheduler':
        return 'text-orange-400'
      case 'telegram':
        return 'text-green-400'
      default:
        return 'text-muted-foreground'
    }
  }

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  return (
    <div className="space-y-4">
      <Header title="Live Logs" description="Real-time system logs from KITT">
        <div className="flex items-center gap-2">
          <div
            className={`h-2 w-2 rounded-full ${
              connected ? 'bg-green-500' : 'bg-red-500'
            }`}
          />
          <span className="text-sm text-muted-foreground">
            {connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </Header>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setAutoScroll(!autoScroll)}
        >
          {autoScroll ? (
            <Pause className="mr-2 h-4 w-4" />
          ) : (
            <Play className="mr-2 h-4 w-4" />
          )}
          {autoScroll ? 'Pause' : 'Resume'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setLogs([])}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Clear
        </Button>
        <span className="ml-4 text-sm text-muted-foreground">
          {logs.length} messages
        </span>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div
            ref={containerRef}
            className="h-[600px] overflow-y-auto bg-black/50 p-4 font-mono text-sm"
            onScroll={() => {
              if (containerRef.current) {
                const { scrollTop, scrollHeight, clientHeight } = containerRef.current
                const isNearBottom = scrollHeight - scrollTop - clientHeight < 50
                setAutoScroll(isNearBottom)
              }
            }}
          >
            {logs.length === 0 ? (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <Terminal className="mr-2 h-5 w-5" />
                Waiting for logs...
              </div>
            ) : (
              logs.map((log, i) => (
                <div key={i} className="mb-1 flex gap-3">
                  <span className="text-muted-foreground">{formatTime(log.ts)}</span>
                  {log.source && (
                    <span className={`w-20 shrink-0 ${getSourceColor(log.source)}`}>
                      [{log.source}]
                    </span>
                  )}
                  <span className={`w-12 shrink-0 ${getLevelColor(log.level)}`}>
                    {log.level}
                  </span>
                  <span className="break-all">{log.content}</span>
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
