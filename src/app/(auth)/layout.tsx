import { ArrowUpRight } from 'lucide-react'
import { CoverageRing } from '@/components/charts/coverage-ring'

// Datos de ejemplo (sintéticos), rotulados como tales en pantalla: ventas diarias de un mes.
const sample = [
  31, 34, 30, 38, 41, 37, 33, 39, 44, 42, 47, 45, 40, 46, 51, 49, 53, 48, 52,
  57, 55, 50, 58, 62, 59, 64, 61, 66, 70, 68,
]
const curve = sample
  .map((value, index) => `${(index / (sample.length - 1)) * 100},${100 - value}`)
  .join(' ')

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-stage">
      <header className="auth-brand">
        <span className="wordmark">DecisionOS</span>
      </header>
      <section className="auth-hero" aria-label="Vista de ejemplo del resumen">
        <p className="auth-hero-label">Ventas netas · noviembre</p>
        <p className="auth-hero-figure">$1,284,500</p>
        <div className="auth-hero-meta">
          <span className="metric-comparison">
            <strong data-trend="up">
              <ArrowUpRight aria-hidden="true" />
              +8.4 %
            </strong>
          </span>
          <span className="auth-coverage">
            <CoverageRing value={83} />
            83 % con costo
          </span>
          <span className="sample-tag">Datos de ejemplo</span>
        </div>
        <p className="auth-tagline">Dónde pierdes dinero y qué decidir primero.</p>
      </section>
      <svg
        className="auth-curve reveal-x"
        viewBox="0 30 100 45"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="auth-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="currentColor" stopOpacity="0.22" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={`0,75 ${curve} 100,75`} fill="url(#auth-fill)" />
        <polyline
          points={curve}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <main id="main-content" tabIndex={-1} className="auth-sheet material">
        {children}
      </main>
    </div>
  )
}
