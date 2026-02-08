import { cn } from '@/lib/utils'

interface HeaderProps {
  title: string
  description?: string
  children?: React.ReactNode
  className?: string
}

export function Header({ title, description, children, className }: HeaderProps) {
  return (
    <div className={cn('flex items-center justify-between border-b border-border pb-6', className)}>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && (
          <p className="mt-1 text-muted-foreground">{description}</p>
        )}
      </div>
      {children && <div className="flex items-center gap-4">{children}</div>}
    </div>
  )
}
