import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api, type CredentialInfo } from '@/lib/api'
import {
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Key,
  Shield,
  Plus,
  Trash2,
  TestTube2,
  Upload,
  Lock,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Category display config
const CATEGORY_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  api_key: { label: 'AI Services', icon: '🤖', color: 'text-blue-400' },
  token: { label: 'Messaging', icon: '💬', color: 'text-green-400' },
  oauth: { label: 'OAuth', icon: '🔗', color: 'text-purple-400' },
  other: { label: 'Other', icon: '🔧', color: 'text-gray-400' },
}

export function Credentials() {
  const [credentials, setCredentials] = useState<CredentialInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [migrating, setMigrating] = useState(false)
  const [migrationResult, setMigrationResult] = useState<string | null>(null)

  // Add/Edit modal state
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [formKey, setFormKey] = useState('')
  const [formValue, setFormValue] = useState('')
  const [formCategory, setFormCategory] = useState<string>('api_key')
  const [formDescription, setFormDescription] = useState('')
  const [saving, setSaving] = useState(false)

  // Test state
  const [testing, setTesting] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; preview?: string; error?: string }>>({})

  const fetchCredentials = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await api.credentials.list()
      setCredentials(data.credentials)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load credentials')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCredentials()
  }, [])

  const handleMigrate = async () => {
    try {
      setMigrating(true)
      setMigrationResult(null)
      const result = await api.credentials.migrate()
      const parts: string[] = []
      if (result.migrated.length > 0) parts.push(`✅ Migrated: ${result.migrated.join(', ')}`)
      if (result.skipped.length > 0) parts.push(`⏭️ Already in vault: ${result.skipped.join(', ')}`)
      if (result.failed.length > 0) parts.push(`❌ Failed: ${result.failed.map(f => f.key).join(', ')}`)
      if (parts.length === 0) parts.push('No secrets found in .env to migrate')
      setMigrationResult(parts.join('\n'))
      fetchCredentials()
    } catch (err) {
      setMigrationResult(`❌ Migration failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setMigrating(false)
    }
  }

  const handleTest = async (key: string) => {
    try {
      setTesting(key)
      const result = await api.credentials.test(key)
      setTestResults(prev => ({
        ...prev,
        [key]: { success: result.success, preview: result.preview, error: result.error },
      }))
    } catch (err) {
      setTestResults(prev => ({
        ...prev,
        [key]: { success: false, error: err instanceof Error ? err.message : 'Test failed' },
      }))
    } finally {
      setTesting(null)
    }
  }

  const handleDelete = async (key: string) => {
    if (!confirm(`Delete ${key} from the vault? This cannot be undone.`)) return
    try {
      await api.credentials.delete(key)
      fetchCredentials()
      setTestResults(prev => {
        const copy = { ...prev }
        delete copy[key]
        return copy
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete credential')
    }
  }

  const handleSave = async () => {
    const key = editingKey || formKey
    if (!key || !formValue) return

    try {
      setSaving(true)
      await api.credentials.set(key, formValue, formCategory, formDescription)
      resetForm()
      fetchCredentials()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save credential')
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (cred: CredentialInfo) => {
    setEditingKey(cred.key)
    setFormKey(cred.key)
    setFormValue('')
    setFormCategory(cred.category)
    setFormDescription(cred.description || '')
    setShowAddForm(true)
  }

  const resetForm = () => {
    setEditingKey(null)
    setShowAddForm(false)
    setFormKey('')
    setFormValue('')
    setFormCategory('api_key')
    setFormDescription('')
  }

  // Group credentials by category
  const grouped = credentials.reduce((acc, cred) => {
    const cat = cred.category || 'other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(cred)
    return acc
  }, {} as Record<string, CredentialInfo[]>)

  // Stats
  const inVault = credentials.filter(c => c.inVault).length
  const inEnvOnly = credentials.filter(c => !c.inVault && c.inEnv).length
  const missing = credentials.filter(c => !c.inVault && !c.inEnv).length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">API Keys & Credentials</h1>
          <p className="text-muted-foreground">
            Encrypted credential vault — AES-256-GCM with machine-derived key
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchCredentials} disabled={loading}>
            <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              resetForm()
              setShowAddForm(true)
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Key
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 flex items-center gap-2">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          {error}
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setError(null)}>
            Dismiss
          </Button>
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-500/10 p-2">
                <Lock className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{inVault}</p>
                <p className="text-sm text-muted-foreground">In Vault</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-yellow-500/10 p-2">
                <AlertCircle className="h-5 w-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{inEnvOnly}</p>
                <p className="text-sm text-muted-foreground">In .env only</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-red-500/10 p-2">
                <XCircle className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{missing}</p>
                <p className="text-sm text-muted-foreground">Missing</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Migrate from .env */}
      {inEnvOnly > 0 && (
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Upload className="h-5 w-5 text-yellow-400" />
                <div>
                  <p className="font-medium">Migrate from .env</p>
                  <p className="text-sm text-muted-foreground">
                    {inEnvOnly} secret{inEnvOnly > 1 ? 's' : ''} found in .env — move to encrypted vault
                  </p>
                </div>
              </div>
              <Button onClick={handleMigrate} disabled={migrating} size="sm">
                {migrating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                Migrate
              </Button>
            </div>
            {migrationResult && (
              <pre className="mt-4 text-sm whitespace-pre-wrap text-muted-foreground bg-muted/50 p-3 rounded">
                {migrationResult}
              </pre>
            )}
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Form */}
      {showAddForm && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="text-lg">
              {editingKey ? `Update ${editingKey}` : 'Add New Credential'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!editingKey && (
              <div className="space-y-2">
                <Label htmlFor="cred-key">Key Name</Label>
                <Input
                  id="cred-key"
                  value={formKey}
                  onChange={(e) => setFormKey(e.target.value.toUpperCase())}
                  placeholder="MY_API_KEY"
                  className="font-mono"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="cred-value">
                {editingKey ? 'New Value' : 'Value'}
              </Label>
              <Input
                id="cred-value"
                type="password"
                value={formValue}
                onChange={(e) => setFormValue(e.target.value)}
                placeholder={editingKey ? 'Enter new value...' : 'sk-...'}
                className="font-mono"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={formCategory} onValueChange={setFormCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="api_key">🤖 API Key</SelectItem>
                    <SelectItem value="token">💬 Token</SelectItem>
                    <SelectItem value="oauth">🔗 OAuth</SelectItem>
                    <SelectItem value="other">🔧 Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cred-desc">Description (optional)</Label>
                <Input
                  id="cred-desc"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="What is this key for?"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={resetForm}>
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || (!editingKey && !formKey) || !formValue}
              >
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Key className="mr-2 h-4 w-4" />
                )}
                {editingKey ? 'Update' : 'Save'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Credential Groups */}
      <div className="space-y-6">
        {Object.entries(grouped).map(([category, items]) => {
          const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.other
          return (
            <div key={category}>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span>{config.icon}</span>
                {config.label}
                <Badge variant="secondary">
                  {items.filter(i => i.inVault).length}/{items.length}
                </Badge>
              </h2>
              <div className="grid gap-3">
                {items.map((cred) => (
                  <CredentialRow
                    key={cred.key}
                    credential={cred}
                    testResult={testResults[cred.key]}
                    isTesting={testing === cred.key}
                    onTest={() => handleTest(cred.key)}
                    onEdit={() => startEdit(cred)}
                    onDelete={() => handleDelete(cred.key)}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Security Note */}
      <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
        <Shield className="h-5 w-5 text-muted-foreground mt-0.5" />
        <div className="text-sm text-muted-foreground">
          <p className="font-medium">Encryption Details</p>
          <p>
            All secrets are encrypted with AES-256-GCM using a machine-specific master key derived via PBKDF2 (100k iterations).
            Values are never stored in plaintext. The master key is tied to this machine and cannot be extracted.
          </p>
        </div>
      </div>
    </div>
  )
}

function CredentialRow({
  credential,
  testResult,
  isTesting,
  onTest,
  onEdit,
  onDelete,
}: {
  credential: CredentialInfo
  testResult?: { success: boolean; preview?: string; error?: string }
  isTesting: boolean
  onTest: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const status = credential.inVault
    ? 'vault'
    : credential.inEnv
      ? 'env'
      : 'missing'

  return (
    <Card className={cn(
      "transition-all duration-200",
      status === 'vault' && "border-green-500/20",
      status === 'env' && "border-yellow-500/20",
      status === 'missing' && "border-red-500/20 bg-red-500/5",
    )}>
      <CardContent className="py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <StatusIcon status={status} />
            <div className="min-w-0">
              <p className="font-mono text-sm font-medium truncate">{credential.key}</p>
              {credential.description && (
                <p className="text-xs text-muted-foreground truncate">{credential.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Test result */}
            {testResult && (
              <Badge
                variant={testResult.success ? 'default' : 'destructive'}
                className={cn(
                  "text-xs",
                  testResult.success && "bg-green-500/20 text-green-400"
                )}
              >
                {testResult.success ? (
                  <>
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    {testResult.preview}
                  </>
                ) : (
                  <>
                    <XCircle className="mr-1 h-3 w-3" />
                    {testResult.error || 'Failed'}
                  </>
                )}
              </Badge>
            )}

            {/* Status badge */}
            <StatusBadge status={status} />

            {/* Actions */}
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onTest}
                disabled={isTesting || status === 'missing'}
                title="Test credential"
              >
                {isTesting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <TestTube2 className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onEdit}
                title={credential.inVault ? 'Update value' : 'Add to vault'}
              >
                <Key className="h-4 w-4" />
              </Button>
              {credential.inVault && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-red-400 hover:text-red-300"
                  onClick={onDelete}
                  title="Delete from vault"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function StatusIcon({ status }: { status: 'vault' | 'env' | 'missing' }) {
  if (status === 'vault') {
    return (
      <div className="rounded-lg bg-green-500/10 p-2">
        <Lock className="h-4 w-4 text-green-400" />
      </div>
    )
  }
  if (status === 'env') {
    return (
      <div className="rounded-lg bg-yellow-500/10 p-2">
        <AlertCircle className="h-4 w-4 text-yellow-400" />
      </div>
    )
  }
  return (
    <div className="rounded-lg bg-red-500/10 p-2">
      <XCircle className="h-4 w-4 text-red-400" />
    </div>
  )
}

function StatusBadge({ status }: { status: 'vault' | 'env' | 'missing' }) {
  if (status === 'vault') {
    return (
      <Badge variant="default" className="bg-green-500/20 text-green-400 hover:bg-green-500/30 text-xs">
        <Lock className="mr-1 h-3 w-3" />
        Encrypted
      </Badge>
    )
  }
  if (status === 'env') {
    return (
      <Badge variant="secondary" className="text-yellow-400 text-xs">
        <AlertCircle className="mr-1 h-3 w-3" />
        .env only
      </Badge>
    )
  }
  return (
    <Badge variant="destructive" className="text-xs">
      <XCircle className="mr-1 h-3 w-3" />
      Missing
    </Badge>
  )
}
