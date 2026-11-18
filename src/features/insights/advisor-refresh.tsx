'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export function AdvisorRefresh() {
  const router = useRouter()
  useEffect(() => {
    const interval = window.setInterval(() => router.refresh(), 3000)
    const timeout = window.setTimeout(
      () => window.clearInterval(interval),
      120000,
    )
    return () => {
      window.clearInterval(interval)
      window.clearTimeout(timeout)
    }
  }, [router])
  return <output>Generando recomendaciones…</output>
}
