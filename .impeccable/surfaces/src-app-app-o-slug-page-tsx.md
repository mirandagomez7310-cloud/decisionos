---
version: 1
slug: "src-app-app-o-slug-page-tsx"
primary_target: "src/app/(app)/o/[slug]/page.tsx"
related_targets: []
---

## Scope
Executive Dashboard (`/o/[slug]`), modo Operate. Primera pantalla del mundo «Piso de almacén»; el resto de la app (importaciones, catálogo, miembros, ventas, margen) hereda este mundo.

## Audience and task
Propietario de una distribuidora en México, en teléfono (vistazo) y escritorio (análisis) con el mismo peso. Responde a la vez «¿cómo voy?» y «¿dónde pierdo margen?» del mes en curso frente al mismo tramo del mes anterior. Debe evitar: panel genérico, cifras sin periodo ni cobertura, tono frío.

## Direction contract
THESIS: Cada cifra está archivada como una tarima en su rack: etiqueta de ubicación, periodo y cobertura siempre a la vista. Rechaza la rejilla de tarjetas KPI con gráficas de colores.
OWN-WORLD: Concreto pulido claro de fondo, barra superior en acero azul de rack, tinta casi negra cálida, amarillo de etiqueta solo para acción y bloque de código de etiqueta, naranja de travesaño solo para riesgo; periodo actual en azul de rack, anterior en gris. Barlow para interfaz y Barlow Condensed en mayúsculas para etiquetas y rótulos. Sin tarjetas ni sombras: montantes finos de rack separan columnas. En oscuro, fondo azul de rack profundo, nunca negro.
STORY: El propietario ve en un segundo sus ventas y su margen del mes con variación, entiende qué productos y clientes explican el cambio, detecta el producto con margen negativo y entra al detalle.
FIRST VIEWPORT: Barra superior con DecisionOS, módulos y organización. Título «Resumen ejecutivo» con periodo y selector de periodo amarillo a la derecha. Dos columnas iguales separadas por un montante: ventas netas y margen bruto, cada una con su etiqueta de ubicación (código amarillo VTA·NOV / MGN·NOV), cifra de cartel alineada a la derecha, variación, comparación y cobertura. Debajo, curva diaria a todo el ancho (actual frente a anterior) y «Qué explica el cambio» en dos tablas. En móvil: una columna, cifras primero.
FORM: Piso de almacén, candidato 5 de 7 de la lista ordenada (1 Libro mayor, 2 Talonario de remisiones, 3 Almanaque del proveedor, 4 Caja corrugada, 5 Piso de almacén, 6 Rótulos de la central de abastos, 7 Hoja de ruta del repartidor). Raises: escala de leyenda a cartel (Metro); retícula visible como montantes (Crouwel); vocabulario de estado fijo completa / cobertura parcial / sin datos / sin comparación (metro esmaltado); cifras contra el margen derecho con capacidad fija (casete); tinta reservada al periodo actual (orientación); columnas que no se mueven al cambiar de periodo (tablero de salidas). Movimiento distintivo: la etiqueta de ubicación; al cambiar de periodo, las etiquetas se re-rotulan en su sitio. seed:cdc199673f38f965
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Composition reference
`.impeccable/mocks/decision/assigned.html` (boceto elegido). Corregir en la construcción: la curva diaria ocupa todo el ancho con ejes legibles.

## Unresolved
Librería de gráficas (D-016), con la skill `dataviz`.
