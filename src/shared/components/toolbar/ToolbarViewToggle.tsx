'use client'

type ViewMode = 'row' | 'grid'

interface ToolbarViewToggleProps {
  view: ViewMode
  onChange: (view: ViewMode) => void
  rowLabel: string
  gridLabel: string
}

function RowsIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  )
}

function GridIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="4" width="6" height="6" rx="1.5" />
      <rect x="14" y="4" width="6" height="6" rx="1.5" />
      <rect x="4" y="14" width="6" height="6" rx="1.5" />
      <rect x="14" y="14" width="6" height="6" rx="1.5" />
    </svg>
  )
}

export function ToolbarViewToggle({ view, onChange, rowLabel, gridLabel }: ToolbarViewToggleProps) {
  const views: ViewMode[] = ['row', 'grid']

  return (
    <div className="flex gap-1">
      {views.map((mode) => (
        <button
          key={mode}
          type="button"
          aria-label={mode === 'row' ? rowLabel : gridLabel}
          aria-pressed={view === mode}
          onClick={() => onChange(mode)}
          className={`grid h-9 w-9 place-items-center rounded-lg transition-all duration-200 ${
            view === mode
              ? 'bg-accent text-accent-foreground'
              : 'border border-[#EAEAEA] bg-white text-[#787774] hover:bg-accent/10'
          }`}
        >
          {mode === 'row' ? <RowsIcon /> : <GridIcon />}
        </button>
      ))}
    </div>
  )
}
