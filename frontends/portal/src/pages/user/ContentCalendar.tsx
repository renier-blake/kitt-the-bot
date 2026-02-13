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
  X,
  PenLine,
  Video,
  Linkedin,
  Mic,
  ExternalLink,
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
interface ContentProject {
  id: number
  identifier: string
  name: string
  description: string | null
  color: string
  createdAt: number
}

interface ContentLabel {
  id: number
  name: string
  color: string
}

interface ContentItem {
  id: number
  identifier: string
  title: string
  description: string | null
  contentType: ContentType
  topic: string | null
  angle: string | null
  hook: string | null
  script: string | null
  imageUrls: string | null
  state: ContentState
  priority: ContentPriority
  projectId: number | null
  position: number
  dueDate: number | null
  scheduledDate: number | null
  publishDate: number | null
  publishedUrl: string | null
  createdBy: string
  createdAt: number
  updatedAt: number
  project: { identifier: string; color: string } | null
  labels: ContentLabel[]
}

type ContentState = 'backlog' | 'todo' | 'review' | 'planned' | 'published' | 'archived'
type ContentType = 'blogpost' | 'loom_video' | 'linkedin_post' | 'podcast' | 'x_post'
type ContentPriority = 'critical' | 'urgent' | 'high' | 'medium' | 'low'
type ViewMode = 'board' | 'list' | 'calendar'

const STATE_COLUMNS: { id: ContentState; label: string }[] = [
  { id: 'backlog', label: 'Backlog' },
  { id: 'todo', label: 'To Do' },
  { id: 'review', label: 'Review' },
  { id: 'planned', label: 'Planned' },
  { id: 'published', label: 'Published' },
  { id: 'archived', label: 'Archived' },
]

const PRIORITY_CONFIG: Record<ContentPriority, { label: string; color: string; icon: React.ReactNode }> = {
  critical: { label: 'Critical', color: '#7F1D1D', icon: <AlertCircle className="w-3 h-3" /> },
  urgent: { label: 'Urgent', color: '#DC2626', icon: <AlertCircle className="w-3 h-3" /> },
  high: { label: 'High', color: '#F97316', icon: <ArrowUpCircle className="w-3 h-3" /> },
  medium: { label: 'Medium', color: '#EAB308', icon: <MinusCircle className="w-3 h-3" /> },
  low: { label: 'Low', color: '#22C55E', icon: <ArrowDownCircle className="w-3 h-3" /> },
}

const CONTENT_TYPE_CONFIG: Record<ContentType, { label: string; color: string; icon: React.ReactNode }> = {
  blogpost: { label: 'Blog Post', color: '#10B981', icon: <PenLine className="w-3 h-3" /> },
  loom_video: { label: 'Loom Video', color: '#8B5CF6', icon: <Video className="w-3 h-3" /> },
  linkedin_post: { label: 'LinkedIn', color: '#0077B5', icon: <Linkedin className="w-3 h-3" /> },
  podcast: { label: 'Podcast', color: '#EF4444', icon: <Mic className="w-3 h-3" /> },
  x_post: { label: 'X Post', color: '#a0a0a0', icon: <span className="text-[10px] font-bold leading-none">𝕏</span> },
}

const STATE_STYLE: Record<ContentState, { bg: string; color: string }> = {
  backlog: { bg: '#EAB30820', color: '#EAB308' },
  todo: { bg: '#F9731620', color: '#F97316' },
  review: { bg: '#A855F720', color: '#A855F7' },
  planned: { bg: '#3B82F620', color: '#3B82F6' },
  published: { bg: '#10B98120', color: '#10B981' },
  archived: { bg: '#6B728020', color: '#6B7280' },
}

// Hooks
function useContentProjects() {
  const [projects, setProjects] = useState<ContentProject[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/content/projects')
      .then((res) => res.json())
      .then((data) => {
        setProjects(data.projects || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  return { projects, loading }
}

function useContentLabels() {
  const [labels, setLabels] = useState<ContentLabel[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/content/labels')
      .then((res) => res.json())
      .then((data) => {
        setLabels(data.labels || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  return { labels, loading }
}

function LabelFilterDropdown({
  labels,
  selected,
  onChange,
}: {
  labels: ContentLabel[]
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
                    'w-4 h-4 rounded border flex items-center justify-center shrink-0',
                    selected.includes(label.id) ? 'bg-[#FF9900] border-[#FF9900]' : 'border-muted-foreground'
                  )}
                >
                  {selected.includes(label.id) && <span className="text-black text-xs">✓</span>}
                </div>
                <span
                  className="px-1.5 py-0.5 text-xs rounded-full truncate"
                  style={{ backgroundColor: `${label.color}20`, color: label.color }}
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

function useContentItems(filters: {
  project?: number
  state?: ContentState
  contentType?: ContentType
  priority?: ContentPriority
  search?: string
  labels?: number[]
}) {
  const [items, setItems] = useState<ContentItem[]>([])
  const [loading, setLoading] = useState(true)

  const fetchItems = () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filters.project) params.set('project', String(filters.project))
    if (filters.state) params.set('state', filters.state)
    if (filters.contentType) params.set('contentType', filters.contentType)
    if (filters.priority) params.set('priority', filters.priority)
    if (filters.search) params.set('search', filters.search)
    if (filters.labels && filters.labels.length > 0) {
      filters.labels.forEach((labelId) => params.append('labels', String(labelId)))
    }

    fetch(`/api/content/items?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        setItems(data.items || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    fetchItems()
  }, [filters.project, filters.state, filters.contentType, filters.priority, filters.search, filters.labels])

  const updateItem = async (id: number, updates: Partial<ContentItem>) => {
    const apiUpdates: Record<string, unknown> = {}
    if (updates.title !== undefined) apiUpdates.title = updates.title
    if (updates.description !== undefined) apiUpdates.description = updates.description
    if (updates.state !== undefined) apiUpdates.state = updates.state
    if (updates.priority !== undefined) apiUpdates.priority = updates.priority
    if (updates.contentType !== undefined) apiUpdates.contentType = updates.contentType
    if (updates.position !== undefined) apiUpdates.position = updates.position
    if (updates.topic !== undefined) apiUpdates.topic = updates.topic
    if (updates.angle !== undefined) apiUpdates.angle = updates.angle
    if (updates.hook !== undefined) apiUpdates.hook = updates.hook
    if (updates.script !== undefined) apiUpdates.script = updates.script
    if (updates.imageUrls !== undefined) apiUpdates.imageUrls = updates.imageUrls
    if (updates.dueDate !== undefined) apiUpdates.dueDate = updates.dueDate
    if (updates.scheduledDate !== undefined) apiUpdates.scheduledDate = updates.scheduledDate
    if (updates.publishDate !== undefined) apiUpdates.publishDate = updates.publishDate
    if (updates.publishedUrl !== undefined) apiUpdates.publishedUrl = updates.publishedUrl
    if ((updates as Record<string, unknown>).projectId !== undefined) apiUpdates.projectId = (updates as Record<string, unknown>).projectId

    const res = await fetch(`/api/content/items/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(apiUpdates),
    })
    if (res.ok) {
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...updates } : item)))
      return true
    }
    return false
  }

  const createItem = async (item: {
    title: string
    description?: string
    projectId?: number
    priority: ContentPriority
    contentType: ContentType
    topic?: string
    angle?: string
    hook?: string
  }) => {
    const res = await fetch('/api/content/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    })
    if (res.ok) {
      fetchItems()
      return true
    }
    return false
  }

  return { items, loading, updateItem, createItem, setItems }
}

// Badge Components
function PriorityBadge({ priority }: { priority: ContentPriority }) {
  const config = PRIORITY_CONFIG[priority] || {
    label: priority,
    color: '#6B7280',
    icon: <MinusCircle className="w-3 h-3" />,
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

function ContentTypeBadge({ contentType }: { contentType: ContentType }) {
  const config = CONTENT_TYPE_CONFIG[contentType] || { label: contentType, color: '#6B7280', icon: null }
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

// Sortable Content Card (Board view)
function SortableContentCard({
  item,
  onClick,
}: {
  item: ContentItem
  onClick: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, data: { item } })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

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
      className={cn('cursor-grab active:cursor-grabbing', isDragging && 'cursor-grabbing')}
    >
      <Card
        className={cn(
          'hover:border-[#FF9900]/50 transition-colors group select-none',
          isDragging && 'shadow-lg ring-2 ring-[#FF9900]/30'
        )}
        onClick={handleClick}
      >
        <CardContent className="p-3">
          <div className="flex items-start justify-between gap-2">
            <span className="text-xs text-muted-foreground font-mono">{item.identifier}</span>
            <ContentTypeBadge contentType={item.contentType} />
          </div>
          <h4 className="text-sm font-medium mt-1 line-clamp-2">{item.title}</h4>
          {item.topic && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{item.topic}</p>
          )}
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <PriorityBadge priority={item.priority} />
            {item.project && (
              <ProjectBadge identifier={item.project.identifier} color={item.project.color} />
            )}
          </div>
          {item.scheduledDate && (
            <div className="flex items-center gap-1 mt-2 text-xs text-[#3B82F6]">
              <Calendar className="w-3 h-3" />
              <span>
                {new Date(item.scheduledDate).toLocaleDateString('nl-NL', {
                  day: 'numeric',
                  month: 'short',
                })}
              </span>
            </div>
          )}
          {item.publishedUrl && (
            <div className="flex items-center gap-1 mt-1 text-xs text-[#10B981]">
              <ExternalLink className="w-3 h-3" />
              <span>Published</span>
            </div>
          )}
          {item.labels.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {item.labels.slice(0, 3).map((label) => (
                <LabelBadge key={label.id} name={label.name} color={label.color} />
              ))}
              {item.labels.length > 3 && (
                <span className="text-xs text-muted-foreground">+{item.labels.length - 3}</span>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// Static Content Card (drag overlay)
function ContentCardOverlay({ item }: { item: ContentItem }) {
  return (
    <Card className="shadow-lg ring-2 ring-[#FF9900]/30 rotate-2">
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <span className="text-xs text-muted-foreground font-mono">{item.identifier}</span>
          <ContentTypeBadge contentType={item.contentType} />
        </div>
        <h4 className="text-sm font-medium mt-1 line-clamp-2">{item.title}</h4>
        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          <PriorityBadge priority={item.priority} />
          {item.project && (
            <ProjectBadge identifier={item.project.identifier} color={item.project.color} />
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// Drop Zone at bottom of column
function DropZoneBottom({
  columnId,
  isOverColumn,
}: {
  columnId: ContentState
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
        'h-16 rounded-lg border-2 border-dashed transition-colors flex items-center justify-center text-sm text-muted-foreground',
        isOver || isOverColumn
          ? 'border-[#FF9900]/50 bg-[#FF9900]/10 text-[#FF9900]'
          : 'border-muted hover:border-muted-foreground/30'
      )}
    >
      {isOver || isOverColumn ? 'Drop here' : 'Drop here to add at bottom'}
    </div>
  )
}

// Droppable Column
function DroppableColumn({
  column,
  items,
  onItemClick,
}: {
  column: { id: ContentState; label: string }
  items: ContentItem[]
  onItemClick: (item: ContentItem) => void
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
            {items.length}
          </span>
        </div>
      </div>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={cn(
            'flex-1 overflow-y-auto space-y-2 min-h-0 rounded-lg p-2 transition-colors',
            isOver ? 'bg-[#FF9900]/10 ring-2 ring-[#FF9900]/30' : 'bg-muted/30'
          )}
        >
          {items.map((item) => (
            <SortableContentCard key={item.id} item={item} onClick={() => onItemClick(item)} />
          ))}
          <DropZoneBottom columnId={column.id} isOverColumn={isOver} />
        </div>
      </SortableContext>
    </div>
  )
}

// Detail Panel
function ContentDetailPanel({
  item,
  onClose,
  onUpdate,
  projects,
  allLabels,
  onUpdateLabels,
}: {
  item: ContentItem | null
  onClose: () => void
  onUpdate: (id: number, updates: Partial<ContentItem>) => void
  projects: ContentProject[]
  allLabels: ContentLabel[]
  onUpdateLabels: (itemId: number, labelIds: number[]) => Promise<void>
}) {
  const [edited, setEdited] = useState<Partial<ContentItem> & { projectId?: number | null }>({})
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
    if (item) {
      setEdited({
        title: item.title,
        description: item.description,
        contentType: item.contentType,
        topic: item.topic,
        angle: item.angle,
        hook: item.hook,
        script: item.script,
        imageUrls: item.imageUrls,
        priority: item.priority,
        state: item.state,
        projectId: item.projectId,
        dueDate: item.dueDate,
        scheduledDate: item.scheduledDate,
        publishDate: item.publishDate,
        publishedUrl: item.publishedUrl,
      })
      setSelectedLabelIds(item.labels.map((l) => l.id))
    }
  }, [item])

  if (!item) return null

  const handleSave = () => {
    const updates: Partial<ContentItem> & { projectId?: number | null } = { ...edited }
    onUpdate(item.id, updates)
    onClose()
  }

  return (
    <div
      className={cn(
        'fixed inset-y-0 right-0 w-96 bg-[#1A1A1A] border-l border-border shadow-2xl transform transition-transform duration-300 z-50',
        item ? 'translate-x-0' : 'translate-x-full'
      )}
    >
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground font-mono">{item.identifier}</span>
            {item.project && <ProjectBadge identifier={item.project.identifier} color={item.project.color} />}
            <ContentTypeBadge contentType={item.contentType} />
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground">Title</Label>
            <Input
              value={edited.title || ''}
              onChange={(e) => setEdited({ ...edited, title: e.target.value })}
              className="mt-1"
            />
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Description</Label>
            <Textarea
              value={edited.description || ''}
              onChange={(e) => setEdited({ ...edited, description: e.target.value })}
              className="mt-1 min-h-[80px]"
              placeholder="Korte beschrijving..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Content Type</Label>
              <Select
                value={edited.contentType}
                onValueChange={(v) => setEdited({ ...edited, contentType: v as ContentType })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(CONTENT_TYPE_CONFIG) as ContentType[]).map((type) => (
                    <SelectItem key={type} value={type}>
                      <span className="flex items-center gap-2">
                        {CONTENT_TYPE_CONFIG[type].icon}
                        {CONTENT_TYPE_CONFIG[type].label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Priority</Label>
              <Select
                value={edited.priority}
                onValueChange={(v) => setEdited({ ...edited, priority: v as ContentPriority })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(['critical', 'urgent', 'high', 'medium', 'low'] as ContentPriority[]).map((p) => (
                    <SelectItem key={p} value={p}>
                      {PRIORITY_CONFIG[p].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">State</Label>
              <Select
                value={edited.state}
                onValueChange={(v) => setEdited({ ...edited, state: v as ContentState })}
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
              <Label className="text-xs text-muted-foreground">Project</Label>
              <Select
                value={edited.projectId?.toString() || 'none'}
                onValueChange={(v) => setEdited({ ...edited, projectId: v === 'none' ? null : Number(v) })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No project</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id.toString()}>
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: project.color }} />
                        {project.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          <div>
            <Label className="text-xs text-muted-foreground">Topic / Onderwerp</Label>
            <Input
              value={edited.topic || ''}
              onChange={(e) => setEdited({ ...edited, topic: e.target.value })}
              className="mt-1"
              placeholder="Waar gaat het over?"
            />
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Angle / Invalshoek</Label>
            <Input
              value={edited.angle || ''}
              onChange={(e) => setEdited({ ...edited, angle: e.target.value })}
              className="mt-1"
              placeholder="Vanuit welk perspectief?"
            />
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Hook</Label>
            <Input
              value={edited.hook || ''}
              onChange={(e) => setEdited({ ...edited, hook: e.target.value })}
              className="mt-1"
              placeholder="Opening hook..."
            />
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Script / Content</Label>
            <Textarea
              value={edited.script || ''}
              onChange={(e) => setEdited({ ...edited, script: e.target.value })}
              className="mt-1 min-h-[160px] font-mono text-xs"
              placeholder="Het daadwerkelijke script, artikel of tekst..."
            />
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Image URLs (JSON array)</Label>
            <Textarea
              value={edited.imageUrls || ''}
              onChange={(e) => setEdited({ ...edited, imageUrls: e.target.value })}
              className="mt-1 min-h-[60px] font-mono text-xs"
              placeholder='["https://example.com/image.png"]'
            />
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Scheduled Date</Label>
              <Input
                type="date"
                value={edited.scheduledDate ? new Date(edited.scheduledDate).toISOString().split('T')[0] : ''}
                onChange={(e) => {
                  const dateValue = e.target.value
                  if (!dateValue) {
                    setEdited({ ...edited, scheduledDate: null })
                    return
                  }
                  const [year, month, day] = dateValue.split('-').map(Number)
                  const date = new Date(year, month - 1, day, 12, 0, 0)
                  setEdited({ ...edited, scheduledDate: date.getTime() })
                }}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Due Date</Label>
              <Input
                type="date"
                value={edited.dueDate ? new Date(edited.dueDate).toISOString().split('T')[0] : ''}
                onChange={(e) => {
                  const dateValue = e.target.value
                  if (!dateValue) {
                    setEdited({ ...edited, dueDate: null })
                    return
                  }
                  const [year, month, day] = dateValue.split('-').map(Number)
                  const date = new Date(year, month - 1, day, 12, 0, 0)
                  setEdited({ ...edited, dueDate: date.getTime() })
                }}
                className="mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Publish Date</Label>
              <Input
                type="date"
                value={edited.publishDate ? new Date(edited.publishDate).toISOString().split('T')[0] : ''}
                onChange={(e) => {
                  const dateValue = e.target.value
                  if (!dateValue) {
                    setEdited({ ...edited, publishDate: null })
                    return
                  }
                  const [year, month, day] = dateValue.split('-').map(Number)
                  const date = new Date(year, month - 1, day, 12, 0, 0)
                  setEdited({ ...edited, publishDate: date.getTime() })
                }}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Published URL</Label>
              <Input
                value={edited.publishedUrl || ''}
                onChange={(e) => setEdited({ ...edited, publishedUrl: e.target.value })}
                className="mt-1"
                placeholder="https://..."
              />
            </div>
          </div>

          <div ref={labelPickerRef} className="relative">
            <Label className="text-xs text-muted-foreground">Labels</Label>
            <div
              className="flex flex-wrap gap-1 mt-1 min-h-[32px] p-1.5 border border-border rounded-md cursor-pointer hover:border-muted-foreground/50"
              onClick={() => setShowLabelPicker(!showLabelPicker)}
            >
              {selectedLabelIds.length > 0 ? (
                allLabels
                  .filter((l) => selectedLabelIds.includes(l.id))
                  .map((label) => <LabelBadge key={label.id} name={label.name} color={label.color} />)
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
                        ? selectedLabelIds.filter((id) => id !== label.id)
                        : [...selectedLabelIds, label.id]
                      setSelectedLabelIds(newIds)
                      onUpdateLabels(item.id, newIds)
                    }}
                  >
                    <div
                      className={cn(
                        'w-4 h-4 rounded border flex items-center justify-center shrink-0',
                        selectedLabelIds.includes(label.id)
                          ? 'bg-[#FF9900] border-[#FF9900]'
                          : 'border-muted-foreground'
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

          <Separator />

          <div className="text-xs text-muted-foreground space-y-1">
            <div>Created by {item.createdBy}</div>
            <div>{new Date(item.createdAt).toLocaleString()}</div>
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

// Create Content Dialog
function CreateContentDialog({
  projects,
  onCreate,
  defaultProjectId,
}: {
  projects: ContentProject[]
  onCreate: (item: {
    title: string
    description?: string
    projectId?: number
    priority: ContentPriority
    contentType: ContentType
    topic?: string
    angle?: string
    hook?: string
  }) => Promise<boolean>
  defaultProjectId?: number
}) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [projectId, setProjectId] = useState<number | undefined>(defaultProjectId || projects[0]?.id)
  const [priority, setPriority] = useState<ContentPriority>('medium')
  const [contentType, setContentType] = useState<ContentType>('blogpost')
  const [topic, setTopic] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (defaultProjectId) setProjectId(defaultProjectId)
  }, [defaultProjectId])

  const handleSubmit = async () => {
    if (!title) return
    setLoading(true)
    const success = await onCreate({
      title,
      description: description || undefined,
      projectId,
      priority,
      contentType,
      topic: topic || undefined,
    })
    setLoading(false)
    if (success) {
      setOpen(false)
      setTitle('')
      setDescription('')
      setTopic('')
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-[#FF9900] hover:bg-[#FF9900]/90 text-black">
          <Plus className="w-4 h-4 mr-1" />
          New Content
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[525px] bg-[#1A1A1A] border-border">
        <DialogHeader>
          <DialogTitle>Create Content Item</DialogTitle>
          <DialogDescription>Add a new content idea to your calendar.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Content title"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="topic">Topic (optional)</Label>
            <Input
              id="topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Where is this about?"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description..."
              className="min-h-[80px]"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Content Type</Label>
              <Select value={contentType} onValueChange={(v) => setContentType(v as ContentType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(CONTENT_TYPE_CONFIG) as ContentType[]).map((type) => (
                    <SelectItem key={type} value={type}>
                      <span className="flex items-center gap-2">
                        {CONTENT_TYPE_CONFIG[type].icon}
                        {CONTENT_TYPE_CONFIG[type].label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Project</Label>
              <Select
                value={projectId?.toString() || 'none'}
                onValueChange={(v) => setProjectId(v === 'none' ? undefined : Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No project</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id.toString()}>
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: project.color }} />
                        {project.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Priority</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as ContentPriority)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(['critical', 'urgent', 'high', 'medium', 'low'] as ContentPriority[]).map((p) => (
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
            disabled={!title || loading}
            className="bg-[#FF9900] hover:bg-[#FF9900]/90 text-black"
          >
            {loading ? 'Creating...' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// List row
function ContentListRow({
  item,
  onClick,
}: {
  item: ContentItem
  onClick: (item: ContentItem) => void
}) {
  const stateStyle = STATE_STYLE[item.state] || STATE_STYLE.backlog

  return (
    <tr className="hover:bg-[#1A1A1A]/50 cursor-pointer" onClick={() => onClick(item)}>
      <td className="p-3 font-mono text-muted-foreground">{item.identifier}</td>
      <td className="p-3">
        <div className="flex items-center gap-2">
          <span className="font-medium">{item.title}</span>
        </div>
        {item.labels.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {item.labels.map((label) => (
              <LabelBadge key={label.id} name={label.name} color={label.color} />
            ))}
          </div>
        )}
      </td>
      <td className="p-3">
        <ContentTypeBadge contentType={item.contentType} />
      </td>
      <td className="p-3">
        <span
          className="inline-flex items-center px-2 py-0.5 text-xs rounded"
          style={{ backgroundColor: stateStyle.bg, color: stateStyle.color }}
        >
          {item.state.replace('_', ' ')}
        </span>
      </td>
      <td className="p-3">
        <PriorityBadge priority={item.priority} />
      </td>
      <td className="p-3">
        {item.project && <ProjectBadge identifier={item.project.identifier} color={item.project.color} />}
      </td>
      <td className="p-3 text-xs text-muted-foreground">
        {item.scheduledDate
          ? new Date(item.scheduledDate).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
          : '-'}
      </td>
    </tr>
  )
}

// Calendar View (groups by scheduledDate)
function ContentCalendarView({
  items,
  onItemClick,
}: {
  items: ContentItem[]
  onItemClick: (item: ContentItem) => void
}) {
  const [currentDate, setCurrentDate] = useState(new Date())

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startOffset = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1

  const daysInMonth = lastDay.getDate()
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7

  const itemsByDay = useMemo(() => {
    const map: Record<string, ContentItem[]> = {}
    for (const item of items) {
      if (!item.scheduledDate) continue
      const d = new Date(item.scheduledDate)
      if (d.getFullYear() === year && d.getMonth() === month) {
        const key = d.getDate().toString()
        if (!map[key]) map[key] = []
        map[key].push(item)
      }
    }
    return map
  }, [items, year, month])

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
          <Button variant="outline" size="sm" onClick={prevMonth}>
            ←
          </Button>
          <h2 className="text-lg font-semibold min-w-[200px] text-center">{monthName}</h2>
          <Button variant="outline" size="sm" onClick={nextMonth}>
            →
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={goToday}>
          Today
        </Button>
      </div>

      <div className="grid grid-cols-7 border border-border rounded-lg overflow-hidden">
        {weekDays.map((day) => (
          <div
            key={day}
            className="p-2 text-xs font-medium text-muted-foreground text-center bg-[#1A1A1A] border-b border-border"
          >
            {day}
          </div>
        ))}

        {Array.from({ length: totalCells }, (_, i) => {
          const dayNum = i - startOffset + 1
          const isCurrentMonth = dayNum >= 1 && dayNum <= daysInMonth
          const dayItems = isCurrentMonth ? itemsByDay[dayNum.toString()] || [] : []
          const isPast =
            isCurrentMonth &&
            new Date(year, month, dayNum) < new Date(today.getFullYear(), today.getMonth(), today.getDate())

          return (
            <div
              key={i}
              className={cn(
                'min-h-[100px] p-1 border-b border-r border-border',
                !isCurrentMonth && 'bg-[#0A0A0A]/50',
                isCurrentMonth && isToday(dayNum) && 'bg-[#FF9900]/5 ring-1 ring-inset ring-[#FF9900]/30'
              )}
            >
              {isCurrentMonth && (
                <>
                  <div
                    className={cn(
                      'text-xs font-medium mb-1 px-1',
                      isToday(dayNum)
                        ? 'text-[#FF9900]'
                        : isPast
                          ? 'text-muted-foreground/50'
                          : 'text-muted-foreground'
                    )}
                  >
                    {dayNum}
                  </div>
                  <div className="space-y-0.5">
                    {dayItems.slice(0, 3).map((item) => {
                      const typeConfig = CONTENT_TYPE_CONFIG[item.contentType]
                      return (
                        <div
                          key={item.id}
                          className="px-1 py-0.5 text-[10px] rounded cursor-pointer hover:brightness-125 truncate flex items-center gap-1"
                          style={{ backgroundColor: `${typeConfig.color}20`, color: typeConfig.color }}
                          onClick={() => onItemClick(item)}
                          title={`${item.identifier}: ${item.title}`}
                        >
                          {typeConfig.icon}
                          {item.title}
                        </div>
                      )
                    })}
                    {dayItems.length > 3 && (
                      <div className="text-[10px] text-muted-foreground px-1">+{dayItems.length - 3} more</div>
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
export function ContentCalendar() {
  const [viewMode, setViewMode] = useState<ViewMode>('board')
  const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null)
  const [activeDragItem, setActiveDragItem] = useState<ContentItem | null>(null)

  const [selectedProject, setSelectedProject] = useState<number | null>(null)
  const [stateFilter, setStateFilter] = useState<ContentState | null>(null)
  const [priorityFilter, setPriorityFilter] = useState<ContentPriority | null>(null)
  const [typeFilter, setTypeFilter] = useState<ContentType | null>(null)
  const [labelFilter, setLabelFilter] = useState<number[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  const { projects, loading: projectsLoading } = useContentProjects()
  const { labels: allLabels } = useContentLabels()
  const { items, loading: itemsLoading, updateItem, createItem, setItems } = useContentItems({
    project: selectedProject || undefined,
    state: stateFilter || undefined,
    contentType: typeFilter || undefined,
    priority: priorityFilter || undefined,
    search: searchQuery || undefined,
    labels: labelFilter.length > 0 ? labelFilter : undefined,
  })

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const itemsByState = useMemo(() => {
    const grouped: Record<ContentState, ContentItem[]> = {
      backlog: [],
      todo: [],
      review: [],
      planned: [],
      published: [],
      archived: [],
    }
    const sorted = [...items].sort((a, b) => {
      if (a.position !== b.position) return a.position - b.position
      return a.createdAt - b.createdAt
    })
    for (const item of sorted) {
      grouped[item.state].push(item)
    }
    return grouped
  }, [items])

  const projectItemCounts = useMemo(() => {
    const counts: Record<number, number> = {}
    for (const item of items) {
      if (item.projectId) {
        counts[item.projectId] = (counts[item.projectId] || 0) + 1
      }
    }
    return counts
  }, [items])

  const handleDragStart = (event: DragStartEvent) => {
    const item = items.find((i) => i.id === event.active.id)
    if (item) setActiveDragItem(item)
  }

  const calculateNewPosition = (targetItems: ContentItem[], overItemId: number | null, activeItemId: number): number => {
    const otherItems = targetItems.filter((i) => i.id !== activeItemId)
    if (otherItems.length === 0) return 0
    if (overItemId === null) return otherItems[otherItems.length - 1].position + 1000

    const overIndex = otherItems.findIndex((i) => i.id === overItemId)
    if (overIndex === -1) return otherItems[otherItems.length - 1]?.position + 1000 || 0
    if (overIndex === 0) return otherItems[0].position - 1000

    return (otherItems[overIndex - 1].position + otherItems[overIndex].position) / 2
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return

    const activeId = active.id as number
    const overId = over.id as number | string
    const activeItem = items.find((i) => i.id === activeId)
    if (!activeItem) return

    const overColumn = STATE_COLUMNS.find((col) => col.id === overId)
    if (overColumn) {
      if (activeItem.state !== overColumn.id) {
        const targetItems = itemsByState[overColumn.id]
        const newPosition = calculateNewPosition(targetItems, null, activeId)
        setItems((prev) => prev.map((i) => (i.id === activeId ? { ...i, state: overColumn.id, position: newPosition } : i)))
      }
    } else if (typeof overId === 'string' && overId.endsWith('-bottom')) {
      const columnId = overId.replace('-bottom', '') as ContentState
      const targetItems = itemsByState[columnId]
      const currentIndex = targetItems.findIndex((i) => i.id === activeId)
      const isLastInColumn = currentIndex === targetItems.length - 1

      if (activeItem.state !== columnId || !isLastInColumn) {
        const newPosition = calculateNewPosition(targetItems, null, activeId)
        setItems((prev) => prev.map((i) => (i.id === activeId ? { ...i, state: columnId, position: newPosition } : i)))
      }
    } else {
      const overItem = items.find((i) => i.id === overId)
      if (overItem && overItem.id !== activeItem.id) {
        const targetItems = itemsByState[overItem.state]
        const newPosition = calculateNewPosition(targetItems, overItem.id, activeId)
        setItems((prev) => prev.map((i) => (i.id === activeId ? { ...i, state: overItem.state, position: newPosition } : i)))
      }
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveDragItem(null)
    if (!over) return

    const activeId = active.id as number
    const overId = over.id as number | string
    const activeItem = items.find((i) => i.id === activeId)
    if (!activeItem) return

    const overColumn = STATE_COLUMNS.find((col) => col.id === overId)
    if (overColumn) {
      await updateItem(activeId, { state: overColumn.id, position: activeItem.position })
    } else if (typeof overId === 'string' && overId.endsWith('-bottom')) {
      const columnId = overId.replace('-bottom', '') as ContentState
      await updateItem(activeId, { state: columnId, position: activeItem.position })
    } else {
      const overItem = items.find((i) => i.id === overId)
      if (overItem) {
        await updateItem(activeId, { state: overItem.state, position: activeItem.position })
      }
    }
  }

  const isLoading = projectsLoading || itemsLoading

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border">
        <h1 className="text-xl font-semibold">Content Calendar</h1>
        <CreateContentDialog
          projects={projects}
          onCreate={createItem}
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
            <span className="ml-1.5 text-xs opacity-60">{items.length}</span>
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
              onClick={() => setSelectedProject(selectedProject === project.id ? null : project.id)}
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
              {project.identifier}
              {selectedProject === null && projectItemCounts[project.id] && (
                <span className="text-xs opacity-60">{projectItemCounts[project.id]}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-3 px-6 py-2 border-b border-border bg-[#1A1A1A]/50">
        <Select
          value={priorityFilter || 'all'}
          onValueChange={(v) => setPriorityFilter(v === 'all' ? null : (v as ContentPriority))}
        >
          <SelectTrigger className="w-32 h-8 text-sm">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            {(['critical', 'urgent', 'high', 'medium', 'low'] as ContentPriority[]).map((p) => (
              <SelectItem key={p} value={p}>
                {PRIORITY_CONFIG[p].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={stateFilter || 'all'}
          onValueChange={(v) => setStateFilter(v === 'all' ? null : (v as ContentState))}
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

        <Select
          value={typeFilter || 'all'}
          onValueChange={(v) => setTypeFilter(v === 'all' ? null : (v as ContentType))}
        >
          <SelectTrigger className="w-36 h-8 text-sm">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {(Object.keys(CONTENT_TYPE_CONFIG) as ContentType[]).map((type) => (
              <SelectItem key={type} value={type}>
                <span className="flex items-center gap-2">
                  {CONTENT_TYPE_CONFIG[type].icon}
                  {CONTENT_TYPE_CONFIG[type].label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <LabelFilterDropdown labels={allLabels} selected={labelFilter} onChange={setLabelFilter} />

        <div className="flex-1" />

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search content..."
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
                  items={itemsByState[column.id]}
                  onItemClick={setSelectedItem}
                />
              ))}
            </div>

            <DragOverlay>{activeDragItem ? <ContentCardOverlay item={activeDragItem} /> : null}</DragOverlay>
          </DndContext>
        ) : viewMode === 'list' ? (
          <div className="h-full overflow-auto p-4">
            <Card className="border-border">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#1A1A1A] text-muted-foreground">
                    <tr>
                      <th className="text-left p-3 font-medium w-28">ID</th>
                      <th className="text-left p-3 font-medium">Title</th>
                      <th className="text-left p-3 font-medium w-28">Type</th>
                      <th className="text-left p-3 font-medium w-24">State</th>
                      <th className="text-left p-3 font-medium w-24">Priority</th>
                      <th className="text-left p-3 font-medium w-24">Project</th>
                      <th className="text-left p-3 font-medium w-28">Scheduled</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {items.map((item) => (
                      <ContentListRow key={item.id} item={item} onClick={setSelectedItem} />
                    ))}
                  </tbody>
                </table>
                {items.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">No content items found</div>
                )}
              </div>
            </Card>
          </div>
        ) : (
          <ContentCalendarView items={items} onItemClick={setSelectedItem} />
        )}
      </div>

      {/* Detail Panel */}
      <ContentDetailPanel
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onUpdate={updateItem}
        projects={projects}
        allLabels={allLabels}
        onUpdateLabels={async (itemId, labelIds) => {
          await fetch(`/api/content/items/${itemId}/labels`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ labelIds }),
          })
        }}
      />

      {/* Overlay for detail panel */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setSelectedItem(null)} />
      )}
    </div>
  )
}
