import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { api, WhatsAppStatus } from '@/lib/api'
import {
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Plug,
  Unplug,
  Smartphone,
  QrCode,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import QRCode from 'react-qr-code'

export function WhatsAppCard() {
  const [status, setStatus] = useState<WhatsAppStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [showQrModal, setShowQrModal] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchStatus = async () => {
    try {
      const data = await api.getWhatsAppStatus()
      setStatus(data)
      setError(null)

      // Auto-close modal when connected
      if (data.connected && showQrModal) {
        setShowQrModal(false)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch status')
    } finally {
      setLoading(false)
    }
  }

  // Initial fetch
  useEffect(() => {
    fetchStatus()
  }, [])

  // Poll while modal is open
  useEffect(() => {
    if (!showQrModal) return

    const interval = setInterval(fetchStatus, 2000)
    return () => clearInterval(interval)
  }, [showQrModal])

  const handleConnect = () => {
    setShowQrModal(true)
    fetchStatus()
  }

  const handleDisconnect = async () => {
    if (!confirm('Disconnect WhatsApp? You will need to scan the QR code again to reconnect.')) {
      return
    }

    try {
      setDisconnecting(true)
      await api.disconnectWhatsApp()
      await fetchStatus()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect')
    } finally {
      setDisconnecting(false)
    }
  }

  if (loading && !status) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-48">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  const isConnected = status?.connected ?? false
  const isDisabled = status?.status === 'disabled'

  return (
    <>
      <Card className={cn(
        "transition-all duration-200",
        isConnected && "border-green-500/30 bg-green-500/5",
        isDisabled && "opacity-50"
      )}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">📱</span>
              <div>
                <CardTitle className="text-lg">WhatsApp</CardTitle>
                <CardDescription className="text-xs">
                  Channel
                </CardDescription>
              </div>
            </div>
            <StatusBadge status={status?.status || 'disconnected'} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Send and receive messages via WhatsApp
          </p>

          {error && (
            <div className="p-2 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          {isDisabled ? (
            <div className="text-sm text-muted-foreground">
              Enable WhatsApp in .env with WHATSAPP_ENABLED=true
            </div>
          ) : isConnected ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                <span>Connected as {status?.user?.name || status?.user?.id || 'Unknown'}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={handleDisconnect}
                disabled={disconnecting}
              >
                {disconnecting ? (
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
              onClick={handleConnect}
            >
              <Plug className="mr-2 h-4 w-4" />
              Connect
            </Button>
          )}
        </CardContent>
      </Card>

      <QrCodeModal
        open={showQrModal}
        onClose={() => setShowQrModal(false)}
        status={status}
      />
    </>
  )
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'connected':
      return (
        <Badge variant="default" className="bg-green-500/20 text-green-400 hover:bg-green-500/30">
          <CheckCircle2 className="mr-1 h-3 w-3" />
          Active
        </Badge>
      )
    case 'awaiting_scan':
      return (
        <Badge variant="default" className="bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30">
          <QrCode className="mr-1 h-3 w-3" />
          Pending
        </Badge>
      )
    case 'disabled':
      return (
        <Badge variant="secondary">
          <XCircle className="mr-1 h-3 w-3" />
          Disabled
        </Badge>
      )
    default:
      return (
        <Badge variant="secondary">
          <XCircle className="mr-1 h-3 w-3" />
          Disconnected
        </Badge>
      )
  }
}

function QrCodeModal({
  open,
  onClose,
  status,
}: {
  open: boolean
  onClose: () => void
  status: WhatsAppStatus | null
}) {
  const qrCode = status?.qrCode
  const isConnected = status?.connected

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Connect WhatsApp
          </DialogTitle>
          <DialogDescription>
            Scan this QR code with your WhatsApp app to connect
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center space-y-4 py-4">
          {isConnected ? (
            <div className="flex flex-col items-center gap-2 text-green-600">
              <CheckCircle2 className="h-16 w-16" />
              <span className="text-lg font-medium">Connected!</span>
              <span className="text-sm text-muted-foreground">
                You can close this dialog
              </span>
            </div>
          ) : qrCode ? (
            <>
              <div className="bg-white p-4 rounded-lg">
                <QRCode value={qrCode} size={200} />
              </div>
              <div className="text-sm text-muted-foreground text-center space-y-2">
                <p className="font-medium">To connect:</p>
                <ol className="list-decimal list-inside text-left space-y-1">
                  <li>Open WhatsApp on your phone</li>
                  <li>Tap Settings &rarr; Linked Devices</li>
                  <li>Tap "Link a Device"</li>
                  <li>Scan this QR code</li>
                </ol>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Generating QR code...
              </span>
            </div>
          )}

          {/* Only show error if not connected AND no QR code (QR + error = normal reconnect) */}
          {status?.lastError && !isConnected && !qrCode && (
            <div className="p-2 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm flex items-center gap-2 w-full">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{status.lastError}</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
