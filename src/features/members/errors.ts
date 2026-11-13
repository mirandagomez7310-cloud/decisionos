export function mutationError(code?: string) {
  if (code === '23514')
    return 'La organización necesita al menos un propietario'
  if (code === '42501') return 'No tienes permiso para esta acción'
  if (code === 'PGRST301')
    return 'Tu sesión caducó. Inicia sesión para continuar.'
  return 'No pudimos completar la acción. Inténtalo de nuevo.'
}
