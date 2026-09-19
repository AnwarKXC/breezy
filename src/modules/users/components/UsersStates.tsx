interface UsersStateCardProps {
  title: string
  description?: string
}

export function UsersLoadingState() {
  return (
    <div className="rounded-xl bg-white p-5 ">
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex items-center gap-4 border-b border-[#EAEAEA] pb-4 last:border-0 last:pb-0">
            <div className="h-10 w-10 rounded-full bg-[#EAEAEA] animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-36 rounded-xl bg-[#EAEAEA] animate-pulse" />
              <div className="h-3 w-56 rounded-xl bg-[#EAEAEA] animate-pulse" />
            </div>
            <div className="h-8 w-24 rounded-xl bg-[#EAEAEA] animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function UsersStateCard({ title, description }: UsersStateCardProps) {
  return (
    <div className="rounded-xl bg-white p-10 text-center ">
      <h2 className="text-base font-bold text-[#1A1A1A]">{title}</h2>
      {description ? <p className="mt-2 text-sm text-[#787774]">{description}</p> : null}
    </div>
  )
}

