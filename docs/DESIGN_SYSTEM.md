# DecisionOS — Sistema de diseño (principios y restricciones)

Estado: dirección sin ejecutar. Colores, tipografías y tokens concretos **no se fijan aquí**: salen de la ronda de conceptos de Impeccable al construir la primera pantalla (fase 3) y se documentan entonces en `DESIGN.md` con sus tokens. Este archivo define qué debe cumplir cualquier dirección que se elija.

## Lo que el producto debe transmitir

Un propietario abre DecisionOS para saber dónde pierde dinero y qué hacer primero. La interfaz es un instrumento de lectura: calma, precisa, sin ruido. Debe sentirse como un producto comercial que compite internacionalmente, no como un panel administrativo.

## Principios

1. **La cifra manda.** Cada pantalla tiene un número o una frase que responde una pregunta del brief. Todo lo demás la sustenta.
2. **Jerarquía por tipografía y espacio, no por cajas.** Las tarjetas se usan cuando agrupan una acción, no para decorar. Separar con espacio y líneas finas antes que con bordes y sombras.
3. **Hechos, hipótesis y sugerencias se ven distintos.** Un hecho se presenta con la seguridad de una cifra; una hipótesis con su condición; una sugerencia como acción con su evidencia enlazada. Esta distinción es visual, no solo textual.
4. **Un solo acento para actuar; un segundo solo para riesgo.** Nada más tiene color por sí mismo. Las gráficas usan la paleta de datos (abajo), no el acento.
5. **Densidad útil.** Pantallas de lectura (dashboard, advisor) amplias; pantallas de trabajo (tablas, importaciones) densas y alineadas. Las dos conviven con los mismos tokens.
6. **Movimiento con propósito.** Microanimaciones que confirman (guardado, filtro aplicado) o guían (cambio de periodo); ninguna en datos funcionales ni en acciones de teclado. Respeta `prefers-reduced-motion`.
7. **Modo claro y oscuro con la misma jerarquía.** Se diseñan a la vez; el oscuro no es una inversión automática.

## Direcciones visuales candidatas (una línea cada una; elige la ronda de Impeccable)

- **Libro mayor.** El estado de cuenta que un contador deja sobre la mesa del dueño: columnas de cifras alineadas, filetes finos, márgenes anchos, una sola tinta de acento. Confianza por sobriedad.
- **Piso de almacén.** Racks, tarimas y etiquetas plantilladas: retícula densa y utilitaria, rótulos cortos en mayúsculas pequeñas, un color de señalización industrial reservado a las alertas. Energía de operación.
- **Mesa de despacho.** El mostrador donde se cruzan pedidos, rutas y cobros: paneles como tickets y hojas de ruta, jerarquía solo por tamaño y peso, neutros cálidos de papel kraft y copia al carbón. Cercanía y oficio.

Ninguna de las tres puede resolverse con los valores por defecto de IA (crema + serif + terracota, casi negro + acento ácido, degradado morado-azul, Inter o Space Grotesk).

## Restricciones de ejecución

- **Números.** Numerales tabulares en toda cifra; formato `es-MX` (`$1,234,567.89`, `12.3 %`); negativos con signo, nunca solo en rojo; periodos siempre visibles junto a la cifra ("últimos 30 días vs. 30 anteriores").
- **Gráficas.** Antes de la primera gráfica, leer la skill `dataviz`. Reglas fijas: una familia de gráficas en todo el producto, ejes y unidades siempre legibles, tooltips con la cifra exacta, paleta categórica y secuencial propia validada en claro y oscuro, nunca más de seis series sin agrupación, sin gráficas de pastel para comparar proporciones.
- **Tablas.** Orden, filtro y paginación en servidor; cabecera fija; columnas numéricas alineadas a la derecha; fila de totales cuando aplica.
- **Estados obligatorios en cada vista.** Cargando (esqueleto, no spinner), vacío, sin permiso, error. El vacío más importante del producto es **"aún no hay datos"** antes de la primera importación: explica qué importar y lleva a hacerlo.
- **Accesibilidad.** Contraste AA en ambos modos, foco visible, todo operable con teclado, `aria-live` para resultados de importación, `role="alert"` en errores, etiquetas en gráficas y tablas de datos equivalentes para lectores de pantalla.
- **Responsive.** Móvil es lectura (dashboard, insights, alertas); importación y administración se optimizan para escritorio pero funcionan en móvil. Nunca scroll horizontal de página.
- **Copy.** Español de México, directo, sin jerga de BI ("rotación de inventario" con su definición a un clic). Los títulos de insight son frases con verbo.

## Evitar

Plantilla administrativa genérica · exceso de tarjetas · gradientes decorativos · iconografía sin función · sombras apiladas · tipografía por defecto del framework · colores de marca en gráficas · animaciones en tablas y formularios · dashboards que muestran todo y no responden nada.

## Componentes que el producto necesita (inventario inicial)

Cifra principal con variación y periodo · lista de insights (hecho / hipótesis / sugerencia) con evidencia desplegable · selector de periodo · tabla de datos · asistente de importación (subir, mapear columnas, revisar errores, confirmar) · navegación por módulos con organización activa · ajustes de organización y miembros · diálogo de confirmación y deshacer. Base: shadcn/ui; identidad: tokens del `DESIGN.md` que escriba Impeccable.
