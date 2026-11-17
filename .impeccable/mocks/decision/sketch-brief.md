# Brief para Codex: tres bocetos HTML del primer viewport del Executive Dashboard

Escribe exactamente tres archivos nuevos y no toques nada más del repositorio:

- `.impeccable/mocks/decision/assigned.html` (dirección «Piso de almacén»)
- `.impeccable/mocks/decision/model-pick.html` (dirección «Libro mayor»)
- `.impeccable/mocks/decision/canon.html` (estándar de la categoría)

## Reglas comunes
- Un solo archivo autocontenido cada uno: HTML + `<style>` en línea, **sin JavaScript**, nada externo salvo Google Fonts. Menos de 200 líneas. UTF-8 sin BOM.
- Solo el primer viewport, escritorio: `html, body { width: 1440px; height: 900px; overflow: hidden; margin: 0 }`.
- Modo claro. Numerales tabulares (`font-variant-numeric: tabular-nums`) en toda cifra. Formato `es-MX`: `$1,284,530.00`, `12.3 %`. Negativos con signo `−`, nunca solo en color.
- Contenido real del producto (datos sintéticos, sin inventar clientes reales): organización «Distribuidora del Bajío» (ejemplo), periodo **«1–13 nov 2026 vs. 1–13 oct 2026»**.
- Estructura de pantalla de trabajo, con controles estándar reconocibles (navegación, selector, tabla con cabeceras), nunca un póster ni un disfraz de objeto.
- No uses Inter, Space Grotesk, IBM Plex, DM Sans ni Fraunces.

## Contenido (igual en los tres)
- Navegación: DecisionOS · Inicio · Ventas · Margen · Importaciones · Catálogo; organización activa; selector de periodo «Mes en curso vs. anterior».
- Dos cifras principales **del mismo peso**:
  - Ventas netas **$1,284,530.00**, **+12.3 %** frente a $1,143,820.00.
  - Margen bruto **$398,204.00 · 31.0 %**, **−1.8 pts**; «Cobertura: 83 % de las líneas con costo».
- Curva diaria de ventas del mes actual frente al anterior (SVG simple de 13 puntos frente a 31; el actual en la tinta reservada).
- «Qué explica el cambio»: dos tablas cortas (4 filas cada una), columnas alineadas a la derecha:
  - Productos que más mueven la venta: «Aceite vegetal 20 L» +$84,200.00 · «Detergente industrial 10 kg» +$41,950.00 · «Azúcar estándar 50 kg» −$22,310.00 · «Harina de trigo 44 kg» −$9,870.00.
  - Clientes: «Abarrotes La Esperanza» +$52,400.00 · «Cremería San Juan» +$18,730.00 · «Tienda Don Pepe» −$14,200.00 · «Mini súper El Faro» −$6,050.00.
- Un estado visible: la fila de margen de «Azúcar estándar 50 kg» con margen negativo (−2.4 %) marcada como riesgo.

## 1. `assigned.html` · Piso de almacén
Racks selectivos, etiquetas de ubicación y marcas de piso de una bodega de distribución, traducidos a una pantalla de trabajo limpia.
- Paleta: fondo concreto `#E7E5DF`, barra superior acero de rack `#1D3F66` (texto blanco), tinta `#1A1D21`, amarillo de etiqueta `#F2C230` (acento de acción y bloque de código de la etiqueta), naranja de travesaño `#D9531E` solo para riesgo. Periodo actual en `#1D3F66`, anterior en gris `#9A9891`.
- Tipo: Barlow para la interfaz y Barlow Condensed para etiquetas y rótulos en mayúsculas pequeñas.
- **Movimiento distintivo: la etiqueta de ubicación.** Cada cifra principal lleva una etiqueta como las de rack: rectángulo de etiqueta blanca con un bloque amarillo a la izquierda con su código (`VTA · NOV`, `MGN · NOV`) y debajo el periodo y la cobertura en condensada.
- Cifras principales a tamaño de cartel (unos 88 px), todo lo demás pequeño.
- Sin tarjetas ni sombras: las columnas se separan con montantes verticales finos (1 px `#1D3F66` al 35 %), como la retícula de un rack.
- Cifras pegadas al margen derecho de su columna.

## 2. `model-pick.html` · Libro mayor
El estado de cuenta que el contador deja sobre el escritorio del dueño.
- Paleta: papel `#EEF1EA`, rayado verde `#3E6B4F` (filetes finos y acento), tinta `#1B1F1C`, rojo `#B3261E` solo para riesgo.
- Tipo: Public Sans; cifras tabulares.
- Cabecera de periodo como encabezado de estado de cuenta; ventas y margen como dos saldos grandes; detalle en columnas con rayado horizontal fino; una sola tinta de acento.

## 3. `canon.html` · Estándar de la categoría
El dashboard de BI que todo el mundo espera, bien hecho: barra lateral oscura `#0F172A`, fondo `#FFFFFF`/`#F8FAFC`, fila de tarjetas KPI con borde `#E2E8F0` y sombra suave, acento `#2563EB`, tipo Manrope, dos paneles de gráfica y tabla debajo.

## Informe final (en español, breve)
Los tres archivos escritos y su número de líneas.
