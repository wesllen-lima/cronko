import type { ComponentType } from "react"

interface EmptyStateProps {
  icon: ComponentType<{ className?: string }>
  title: string
  description: string
  action?: {
    label: string
    href: string
  }
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 p-12 text-center transition-colors">
      <div className="flex justify-center mb-4">
        <div className="rounded-full bg-zinc-100 dark:bg-zinc-800 p-4">
          <Icon className="h-8 w-8 text-zinc-400 dark:text-zinc-500" />
        </div>
      </div>
      <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">{title}</h3>
      <p className="text-xs text-zinc-500 max-w-sm mx-auto mb-4">
        {description}
      </p>
      {action && (
        <a
          href={action.href}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
        >
          {action.label}
        </a>
      )}
    </div>
  )
}