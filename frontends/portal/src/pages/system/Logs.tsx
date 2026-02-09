import { useEffect, useRef, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { connectWebSocket } from '@/lib/api'
import { Terminal, Pause, Play, Trash2, Filter, Radio } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface LogEntry {
  ts: number
  level: 'debug' | 'info' | 'warn' | 'error'
  content: string
  source?: string
}

const LOG_BUFFER_SIZE = 2000

export function Logs() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([])
  const [autoScroll, setAutoScroll] = useState(true)
  const [connected, setConnected] = useState(false)
  const [filter, setFilter] = useState('')
  const [showFilter, setShowFilter] = useState(false)
  const [newLogIndicator, setNewLogIndicator] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const isUserScrolling = useRef(false)

  // WebSocket connection for live logs
  useEffect(() => {
    const ws = connectWebSocket((data) => {
      if (typeof data === 'object' && data !== null) {
        setLogs((prev) => {
          // Add new log at the beginning (newest first)
          const newLogs = [data as LogEntry, ...prev]
          if (newLogs.length > LOG_BUFFER_SIZE) {
            return newLogs.slice(0, LOG_BUFFER_SIZE)
          }
          return newLogs
        })
        // Flash indicator for new logs
        setNewLogIndicator(true)
        setTimeout(() => setNewLogIndicator(false), 300)
      }
    })

    ws.onopen = () => setConnected(true)
    ws.onclose = () => setConnected(false)

    return () => {
      ws.close()
    }
  }, [])

  // Filter logs when filter changes
  useEffect(() => {
    if (!filter.trim()) {
      setFilteredLogs(logs)
    } else {
      const lowerFilter = filter.toLowerCase()
      setFilteredLogs(
        logs.filter(
          (log) =>
            log.content.toLowerCase().includes(lowerFilter) ||
            log.source?.toLowerCase().includes(lowerFilter) ||
            log.level.toLowerCase().includes(lowerFilter)
        )
      )
    }
  }, [logs, filter])

  // Auto-scroll to top for new logs
  useEffect(() => {
    if (autoScroll && containerRef.current && !isUserScrolling.current) {
      containerRef.current.scrollTop = 0
    }
  }, [filteredLogs, autoScroll])

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error':
        return 'text-red-400 bg-red-400/10'
      case 'warn':
        return 'text-yellow-400 bg-yellow-400/10'
      case 'info':
        return 'text-blue-400 bg-blue-400/10'
      default:
        return 'text-muted-foreground bg-muted/30'
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
      case 'bridge':
        return 'text-pink-400'
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

  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
  }

  // Check if we need to show date separator
  const showDate = (index: number) => {
    if (index === filteredLogs.length - 1) return false
    const current = new Date(filteredLogs[index].ts).setHours(0, 0, 0, 0)
    const next = new Date(filteredLogs[index + 1].ts).setHours(0, 0, 0, 0)
    return current !== next
  }

  const handleScroll = () => {
    if (containerRef.current) {
      const { scrollTop } = containerRef.current
      // User is scrolling if not at top
      isUserScrolling.current = scrollTop > 10
      // Re-enable auto-scroll when user scrolls back to top
      if (scrollTop < 10 && !autoScroll) {
        setAutoScroll(true)
      }
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold">Live Logs</h1>
          
          {/* Live indicator */}
          <div className={cn(
            "flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium transition-colors",
            connected 
              ? "bg-green-500/20 text-green-400" 
              : "bg-red-500/20 text-red-400"
          )}>
            <Radio className={cn(
              "h-4 w-4",
              connected && newLogIndicator && "animate-pulse"
            )} />
            <span>{connected ? 'LIVE' : 'DISCONNECTED'}</span>
          </div>

          {/* Connection status dot */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div
              className={cn(
                "h-2 w-2 rounded-full",
                connected ? 'bg-green-500' : 'bg-red-500'
              )}
            />
            <span>WebSocket</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {showFilter && (
            <Input
              placeholder="Filter logs..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-64 h-8"
              autoFocus
            />
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilter(!showFilter)}
          >
            <Filter className="mr-2 h-4 w-4" />
            Filter
          </Button>
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
          <Button variant="outline" size="sm" onClick={() => setLogs([])}>
            <Trash2 className="mr-2 h-4 w-4" />
            Clear
          </Button>
          <span className="text-sm text-muted-foreground tabular-nums">
            {logs.length.toLocaleString()} messages
            {filter && ` (${filteredLogs.length} shown)`}
          </span>
        </div>
      </div>

      {/* Log Output - Full Height */}
      <div className="flex-1 overflow-hidden p-4">
        <Card className="h-full overflow-hidden border-border">
          <CardContent className="p-0 h-full">
            <div
              ref={containerRef}
              className="h-full overflow-y-auto bg-[#0a0a0a] p-4 font-mono text-sm scroll-smooth"
              onScroll={handleScroll}
            >
              {filteredLogs.length === 0 ? (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  <Terminal className="mr-2 h-5 w-5" />
                  {filter ? 'No logs match filter' : 'Waiting for logs...'}
                </div>
              ) : (
                <div className="space-y-0">
                  {filteredLogs.map((log, i) => (
                    <div key={`${log.ts}-${i}`}>
                      <div className="py-0.5 px-2 hover:bg-white/5 rounded flex gap-3 items-start group">
                        <span className="text-muted-foreground shrink-0 text-xs pt-0.5 tabular-nums">
                          {formatTime(log.ts)}
                        </span>
                        {log.source ? (
                          <span
                            className={`w-16 shrink-0 text-xs truncate ${getSourceColor(log.source)}`}
                          >
                            {log.source}
                          </span>
                        ) : (
                          <span className="w-16 shrink-0" />
                        )}
                        <span
                          className={`w-12 shrink-0 text-xs px-1.5 py-0.5 rounded text-center ${getLevelColor(log.level)}`}
                        >
                          {log.level}
                        </span>
                        <span className="break-all whitespace-pre-wrap text-sm leading-relaxed text-gray-300">
                          {log.content}
                        </span>
                      </div>
                      {showDate(i) && (
                        <div className="py-2 my-2 border-t border-border/30">
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2">
                            {formatDate(filteredLogs[i + 1].ts)}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Scroll to top indicator */}
      {!autoScroll && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setAutoScroll(true)
              containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
            }}
            className="shadow-lg"
          >
            <Play className="mr-2 h-4 w-4" />
            Resume live tail
          </Button>
        </div>
      )}
    </div>
  )
}
