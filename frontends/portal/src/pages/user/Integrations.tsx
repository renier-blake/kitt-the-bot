import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api'
import { 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  RefreshCw,
  Plug,
  Unplug,
  Shield
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Nango will be loaded dynamically
let Nango: any = null

interface Integration {
  id: string
  name: string
  description: string
  icon: string
  category: string
  connected: boolean
  connection: {
    id: string
    createdAt: string
  } | null
}

export function Integrations() {
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [connecting, setConnecting] = useState<string | null>(null)

  // Load Nango SDK
  useEffect(() => {
    const loadNango = async () => {
      try {
        const module = await import('@nangohq/frontend')
        Nango = module.default
      } catch (err) {
        console.error('Failed to load Nango SDK:', err)
        setError('Failed to load Nango SDK')
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

  const handleConnect = async (integration: Integration) => {
    if (!Nango) {
      setError('Nango SDK not loaded')
      return
    }

    try {
      setConnecting(integration.id)
      
      // Get session token from backend
      const { token } = await api.createConnectSession(integration.id)
      
      // Initialize Nango
      const nango = new Nango()
      
      // Open Connect UI
      await nango.openConnectUI({
        sessionToken: token,
        onEvent: (event: any) => {
          if (event.type === 'connect') {
            console.log('Connected!', event)
            fetchIntegrations()
          }
          if (event.type === 'close') {
            console.log('Modal closed')
            setConnecting(null)
          }
        }
      })
    } catch (err) {
      console.error('Failed to connect:', err)
      setError(err instanceof Error ? err.message : 'Failed to connect')
      setConnecting(null)
    }
  }

  const handleDisconnect = async (integration: Integration) => {
    if (!confirm(`Disconnect ${integration.name}?`)) {
      return
    }

    try {
      setConnecting(integration.id)
      await api.disconnectIntegration(integration.id)
      fetchIntegrations()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect')
    } finally {
      setConnecting(null)
    }
  }

  // Group by category
  const grouped = integrations.reduce((acc, integration) => {
    if (!acc[integration.category]) {
      acc[integration.category] = []
    }
    acc[integration.category].push(integration)
    return acc
  }, {} as Record<string, Integration[]>)

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
            Connect your apps to give KITT superpowers
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchIntegrations} disabled={loading}>
          <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          {error}
        </div>
      )}

      {/* Categories */}
      <div className="space-y-8">
        {Object.entries(grouped).map(([category, items]) => (
          <div key={category}>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              {category}
              <Badge variant="secondary">
                {items.filter(i => i.connected).length}/{items.length}
              </Badge>
            </h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {items.map((integration) => (
                <IntegrationCard
                  key={integration.id}
                  integration={integration}
                  isLoading={connecting === integration.id}
                  onConnect={() => handleConnect(integration)}
                  onDisconnect={() => handleDisconnect(integration)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Security Note */}
      <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
        <Shield className="h-5 w-5 text-muted-foreground mt-0.5" />
        <div className="text-sm text-muted-foreground">
          <p className="font-medium">Secure OAuth</p>
          <p>
            Your credentials are never stored locally. All authentication is handled securely via Nango. 
            You can revoke access at any time by disconnecting an integration.
          </p>
        </div>
      </div>
    </div>
  )
}

function IntegrationCard({
  integration,
  isLoading,
  onConnect,
  onDisconnect,
}: {
  integration: Integration
  isLoading: boolean
  onConnect: () => void
  onDisconnect: () => void
}) {
  const isConnected = integration.connected

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
                {integration.category}
              </CardDescription>
            </div>
          </div>
          <StatusBadge connected={isConnected} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {integration.description}
        </p>

        {isConnected ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              <span>Connected</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={onDisconnect}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Unplug className="mr-2 h-4 w-4" />
              )}
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
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plug className="mr-2 h-4 w-4" />
            )}
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
      Disconnected
    </Badge>
  )
}
