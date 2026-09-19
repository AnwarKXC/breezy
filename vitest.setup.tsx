import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

afterEach(() => {
  cleanup()
})

vi.mock('next/image', () => ({
  default: function MockImage(props: Record<string, unknown>) {
    const { src, alt, width, height, className, ...rest } = props as {
      src: string; alt: string; width?: number; height?: number; className?: string; [key: string]: unknown
    }
    return <img src={src} alt={alt} width={width} height={height} className={className} {...rest} />
  },
}))
