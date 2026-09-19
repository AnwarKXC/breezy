'use client'

import dynamic from 'next/dynamic'
export { toast, type ToastInput, type ToastVariant } from './toastEvents'

const Toaster = dynamic(() =>
  import('react-hot-toast').then((m) => ({ default: m.Toaster })),
  { ssr: false }
)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster
        position="bottom-right"
        reverseOrder={false}
        gutter={10}
        containerClassName="!bottom-4 !right-4"
        toastOptions={{
          duration: 4200,
        }}
      />
    </>
  )
}
