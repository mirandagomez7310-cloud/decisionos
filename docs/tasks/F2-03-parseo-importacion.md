# F2-03 · `lib/server/imports`: parseo CSV/Excel, mapeo y validación por fila (fase 2, corte 3)

Brief para Codex. Límites: `docs/tasks/F1-01-scaffold.md`; sin `supabase`, `test:e2e` ni `lhci` (D-027). UTF-8 sin BOM. TypeScript puro en Node, sin acceso a base de datos ni a React: todo probado con Vitest. Lee `docs/DATABASE_SCHEMA.md` (tablas de negocio) y `docs/ARCHITECTURE.md` (flujo de datos).

## Dependencias (aprobadas en D-011)
`npm.cmd install papaparse read-excel-file` y `npm.cmd install -D @types/papaparse`. Lee la API en `node_modules/<paquete>/README.md` (no de memoria): `read-excel-file/node` para Buffer y la opción `schema`/`map` si la usas; `papaparse` con `header: true`, `skipEmptyLines: 'greedy'`, autodetección de delimitador.

## Entregables (`src/lib/server/imports/`)
1. `kinds.ts`: por cada `kind` (`sales`, `products`, `customers`, `inventory`, `receivables`) la lista de campos canónicos con `required`, tipo (`text | number | money | quantity | date | boolean | enum`), sinónimos de cabecera en español e inglés (p. ej. `sku`: `sku, clave, código, codigo, código de producto, product_code, item`) y el esquema Zod de la fila ya mapeada (`z` desde `@/lib/zod`). Campos:
   - `products`: `sku*`, `name*`, `category`, `unit`, `standard_cost`, `list_price`, `active` (default `true`).
   - `customers`: `code*`, `name*`, `segment`, `credit_limit`, `payment_terms_days`, `active`.
   - `sales` (plano, una fila por línea de venta): `external_ref*`, `sold_on*`, `customer_code*`, `customer_name`, `product_sku*`, `product_name`, `quantity*`, `unit_price*`, `unit_cost`, `discount` (default 0), `line_total` (si falta: `quantity * unit_price - discount`, redondeado a 2 decimales; si viene y difiere en más de 0,01 → error de fila), `status` (default `completed`), `currency` (default: la de la organización, se pasa en el contexto), `tax` (importe de la cabecera, opcional).
   - `inventory`: `product_sku*`, `snapshot_on*`, `quantity*`, `unit_cost`.
   - `receivables`: `external_ref*`, `customer_code*`, `issued_on*`, `due_on*`, `amount*`, `paid_amount` (default 0), `sale_external_ref`.
2. `parse.ts`: `parseFile(buffer: Buffer, filename: string): Promise<{ headers: string[]; rows: Record<string, string>[]; warnings: string[] }>`. CSV: detecta BOM UTF-8; decodifica como UTF-8 con `TextDecoder('utf-8', { fatal: true })` y, si falla, `windows-1252` (añade un `warning`). Excel (`.xlsx`): primera hoja, primera fila como cabecera, celdas a texto (fechas de Excel a ISO `YYYY-MM-DD`). `.xls` antiguo: error claro «Guarda el archivo como .xlsx» (límite documentado en D-011). Cabeceras duplicadas o vacías → error. Más de 100 000 filas → error (presupuesto de esta fase). `shortcut:` parsea el archivo entero en memoria (límite 25 MB del bucket); pasar a streaming si un archivo real supera el tiempo de función.
3. `mapping.ts`: `suggestMapping(headers, kind)` → `Record<campo, cabecera | null>` por normalización (minúsculas, sin acentos, sin espacios ni guiones) y sinónimos; `validateMapping(mapping, kind)` → faltan requeridos / cabecera usada dos veces.
4. `validate.ts`: `validateRows(rows, mapping, kind, ctx: { currency: string })` → `{ ok: RowOk[]; errors: RowError[]; summary }` con `rowNumber` (1 = primera fila de datos). Conversión de valores antes de Zod: números con separadores de miles y símbolo de moneda (`$1,234.50`, `1.234,50` si el separador decimal es coma y hay dos decimales), fechas `YYYY-MM-DD`, `DD/MM/YYYY`, `DD-MM-YYYY` y serial de Excel; booleanos `sí/no/true/false/1/0`. Errores por campo en español, legibles por el propietario («Fila 12: la cantidad no es un número»).
5. Tests Vitest con fixtures pequeñas en `src/lib/server/imports/__fixtures__/` (CSV UTF-8 con BOM, CSV latin1, CSV con `;`, un `.xlsx` mínimo generado en el propio test si no hay forma sencilla de incluirlo): parseo, sugerencia de mapeo con cabeceras en español, validación con filas buenas y malas, cálculo y discrepancia de `line_total`, fechas en varios formatos, archivo vacío y sin cabecera.

## Reglas
- Sin `any`; `unknown` y estrechar. Dinero como `string` decimal normalizado (`"1234.50"`), nunca `number` flotante en la salida: la base lo recibe como `numeric`.
- Nada de lógica de base de datos aquí: la escritura va en el job (F2-05).
- `typecheck`, `lint`, `test`, `build` en verde. `git status --short` en el informe.

## Informe final (en español, breve)
Archivos · versiones instaladas (`npm ls papaparse read-excel-file`) · decisiones tomadas donde el brief dejaba margen · comprobaciones · `git status --short`.
