import { useEffect, useState, useCallback, useMemo } from 'react'
import { Header } from '@/components/layout/Header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { api, type DBTable, type TableData } from '@/lib/api'
import { Search, Table2, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { DetailPanel } from '@/components/widgets/DetailPanel'
import { cn } from '@/lib/utils'

// Color mappings for channels
const channelColors: Record<string, string> = {
  telegram: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'team-club': 'bg-green-500/20 text-green-400 border-green-500/30',
  'think-loop': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  default: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
}

// Color mappings for roles
const roleColors: Record<string, string> = {
  user: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  kitt: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  assistant: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  system: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  default: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
}

// Color mappings for types
const typeColors: Record<string, string> = {
  message: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  thought: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  task: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  log: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  default: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
}

// Badge component
function Badge({ value, type }: { value: string; type: 'channel' | 'role' | 'type' }) {
  const colors = type === 'channel' ? channelColors : type === 'role' ? roleColors : typeColors
  const colorClass = colors[value?.toLowerCase()] || colors.default
  
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border', colorClass)}>
      {value}
    </span>
  )
}

const PERIOD_OPTIONS = [
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Last 7 Days' },
  { value: 'month', label: 'Last 30 Days' },
]

const LIMIT_OPTIONS = [10, 25, 50, 100]

type SortDirection = 'asc' | 'desc' | null
type SortConfig = { key: string; direction: SortDirection }

export function Database() {
  const [tables, setTables] = useState<DBTable[]>([])
  const [selectedTable, setSelectedTable] = useState<string>('')
  const [tableData, setTableData] = useState<TableData | null>(null)
  const [search, setSearch] = useState('')
  const [period, setPeriod] = useState('all')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(50)
  const [allRows, setAllRows] = useState<Record<string, unknown>[]>([])
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)
  const [selectedRow, setSelectedRow] = useState<Record<string, unknown> | null>(null)
  
  // New filter states
  const [filterType, setFilterType] = useState<string>('all')
  const [filterChannel, setFilterChannel] = useState<string>('all')
  const [filterRole, setFilterRole] = useState<string>('all')
  
  // Sorting state
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'created_at', direction: 'desc' })

  // Fetch tables list
  useEffect(() => {
    api.getTables().then((data) => {
      setTables(data.tables)
      if (data.tables.length > 0 && !selectedTable) {
        setSelectedTable(data.tables[0].name)
      }
    })
  }, [])

  // Get unique values for filter dropdowns
  const uniqueChannels = useMemo(() => {
    if (!tableData?.rows) return []
    const channels = new Set(tableData.rows.map((r: Record<string, unknown>) => String(r.channel || '')).filter(Boolean))
    return Array.from(channels).sort()
  }, [tableData])

  const uniqueTypes = useMemo(() => {
    if (!tableData?.rows) return []
    const types = new Set(tableData.rows.map((r: Record<string, unknown>) => String(r.type || '')).filter(Boolean))
    return Array.from(types).sort()
  }, [tableData])

  const uniqueRoles = useMemo(() => {
    if (!tableData?.rows) return []
    const roles = new Set(tableData.rows.map((r: Record<string, unknown>) => String(r.role || '')).filter(Boolean))
    return Array.from(roles).sort()
  }, [tableData])

  // Fetch table data (accumulates for scrollable pagination)
  const fetchTableData = useCallback(async (isLoadMore = false) => {
    if (!selectedTable) return
    
    setLoading(true)
    try {
      const currentPage = isLoadMore ? page : 1
      const data = await api.getTableData(selectedTable, currentPage, limit, search, period)
      
      if (isLoadMore) {
        // Append new rows to existing rows
        setAllRows((prev) => [...prev, ...data.rows])
      } else {
        // Replace all rows
        setAllRows(data.rows)
        setPage(1)
      }
      
      setTableData(data)
      setHasMore(data.rows.length === limit && (currentPage * limit) < data.total)
    } catch (err) {
      console.error('Failed to fetch table data:', err)
    } finally {
      setLoading(false)
    }
  }, [selectedTable, page, limit, search, period])

  useEffect(() => {
    fetchTableData(false)
  }, [fetchTableData])

  // Reset when table, search, period, or filters change
  useEffect(() => {
    setPage(1)
    setAllRows([])
    setHasMore(true)
  }, [selectedTable, search, period, filterType, filterChannel, filterRole])

  // Filter and sort data client-side
  const processedRows = useMemo(() => {
    if (allRows.length === 0) return []
    
    let rows = [...allRows]
    
    // Apply filters
    if (filterType !== 'all') {
      rows = rows.filter((r: Record<string, unknown>) => String(r.type) === filterType)
    }
    if (filterChannel !== 'all') {
      rows = rows.filter((r: Record<string, unknown>) => String(r.channel) === filterChannel)
    }
    if (filterRole !== 'all') {
      rows = rows.filter((r: Record<string, unknown>) => String(r.role) === filterRole)
    }
    
    // Apply sorting
    if (sortConfig.key && sortConfig.direction) {
      rows.sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
        const aVal = a[sortConfig.key]
        const bVal = b[sortConfig.key]
        
        if (aVal === null || aVal === undefined) return 1
        if (bVal === null || bVal === undefined) return -1
        
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal
        }
        
        const aStr = String(aVal).toLowerCase()
        const bStr = String(bVal).toLowerCase()
        if (sortConfig.direction === 'asc') {
          return aStr < bStr ? -1 : aStr > bStr ? 1 : 0
        }
        return aStr > bStr ? -1 : aStr < bStr ? 1 : 0
      })
    }
    
    return rows
  }, [tableData, filterType, filterChannel, filterRole, sortConfig])

  // Handle sort click
  const handleSort = (key: string) => {
    setSortConfig((current) => ({
      key,
      direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc',
    }))
  }

  // Get sort icon
  const getSortIcon = (key: string) => {
    if (sortConfig.key !== key) return <ArrowUpDown className="ml-2 h-3 w-3 opacity-50" />
    if (sortConfig.direction === 'asc') return <ArrowUp className="ml-2 h-3 w-3" />
    return <ArrowDown className="ml-2 h-3 w-3" />
  }

  // Define column order and visibility
  const getOrderedColumns = (row: Record<string, unknown>) => {
    const keys = Object.keys(row)
    const priority = ['created_at', 'channel', 'role', 'type', 'session_id', 'content']
    const hidden = ['id', 'metadata', 'embedding']
    
    // Sort by priority, filter out hidden
    const ordered = priority.filter((k) => keys.includes(k))
    const remaining = keys.filter((k) => !priority.includes(k) && !hidden.includes(k))
    
    return [...ordered, ...remaining]
  }

  const columns = tableData?.rows.length ? getOrderedColumns(tableData.rows[0]) : []

  // Format timestamp to readable date
  const formatTimestamp = (value: unknown): string => {
    if (typeof value !== 'number' && typeof value !== 'string') return String(value)
    
    const num = typeof value === 'string' ? parseInt(value, 10) : value
    if (isNaN(num) || num === 0) return String(value)
    
    // Assume milliseconds if > 1e10, otherwise seconds
    const ms = num > 10000000000 ? num : num * 1000
    
    const date = new Date(ms)
    if (isNaN(date.getTime())) return String(value)
    
    // Format: "Feb 8, 14:30:45" (compact, readable)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
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

  // Format cell value for display
  const formatCellValue = (value: unknown, key: string): React.ReactNode => {
    if (value === null) return <span className="text-muted-foreground">null</span>
    if (value === undefined) return <span className="text-muted-foreground">-</span>
    
    // Return colored badges for specific columns
    if (key === 'channel') return <Badge value={String(value)} type="channel" />
    if (key === 'role') return <Badge value={String(value)} type="role" />
    if (key === 'type') return <Badge value={String(value)} type="type" />
    
    // Format timestamps
    if (isTimestampField(key)) {
      return <span className="text-muted-foreground font-mono text-xs">{formatTimestamp(value)}</span>
    }
    
    if (typeof value === 'object') {
      const str = JSON.stringify(value)
      return str.length > 50 ? str.slice(0, 50) + '...' : str
    }
    const str = String(value)
    return str.length > 100 ? str.slice(0, 100) + '...' : str
  }

  return (
    <div className="space-y-6">
      <Header
        title="Database Explorer"
        description="Browse and query KITT's database"
      />

      {/* Tables Overview */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        {tables.map((table) => (
          <Card
            key={table.name}
            className={cn(
              'cursor-pointer transition-colors',
              selectedTable === table.name ? 'border-primary' : 'hover:border-muted-foreground'
            )}
            onClick={() => setSelectedTable(table.name)}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{table.label}</CardTitle>
              <Table2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{table.count.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">records</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter and search {selectedTable} records</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Period" />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Type filter */}
            {uniqueTypes.length > 0 && (
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {uniqueTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Channel filter */}
            {uniqueChannels.length > 0 && (
              <Select value={filterChannel} onValueChange={setFilterChannel}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Channel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Channels</SelectItem>
                  {uniqueChannels.map((channel) => (
                    <SelectItem key={channel} value={channel}>
                      {channel}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Role filter */}
            {uniqueRoles.length > 0 && (
              <Select value={filterRole} onValueChange={setFilterRole}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {uniqueRoles.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Select value={String(limit)} onValueChange={(v) => setLimit(Number(v))}>
              <SelectTrigger className="w-[110px]">
                <SelectValue placeholder="Per page" />
              </SelectTrigger>
              <SelectContent>
                {LIMIT_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={String(opt)}>
                    {opt} / page
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="capitalize">{selectedTable}</CardTitle>
            <CardDescription>
              {processedRows.length.toLocaleString()} of {tableData?.total.toLocaleString()} records
              {loading && ' (loading...)'}
            </CardDescription>
          </div>
          
          {/* Row count */}
          <span className="text-sm text-muted-foreground">
            Showing {processedRows.length} of {tableData?.total.toLocaleString()} records
          </span>
        </CardHeader>
        <CardContent>
          {processedRows.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No records found
            </div>
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto border rounded-md">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      {columns.map((col) => (
                        <TableHead 
                          key={col} 
                          className="whitespace-nowrap cursor-pointer hover:bg-muted/50"
                          onClick={() => handleSort(col)}
                        >
                          <div className="flex items-center">
                            {col}
                            {getSortIcon(col)}
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {processedRows.map((row: Record<string, unknown>, i: number) => (
                      <TableRow
                        key={i}
                        className="cursor-pointer"
                        onClick={() => setSelectedRow(row)}
                      >
                        {columns.map((col) => (
                          <TableCell key={col} className="max-w-[300px] truncate">
                            {formatCellValue(row[col], col)}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              {/* Load more button */}
              {hasMore && (
                <div className="flex justify-center">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setPage((p) => p + 1)
                      fetchTableData(true)
                    }}
                    disabled={loading}
                    className="w-full max-w-xs"
                  >
                    {loading ? 'Loading...' : `Load more (${tableData ? tableData.total - allRows.length : 0} remaining)`}
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Panel */}
      {selectedRow && (
        <>
          <div
            className="fixed inset-0 z-40 bg-background/50"
            onClick={() => setSelectedRow(null)}
          />
          <DetailPanel data={selectedRow} onClose={() => setSelectedRow(null)} />
        </>
      )}
    </div>
  )
}
