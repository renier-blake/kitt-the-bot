import { cn } from '@/lib/utils'

interface PageShellProps {
  children: React.ReactNode
  className?: string
  fullHeight?: boolean
}

export function PageShell({ children, className, fullHeight }: PageShellProps) {
  return (
    <div 
      className={cn(
        'ml-64 min-h-screen bg-background',
        fullHeight && 'h-screen flex flex-col overflow-hidden',
        className
      )}
    >
      <main className={cn(
        'container mx-auto',
        fullHeight ? 'flex-1 overflow-hidden p-0' : 'p-8'
      )}>
        {children}
      </main>
    </div>
  )
}
