'use client'

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react'

interface GlobalLoadingBarContextType {
  start: () => void
  done: () => void
  isLoading: boolean
}

const GlobalLoadingBarContext = createContext<GlobalLoadingBarContextType | null>(null)

export function GlobalLoadingBarProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [animationFrame, setAnimationFrame] = useState<number | null>(null)

  const animate = useCallback(() => {
    setProgress((prev) => {
      if (prev >= 90) return prev
      return prev + Math.random() * 10 + 5
    })
    if (isLoading) {
      setAnimationFrame(requestAnimationFrame(animate))
    }
  }, [isLoading])

  const start = useCallback(() => {
    setIsLoading(true)
    setProgress(0)
    setAnimationFrame(requestAnimationFrame(animate))
  }, [animate])

  const done = useCallback(() => {
    if (animationFrame) cancelAnimationFrame(animationFrame)
    setProgress(100)
    setTimeout(() => {
      setIsLoading(false)
      setProgress(0)
    }, 200)
  }, [animationFrame])

  useEffect(() => {
    return () => {
      if (animationFrame) cancelAnimationFrame(animationFrame)
    }
  }, [animationFrame])

  return (
    <GlobalLoadingBarContext.Provider value={{ start, done, isLoading }}>
      {children}
      {isLoading && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            background: 'linear-gradient(90deg, #3b82f6, #06b6d4)',
            transform: `scaleX(${progress / 100})`,
            transformOrigin: 'left',
            transition: 'transform 0.2s ease-out, opacity 0.2s ease-out',
            zIndex: 9999,
            opacity: isLoading ? 1 : 0,
          }}
          aria-hidden="true"
        />
      )}
    </GlobalLoadingBarContext.Provider>
  )
}

export function useGlobalLoadingBar() {
  const context = useContext(GlobalLoadingBarContext)
  if (!context) {
    throw new Error('useGlobalLoadingBar must be used within GlobalLoadingBarProvider')
  }
  return context
}