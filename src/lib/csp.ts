export function createCsp(
  nonce: string,
  supabaseUrl: string,
  development: boolean,
) {
  const url = new URL(supabaseUrl)
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' 'nonce-${nonce}' 'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU='`,
    "style-src-attr 'unsafe-inline'",
    `connect-src 'self' ${url.origin} wss://${url.host}`,
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    ...(url.protocol === 'https:' ? ['upgrade-insecure-requests'] : []),
  ].join('; ')
}
