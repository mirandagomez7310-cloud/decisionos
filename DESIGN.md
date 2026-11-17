# DecisionOS ? Piso de almacén

Implementado en F3-02: shell y tokens compartidos. El dashboard se construye en los siguientes cortes.

- Barlow 400/500/600/700 para interfaz; Barlow Condensed 500/600 para rótulos en mayúsculas, tracking 0.04em.
- Tokens canónicos en src/app/globals.css. Fondo claro #E7E5DF, superficie #F3F2EE, tinta #1A1D21, shell #1D3F66, acción #F2C230. Radio base 2px.
- Oscuro según sistema: fondo #0F1E30, superficie #16283D, tinta #E9ECEF, shell #0A1624. Sin interruptor.
- Riesgo textual #A63D16 en claro y #F08050 en oscuro para contraste AA. Series actual/anterior independientes de la acción.
- Shell a todo el ancho con navegación en una franja propia que permite saltos de línea. Permisos owner/admin resueltos en servidor; módulo activo actualizado en cliente.
- Contenido ?til máximo 1280px, márgenes interiores de 16px en móvil y 40px en escritorio. Tablas con rótulos condensados, numerales tabulares y separadores finos; cifras alineadas a la derecha.
- Sin nuevas tarjetas, sombras, imágenes ni animaciones.

Verificación de código: detector mecánico sin incidencias, navegación probada con rutas hijas, cambio de ruta y visibilidad de administración. La revisión visual, capturas y E2E corresponden a Claude Code según el brief; el acabado visual queda pendiente de esa revisión.
