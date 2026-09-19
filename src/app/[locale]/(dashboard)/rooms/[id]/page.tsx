import dynamic from 'next/dynamic'

const RoomDetailPage = dynamic(() => import('@/modules/rooms/components/RoomDetailPage').then(m => m.RoomDetailPage), {
  loading: () => <PageSkeleton />,
})

function PageSkeleton() {
  return (
    <div className="min-h-screen bg-[#F7F6F3] px-4 py-6 sm:px-6 lg:px-8">
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-48 rounded bg-[#EAEAEA]" />
        <div className="h-64 rounded-xl bg-white" />
      </div>
    </div>
  )
}

export default function Page() {
  return <RoomDetailPage />
}
