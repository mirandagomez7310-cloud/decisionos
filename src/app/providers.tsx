'use client'
import { z } from 'zod'
import { Toaster } from '@/components/ui/sonner'
z.config({ jitless: true })
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster />
    </>
  )
}
