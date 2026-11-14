export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="app-header">
        <span className="wordmark">DecisionOS</span>
      </header>
      <main id="main-content" tabIndex={-1} className="work-content">
        {children}
      </main>
    </>
  )
}
