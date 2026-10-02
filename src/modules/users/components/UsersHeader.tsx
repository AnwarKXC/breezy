interface UsersHeaderProps {
  title: string
  subtitle: string
  actionLabel: string
  onCreate?: () => void
}

export function UsersHeader({ title, subtitle, actionLabel, onCreate }: UsersHeaderProps) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#1A1A1A]">{title}</h1>
        <p className="mt-1 text-sm font-medium text-[#787774]">{subtitle}</p>
      </div>
      {onCreate ? (
        <button
          type="button"
          onClick={onCreate}
          className="h-9 rounded-lg bg-accent px-4 text-sm font-medium text-accent-foreground transition-all duration-200 hover:bg-accent-hover"
        >
          {actionLabel}
        </button>
      ) : null}
    </header>
  )
}

