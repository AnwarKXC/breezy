interface LogsStateCardProps {
  description: string
  title: string
}

export function LogsStateCard({ description, title }: LogsStateCardProps) {
  return (
    <div className="rounded-xl bg-white p-10 text-center ">
      <h2 className="text-base font-semibold text-[#1A1A1A]">{title}</h2>
      <p className="mt-2 text-sm text-[#787774]">{description}</p>
    </div>
  )
}

export function LogsLoadingState() {
  return (
    <div className="rounded-xl bg-white p-5 ">
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-12 animate-pulse rounded-xl bg-[#F5F5F5]" />
        ))}
      </div>
    </div>
  )
}
