'use client'

import { useState, useEffect } from 'react'

const CLEAN_DURATION_MS = 2 * 60 * 60 * 1000

interface CleanTimerProps {
  dirtySince: string
  className?: string
  onExpire?: () => void
}

export function CleanTimer({ dirtySince, className, onExpire }: CleanTimerProps) {
  const [remaining, setRemaining] = useState('')

  useEffect(() => {
    function tick() {
      const elapsed = Date.now() - new Date(dirtySince).getTime()
      const left = CLEAN_DURATION_MS - elapsed
      if (left <= 0) {
        setRemaining('')
        onExpire?.()
        return
      }
      const totalMin = Math.ceil(left / 60000)
      const h = Math.floor(totalMin / 60)
      const m = totalMin % 60
      setRemaining(h > 0 ? `${h}h ${m}m` : `${m}m`)
    }
    tick()
    const id = setInterval(tick, 30000)
    return () => clearInterval(id)
  }, [dirtySince, onExpire])

  return <span className={className}>{remaining}</span>
}
