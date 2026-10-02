import Link from 'next/link'

interface ContactsHeaderProps {
  title: string
  subtitle: string
  actionLabel: string
  locale: string
  onCreate?: () => void
}

export function ContactsHeader({ title, subtitle, actionLabel, locale, onCreate }: ContactsHeaderProps) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <nav className="flex items-center gap-2 text-sm">
          <Link href={`/${locale}/dashboard`} className="text-[#787774] transition-colors hover:text-[#555555]">
            Dashboard
          </Link>
          <span className="text-[#BBBBBB]">/</span>
          <span className="font-medium text-[#1A1A1A]">Contacts</span>
        </nav>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#1A1A1A]">{title}</h1>
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
