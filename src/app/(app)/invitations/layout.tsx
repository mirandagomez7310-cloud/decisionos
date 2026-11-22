import { AppTopBar } from '@/components/app-account'
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppTopBar />
      <main id="main-content" tabIndex={-1} className="work-content">
        {children}
      </main>
    </>
  )
}