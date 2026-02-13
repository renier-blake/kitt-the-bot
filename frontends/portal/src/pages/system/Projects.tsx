import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Plus,
  LayoutGrid,
  List,
  Search,
  Filter,
  Calendar,
  AlertCircle,
  ArrowUpCircle,
  ArrowDownCircle,
  MinusCircle,
  ChevronRight,
  ChevronDown,
  X
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

// DnD Kit imports
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// Types
interface Project {
  id: number
  identifier: string
  name: string
  description: string | null
  color: string
  createdAt: number
  updatedAt: number
}

interface Label {
  id: number
  name: string
  color: string
}

interface Issue {
  id: number
  identifier: string
  title: string
  description: string | null
  state: IssueState
  priority: IssuePriority
  type: string
  complexity: IssueComplexity
  scope: IssueScope
  projectId: number
  cycleId: number | null
  parentId: number | null
  childCount: number
  position: number
  dueDate: number | null
  scheduledDate: number | null
  scheduledTimeStart: number | null
  scheduledTimeEnd: number | null
  scheduledTimezone: string | null
  startDate: number | null
  createdBy: string
  createdAt: number
  updatedAt: number
  project: { identifier: string; color: string } | null
  cycle: { name: string } | null
  labels: Label[]
}

type IssueState = 'backlog' | 'scheduled' | 'todo' | 'in_progress' | 'testing' | 'done' | 'cancelled'
type IssuePriority = 'critical' | 'urgent' | 'high' | 'medium' | 'low'
type IssueComplexity = 'low' | 'medium' | 'high'
type IssueScope = 'isolated' | 'cross-cutting'
type ViewMode = 'board' | 'list' | 'calendar'

const STATE_COLUMNS: { id: IssueState; label: string }[] = [
  { id: 'backlog', label: 'Backlog' },
  { id: 'scheduled', label: 'Gepland' },
  { id: 'todo', label: 'Todo' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'testing', label: 'Testing' },
  { id: 'done', label: 'Done' },
  { id: 'cancelled', label: 'Cancelled' }
]

const PRIORITY_CONFIG: Record<IssuePriority, { label: string; color: string; icon: React.ReactNode }> = {
  critical: { label: 'Critical', color: '#7F1D1D', icon: <AlertCircle className="w-3 h-3" /> },
  urgent: { label: 'Urgent', color: '#DC2626', icon: <AlertCircle className="w-3 h-3" /> },
  high: { label: 'High', color: '#F97316', icon: <ArrowUpCircle className="w-3 h-3" /> },
  medium: { label: 'Medium', color: '#EAB308', icon: <MinusCircle className="w-3 h-3" /> },
  low: { label: 'Low', color: '#22C55E', icon: <ArrowDownCircle className="w-3 h-3" /> },
}

const TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  feature: { label: 'Feature', color: '#10B981' },
  bug: { label: 'Bug', color: '#EF4444' },
  improvement: { label: 'Improvement', color: '#3B82F6' },
  docs: { label: 'Docs', color: '#8B5CF6' },
}

// Hooks
function useProjects() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/projects')
      .then((res) => res.json())
      .then((data) => {
        setProjects(data.projects || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  return { projects, loading }
}

function useLabels() {
  const [labels, setLabels] = useState<Label[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/labels')
      .then((res) => res.json())
      .then((data) => {
        setLabels(data.labels || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  return { labels, loading }
}

// Custom Label Filter Dropdown
function LabelFilterDropdown({ 
  labels, 
  selected, 
  onChange 
}: { 
  labels: Label[] 
  selected: number[] 
  onChange: (selected: number[]) => void 
}) {
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={ref} className="relative">
      <Button 
        variant="outline" 
        className="w-36 h-8 text-sm font-normal"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Filter className="w-3 h-3 mr-2" />
        {selected.length === 0 ? 'All Labels' : `${selected.length} selected`}
      </Button>
      
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-56 bg-[#1A1A1A] border border-border rounded-lg shadow-lg z-50 p-2">
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {selected.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-xs h-7 text-muted-foreground"
                onClick={() => onChange([])}
              >
                Clear all
              </Button>
            )}
            {labels.map((label) => (
              <div
                key={label.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-[#2A2A2A]"
                onClick={() => {
                  if (selected.includes(label.id)) {
                    onChange(selected.filter((id) => id !== label.id))
                  } else {
                    onChange([...selected, label.id])
                  }
                }}
              >
                <div
                  className={cn(
                    "w-4 h-4 rounded border flex items-center justify-center shrink-0",
                    selected.includes(label.id) ? "bg-[#FF9900] border-[#FF9900]" : "border-muted-foreground"
                  )}
                >
                  {selected.includes(label.id) && <span className="text-black text-xs">✓</span>}
                </div>
                <span
                  className="px-1.5 py-0.5 text-xs rounded-full truncate"
                  style={{
                    backgroundColor: `${label.color}20`,
                    color: label.color,
                  }}
                >
                  {label.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function useIssues(filters: {
  project?: number
  state?: IssueState
  priority?: IssuePriority
  search?: string
  labels?: number[]
  topLevel?: boolean
  parentId?: number
}) {
  const [issues, setIssues] = useState<Issue[]>([])
  const [loading, setLoading] = useState(true)

  const fetchIssues = () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filters.project) params.set('project', String(filters.project))
    if (filters.state) params.set('state', filters.state)
    if (filters.priority) params.set('priority', filters.priority)
    if (filters.search) params.set('search', filters.search)
    if (filters.labels && filters.labels.length > 0) {
      filters.labels.forEach(labelId => params.append('labels', String(labelId)))
    }
    if (filters.topLevel) params.set('topLevel', 'true')
    if (filters.parentId) params.set('parentId', String(filters.parentId))

    fetch(`/api/issues?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        setIssues(data.issues || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    fetchIssues()
  }, [filters.project, filters.state, filters.priority, filters.search, filters.labels, filters.topLevel, filters.parentId])

  const updateIssue = async (id: number, updates: Partial<Issue>) => {
    // Convert camelCase to snake_case for API
    const apiUpdates: Record<string, unknown> = {}
    if (updates.title !== undefined) apiUpdates.title = updates.title
    if (updates.description !== undefined) apiUpdates.description = updates.description
    if (updates.state !== undefined) apiUpdates.state = updates.state
    if (updates.priority !== undefined) apiUpdates.priority = updates.priority
    if (updates.complexity !== undefined) apiUpdates.complexity = updates.complexity
    if (updates.scope !== undefined) apiUpdates.scope = updates.scope
    if (updates.cycleId !== undefined) apiUpdates.cycleId = updates.cycleId
    if (updates.position !== undefined) apiUpdates.position = updates.position
    if (updates.dueDate !== undefined) apiUpdates.dueDate = updates.dueDate
    if (updates.scheduledDate !== undefined) apiUpdates.scheduledDate = updates.scheduledDate
    if (updates.scheduledTimeStart !== undefined) apiUpdates.scheduledTimeStart = updates.scheduledTimeStart
    if (updates.scheduledTimeEnd !== undefined) apiUpdates.scheduledTimeEnd = updates.scheduledTimeEnd
    if (updates.scheduledTimezone !== undefined) apiUpdates.scheduledTimezone = updates.scheduledTimezone
    if (updates.startDate !== undefined) apiUpdates.startDate = updates.startDate
    if (updates.parentId !== undefined) apiUpdates.parentId = updates.parentId
    if ((updates as Record<string, unknown>).projectId !== undefined) apiUpdates.projectId = (updates as Record<string, unknown>).projectId

    const res = await fetch(`/api/issues/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(apiUpdates),
    })
    if (res.ok) {
      // Optimistic update
      setIssues((prev) =>
        prev.map((issue) =>
          issue.id === id ? { ...issue, ...updates } : issue
        )
      )
      return true
    }
    return false
  }

  const createIssue = async (issue: {
    title: string
    description?: string
    projectId: number
    priority: IssuePriority
    type: string
    cycleId?: number
    parentId?: number
  }) => {
    const res = await fetch('/api/issues', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(issue),
    })
    if (res.ok) {
      fetchIssues()
      return true
    }
    return false
  }

  return { issues, loading, updateIssue, createIssue, setIssues }
}

// Components
function PriorityBadge({ priority }: { priority: IssuePriority }) {
  const config = PRIORITY_CONFIG[priority] || { 
    label: priority, 
    color: '#6B7280', 
    icon: <MinusCircle className="w-3 h-3" /> 
  }
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium rounded"
      style={{ backgroundColor: `${config.color}20`, color: config.color }}
    >
      {config.icon}
      {config.label}
    </span>
  )
}

function ProjectBadge({ identifier, color }: { identifier: string; color: string }) {
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium rounded"
      style={{ backgroundColor: `${color}20`, color }}
    >
      {identifier}
    </span>
  )
}

function TypeBadge({ type }: { type: string }) {
  const config = TYPE_CONFIG[type] || { label: type, color: '#6B7280' }
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium rounded"
      style={{ backgroundColor: `${config.color}20`, color: config.color }}
    >
      {config.label}
    </span>
  )
}

function LabelBadge({ name, color }: { name: string; color: string }) {
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium rounded-full"
      style={{ backgroundColor: `${color}20`, color }}
    >
      {name}
    </span>
  )
}

// Sortable Issue Card
function SortableIssueCard({
  issue,
  onClick,
}: {
  issue: Issue
  onClick: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: issue.id, data: { issue } })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  // Prevent click when dragging
  const handleClick = (e: React.MouseEvent) => {
    if (isDragging) {
      e.preventDefault()
      e.stopPropagation()
      return
    }
    onClick()
  }

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...attributes} 
      {...listeners}
      className={cn(
        "cursor-grab active:cursor-grabbing",
        isDragging && "cursor-grabbing"
      )}
    >
      <Card
        className={cn(
          "hover:border-[#FF9900]/50 transition-colors group select-none",
          isDragging && "shadow-lg ring-2 ring-[#FF9900]/30"
        )}
        onClick={handleClick}
      >
        <CardContent className="p-3">
          <div className="flex items-start justify-between gap-2">
            <span className="text-xs text-muted-foreground font-mono">{issue.identifier}</span>
          </div>
          <h4 className="text-sm font-medium mt-1 line-clamp-2">{issue.title}</h4>
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <PriorityBadge priority={issue.priority} />
            {issue.project && (
              <ProjectBadge
                identifier={issue.project.identifier}
                color={issue.project.color}
              />
            )}
          </div>
          {/* Show scheduled date if set */}
          {issue.state === 'scheduled' && issue.scheduledDate && (
            <div className="flex items-center gap-1 mt-2 text-xs text-[#FF9900]">
              <Calendar className="w-3 h-3" />
              <span>
                {new Date(issue.scheduledDate).toLocaleDateString('nl-NL', {
                  day: 'numeric',
                  month: 'short'
                })}
                {issue.scheduledTimeStart && (
                  ` ${new Date(issue.scheduledTimeStart).toLocaleTimeString('nl-NL', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}`
                )}
              </span>
            </div>
          )}

          {/* Show due date */}
          {issue.dueDate && (
            <div className={`flex items-center gap-1 mt-1 text-xs ${
              new Date(issue.dueDate) < new Date() ? 'text-red-400' : 'text-muted-foreground'
            }`}>
              <Calendar className="w-3 h-3" />
              <span>
                {new Date(issue.dueDate).toLocaleDateString('nl-NL', {
                  day: 'numeric',
                  month: 'short'
                })}
              </span>
            </div>
          )}

          {issue.childCount > 0 && (
            <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
              <LayoutGrid className="w-3 h-3" />
              <span>{issue.childCount} sub-issue{issue.childCount !== 1 ? 's' : ''}</span>
            </div>
          )}
          {issue.labels.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {issue.labels.slice(0, 3).map((label) => (
                <LabelBadge key={label.id} name={label.name} color={label.color} />
              ))}
              {issue.labels.length > 3 && (
                <span className="text-xs text-muted-foreground">+{issue.labels.length - 3}</span>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// Static Issue Card (for drag overlay)
function IssueCard({
  issue,
}: {
  issue: Issue
}) {
  return (
    <Card className="shadow-lg ring-2 ring-[#FF9900]/30 rotate-2">
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <span className="text-xs text-muted-foreground font-mono">{issue.identifier}</span>
        </div>
        <h4 className="text-sm font-medium mt-1 line-clamp-2">{issue.title}</h4>
        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          <PriorityBadge priority={issue.priority} />
          {issue.project && (
            <ProjectBadge
              identifier={issue.project.identifier}
              color={issue.project.color}
            />
          )}
        </div>
        {issue.labels.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {issue.labels.slice(0, 3).map((label) => (
              <LabelBadge key={label.id} name={label.name} color={label.color} />
            ))}
            {issue.labels.length > 3 && (
              <span className="text-xs text-muted-foreground">+{issue.labels.length - 3}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Drop Zone at bottom of column
function DropZoneBottom({
  columnId,
  isOverColumn,
}: {
  columnId: IssueState
  isOverColumn: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `${columnId}-bottom`,
    data: { columnId, isBottomZone: true },
  })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "h-16 rounded-lg border-2 border-dashed transition-colors flex items-center justify-center text-sm text-muted-foreground",
        isOver || isOverColumn
          ? "border-[#FF9900]/50 bg-[#FF9900]/10 text-[#FF9900]" 
          : "border-muted hover:border-muted-foreground/30"
      )}
    >
      {isOver || isOverColumn ? 'Drop here' : 'Drop here to add at bottom'}
    </div>
  )
}

// Droppable Column
function DroppableColumn({
  column,
  issues,
  onIssueClick,
}: {
  column: { id: IssueState; label: string }
  issues: Issue[]
  onIssueClick: (issue: Issue) => void
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { column },
  })

  return (
    <div className="flex-shrink-0 w-72 flex flex-col">
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{column.label}</span>
          <span className="text-xs text-muted-foreground bg-[#1A1A1A] px-2 py-0.5 rounded-full">
            {issues.length}
          </span>
        </div>
      </div>
      <SortableContext
        items={issues.map((i) => i.id)}
        strategy={verticalListSortingStrategy}
      >
        <div
          ref={setNodeRef}
          className={cn(
            "flex-1 overflow-y-auto space-y-2 min-h-0 rounded-lg p-2 transition-colors",
            isOver 
              ? "bg-[#FF9900]/10 ring-2 ring-[#FF9900]/30" 
              : "bg-muted/30"
          )}
        >
          {issues.map((issue) => (
            <SortableIssueCard
              key={issue.id}
              issue={issue}
              onClick={() => onIssueClick(issue)}
            />
          ))}
          <DropZoneBottom 
            columnId={column.id} 
            isOverColumn={isOver}
          />
        </div>
      </SortableContext>
    </div>
  )
}

function IssueDetailPanel({
  issue,
  onClose,
  onUpdate,
  projects,
  allLabels,
  onCreateSubIssue,
  onSelectIssue,
  onUpdateLabels,
}: {
  issue: Issue | null
  onClose: () => void
  onUpdate: (id: number, updates: Partial<Issue>) => void
  projects: Project[]
  allLabels: Label[]
  onCreateSubIssue: (issue: {
    title: string
    description: string
    projectId: number
    priority: IssuePriority
    type: string
    parentId?: number
  }) => Promise<boolean>
  onSelectIssue: (issue: Issue) => void
  onUpdateLabels: (issueId: number, labelIds: number[]) => Promise<void>
}) {
  const [editedIssue, setEditedIssue] = useState<Partial<Issue> & { projectId?: number }>({})
  const [subIssues, setSubIssues] = useState<Issue[]>([])
  const [parentIssue, setParentIssue] = useState<Issue | null>(null)
  const [loadingSubIssues, setLoadingSubIssues] = useState(false)
  const [selectedLabelIds, setSelectedLabelIds] = useState<number[]>([])
  const [showLabelPicker, setShowLabelPicker] = useState(false)
  const labelPickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (labelPickerRef.current && !labelPickerRef.current.contains(event.target as Node)) {
        setShowLabelPicker(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (issue) {
      setEditedIssue({
        title: issue.title,
        description: issue.description,
        priority: issue.priority,
        state: issue.state,
        projectId: issue.projectId,
        dueDate: issue.dueDate,
        scheduledDate: issue.scheduledDate,
        scheduledTimeStart: issue.scheduledTimeStart,
        scheduledTimeEnd: issue.scheduledTimeEnd,
        scheduledTimezone: issue.scheduledTimezone,
        startDate: issue.startDate,
      })
      setSelectedLabelIds(issue.labels.map(l => l.id))

      // Load sub-issues if this is a parent
      if (issue.childCount > 0) {
        setLoadingSubIssues(true)
        fetch(`/api/issues?parentId=${issue.id}`)
          .then((res) => res.json())
          .then((data) => {
            setSubIssues(data.issues || [])
            setLoadingSubIssues(false)
          })
          .catch(() => setLoadingSubIssues(false))
      } else {
        setSubIssues([])
      }

      // Load parent if this is a child
      if (issue.parentId) {
        fetch(`/api/issues?search=`)
          .then((res) => res.json())
          .then((data) => {
            const parent = (data.issues || []).find((i: Issue) => i.id === issue.parentId)
            setParentIssue(parent || null)
          })
          .catch(() => setParentIssue(null))
      } else {
        setParentIssue(null)
      }
    }
  }, [issue])

  if (!issue) return null

  const handleSave = () => {
    // Include projectId in updates if changed
    const updates: Partial<Issue> & { projectId?: number } = { ...editedIssue }
    onUpdate(issue.id, updates)
    onClose()
  }

  return (
    <div
      className={cn(
        'fixed inset-y-0 right-0 w-96 bg-[#1A1A1A] border-l border-border shadow-2xl transform transition-transform duration-300 z-50',
        issue ? 'translate-x-0' : 'translate-x-full'
      )}
    >
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground font-mono">{issue.identifier}</span>
            {issue.project && (
              <ProjectBadge identifier={issue.project.identifier} color={issue.project.color} />
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Parent link */}
          {parentIssue && (
            <div
              className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg cursor-pointer hover:bg-muted/50"
              onClick={() => onSelectIssue(parentIssue)}
            >
              <span className="text-xs text-muted-foreground">Parent:</span>
              <span className="text-xs font-mono">{parentIssue.identifier}</span>
              <span className="text-xs truncate">{parentIssue.title}</span>
            </div>
          )}

          <div>
            <Label className="text-xs text-muted-foreground">Title</Label>
            <Input
              value={editedIssue.title || ''}
              onChange={(e) => setEditedIssue({ ...editedIssue, title: e.target.value })}
              className="mt-1"
            />
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Description</Label>
            <Textarea
              value={editedIssue.description || ''}
              onChange={(e) => setEditedIssue({ ...editedIssue, description: e.target.value })}
              className="mt-1 min-h-[120px]"
              placeholder="Add a description..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">State</Label>
              <Select
                value={editedIssue.state}
                onValueChange={(v) => setEditedIssue({ ...editedIssue, state: v as IssueState })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATE_COLUMNS.map((col) => (
                    <SelectItem key={col.id} value={col.id}>
                      {col.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Priority</Label>
              <Select
                value={editedIssue.priority}
                onValueChange={(v) => setEditedIssue({ ...editedIssue, priority: v as IssuePriority })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(['critical', 'urgent', 'high', 'medium', 'low'] as IssuePriority[]).map((p) => (
                    <SelectItem key={p} value={p}>
                      {PRIORITY_CONFIG[p].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Project</Label>
            <Select
              value={editedIssue.projectId?.toString() || ''}
              onValueChange={(v) => setEditedIssue({ ...editedIssue, projectId: Number(v) })}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id.toString()}>
                    <span className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: project.color }}
                      />
                      {project.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Scheduled Date - only show if state is 'scheduled' */}
          {editedIssue.state === 'scheduled' && (
            <div className="p-3 bg-[#FF9900]/10 rounded-lg border border-[#FF9900]/20">
              <Label className="text-xs text-[#FF9900] font-medium">Gepland voor</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Datum</Label>
                  <Input
                    type="date"
                    value={editedIssue.scheduledDate ? new Date(editedIssue.scheduledDate).toISOString().split('T')[0] : ''}
                    onChange={(e) => {
                      const dateValue = e.target.value
                      if (!dateValue) {
                        setEditedIssue({ ...editedIssue, scheduledDate: null, scheduledTimeStart: null })
                        return
                      }
                      const [year, month, day] = dateValue.split('-').map(Number)
                      const date = new Date(year, month - 1, day, 12, 0, 0)
                      setEditedIssue({ ...editedIssue, scheduledDate: date.getTime() })
                    }}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Tijd (optioneel)</Label>
                  <Input
                    type="time"
                    value={editedIssue.scheduledTimeStart ? (() => {
                      const d = new Date(editedIssue.scheduledTimeStart!)
                      const hours = d.getHours().toString().padStart(2, '0')
                      const mins = d.getMinutes().toString().padStart(2, '0')
                      return `${hours}:${mins}`
                    })() : ''}
                    onChange={(e) => {
                      const time = e.target.value
                      if (!time || !editedIssue.scheduledDate) {
                        setEditedIssue({ ...editedIssue, scheduledTimeStart: null })
                        return
                      }
                      const [hours, minutes] = time.split(':').map(Number)
                      const date = new Date(editedIssue.scheduledDate)
                      date.setHours(hours, minutes)
                      setEditedIssue({ ...editedIssue, scheduledTimeStart: date.getTime() })
                    }}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Due Date */}
          <div>
            <Label className="text-xs text-muted-foreground">Deadline (optioneel)</Label>
            <Input
              type="date"
              value={editedIssue.dueDate ? new Date(editedIssue.dueDate).toISOString().split('T')[0] : ''}
              onChange={(e) => {
                const dateValue = e.target.value
                if (!dateValue) {
                  setEditedIssue({ ...editedIssue, dueDate: null })
                  return
                }
                const [year, month, day] = dateValue.split('-').map(Number)
                const date = new Date(year, month - 1, day, 12, 0, 0)
                setEditedIssue({ ...editedIssue, dueDate: date.getTime() })
              }}
              className="mt-1"
            />
          </div>

          <div ref={labelPickerRef} className="relative">
            <Label className="text-xs text-muted-foreground">Labels</Label>
            <div
              className="flex flex-wrap gap-1 mt-1 min-h-[32px] p-1.5 border border-border rounded-md cursor-pointer hover:border-muted-foreground/50"
              onClick={() => setShowLabelPicker(!showLabelPicker)}
            >
              {selectedLabelIds.length > 0 ? (
                allLabels
                  .filter(l => selectedLabelIds.includes(l.id))
                  .map((label) => (
                    <LabelBadge key={label.id} name={label.name} color={label.color} />
                  ))
              ) : (
                <span className="text-sm text-muted-foreground">Click to add labels</span>
              )}
            </div>
            {showLabelPicker && (
              <div className="absolute top-full left-0 mt-1 w-full bg-[#1A1A1A] border border-border rounded-lg shadow-lg z-50 p-2 max-h-48 overflow-y-auto">
                {allLabels.map((label) => (
                  <div
                    key={label.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-[#2A2A2A]"
                    onClick={() => {
                      const newIds = selectedLabelIds.includes(label.id)
                        ? selectedLabelIds.filter(id => id !== label.id)
                        : [...selectedLabelIds, label.id]
                      setSelectedLabelIds(newIds)
                      onUpdateLabels(issue.id, newIds)
                    }}
                  >
                    <div
                      className={cn(
                        "w-4 h-4 rounded border flex items-center justify-center shrink-0",
                        selectedLabelIds.includes(label.id) ? "bg-[#FF9900] border-[#FF9900]" : "border-muted-foreground"
                      )}
                    >
                      {selectedLabelIds.includes(label.id) && <span className="text-black text-xs">✓</span>}
                    </div>
                    <span
                      className="px-1.5 py-0.5 text-xs rounded-full"
                      style={{ backgroundColor: `${label.color}20`, color: label.color }}
                    >
                      {label.name}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sub-issues section */}
          {(issue.childCount > 0 || !issue.parentId) && (
            <>
              <Separator />
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs text-muted-foreground">
                    Sub-issues {issue.childCount > 0 && `(${issue.childCount})`}
                  </Label>
                  <CreateIssueDialog
                    projects={projects}
                    onCreate={onCreateSubIssue}
                    defaultProjectId={issue.projectId}
                    defaultParentId={issue.id}
                  />
                </div>
                {loadingSubIssues ? (
                  <div className="text-xs text-muted-foreground">Loading...</div>
                ) : subIssues.length > 0 ? (
                  <div className="space-y-1">
                    {subIssues.map((sub) => {
                      const stateStyle = getStateStyle(sub.state)
                      return (
                        <div
                          key={sub.id}
                          className="flex items-center gap-2 p-2 rounded hover:bg-muted/30 cursor-pointer"
                          onClick={() => onSelectIssue(sub)}
                        >
                          <span className="text-xs font-mono text-muted-foreground">{sub.identifier}</span>
                          <span className="text-xs truncate flex-1">{sub.title}</span>
                          <span
                            className="inline-flex items-center px-1.5 py-0.5 text-[10px] rounded"
                            style={{ backgroundColor: stateStyle.bg, color: stateStyle.color }}
                          >
                            {sub.state.replace('_', ' ')}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">No sub-issues yet</div>
                )}
              </div>
            </>
          )}

          <Separator />

          <div className="text-xs text-muted-foreground space-y-1">
            <div>Created by {issue.createdBy}</div>
            <div>{new Date(issue.createdAt).toLocaleString()}</div>
          </div>
        </div>

        <div className="p-4 border-t border-border">
          <Button onClick={handleSave} className="w-full bg-[#FF9900] hover:bg-[#FF9900]/90 text-black">
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  )
}

function CreateIssueDialog({
  projects,
  onCreate,
  defaultProjectId,
  defaultParentId,
}: {
  projects: Project[]
  onCreate: (issue: {
    title: string
    description: string
    projectId: number
    priority: IssuePriority
    type: string
    parentId?: number
  }) => Promise<boolean>
  defaultProjectId?: number
  defaultParentId?: number
}) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [projectId, setProjectId] = useState<number>(defaultProjectId || projects[0]?.id || 0)
  const [priority, setPriority] = useState<IssuePriority>('medium')
  const [type, setType] = useState('feature')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (defaultProjectId) setProjectId(defaultProjectId)
  }, [defaultProjectId])

  const handleSubmit = async () => {
    if (!title || !projectId) return
    setLoading(true)
    const success = await onCreate({
      title,
      description,
      projectId,
      priority,
      type,
      parentId: defaultParentId,
    })
    setLoading(false)
    if (success) {
      setOpen(false)
      setTitle('')
      setDescription('')
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size={defaultParentId ? 'sm' : 'default'} className="bg-[#FF9900] hover:bg-[#FF9900]/90 text-black">
          <Plus className="w-4 h-4 mr-1" />
          {defaultParentId ? 'Add Sub-issue' : 'New Issue'}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[525px] bg-[#1A1A1A] border-border">
        <DialogHeader>
          <DialogTitle>{defaultParentId ? 'Create Sub-issue' : 'Create New Issue'}</DialogTitle>
          <DialogDescription>
            {defaultParentId ? 'Add a sub-issue to this parent issue.' : 'Add a new issue to track your work.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Issue title"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the issue..."
              className="min-h-[100px]"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Project</Label>
              <Select
                value={projectId.toString()}
                onValueChange={(v) => setProjectId(Number(v))}
                disabled={!!defaultParentId}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id.toString()}>
                      <span className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: project.color }}
                        />
                        {project.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="feature">Feature</SelectItem>
                  <SelectItem value="bug">Bug</SelectItem>
                  <SelectItem value="improvement">Improvement</SelectItem>
                  <SelectItem value="docs">Docs</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Priority</Label>
            <Select
              value={priority}
              onValueChange={(v) => setPriority(v as IssuePriority)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(['critical', 'urgent', 'high', 'medium', 'low'] as IssuePriority[]).map((p) => (
                  <SelectItem key={p} value={p}>
                    {PRIORITY_CONFIG[p].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!title || !projectId || loading}
            className="bg-[#FF9900] hover:bg-[#FF9900]/90 text-black"
          >
            {loading ? 'Creating...' : 'Create Issue'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// State color helper
function getStateStyle(state: IssueState) {
  const map: Record<IssueState, { bg: string; color: string }> = {
    done: { bg: '#10B98120', color: '#10B981' },
    in_progress: { bg: '#3B82F620', color: '#3B82F6' },
    testing: { bg: '#A855F720', color: '#A855F7' },
    cancelled: { bg: '#6B728020', color: '#6B7280' },
    backlog: { bg: '#EAB30820', color: '#EAB308' },
    scheduled: { bg: '#FF990020', color: '#FF9900' },
    todo: { bg: '#EAB30820', color: '#EAB308' },
  }
  return map[state] || map.backlog
}

// Expandable list row for parent/child hierarchy
function ExpandableIssueRow({
  issue,
  onClick,
  isChild,
}: {
  issue: Issue
  onClick: (issue: Issue) => void
  isChild?: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const [children, setChildren] = useState<Issue[]>([])
  const [loadingChildren, setLoadingChildren] = useState(false)

  const handleExpand = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!expanded && children.length === 0) {
      setLoadingChildren(true)
      fetch(`/api/issues?parentId=${issue.id}`)
        .then((res) => res.json())
        .then((data) => {
          setChildren(data.issues || [])
          setLoadingChildren(false)
        })
        .catch(() => setLoadingChildren(false))
    }
    setExpanded(!expanded)
  }

  const stateStyle = getStateStyle(issue.state)

  return (
    <>
      <tr
        className="hover:bg-[#1A1A1A]/50 cursor-pointer"
        onClick={() => onClick(issue)}
      >
        <td className="p-3 font-mono text-muted-foreground">
          <div className={cn('flex items-center gap-1', isChild && 'pl-6')}>
            {!isChild && issue.childCount > 0 && (
              <button
                onClick={handleExpand}
                className="p-0.5 hover:bg-muted rounded"
              >
                {expanded ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </button>
            )}
            {isChild && <span className="text-muted-foreground/40 pl-1">└</span>}
            {issue.identifier}
          </div>
        </td>
        <td className="p-3">
          <div className="flex items-center gap-2">
            <span className="font-medium">{issue.title}</span>
            {!isChild && issue.childCount > 0 && (
              <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                {issue.childCount}
              </span>
            )}
          </div>
          {issue.labels.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {issue.labels.map((label) => (
                <LabelBadge key={label.id} name={label.name} color={label.color} />
              ))}
            </div>
          )}
        </td>
        <td className="p-3">
          <span
            className="inline-flex items-center px-2 py-0.5 text-xs rounded"
            style={{ backgroundColor: stateStyle.bg, color: stateStyle.color }}
          >
            {issue.state.replace('_', ' ')}
          </span>
        </td>
        <td className="p-3">
          <PriorityBadge priority={issue.priority} />
        </td>
        <td className="p-3">
          <TypeBadge type={issue.type} />
        </td>
        <td className="p-3">
          {issue.project && (
            <ProjectBadge identifier={issue.project.identifier} color={issue.project.color} />
          )}
        </td>
      </tr>
      {expanded && (
        loadingChildren ? (
          <tr>
            <td colSpan={6} className="p-3 pl-12 text-sm text-muted-foreground">
              Loading...
            </td>
          </tr>
        ) : (
          children.map((child) => (
            <ExpandableIssueRow
              key={child.id}
              issue={child}
              onClick={onClick}
              isChild
            />
          ))
        )
      )}
    </>
  )
}

// Calendar View
function CalendarView({
  issues,
  onIssueClick,
}: {
  issues: Issue[]
  onIssueClick: (issue: Issue) => void
}) {
  const [currentDate, setCurrentDate] = useState(new Date())

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startOffset = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1 // Monday start

  const daysInMonth = lastDay.getDate()
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7

  // Group issues by due date (day of month)
  const issuesByDay = useMemo(() => {
    const map: Record<string, Issue[]> = {}
    for (const issue of issues) {
      if (!issue.dueDate) continue
      const d = new Date(issue.dueDate)
      if (d.getFullYear() === year && d.getMonth() === month) {
        const key = d.getDate().toString()
        if (!map[key]) map[key] = []
        map[key].push(issue)
      }
    }
    return map
  }, [issues, year, month])

  const today = new Date()
  const isToday = (day: number) =>
    today.getFullYear() === year && today.getMonth() === month && today.getDate() === day

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1))
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1))
  const goToday = () => setCurrentDate(new Date())

  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  return (
    <div className="h-full overflow-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={prevMonth}>←</Button>
          <h2 className="text-lg font-semibold min-w-[200px] text-center">{monthName}</h2>
          <Button variant="outline" size="sm" onClick={nextMonth}>→</Button>
        </div>
        <Button variant="outline" size="sm" onClick={goToday}>Today</Button>
      </div>

      <div className="grid grid-cols-7 border border-border rounded-lg overflow-hidden">
        {/* Week day headers */}
        {weekDays.map(day => (
          <div key={day} className="p-2 text-xs font-medium text-muted-foreground text-center bg-[#1A1A1A] border-b border-border">
            {day}
          </div>
        ))}

        {/* Calendar cells */}
        {Array.from({ length: totalCells }, (_, i) => {
          const dayNum = i - startOffset + 1
          const isCurrentMonth = dayNum >= 1 && dayNum <= daysInMonth
          const dayIssues = isCurrentMonth ? (issuesByDay[dayNum.toString()] || []) : []
          const isPast = isCurrentMonth && new Date(year, month, dayNum) < new Date(today.getFullYear(), today.getMonth(), today.getDate())

          return (
            <div
              key={i}
              className={cn(
                "min-h-[100px] p-1 border-b border-r border-border",
                !isCurrentMonth && "bg-[#0A0A0A]/50",
                isCurrentMonth && isToday(dayNum) && "bg-[#FF9900]/5 ring-1 ring-inset ring-[#FF9900]/30"
              )}
            >
              {isCurrentMonth && (
                <>
                  <div className={cn(
                    "text-xs font-medium mb-1 px-1",
                    isToday(dayNum) ? "text-[#FF9900]" : isPast ? "text-muted-foreground/50" : "text-muted-foreground"
                  )}>
                    {dayNum}
                  </div>
                  <div className="space-y-0.5">
                    {dayIssues.slice(0, 3).map(issue => {
                      const stateStyle = getStateStyle(issue.state)
                      return (
                        <div
                          key={issue.id}
                          className="px-1 py-0.5 text-[10px] rounded cursor-pointer hover:brightness-125 truncate"
                          style={{ backgroundColor: stateStyle.bg, color: stateStyle.color }}
                          onClick={() => onIssueClick(issue)}
                          title={`${issue.identifier}: ${issue.title}`}
                        >
                          <span className="font-mono">{issue.identifier}</span>{' '}
                          {issue.title}
                        </div>
                      )
                    })}
                    {dayIssues.length > 3 && (
                      <div className="text-[10px] text-muted-foreground px-1">
                        +{dayIssues.length - 3} more
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Main Page Component
export function Projects() {
  const [viewMode, setViewMode] = useState<ViewMode>('board')
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null)
  const [activeDragIssue, setActiveDragIssue] = useState<Issue | null>(null)

  // Project tabs
  const [selectedProject, setSelectedProject] = useState<number | null>(null)

  // Filters (simplified)
  const [stateFilter, setStateFilter] = useState<IssueState | null>(null)
  const [priorityFilter, setPriorityFilter] = useState<IssuePriority | null>(null)
  const [labelFilter, setLabelFilter] = useState<number[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  const { projects, loading: projectsLoading } = useProjects()
  const { labels: allLabels } = useLabels()
  const { issues, loading: issuesLoading, updateIssue, createIssue, setIssues } = useIssues({
    project: selectedProject || undefined,
    state: stateFilter || undefined,
    priority: priorityFilter || undefined,
    search: searchQuery || undefined,
    labels: labelFilter.length > 0 ? labelFilter : undefined,
    topLevel: viewMode === 'board' || viewMode === 'list' ? true : undefined,
    // Calendar shows all issues (including children) that have due dates
  })

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Group issues by state, sorted by position (manual ordering)
  const issuesByState = useMemo(() => {
    const grouped: Record<IssueState, Issue[]> = {
      backlog: [],
      scheduled: [],
      todo: [],
      in_progress: [],
      testing: [],
      done: [],
      cancelled: [],
    }
    const sortedIssues = [...issues].sort((a, b) => {
      if (a.position !== b.position) {
        return a.position - b.position
      }
      return a.createdAt - b.createdAt
    })
    for (const issue of sortedIssues) {
      grouped[issue.state].push(issue)
    }
    return grouped
  }, [issues])

  // Count issues per project (for tab badges)
  const projectIssueCounts = useMemo(() => {
    const counts: Record<number, number> = {}
    for (const issue of issues) {
      counts[issue.projectId] = (counts[issue.projectId] || 0) + 1
    }
    return counts
  }, [issues])

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    const issue = issues.find((i) => i.id === active.id)
    if (issue) {
      setActiveDragIssue(issue)
    }
  }

  const calculateNewPosition = (
    targetIssues: Issue[],
    overIssueId: number | null,
    activeIssueId: number
  ): number => {
    const otherIssues = targetIssues.filter((i) => i.id !== activeIssueId)

    if (otherIssues.length === 0) return 0

    if (overIssueId === null) {
      const lastIssue = otherIssues[otherIssues.length - 1]
      return lastIssue.position + 1000
    }

    const overIndex = otherIssues.findIndex((i) => i.id === overIssueId)
    if (overIndex === -1) {
      return otherIssues[otherIssues.length - 1]?.position + 1000 || 0
    }

    if (overIndex === 0) {
      return otherIssues[0].position - 1000
    }

    const prevIssue = otherIssues[overIndex - 1]
    const nextIssue = otherIssues[overIndex]
    return (prevIssue.position + nextIssue.position) / 2
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event

    if (!over) return

    const activeId = active.id as number
    const overId = over.id as number | string

    const activeIssue = issues.find((i) => i.id === activeId)
    if (!activeIssue) return

    const overColumn = STATE_COLUMNS.find((col) => col.id === overId)
    if (overColumn) {
      if (activeIssue.state !== overColumn.id) {
        const targetIssues = issuesByState[overColumn.id]
        const newPosition = calculateNewPosition(targetIssues, null, activeId)

        setIssues((prev) =>
          prev.map((i) =>
            i.id === activeId
              ? { ...i, state: overColumn.id, position: newPosition }
              : i
          )
        )
      }
    } else if (typeof overId === 'string' && overId.endsWith('-bottom')) {
      const columnId = overId.replace('-bottom', '') as IssueState
      const targetIssues = issuesByState[columnId]

      const currentIndex = targetIssues.findIndex(i => i.id === activeId)
      const isLastInColumn = currentIndex === targetIssues.length - 1

      if (activeIssue.state !== columnId || !isLastInColumn) {
        const newPosition = calculateNewPosition(targetIssues, null, activeId)

        setIssues((prev) =>
          prev.map((i) =>
            i.id === activeId
              ? { ...i, state: columnId, position: newPosition }
              : i
          )
        )
      }
    } else {
      const overIssue = issues.find((i) => i.id === overId)
      if (overIssue && overIssue.id !== activeIssue.id) {
        const targetIssues = issuesByState[overIssue.state]
        const newPosition = calculateNewPosition(targetIssues, overIssue.id, activeId)

        setIssues((prev) =>
          prev.map((i) =>
            i.id === activeId
              ? { ...i, state: overIssue.state, position: newPosition }
              : i
          )
        )
      }
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveDragIssue(null)

    if (!over) return

    const activeId = active.id as number
    const overId = over.id as number | string

    const activeIssue = issues.find((i) => i.id === activeId)
    if (!activeIssue) return

    const overColumn = STATE_COLUMNS.find((col) => col.id === overId)
    if (overColumn) {
      await updateIssue(activeId, {
        state: overColumn.id,
        position: activeIssue.position
      })
    } else if (typeof overId === 'string' && overId.endsWith('-bottom')) {
      const columnId = overId.replace('-bottom', '') as IssueState
      await updateIssue(activeId, {
        state: columnId,
        position: activeIssue.position
      })
    } else {
      const overIssue = issues.find((i) => i.id === overId)
      if (overIssue) {
        await updateIssue(activeId, {
          state: overIssue.state,
          position: activeIssue.position
        })
      }
    }
  }

  const isLoading = projectsLoading || issuesLoading

  return (
    <div className="flex flex-col h-full">
      {/* Header with Project Tabs */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border">
        <h1 className="text-xl font-semibold">Projects</h1>
        <CreateIssueDialog
          projects={projects}
          onCreate={createIssue}
          defaultProjectId={selectedProject || undefined}
        />
      </div>

      {/* Project Tabs */}
      <div className="px-6 py-2 border-b border-border bg-[#1A1A1A]/30">
        <div className="flex items-center gap-1 overflow-x-auto">
          <button
            className={cn(
              'px-3 py-1.5 text-sm rounded-md transition-colors whitespace-nowrap',
              selectedProject === null
                ? 'bg-[#FF9900]/20 text-[#FF9900] font-medium'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
            onClick={() => setSelectedProject(null)}
          >
            All
            <span className="ml-1.5 text-xs opacity-60">{issues.length}</span>
          </button>
          {projects.map((project) => (
            <button
              key={project.id}
              className={cn(
                'px-3 py-1.5 text-sm rounded-md transition-colors whitespace-nowrap flex items-center gap-2',
                selectedProject === project.id
                  ? 'bg-[#FF9900]/20 text-[#FF9900] font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
              onClick={() => setSelectedProject(
                selectedProject === project.id ? null : project.id
              )}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: project.color }}
              />
              {project.identifier}
              {selectedProject === null && projectIssueCounts[project.id] && (
                <span className="text-xs opacity-60">{projectIssueCounts[project.id]}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Simplified Filter Bar */}
      <div className="flex items-center gap-3 px-6 py-2 border-b border-border bg-[#1A1A1A]/50">
        <Select
          value={priorityFilter || 'all'}
          onValueChange={(v) =>
            setPriorityFilter(v === 'all' ? null : (v as IssuePriority))
          }
        >
          <SelectTrigger className="w-32 h-8 text-sm">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            {(['critical', 'urgent', 'high', 'medium', 'low'] as IssuePriority[]).map((p) => (
              <SelectItem key={p} value={p}>
                {PRIORITY_CONFIG[p].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={stateFilter || 'all'}
          onValueChange={(v) => setStateFilter(v === 'all' ? null : (v as IssueState))}
        >
          <SelectTrigger className="w-32 h-8 text-sm">
            <SelectValue placeholder="State" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All States</SelectItem>
            {STATE_COLUMNS.map((col) => (
              <SelectItem key={col.id} value={col.id}>
                {col.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <LabelFilterDropdown
          labels={allLabels}
          selected={labelFilter}
          onChange={setLabelFilter}
        />

        <div className="flex-1" />

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search issues..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-56 h-8 pl-9 text-sm"
          />
        </div>

        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
          <TabsList className="bg-[#1A1A1A] h-8">
            <TabsTrigger value="board" className="data-[state=active]:bg-[#FF9900]/20 h-7 text-xs px-2">
              <LayoutGrid className="w-3.5 h-3.5 mr-1" />
              Board
            </TabsTrigger>
            <TabsTrigger value="list" className="data-[state=active]:bg-[#FF9900]/20 h-7 text-xs px-2">
              <List className="w-3.5 h-3.5 mr-1" />
              List
            </TabsTrigger>
            <TabsTrigger value="calendar" className="data-[state=active]:bg-[#FF9900]/20 h-7 text-xs px-2">
              <Calendar className="w-3.5 h-3.5 mr-1" />
              Calendar
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-muted-foreground">Loading...</div>
          </div>
        ) : viewMode === 'board' ? (
          // Board View (Kanban) with DnD
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div className="flex h-full overflow-x-auto p-4 gap-4">
              {STATE_COLUMNS.map((column) => (
                <DroppableColumn
                  key={column.id}
                  column={column}
                  issues={issuesByState[column.id]}
                  onIssueClick={setSelectedIssue}
                />
              ))}
            </div>

            <DragOverlay>
              {activeDragIssue ? (
                <IssueCard issue={activeDragIssue} />
              ) : null}
            </DragOverlay>
          </DndContext>
        ) : viewMode === 'list' ? (
          // List View with expandable parent/child rows
          <div className="h-full overflow-auto p-4">
            <Card className="border-border">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#1A1A1A] text-muted-foreground">
                    <tr>
                      <th className="text-left p-3 font-medium w-28">ID</th>
                      <th className="text-left p-3 font-medium">Title</th>
                      <th className="text-left p-3 font-medium w-24">State</th>
                      <th className="text-left p-3 font-medium w-24">Priority</th>
                      <th className="text-left p-3 font-medium w-24">Type</th>
                      <th className="text-left p-3 font-medium w-24">Project</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {issues.map((issue) => (
                      <ExpandableIssueRow
                        key={issue.id}
                        issue={issue}
                        onClick={setSelectedIssue}
                      />
                    ))}
                  </tbody>
                </table>
                {issues.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    No issues found
                  </div>
                )}
              </div>
            </Card>
          </div>
        ) : (
          // Calendar View
          <CalendarView issues={issues} onIssueClick={setSelectedIssue} />
        )}
      </div>

      {/* Issue Detail Panel */}
      <IssueDetailPanel
        issue={selectedIssue}
        onClose={() => setSelectedIssue(null)}
        onUpdate={updateIssue}
        projects={projects}
        allLabels={allLabels}
        onCreateSubIssue={createIssue}
        onSelectIssue={setSelectedIssue}
        onUpdateLabels={async (issueId, labelIds) => {
          await fetch(`/api/issues/${issueId}/labels`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ labelIds }),
          })
        }}
      />

      {/* Overlay for detail panel */}
      {selectedIssue && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setSelectedIssue(null)}
        />
      )}
    </div>
  )
}
