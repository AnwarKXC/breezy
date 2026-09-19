'use client'

import { useEffect } from 'react'
import { installCsrfHeaderPatch } from '@/shared/csrfClient'

export function CsrfBootstrap() {
  useEffect(() => { installCsrfHeaderPatch() }, [])
  return null
}