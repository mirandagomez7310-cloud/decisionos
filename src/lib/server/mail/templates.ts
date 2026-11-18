import type { Insight } from '@/lib/supabase/types'

const entities: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (character) => entities[character]!)

export function alertEmail({
  organizationName,
  appUrl,
  slug,
  insights,
}: {
  organizationName: string
  appUrl: string
  slug: string
  insights: Pick<Insight, 'severity' | 'title' | 'body'>[]
}) {
  const summary =
    insights.length === 1
      ? '1 alerta nueva'
      : `${insights.length} alertas nuevas`
  const subject = `DecisionOS · ${summary} en ${organizationName.replace(/[\r\n]/g, ' ')}`
  const url = new URL(`/o/${encodeURIComponent(slug)}/insights`, appUrl).href
  const entries = insights.map(({ severity, title, body }) => ({
    heading: `${severity === 'critical' ? 'Crítico' : 'Atención'} · ${title}`,
    body,
  }))

  return {
    subject,
    text: [
      subject,
      ...entries.map(({ heading, body }) => `${heading}\n${body}`),
      `Ver diagnóstico: ${url}`,
    ].join('\n\n'),
    html: `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head><body><h1>${escapeHtml(subject)}</h1><ul>${entries.map(({ heading, body }) => `<li><h2>${escapeHtml(heading)}</h2><p>${escapeHtml(body)}</p></li>`).join('')}</ul><p><a href="${escapeHtml(url)}">Ver diagnóstico</a></p></body></html>`,
  }
}
