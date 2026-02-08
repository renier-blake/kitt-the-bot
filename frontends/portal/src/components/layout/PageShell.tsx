import { cn } from '@/lib/utils'

interface PageShellProps {
  children: React.ReactNode
  className?: string
}

export function PageShell({ children, className }: PageShellProps) {
  return (
    <div className={cn('ml-64 min-h-screen bg-background', className)}>
      <main className="container mx-auto p-8">{children}</main>
    </div>
  )
}
