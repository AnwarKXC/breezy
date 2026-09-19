'use client'

export function AccountingPageSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 bg-[#F5F5F5] rounded-xl" />
        ))}
      </div>
      <div className="h-12 bg-[#F5F5F5] rounded-lg w-96" />
      <div className="h-96 bg-[#F5F5F5] rounded-xl" />
    </div>
  )
}
