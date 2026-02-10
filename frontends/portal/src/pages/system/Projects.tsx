import { useEffect, useMemo, useState } from 'react'
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

interface Cycle {
  id: number
  name: string
  status: string
  startDate: number
  endDate: number
  createdAt: number
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
  projectId: number
  cycleId: number | null
  position: number
  createdBy: string
  createdAt: number
  updatedAt: number
  project: { identifier: string; color: string } | null
  cycle: { name: string } | null
  labels: Label[]
}

type IssueState = 'backlog' | 'todo' | 'in_progress' | 'testing' | 'done' | 'canceled'
type IssuePriority = 'critical' | 'urgent' | 'high' | 'medium' | 'low'
type ViewMode = 'board' | 'list'

const STATE_COLUMNS: { id: IssueState; label: string }[] = [
  { id: 'backlog', label: 'Backlog' },
  { id: 'todo', label: 'Todo' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'testing', label: 'Testing' },
  { id: 'done', label: 'Done' },
  { id: 'canceled', label: 'Canceled' },
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

function useCycles() {
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/cycles')
      .then((res) => res.json())
      .then((data) => {
        setCycles(data.cycles || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  return { cycles, loading }
}

function useIssues(filters: {
  project?: number
  cycle?: number
  state?: IssueState
  priority?: IssuePriority
  search?: string
}) {
  const [issues, setIssues] = useState<Issue[]>([])
  const [loading, setLoading] = useState(true)

  const fetchIssues = () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filters.project) params.set('project', String(filters.project))
    if (filters.cycle) params.set('cycle', String(filters.cycle))
    if (filters.state) params.set('state', filters.state)
    if (filters.priority) params.set('priority', filters.priority)
    if (filters.search) params.set('search', filters.search)

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
  }, [filters.project, filters.cycle, filters.state, filters.priority, filters.search])

  const updateIssue = async (id: number, updates: Partial<Issue>) => {
    const res = await fetch(`/api/issues/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
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
  cycles,
}: {
  issue: Issue | null
  onClose: () => void
  onUpdate: (id: number, updates: Partial<Issue>) => void
  cycles: Cycle[]
}) {
  const [editedIssue, setEditedIssue] = useState<Partial<Issue>>({})

  useEffect(() => {
    if (issue) {
      setEditedIssue({
        title: issue.title,
        description: issue.description,
        priority: issue.priority,
        state: issue.state,
        cycleId: issue.cycleId,
      })
    }
  }, [issue])

  if (!issue) return null

  const handleSave = () => {
    onUpdate(issue.id, editedIssue)
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
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
            <Label className="text-xs text-muted-foreground">Cycle</Label>
            <Select
              value={editedIssue.cycleId?.toString() || 'none'}
              onValueChange={(v) =>
                setEditedIssue({ ...editedIssue, cycleId: v === 'none' ? null : Number(v) })
              }
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="No cycle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No cycle</SelectItem>
                {cycles.map((cycle) => (
                  <SelectItem key={cycle.id} value={cycle.id.toString()}>
                    {cycle.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Labels</Label>
            <div className="flex flex-wrap gap-1 mt-1">
              {issue.labels.map((label) => (
                <LabelBadge key={label.id} name={label.name} color={label.color} />
              ))}
              {issue.labels.length === 0 && (
                <span className="text-sm text-muted-foreground">No labels</span>
              )}
            </div>
          </div>

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
  cycles,
  onCreate,
}: {
  projects: Project[]
  cycles: Cycle[]
  onCreate: (issue: {
    title: string
    description: string
    projectId: number
    priority: IssuePriority
    type: string
    cycleId?: number
  }) => Promise<boolean>
}) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [projectId, setProjectId] = useState<number>(projects[0]?.id || 0)
  const [priority, setPriority] = useState<IssuePriority>('medium')
  const [type, setType] = useState('feature')
  const [cycleId, setCycleId] = useState<number | undefined>()
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!title || !projectId) return
    setLoading(true)
    const success = await onCreate({
      title,
      description,
      projectId,
      priority,
      type,
      cycleId,
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
        <Button className="bg-[#FF9900] hover:bg-[#FF9900]/90 text-black">
          <Plus className="w-4 h-4 mr-2" />
          New Issue
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[525px] bg-[#1A1A1A] border-border">
        <DialogHeader>
          <DialogTitle>Create New Issue</DialogTitle>
          <DialogDescription>Add a new issue to track your work.</DialogDescription>
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
          <div className="grid grid-cols-2 gap-4">
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
            <div className="grid gap-2">
              <Label>Cycle</Label>
              <Select
                value={cycleId?.toString() || 'none'}
                onValueChange={(v) =>
                  setCycleId(v === 'none' ? undefined : Number(v))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="No cycle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No cycle</SelectItem>
                  {cycles.map((cycle) => (
                    <SelectItem key={cycle.id} value={cycle.id.toString()}>
                      {cycle.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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

// Main Page Component
export function Projects() {
  const [viewMode, setViewMode] = useState<ViewMode>('board')
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null)
  const [activeDragIssue, setActiveDragIssue] = useState<Issue | null>(null)

  // Filters
  const [projectFilter, setProjectFilter] = useState<number | null>(null)
  const [cycleFilter, setCycleFilter] = useState<number | null>(null)
  const [stateFilter, setStateFilter] = useState<IssueState | null>(null)
  const [priorityFilter, setPriorityFilter] = useState<IssuePriority | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const { projects, loading: projectsLoading } = useProjects()
  const { cycles, loading: cyclesLoading } = useCycles()
  const { issues, loading: issuesLoading, updateIssue, createIssue, setIssues } = useIssues({
    project: projectFilter || undefined,
    cycle: cycleFilter || undefined,
    state: stateFilter || undefined,
    priority: priorityFilter || undefined,
    search: searchQuery || undefined,
  })

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // Start dragging after 5px movement
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
      todo: [],
      in_progress: [],
      testing: [],
      done: [],
      canceled: [],
    }
    // Sort all issues by position first, then createdAt as fallback
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

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    const issue = issues.find((i) => i.id === active.id)
    if (issue) {
      setActiveDragIssue(issue)
    }
  }

  // Calculate new position based on issues in target column
  const calculateNewPosition = (
    targetIssues: Issue[],
    overIssueId: number | null,
    activeIssueId: number
  ): number => {
    // Filter out the active issue from the list
    const otherIssues = targetIssues.filter((i) => i.id !== activeIssueId)

    if (otherIssues.length === 0) {
      // Empty column - start at 0
      return 0
    }

    if (overIssueId === null) {
      // Dropped at end - position after last issue
      const lastIssue = otherIssues[otherIssues.length - 1]
      return lastIssue.position + 1000
    }

    // Find position of issue we're dropping over
    const overIndex = otherIssues.findIndex((i) => i.id === overIssueId)
    if (overIndex === -1) {
      return otherIssues[otherIssues.length - 1]?.position + 1000 || 0
    }

    if (overIndex === 0) {
      // Dropped at top - position before first issue
      return otherIssues[0].position - 1000
    }

    // Dropped between two issues - position in the middle
    const prevIssue = otherIssues[overIndex - 1]
    const nextIssue = otherIssues[overIndex]
    return (prevIssue.position + nextIssue.position) / 2
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event

    if (!over) return

    const activeId = active.id as number
    const overId = over.id as number | string

    // Find the active issue
    const activeIssue = issues.find((i) => i.id === activeId)
    if (!activeIssue) return

    // Check if dragging over a column directly
    const overColumn = STATE_COLUMNS.find((col) => col.id === overId)
    if (overColumn) {
      // Moving to a different column
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
      // Dragging over a bottom drop zone
      const columnId = overId.replace('-bottom', '') as IssueState
      const targetIssues = issuesByState[columnId]
      
      // Only update if moving to different column or actually changing position
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
      // Dragging over an issue
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

    // Check if dropped on a column directly
    const overColumn = STATE_COLUMNS.find((col) => col.id === overId)
    if (overColumn) {
      // Update both state and position on server
      await updateIssue(activeId, { 
        state: overColumn.id, 
        position: activeIssue.position 
      })
    } else if (typeof overId === 'string' && overId.endsWith('-bottom')) {
      // Dropped on a bottom drop zone
      const columnId = overId.replace('-bottom', '') as IssueState
      await updateIssue(activeId, { 
        state: columnId, 
        position: activeIssue.position 
      })
    } else {
      // Dropped on an issue
      const overIssue = issues.find((i) => i.id === overId)
      if (overIssue) {
        await updateIssue(activeId, { 
          state: overIssue.state, 
          position: activeIssue.position 
        })
      }
    }
  }

  const isLoading = projectsLoading || cyclesLoading || issuesLoading

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold">Projects</h1>
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
            <TabsList className="bg-[#1A1A1A]">
              <TabsTrigger value="board" className="data-[state=active]:bg-[#FF9900]/20">
                <LayoutGrid className="w-4 h-4 mr-2" />
                Board
              </TabsTrigger>
              <TabsTrigger value="list" className="data-[state=active]:bg-[#FF9900]/20">
                <List className="w-4 h-4 mr-2" />
                List
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <CreateIssueDialog projects={projects} cycles={cycles} onCreate={createIssue} />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border bg-[#1A1A1A]/50">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Filter className="w-4 h-4" />
          <span className="text-sm">Filters:</span>
        </div>

        <Select
          value={cycleFilter?.toString() || 'all'}
          onValueChange={(v) => setCycleFilter(v === 'all' ? null : Number(v))}
        >
          <SelectTrigger className="w-36 h-8 text-sm">
            <Calendar className="w-3 h-3 mr-2" />
            <SelectValue placeholder="All Cycles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Cycles</SelectItem>
            {cycles.map((cycle) => (
              <SelectItem key={cycle.id} value={cycle.id.toString()}>
                {cycle.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={projectFilter?.toString() || 'all'}
          onValueChange={(v) => setProjectFilter(v === 'all' ? null : Number(v))}
        >
          <SelectTrigger className="w-36 h-8 text-sm">
            <SelectValue placeholder="All Projects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
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

        <Select
          value={stateFilter || 'all'}
          onValueChange={(v) => setStateFilter(v === 'all' ? null : (v as IssueState))}
        >
          <SelectTrigger className="w-32 h-8 text-sm">
            <SelectValue placeholder="All States" />
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

        <Select
          value={priorityFilter || 'all'}
          onValueChange={(v) =>
            setPriorityFilter(v === 'all' ? null : (v as IssuePriority))
          }
        >
          <SelectTrigger className="w-32 h-8 text-sm">
            <SelectValue placeholder="All Priorities" />
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

        <div className="flex-1" />

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search issues..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-64 h-8 pl-9 text-sm"
          />
        </div>
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
        ) : (
          // List View
          <div className="h-full overflow-auto p-4">
            <Card className="border-border">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#1A1A1A] text-muted-foreground">
                    <tr>
                      <th className="text-left p-3 font-medium w-24">ID</th>
                      <th className="text-left p-3 font-medium">Title</th>
                      <th className="text-left p-3 font-medium w-24">State</th>
                      <th className="text-left p-3 font-medium w-24">Priority</th>
                      <th className="text-left p-3 font-medium w-24">Type</th>
                      <th className="text-left p-3 font-medium w-32">Project</th>
                      <th className="text-left p-3 font-medium w-28">Cycle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {issues.map((issue) => (
                      <tr
                        key={issue.id}
                        className="hover:bg-[#1A1A1A]/50 cursor-pointer"
                        onClick={() => setSelectedIssue(issue)}
                      >
                        <td className="p-3 font-mono text-muted-foreground">
                          {issue.identifier}
                        </td>
                        <td className="p-3">
                          <div className="font-medium">{issue.title}</div>
                          {issue.labels.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {issue.labels.map((label) => (
                                <LabelBadge
                                  key={label.id}
                                  name={label.name}
                                  color={label.color}
                                />
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="p-3">
                          <span
                            className="inline-flex items-center px-2 py-0.5 text-xs rounded"
                            style={{
                              backgroundColor:
                                issue.state === 'done'
                                  ? '#10B98120'
                                  : issue.state === 'in_progress'
                                  ? '#3B82F620'
                                  : issue.state === 'testing'
                                  ? '#A855F720'
                                  : issue.state === 'canceled'
                                  ? '#6B728020'
                                  : '#EAB30820',
                              color:
                                issue.state === 'done'
                                  ? '#10B981'
                                  : issue.state === 'in_progress'
                                  ? '#3B82F6'
                                  : issue.state === 'testing'
                                  ? '#A855F7'
                                  : issue.state === 'canceled'
                                  ? '#6B7280'
                                  : '#EAB308',
                            }}
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
                            <ProjectBadge
                              identifier={issue.project.identifier}
                              color={issue.project.color}
                            />
                          )}
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {issue.cycle?.name || '-'}
                        </td>
                      </tr>
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
        )}
      </div>

      {/* Issue Detail Panel */}
      <IssueDetailPanel
        issue={selectedIssue}
        onClose={() => setSelectedIssue(null)}
        onUpdate={updateIssue}
        cycles={cycles}
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
