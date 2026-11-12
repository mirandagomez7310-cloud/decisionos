'use client'
export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="es">
      <body>
        <main role="alert">
          <h1>No pudimos cargar DecisionOS</h1>
          <p>Inténtalo de nuevo en unos momentos.</p>
          <button onClick={reset}>Reintentar</button>
        </main>
      </body>
    </html>
  )
}
