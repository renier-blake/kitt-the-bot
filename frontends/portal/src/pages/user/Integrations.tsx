import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { api, type Integration } from '@/lib/api'
import {
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Plug,
  Unplug,
  Shield,
  MessageSquare,
  TestTube2,
  Upload,
  Eye,
  EyeOff,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { WhatsAppCard } from '@/components/WhatsAppCard'

// Nango will be loaded dynamically
let Nango: any = null

// Category display config
const CATEGORY_CONFIG: Record<string, { label: string; icon: string }> = {
  ai_service: { label: 'AI Services', icon: '🤖' },
  channel: { label: 'Channels', icon: '💬' },
  email: { label: 'Email', icon: '📧' },
  calendar: { label: 'Calendar', icon: '📅' },
  storage: { label: 'Storage', icon: '📁' },
  productivity: { label: 'Productivity', icon: '📝' },
  media: { label: 'Media', icon: '🎙️' },
  fitness: { label: 'Fitness', icon: '🏋️' },
  development: { label: 'Development', icon: '⚙️' },
  crm: { label: 'CRM', icon: '🎯' },
  infrastructure: { label: 'Infrastructure', icon: '🔧' },
}

// Category display order
const CATEGORY_ORDER = [
  'channel', 'ai_service', 'email', 'calendar', 'media',
  'fitness', 'storage', 'productivity', 'development', 'crm', 'infrastructure',
]

export function Integrations() {
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [connecting, setConnecting] = useState<string | null>(null)
  const [authModal, setAuthModal] = useState<Integration | null>(null)
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; preview?: string; error?: string }>>({})
  const [testing, setTesting] = useState<string | null>(null)
  const [migrating, setMigrating] = useState(false)

  // Load Nango SDK
  useEffect(() => {
    const loadNango = async () => {
      try {
        const module = await import('@nangohq/frontend')
        Nango = module.default
      } catch {
        // Nango SDK not available — OAuth integrations won't work
      }
    }
    loadNango()
  }, [])

  const fetchIntegrations = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await api.getIntegrations()
      setIntegrations(data.integrations)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load integrations')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchIntegrations()
  }, [])

  const handleNangoConnect = async (integration: Integration) => {
    if (!Nango) {
      setError('Nango SDK not loaded — cannot connect OAuth integrations')
      return
    }
    try {
      setConnecting(integration.id)
      const { token } = await api.createConnectSession(integration.id)
      const nango = new Nango()
      await nango.openConnectUI({
        sessionToken: token,
        onEvent: (event: any) => {
          if (event.type === 'connect') {
            fetchIntegrations()
          }
          if (event.type === 'close') {
            setConnecting(null)
          }
        }
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect')
      setConnecting(null)
    }
  }

  const handleConnect = (integration: Integration) => {
    if (integration.auth_type === 'oauth' && integration.provider === 'nango') {
      handleNangoConnect(integration)
    } else {
      // Open auth modal for API key, token, credentials, custom OAuth
      setAuthModal(integration)
    }
  }

  const handleDisconnect = async (integration: Integration) => {
    if (!confirm(`Disconnect ${integration.name}?`)) return
    try {
      setConnecting(integration.id)
      await api.removeIntegrationAuth(integration.id)
      fetchIntegrations()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect')
    } finally {
      setConnecting(null)
    }
  }

  const handleTest = async (integration: Integration) => {
    try {
      setTesting(integration.id)
      const result = await api.testIntegration(integration.id)
      setTestResults(prev => ({ ...prev, [integration.id]: result }))
    } catch (err) {
      setTestResults(prev => ({ ...prev, [integration.id]: { success: false, error: 'Test failed' } }))
    } finally {
      setTesting(null)
    }
  }

  const handleMigrate = async () => {
    try {
      setMigrating(true)
      await api.migrateIntegrations()
      await fetchIntegrations()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Migration failed')
    } finally {
      setMigrating(false)
    }
  }

  // Group by category, ordered
  const grouped = integrations.reduce((acc, integration) => {
    if (!acc[integration.category]) acc[integration.category] = []
    acc[integration.category].push(integration)
    return acc
  }, {} as Record<string, Integration[]>)

  const sortedCategories = CATEGORY_ORDER.filter(c => grouped[c])

  // Stats
  const connectedCount = integrations.filter(i => i.connected).length

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
          <h1 className="text-2xl font-bold tracking-tight">Integrations</h1>
          <p className="text-muted-foreground">
            Connect services to give KITT superpowers — {connectedCount}/{integrations.length} active
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleMigrate} disabled={migrating}>
            {migrating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Sync .env
          </Button>
          <Button variant="outline" size="sm" onClick={fetchIntegrations} disabled={loading}>
            <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 flex items-center gap-2">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span className="flex-1">{error}</span>
          <Button variant="ghost" size="sm" onClick={() => setError(null)}>Dismiss</Button>
        </div>
      )}

      {/* WhatsApp (special channel with QR code) */}
      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          WhatsApp
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <WhatsAppCard />
        </div>
      </div>

      {/* All integration categories */}
      <div className="space-y-8">
        {sortedCategories.map(category => {
          const items = grouped[category]
          const config = CATEGORY_CONFIG[category] || { label: category, icon: '🔌' }
          return (
            <div key={category}>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span>{config.icon}</span>
                {config.label}
                <Badge variant="secondary">
                  {items.filter(i => i.connected).length}/{items.length}
                </Badge>
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {items.map(integration => (
                  <IntegrationCard
                    key={integration.id}
                    integration={integration}
                    isLoading={connecting === integration.id}
                    isTesting={testing === integration.id}
                    testResult={testResults[integration.id]}
                    onConnect={() => handleConnect(integration)}
                    onDisconnect={() => handleDisconnect(integration)}
                    onTest={() => handleTest(integration)}
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
          <p className="font-medium">Security</p>
          <p>
            OAuth tokens are managed by Nango. API keys and passwords are encrypted locally
            with AES-256-GCM using a machine-specific key. Nothing leaves your machine unencrypted.
          </p>
        </div>
      </div>

      {/* Auth Modal */}
      {authModal && (
        <AuthModal
          integration={authModal}
          onClose={() => setAuthModal(null)}
          onSaved={() => {
            setAuthModal(null)
            fetchIntegrations()
          }}
        />
      )}
    </div>
  )
}

function IntegrationCard({
  integration,
  isLoading,
  isTesting,
  testResult,
  onConnect,
  onDisconnect,
  onTest,
}: {
  integration: Integration
  isLoading: boolean
  isTesting: boolean
  testResult?: { success: boolean; preview?: string; error?: string }
  onConnect: () => void
  onDisconnect: () => void
  onTest: () => void
}) {
  const isConnected = integration.connected

  const authLabel = {
    oauth: 'OAuth',
    api_key: 'API Key',
    token: 'Token',
    credentials: 'Login',
  }[integration.auth_type]

  return (
    <Card className={cn(
      "transition-all duration-200",
      isConnected && "border-green-500/30 bg-green-500/5"
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{integration.icon}</span>
            <div>
              <CardTitle className="text-lg">{integration.name}</CardTitle>
              <CardDescription className="text-xs">
                {authLabel}
              </CardDescription>
            </div>
          </div>
          <StatusBadge connected={isConnected} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {integration.description}
        </p>

        {/* Test result */}
        {testResult && (
          <div className={cn(
            "text-xs px-2 py-1.5 rounded flex items-center gap-1",
            testResult.success ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
          )}>
            {testResult.success ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
            {testResult.success ? `Connected${testResult.preview ? ` (${testResult.preview})` : ''}` : testResult.error || 'Failed'}
          </div>
        )}

        {isConnected ? (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={onTest}
              disabled={isTesting}
            >
              {isTesting ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <TestTube2 className="mr-1 h-3 w-3" />}
              Test
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-red-400 hover:text-red-300"
              onClick={onDisconnect}
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Unplug className="mr-1 h-3 w-3" />}
              Disconnect
            </Button>
          </div>
        ) : (
          <Button
            variant="default"
            size="sm"
            className="w-full"
            onClick={onConnect}
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plug className="mr-2 h-4 w-4" />}
            Connect
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

function StatusBadge({ connected }: { connected: boolean }) {
  if (connected) {
    return (
      <Badge variant="default" className="bg-green-500/20 text-green-400 hover:bg-green-500/30">
        <CheckCircle2 className="mr-1 h-3 w-3" />
        Active
      </Badge>
    )
  }
  return (
    <Badge variant="secondary">
      <XCircle className="mr-1 h-3 w-3" />
      Not set
    </Badge>
  )
}

// Auth Modal — handles API key, token, credentials, custom OAuth
function AuthModal({
  integration,
  onClose,
  onSaved,
}: {
  integration: Integration
  onClose: () => void
  onSaved: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showValues, setShowValues] = useState(false)

  // Form state depends on auth_type
  const [value, setValue] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [multiValues, setMultiValues] = useState<Record<string, string>>({})

  const authConfig = integration.auth_config || {}
  const credentialKeys: string[] = (authConfig.credential_keys as string[]) || []

  const handleSave = async () => {
    try {
      setSaving(true)
      setError(null)

      if (integration.auth_type === 'api_key' || integration.auth_type === 'token') {
        if (!value.trim()) {
          setError('Value is required')
          setSaving(false)
          return
        }
        await api.setIntegrationAuth(integration.id, { value: value.trim() })
      } else if (integration.auth_type === 'credentials') {
        if (!username.trim() || !password.trim()) {
          setError('Username and password are required')
          setSaving(false)
          return
        }
        await api.setIntegrationAuth(integration.id, { username: username.trim(), password: password.trim() })
      } else if (integration.auth_type === 'oauth' && credentialKeys.length > 0) {
        const missing = credentialKeys.filter(k => !multiValues[k]?.trim())
        if (missing.length > 0) {
          setError(`Missing: ${missing.join(', ')}`)
          setSaving(false)
          return
        }
        await api.setIntegrationAuth(integration.id, multiValues)
      }

      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const getTitle = () => {
    if (integration.connected) return `Update ${integration.name}`
    return `Connect ${integration.name}`
  }

  const getDescription = () => {
    switch (integration.auth_type) {
      case 'api_key': return 'Enter your API key to connect this service.'
      case 'token': return 'Enter your access token to connect this service.'
      case 'credentials': return 'Enter your login credentials to connect this service.'
      default: return 'Enter the required credentials.'
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>{integration.icon}</span>
            {getTitle()}
          </DialogTitle>
          <DialogDescription>{getDescription()}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-sm text-red-400">
              {error}
            </div>
          )}

          {(integration.auth_type === 'api_key' || integration.auth_type === 'token') && (
            <div className="space-y-2">
              <Label>{integration.auth_type === 'api_key' ? 'API Key' : 'Token'}</Label>
              <div className="relative">
                <Input
                  type={showValues ? 'text' : 'password'}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={integration.auth_type === 'api_key' ? 'sk-...' : 'Enter token...'}
                  className="font-mono pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowValues(!showValues)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showValues ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}

          {integration.auth_type === 'credentials' && (
            <>
              <div className="space-y-2">
                <Label>Email / Username</Label>
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <div className="relative">
                  <Input
                    type={showValues ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password..."
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowValues(!showValues)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showValues ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </>
          )}

          {integration.auth_type === 'oauth' && credentialKeys.length > 0 && (
            <>
              {credentialKeys.map(key => (
                <div key={key} className="space-y-2">
                  <Label className="font-mono text-xs">{key}</Label>
                  <div className="relative">
                    <Input
                      type={showValues ? 'text' : 'password'}
                      value={multiValues[key] || ''}
                      onChange={(e) => setMultiValues(prev => ({ ...prev, [key]: e.target.value }))}
                      placeholder={`Enter ${key}...`}
                      className="font-mono pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowValues(!showValues)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showValues ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plug className="mr-2 h-4 w-4" />}
            {integration.connected ? 'Update' : 'Connect'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
