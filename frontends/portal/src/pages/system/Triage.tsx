import { useEffect, useState } from 'react'
import {
  Plus,
  Check,
  Archive,
  Clock,
  MessageSquare,
  Eye,
  Lightbulb,
  Inbox,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

// Types
interface TriageItem {
  id: number
  title: string
  description: string | null
  source: string | null
  processed: boolean
  issueId: number | null
  snoozedUntil: number | null
  labels: string[]
  createdAt: number
}

interface Project {
  id: number
  identifier: string
  name: string
  color: string
}

interface Cycle {
  id: number
  name: string
}

type IssuePriority = 'urgent' | 'high' | 'medium' | 'low'
type ViewMode = 'inbox' | 'processed'

const SOURCE_ICONS: Record<string, React.ReactNode> = {
  conversation: <MessageSquare className="w-4 h-4" />,
  observation: <Eye className="w-4 h-4" />,
  idea: <Lightbulb className="w-4 h-4" />,
  manual: <MessageSquare className="w-4 h-4" />,
  audit: <Eye className="w-4 h-4" />,
  suggestion: <Lightbulb className="w-4 h-4" />,
}

const SOURCE_LABELS: Record<string, string> = {
  conversation: 'Conversation',
  observation: 'Observation',
  idea: 'Idea',
  manual: 'Manual',
  audit: 'Audit',
  suggestion: 'Suggestion',
}

const LABEL_COLORS: Record<string, string> = {
  audit: 'bg-orange-500/20 text-orange-400',
  suggestion: 'bg-purple-500/20 text-purple-400',
  security: 'bg-red-500/20 text-red-400',
  performance: 'bg-blue-500/20 text-blue-400',
  outdated: 'bg-gray-500/20 text-gray-400',
  consistency: 'bg-cyan-500/20 text-cyan-400',
  'best-practices': 'bg-emerald-500/20 text-emerald-400',
  logs: 'bg-violet-500/20 text-violet-400',
  bug: 'bg-red-500/20 text-red-400',
  enhancement: 'bg-blue-500/20 text-blue-400',
}

// Hooks
function useTriage(processed: boolean = false) {
  const [items, setItems] = useState<TriageItem[]>([])
  const [loading, setLoading] = useState(true)

  const fetchItems = () => {
    setLoading(true)
    fetch(`/api/triage?processed=${processed}`)
      .then((res) => res.json())
      .then((data) => {
        setItems(data.items || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    fetchItems()
  }, [processed])

  const createItem = async (item: { title: string; description?: string; source?: string }) => {
    const res = await fetch('/api/triage', {
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

  const convertToIssue = async (
    triageId: number,
    data: { projectId: number; priority: IssuePriority; type: string; cycleId?: number }
  ) => {
    const res = await fetch(`/api/triage/${triageId}/convert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (res.ok) {
      fetchItems()
      return await res.json()
    }
    return null
  }

  const updateItem = async (id: number, updates: { processed?: boolean; snoozedUntil?: number | null }) => {
    const res = await fetch(`/api/triage/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    if (res.ok) {
      fetchItems()
      return true
    }
    return false
  }

  return { items, loading, createItem, convertToIssue, updateItem, refetch: fetchItems }
}

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

// Components
function CreateTriageDialog({ onCreate }: { onCreate: (item: { title: string; description?: string }) => Promise<boolean> }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!title) return
    setLoading(true)
    const success = await onCreate({ title, description })
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
          New Idea
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[525px] bg-[#1A1A1A] border-border">
        <DialogHeader>
          <DialogTitle>Add New Idea</DialogTitle>
          <DialogDescription>Quickly capture an idea or feature request.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Add workout tracking dashboard"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add more details..."
              className="min-h-[100px]"
            />
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
            {loading ? 'Adding...' : 'Add Idea'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ConvertDialog({
  item,
  projects,
  cycles,
  onConvert,
  onClose,
}: {
  item: TriageItem | null
  projects: Project[]
  cycles: Cycle[]
  onConvert: (triageId: number, data: { projectId: number; priority: IssuePriority; type: string; cycleId?: number }) => Promise<{ issueId: number; identifier: string } | null>
  onClose: () => void
}) {
  const [projectId, setProjectId] = useState<number>(projects[0]?.id || 0)
  const [priority, setPriority] = useState<IssuePriority>('medium')
  const [type, setType] = useState('feature')
  const [cycleId, setCycleId] = useState<number | undefined>()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ issueId: number; identifier: string } | null>(null)

  useEffect(() => {
    if (item && projects.length > 0 && !projectId) {
      setProjectId(projects[0].id)
    }
  }, [item, projects])

  if (!item) return null

  const handleConvert = async () => {
    if (!projectId) return
    setLoading(true)
    const res = await onConvert(item.id, { projectId, priority, type, cycleId })
    setLoading(false)
    if (res) {
      setResult(res)
    }
  }

  const handleClose = () => {
    setResult(null)
    onClose()
  }

  return (
    <Dialog open={!!item} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[525px] bg-[#1A1A1A] border-border">
        {!result ? (
          <>
            <DialogHeader>
              <DialogTitle>Convert to Issue</DialogTitle>
              <DialogDescription>Create an issue from this idea.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="bg-muted/50 p-3 rounded-lg">
                <div className="font-medium">{item.title}</div>
                {item.description && (
                  <div className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {item.description}
                  </div>
                )}
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
                      <SelectItem value="urgent">Urgent</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Cycle</Label>
                  <Select
                    value={cycleId?.toString() || 'none'}
                    onValueChange={(v) => setCycleId(v === 'none' ? undefined : Number(v))}
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
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleConvert}
                disabled={!projectId || loading}
                className="bg-[#FF9900] hover:bg-[#FF9900]/90 text-black"
              >
                {loading ? 'Creating...' : 'Convert to Issue'}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Issue Created!</DialogTitle>
              <DialogDescription>
                The idea has been converted to issue <strong>{result.identifier}</strong>.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <div className="flex items-center justify-center p-6 bg-green-500/10 rounded-lg">
                <Check className="w-12 h-12 text-green-500" />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleClose} className="w-full">
                Done
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function SnoozeDropdown({
  itemId,
  onSnooze,
}: {
  itemId: number
  onSnooze: (id: number, until: number) => Promise<boolean>
}) {
  const [open, setOpen] = useState(false)

  const durations = [
    { label: '1 day', value: 1 },
    { label: '1 week', value: 7 },
    { label: '1 month', value: 30 },
  ]

  const handleSnooze = async (days: number) => {
    const until = Date.now() + days * 24 * 60 * 60 * 1000
    await onSnooze(itemId, until)
    setOpen(false)
  }

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => setOpen(!open)}
      >
        <Clock className="w-4 h-4" />
      </Button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-50 mt-1 w-32 bg-[#1A1A1A] border border-border rounded-md shadow-lg">
            {durations.map((d) => (
              <button
                key={d.value}
                className="w-full px-3 py-2 text-sm text-left hover:bg-muted first:rounded-t-md last:rounded-b-md"
                onClick={() => handleSnooze(d.value)}
              >
                {d.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function TriageItemCard({
  item,
  onConvert,
  onArchive,
  onSnooze,
}: {
  item: TriageItem
  onConvert: (item: TriageItem) => void
  onArchive: (id: number) => void
  onSnooze: (id: number, until: number) => Promise<boolean>
}) {
  const sourceIcon = item.source ? SOURCE_ICONS[item.source] || <MessageSquare className="w-4 h-4" /> : null
  const sourceLabel = item.source ? SOURCE_LABELS[item.source] || item.source : 'Unknown'

  return (
    <Card className="hover:border-[#FF9900]/50 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h4 className="font-medium truncate">{item.title}</h4>
              {sourceIcon && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                  {sourceIcon}
                  {sourceLabel}
                </span>
              )}
              {item.labels?.map((label) => (
                <span
                  key={label}
                  className={cn(
                    'inline-flex items-center text-xs px-2 py-0.5 rounded',
                    LABEL_COLORS[label] || 'bg-muted text-muted-foreground'
                  )}
                >
                  {label}
                </span>
              ))}
            </div>
            {item.description && (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {item.description}
              </p>
            )}
            <div className="text-xs text-muted-foreground mt-2">
              {new Date(item.createdAt).toLocaleDateString()}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-green-500 hover:text-green-400 hover:bg-green-500/10"
              onClick={() => onConvert(item)}
              title="Convert to issue"
            >
              <Check className="w-4 h-4" />
            </Button>
            <SnoozeDropdown
              itemId={item.id}
              onSnooze={onSnooze}
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => onArchive(item.id)}
              title="Archive"
            >
              <Archive className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center">
      <Inbox className="w-16 h-16 text-muted-foreground mb-4" />
      <h3 className="text-lg font-medium mb-2">Inbox is empty</h3>
      <p className="text-muted-foreground mb-4 max-w-md">
        All ideas have been processed. Great job! Add a new idea to get started.
      </p>
      <Button onClick={onNew} className="bg-[#FF9900] hover:bg-[#FF9900]/90 text-black">
        <Plus className="w-4 h-4 mr-2" />
        Add New Idea
      </Button>
    </div>
  )
}

// Main Page Component
export function Triage() {
  const [viewMode, setViewMode] = useState<ViewMode>('inbox')
  const [convertItem, setConvertItem] = useState<TriageItem | null>(null)

  const { items, loading, createItem, convertToIssue, updateItem } = useTriage(viewMode === 'processed')
  const { projects } = useProjects()
  const { cycles } = useCycles()

  const handleArchive = async (id: number) => {
    await updateItem(id, { processed: true })
  }

  const handleSnooze = async (id: number, until: number) => {
    return await updateItem(id, { snoozedUntil: until })
  }

  const handleConvert = async (
    triageId: number,
    data: { projectId: number; priority: IssuePriority; type: string; cycleId?: number }
  ) => {
    return await convertToIssue(triageId, data)
  }

  const isLoading = loading

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold">Triage Inbox</h1>
          <div className="flex items-center gap-1 bg-[#1A1A1A] rounded-lg p-1">
            <button
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                viewMode === 'inbox'
                  ? 'bg-[#FF9900]/20 text-[#FF9900]'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              onClick={() => setViewMode('inbox')}
            >
              Inbox
            </button>
            <button
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                viewMode === 'processed'
                  ? 'bg-[#FF9900]/20 text-[#FF9900]'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              onClick={() => setViewMode('processed')}
            >
              Processed
            </button>
          </div>
        </div>
        <CreateTriageDialog onCreate={createItem} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-muted-foreground">Loading...</div>
          </div>
        ) : items.length === 0 ? (
          <EmptyState onNew={() => document.querySelector<HTMLButtonElement>('button[data-state="closed"]')?.click()} />
        ) : (
          <div className="space-y-3 max-w-3xl">
            {items.map((item) => (
              <TriageItemCard
                key={item.id}
                item={item}
                onConvert={setConvertItem}
                onArchive={handleArchive}
                onSnooze={handleSnooze}
              />
            ))}
          </div>
        )}
      </div>

      {/* Convert Dialog */}
      <ConvertDialog
        item={convertItem}
        projects={projects}
        cycles={cycles}
        onConvert={handleConvert}
        onClose={() => setConvertItem(null)}
      />
    </div>
  )
}
