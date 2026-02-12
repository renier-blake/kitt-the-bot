import { useState, useEffect, useMemo } from 'react'
import { Lock, Search, Loader2, Zap, Clock, X, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { api, type Skill } from '@/lib/api'

// ==========================================
// Skill Detail Panel
// ==========================================

function SkillDetailPanel({
  skill,
  onClose,
  onToggle,
}: {
  skill: Skill
  onClose: () => void
  onToggle: (id: string, enabled: boolean) => void
}) {
  const [content, setContent] = useState<string | null>(null)
  const [loadingContent, setLoadingContent] = useState(true)
  const isSystem = skill.skillType === 'system'

  useEffect(() => {
    setLoadingContent(true)
    setContent(null)
    api
      .getSkillContent(skill.id)
      .then((data) => setContent(data.content))
      .catch(() => setContent(null))
      .finally(() => setLoadingContent(false))
  }, [skill.id])

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-[480px] border-l border-border bg-card shadow-xl animate-in slide-in-from-right duration-200 flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 p-6 pb-4 border-b border-border">
        <div className="flex items-start gap-3 min-w-0">
          <span className="text-3xl shrink-0">{skill.icon || '📋'}</span>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold leading-tight">{skill.name}</h2>
            {skill.description && (
              <p className="text-sm text-muted-foreground mt-1">{skill.description}</p>
            )}
          </div>
        </div>
        <Button variant="ghost" size="icon" className="shrink-0" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Metadata */}
      <div className="p-6 pb-4 space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-xs uppercase tracking-wider text-muted-foreground">Type</span>
            <div className="mt-1 flex items-center gap-1.5">
              {isSystem ? (
                <><Lock className="h-3.5 w-3.5 text-muted-foreground" /><span>System</span></>
              ) : (
                <span>User</span>
              )}
            </div>
          </div>
          <div>
            <span className="text-xs uppercase tracking-wider text-muted-foreground">Execution</span>
            <div className="mt-1 flex items-center gap-1.5">
              {skill.execution === 'background' ? (
                <><Clock className="h-3.5 w-3.5" /><span>Background</span></>
              ) : (
                <><Zap className="h-3.5 w-3.5" /><span>Direct</span></>
              )}
            </div>
          </div>
          {skill.model && (
            <div>
              <span className="text-xs uppercase tracking-wider text-muted-foreground">Model</span>
              <div className="mt-1">
                <Badge variant="secondary" className="text-xs">{skill.model}</Badge>
              </div>
            </div>
          )}
          <div>
            <span className="text-xs uppercase tracking-wider text-muted-foreground">Status</span>
            <div className="mt-1">
              {!isSystem ? (
                <div className="flex items-center gap-2">
                  <Switch
                    checked={skill.enabled}
                    onCheckedChange={(checked) => onToggle(skill.id, checked)}
                  />
                  <span className="text-sm">{skill.enabled ? 'Enabled' : 'Disabled'}</span>
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">Always active</span>
              )}
            </div>
          </div>
        </div>

        {skill.triggers.length > 0 && (
          <div>
            <span className="text-xs uppercase tracking-wider text-muted-foreground">Triggers</span>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {skill.triggers.map((t) => (
                <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
              ))}
            </div>
          </div>
        )}

        {skill.modes.length > 0 && (
          <div>
            <span className="text-xs uppercase tracking-wider text-muted-foreground">Modes</span>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {skill.modes.map((m) => (
                <Badge key={m} variant="outline" className="text-xs">{m}</Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      <Separator />

      {/* SKILL.md Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">Skill Instructions</span>
        {loadingContent ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : content ? (
          <pre className="mt-3 text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap font-mono bg-muted/30 rounded-md p-4 overflow-x-auto">
            {content}
          </pre>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">No SKILL.md found</p>
        )}
      </div>
    </div>
  )
}

// ==========================================
// Skills Table Row
// ==========================================

function SkillRow({
  skill,
  isSelected,
  onClick,
  onToggle,
}: {
  skill: Skill
  isSelected: boolean
  onClick: () => void
  onToggle: (id: string, enabled: boolean) => void
}) {
  const isSystem = skill.skillType === 'system'

  return (
    <tr
      className={cn(
        'group cursor-pointer border-b border-border transition-colors hover:bg-muted/50',
        isSelected && 'bg-primary/5',
        !skill.enabled && 'opacity-50',
      )}
      onClick={onClick}
    >
      <td className="px-4 py-3 w-10">
        <span className="text-lg">{skill.icon || '📋'}</span>
      </td>
      <td className="px-4 py-3">
        <div className="font-medium text-sm">{skill.name}</div>
        {skill.description && (
          <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{skill.description}</div>
        )}
      </td>
      <td className="px-4 py-3 w-24">
        <Badge variant="outline" className="text-xs">
          {skill.execution === 'background' ? (
            <><Clock className="mr-1 h-3 w-3" />bg</>
          ) : (
            <><Zap className="mr-1 h-3 w-3" />direct</>
          )}
        </Badge>
      </td>
      <td className="px-4 py-3 w-20 text-center">
        {skill.model && (
          <Badge variant="secondary" className="text-xs">{skill.model}</Badge>
        )}
      </td>
      <td className="px-4 py-3 w-16 text-center" onClick={(e) => e.stopPropagation()}>
        {isSystem ? (
          <Lock className="h-4 w-4 text-muted-foreground mx-auto" />
        ) : (
          <Switch
            checked={skill.enabled}
            onCheckedChange={(checked) => onToggle(skill.id, checked)}
          />
        )}
      </td>
      <td className="px-4 py-3 w-8">
        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </td>
    </tr>
  )
}

// ==========================================
// Skills Page
// ==========================================

export function Skills() {
  const [skills, setSkills] = useState<Skill[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null)

  const fetchSkills = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await api.getSkills()
      setSkills(data.skills)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load skills')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSkills()
  }, [])

  const handleToggle = async (id: string, enabled: boolean) => {
    setSkills((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled } : s))
    )
    setSelectedSkill((prev) =>
      prev?.id === id ? { ...prev, enabled } : prev
    )

    try {
      await api.updateSkill(id, { enabled })
    } catch {
      setSkills((prev) =>
        prev.map((s) => (s.id === id ? { ...s, enabled: !enabled } : s))
      )
      setSelectedSkill((prev) =>
        prev?.id === id ? { ...prev, enabled: !enabled } : prev
      )
    }
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return skills
    const q = search.toLowerCase()
    return skills.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.description?.toLowerCase().includes(q) ||
        s.triggers.some((t) => t.toLowerCase().includes(q))
    )
  }, [skills, search])

  const systemSkills = filtered.filter((s) => s.skillType === 'system')
  const userSkills = filtered.filter((s) => s.skillType === 'user')

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
        {error}
      </div>
    )
  }

  return (
    <>
      <div className={cn('space-y-6 transition-all', selectedSkill && 'mr-[480px]')}>
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Skills</h1>
            <p className="text-muted-foreground">
              {systemSkills.length} system, {userSkills.length} user
            </p>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search skills..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* System Skills Table */}
        {systemSkills.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Lock className="h-3.5 w-3.5 text-muted-foreground" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                System ({systemSkills.length})
              </h2>
            </div>
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full">
                <tbody>
                  {systemSkills.map((skill) => (
                    <SkillRow
                      key={skill.id}
                      skill={skill}
                      isSelected={selectedSkill?.id === skill.id}
                      onClick={() => setSelectedSkill(skill)}
                      onToggle={handleToggle}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* User Skills Table */}
        {userSkills.length > 0 && (
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              User ({userSkills.length})
            </h2>
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full">
                <tbody>
                  {userSkills.map((skill) => (
                    <SkillRow
                      key={skill.id}
                      skill={skill}
                      isSelected={selectedSkill?.id === skill.id}
                      onClick={() => setSelectedSkill(skill)}
                      onToggle={handleToggle}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {filtered.length === 0 && search && (
          <div className="text-center py-12 text-muted-foreground">
            No skills found for "{search}"
          </div>
        )}
      </div>

      {/* Detail Panel */}
      {selectedSkill && (
        <SkillDetailPanel
          skill={selectedSkill}
          onClose={() => setSelectedSkill(null)}
          onToggle={handleToggle}
        />
      )}
    </>
  )
}
