const SKELETON_ROWS = Array.from({ length: 5 })

interface ContactsStateCardProps {
  title: string
  description?: string
  retryLabel?: string
  onRetry?: () => void
}

export function ContactsLoadingState() {
  return (
    <div className="rounded-xl bg-white p-5 ">
      <div className="space-y-4">
        {SKELETON_ROWS.map((_, index) => (
          <div
            key={index}
            className="flex items-center gap-4 border-b border-[#EAEAEA] pb-4 last:border-0 last:pb-0"
          >
            <div className="h-10 w-10 animate-pulse rounded-full bg-[#EAEAEA]" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-36 animate-pulse rounded-xl bg-[#EAEAEA]" />
              <div className="h-3 w-56 animate-pulse rounded-xl bg-[#EAEAEA]" />
            </div>
            <div className="h-8 w-24 animate-pulse rounded-xl bg-[#EAEAEA]" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function ContactsStateCard({ title, description, retryLabel, onRetry }: ContactsStateCardProps) {
  return (
    <div className="rounded-xl bg-white p-10 text-center ">
      <h2 className="text-base font-bold text-[#1A1A1A]">{title}</h2>
      {description ? <p className="mt-2 text-sm text-[#787774]">{description}</p> : null}
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-lg border border-[#D4D4D4] px-4 py-2 text-sm font-semibold text-[#333333] transition-colors hover:bg-accent/10"
        >
          {retryLabel ?? 'Retry'}
        </button>
      ) : null}
    </div>
  )
}
