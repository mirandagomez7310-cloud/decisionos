import { z } from 'zod'
// jitless antes de construir cualquier esquema: z.object sondea `new Function` en init y la CSP reporta la violación aunque se trague el error.
z.config({ jitless: true })
export { z }
