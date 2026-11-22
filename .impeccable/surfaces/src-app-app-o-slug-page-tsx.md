---
version: 1
slug: "src-app-app-o-slug-page-tsx"
primary_target: "src/app/(app)/o/[slug]/page.tsx"
related_targets: ["src/app/(app)/o/[slug]/layout.tsx","src/components/organization-navigation.tsx"]
---

## Scope
Executive Dashboard (`/o/[slug]`) y shell de la app, modo Operate, en el mundo Apple de R1 (sustituye «Piso de almacén»). Comparte el mundo con el login.

## Audience and task
Propietario de una distribuidora en México, en teléfono (vistazo) y escritorio (análisis), con el mismo peso. Responde «¿cómo voy?» y «¿dónde pierdo margen?» del periodo frente al anterior. Debe evitar: panel genérico, cifras sin periodo ni cobertura.

## Direction contract
THESIS: La cifra, como en la pantalla de bloqueo, dentro de una app de macOS: título grande, dos cifras protagonistas con su historia y su cobertura visibles, y el porqué del cambio dibujado. Rechaza la rejilla de seis KPIs de colores.
OWN-WORLD: Colores de sistema de Apple (fondo agrupado #F5F5F7 con tarjetas blancas; en oscuro, negro con #1C1C1E), acento systemBlue, verde y rojo con significado, un color por módulo en los iconos de la barra lateral. Pila del sistema, título grande de 34 px y cifras tabulares. Barra lateral translúcida con desenfoque en escritorio y barra de pestañas iOS en móvil.
STORY: Ve ventas y margen con su variación, la sparkline frente al periodo anterior y la cobertura del costo como anillo. Lee el diagnóstico y ve con barras divergentes qué productos y clientes explican el cambio.
FIRST VIEWPORT: Barra lateral a la izquierda con la organización y los módulos agrupados. Título grande «Resumen ejecutivo», el periodo y el control segmentado a la derecha. Dos tarjetas KPI iguales: ventas (cifra, chip, comparación, sparkline) y margen (cifra con %, chip de puntos, anillo de cobertura). Debajo, el diagnóstico y la tarjeta de ventas diarias (líneas con dominio en límites redondos y etiquetas directas). En móvil: una columna con las cifras primero y la barra de pestañas abajo.
FORM: Dirección fijada por la usuaria, sin sorteo: «necesito que sea algo más apegado a Apple design, más gráfico»; referente elegido: «Mezcla» (apple.com en login y vacíos, app de macOS dentro). Movimiento distintivo: el anillo de cobertura se cierra y las sparklines se trazan al cargar y al cambiar de periodo. seed: none (sin tirada: dirección fijada por la usuaria)
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved
R2 y R3 (resto de módulos) en otras sesiones.
