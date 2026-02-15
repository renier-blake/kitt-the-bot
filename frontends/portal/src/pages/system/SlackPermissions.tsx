import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import type { SlackPermissionMatrix, SlackSeenData } from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Plus, Trash2, Shield, Hash, User, Globe } from 'lucide-react'

type Permission = 'respond' | 'read-only' | 'blocked'

const PERMISSION_OPTIONS: { value: Permission; label: string }[] = [
  { value: 'respond', label: 'Respond' },
  { value: 'read-only', label: 'Read-only' },
  { value: 'blocked', label: 'Blocked' },
]

function PermissionSelect({ value, onChange }: { value: string; onChange: (val: Permission) => void }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as Permission)}>
      <SelectTrigger className="w-[140px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PERMISSION_OPTIONS.map(opt => (
          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function PermissionBadge({ permission }: { permission: string }) {
  const colors: Record<string, string> = {
    respond: 'bg-green-500/20 text-green-400',
    'read-only': 'bg-yellow-500/20 text-yellow-400',
    blocked: 'bg-red-500/20 text-red-400',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[permission] ?? 'bg-muted text-muted-foreground'}`}>
      {permission}
    </span>
  )
}

/** Dropdown to pick a seen channel */
function ChannelPicker({
  seen,
  exclude,
  value,
  onChange,
}: {
  seen: SlackSeenData['channels']
  exclude: string[]
  value: string
  onChange: (val: string) => void
}) {
  const available = seen.filter(c => !exclude.includes(c.channelId))
  if (available.length === 0) {
    return <span className="text-sm text-muted-foreground">No new channels discovered yet</span>
  }
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[220px]">
        <SelectValue placeholder="Select channel..." />
      </SelectTrigger>
      <SelectContent>
        {available.map(c => (
          <SelectItem key={c.channelId} value={c.channelId}>
            {c.channelName ?? (c.isDM ? `DM ${c.channelId}` : `#${c.channelId}`)}
            <span className="ml-2 text-muted-foreground text-xs">({c.messageCount} msgs)</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** Dropdown to pick a seen user */
function UserPicker({
  seen,
  exclude,
  value,
  onChange,
}: {
  seen: SlackSeenData['users']
  exclude: string[]
  value: string
  onChange: (val: string) => void
}) {
  const available = seen.filter(u => !exclude.includes(u.userId))
  if (available.length === 0) {
    return <span className="text-sm text-muted-foreground">No new users discovered yet</span>
  }
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[220px]">
        <SelectValue placeholder="Select user..." />
      </SelectTrigger>
      <SelectContent>
        {available.map(u => (
          <SelectItem key={u.userId} value={u.userId}>
            {u.displayName}
            <span className="ml-2 text-muted-foreground text-xs">({u.userId})</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function SlackPermissions() {
  const [matrix, setMatrix] = useState<SlackPermissionMatrix | null>(null)
  const [seen, setSeen] = useState<SlackSeenData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Add forms
  const [newChannelId, setNewChannelId] = useState('')
  const [newChannelPerm, setNewChannelPerm] = useState<Permission>('respond')
  const [newUserId, setNewUserId] = useState('')
  const [newUserPerm, setNewUserPerm] = useState<Permission>('respond')
  const [overrideChannelId, setOverrideChannelId] = useState<string | null>(null)
  const [newOverrideUserId, setNewOverrideUserId] = useState('')
  const [newOverridePerm, setNewOverridePerm] = useState<Permission>('read-only')

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const [perms, seenData] = await Promise.all([
        api.getSlackPermissions('slack'),
        api.getSlackSeen(),
      ])
      setMatrix(perms)
      setSeen(seenData)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const handleUpsert = async (channelId: string, userId: string, permission: Permission) => {
    try {
      setSaving(true)
      await api.upsertSlackPermission({ adapter: 'slack', channelId, userId, permission })
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (channelId: string, userId: string) => {
    try {
      setSaving(true)
      await api.deleteSlackPermission({ adapter: 'slack', channelId, userId })
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setSaving(false)
    }
  }

  // Lookup helpers
  const getUserName = (userId: string) => {
    const u = seen?.users.find(u => u.userId === userId)
    return u?.displayName ?? userId
  }

  const getChannelLabel = (channelId: string) => {
    const c = seen?.channels.find(c => c.channelId === channelId)
    if (!c) return channelId
    return c.channelName ?? (c.isDM ? `DM ${channelId}` : `#${channelId}`)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const globalDefault = matrix?.globalDefault ?? null
  const channels = matrix?.channels ?? []
  const users = matrix?.users ?? []
  const seenUsers = seen?.users ?? []
  const seenChannels = seen?.channels ?? []

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Slack Permissions</h1>
        <p className="text-muted-foreground">
          Channel & user permission matrix for the Slack OAuth adapter.
          Most specific rule wins: user+channel &gt; user default &gt; channel default &gt; global default.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {/* Global Default */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Global Default
          </CardTitle>
          <CardDescription>
            Fallback permission when no channel or user rule matches.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <PermissionSelect
              value={globalDefault ?? 'read-only'}
              onChange={(perm) => handleUpsert('', '', perm)}
            />
            {globalDefault && (
              <Button variant="ghost" size="sm" onClick={() => handleDelete('', '')} disabled={saving}>
                <Trash2 className="h-4 w-4 mr-1" /> Remove
              </Button>
            )}
            {!globalDefault && (
              <span className="text-sm text-muted-foreground">
                Not set — defaults to &quot;respond&quot; when no rules exist
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* User Defaults */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            User Defaults
          </CardTitle>
          <CardDescription>
            Global permission per user. User rules beat channel defaults.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {users.length === 0 && (
            <p className="text-sm text-muted-foreground">No user rules configured yet.</p>
          )}

          {users.map(u => (
            <div key={u.userId} className="flex items-center gap-3">
              <span className="text-sm font-medium">{getUserName(u.userId)}</span>
              <code className="text-xs text-muted-foreground">{u.userId}</code>
              <PermissionBadge permission={u.permission} />
              <PermissionSelect
                value={u.permission}
                onChange={(perm) => handleUpsert('', u.userId, perm)}
              />
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete('', u.userId)} disabled={saving}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}

          {/* Add user */}
          <div className="flex items-center gap-2 pt-2 border-t">
            <UserPicker
              seen={seenUsers}
              exclude={users.map(u => u.userId)}
              value={newUserId}
              onChange={setNewUserId}
            />
            <PermissionSelect value={newUserPerm} onChange={setNewUserPerm} />
            <Button
              size="sm"
              disabled={!newUserId || saving}
              onClick={async () => {
                await handleUpsert('', newUserId, newUserPerm)
                setNewUserId('')
              }}
            >
              <Plus className="h-4 w-4 mr-1" /> Add User
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Channel Defaults */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Hash className="h-5 w-5" />
            Channel Defaults
          </CardTitle>
          <CardDescription>
            Default permission per channel. Overridden by user-specific rules.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {channels.length === 0 && (
            <p className="text-sm text-muted-foreground">No channel rules configured yet.</p>
          )}

          {channels.map(ch => (
            <div key={ch.channelId} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">{getChannelLabel(ch.channelId)}</span>
                  <code className="text-xs text-muted-foreground">{ch.channelId}</code>
                  <PermissionSelect
                    value={ch.default}
                    onChange={(perm) => handleUpsert(ch.channelId, '', perm)}
                  />
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(ch.channelId, '')} disabled={saving}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              {/* Channel user overrides */}
              {ch.overrides.length > 0 && (
                <div className="ml-6 space-y-2">
                  <span className="text-xs text-muted-foreground font-medium">User overrides:</span>
                  {ch.overrides.map(ov => (
                    <div key={ov.userId} className="flex items-center gap-3">
                      <span className="text-sm">{getUserName(ov.userId)}</span>
                      <code className="text-xs text-muted-foreground">{ov.userId}</code>
                      <PermissionSelect
                        value={ov.permission}
                        onChange={(perm) => handleUpsert(ch.channelId, ov.userId, perm)}
                      />
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(ch.channelId, ov.userId)} disabled={saving}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add user override for this channel */}
              {overrideChannelId === ch.channelId ? (
                <div className="ml-6 flex items-center gap-2">
                  <UserPicker
                    seen={seenUsers}
                    exclude={ch.overrides.map(o => o.userId)}
                    value={newOverrideUserId}
                    onChange={setNewOverrideUserId}
                  />
                  <PermissionSelect value={newOverridePerm} onChange={setNewOverridePerm} />
                  <Button
                    size="sm"
                    disabled={!newOverrideUserId || saving}
                    onClick={async () => {
                      await handleUpsert(ch.channelId, newOverrideUserId, newOverridePerm)
                      setNewOverrideUserId('')
                      setOverrideChannelId(null)
                    }}
                  >
                    Add
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setOverrideChannelId(null); setNewOverrideUserId('') }}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button variant="outline" size="sm" className="ml-6" onClick={() => setOverrideChannelId(ch.channelId)}>
                  <Plus className="h-3 w-3 mr-1" /> Add user override
                </Button>
              )}
            </div>
          ))}

          {/* Add channel */}
          <div className="flex items-center gap-2 pt-2 border-t">
            <ChannelPicker
              seen={seenChannels}
              exclude={channels.map(c => c.channelId)}
              value={newChannelId}
              onChange={setNewChannelId}
            />
            <PermissionSelect value={newChannelPerm} onChange={setNewChannelPerm} />
            <Button
              size="sm"
              disabled={!newChannelId || saving}
              onClick={async () => {
                await handleUpsert(newChannelId, '', newChannelPerm)
                setNewChannelId('')
              }}
            >
              <Plus className="h-4 w-4 mr-1" /> Add Channel
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Resolution explanation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            How Resolution Works
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
            <li><strong>User + Channel override</strong> — most specific, always wins</li>
            <li><strong>User default</strong> — user-specific rules beat channel defaults</li>
            <li><strong>Channel default</strong> — applies to all users in that channel</li>
            <li><strong>Global default</strong> — fallback for everything</li>
            <li><strong>No rules</strong> — everyone gets &quot;respond&quot; (backwards compatible)</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  )
}
