'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

export function NavigationLoader() {
  const pathname = usePathname()
  const [loading, setLoading] = useState(false)
  const prevPathname = useRef(pathname)

  useEffect(() => {
    if (prevPathname.current !== pathname) {
      prevPathname.current = pathname
      setLoading(true)
      const timer = setTimeout(() => setLoading(false), 500)
      return () => clearTimeout(timer)
    }
  }, [pathname])

  if (!loading) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/80">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#EAEAEA] border-t-[#2563EB]" />
    </div>
  )
}
