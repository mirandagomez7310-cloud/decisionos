# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Principal:** propietario o director general de una distribuidora o mayorista en México, con inventario, ventas recurrentes y muchos clientes. Consulta DecisionOS tanto en el teléfono (vistazos rápidos entre visitas a clientes o en el almacén) como en escritorio (análisis con calma); los dos usos pesan igual.
- **Secundarios (pendiente de validar):** gerentes de ventas, compras y finanzas.
- Su trabajo: saber dónde pierde dinero, qué productos y clientes son rentables, qué inventario inmoviliza capital, qué clientes son riesgo, por qué cambian sus ventas y qué decidir primero.

## Product Purpose

SaaS B2B de Business Intelligence y soporte a decisiones con IA. Lee los datos que la empresa ya tiene (hoy CSV y Excel exportados de su sistema; después integraciones) y los convierte en diagnósticos, alertas, análisis y recomendaciones accionables con cifras verificables. No es un ERP, ni un dashboard genérico, ni un sistema de captura: no sustituye el sistema de ventas, inventario o facturación del cliente.

Éxito: el propietario responde una de sus seis preguntas con una cifra en la que confía y actúa sobre ella. Métricas de éxito del producto (adopción, tiempo hasta el primer insight, retención): pendientes de definir.

## Positioning

Separa siempre hechos, hipótesis y sugerencias, y cada insight apunta a la evidencia (cifras y periodo) que lo sustenta. Los cálculos financieros son deterministas (SQL o TypeScript con tests); la IA solo lee cifras ya calculadas y redacta o prioriza, nunca calcula. Las métricas declaran su cobertura ("calculado sobre el 83 % de las líneas con costo") en lugar de aparentar precisión.

## Operating Context

- Los datos entran por importación de CSV/Excel con un asistente (subir, mapear columnas, validar por fila, confirmar, revertir).
- Multi-organización con roles owner, admin, analyst y viewer; aislamiento por organización garantizado en la base de datos (RLS). Importaciones y cambios de administración quedan auditados.
- Mercado inicial México: español de México, moneda MXN, formato `es-MX`, horario local. La arquitectura no asume un solo país ni sector.

## Capabilities and Constraints

- Construido: organizaciones, membresías, invitaciones, auditoría, importación de ventas, productos, clientes, inventario y cuentas por cobrar, catálogo.
- Módulos previstos por fases: Executive Dashboard, Sales, Profit (fase 3); Inventory y Cash (fase 4); Insights, Reports y Alerts (fase 5); AI Business Advisor (fase 6).
- Fuera de alcance: captura operativa, CFDI y contabilidad, integraciones directas con ERP antes de la API, multi-moneda real, app móvil nativa.
- Sin decidir: sistemas de origen reales de los primeros clientes y su formato y periodicidad (D-014).

## Brand Commitments

Solo el nombre: DecisionOS. Sin logo, paleta ni tipografía comprometidos; la identidad sale de la ronda de conceptos de la fase 3.

## Evidence on Hand

No hay clientes, datos reales, testimonios ni casos de éxito. El diseño y las pruebas usan datos sintéticos realistas (fixtures de `e2e/` y generadores de prueba). No se inventan clientes, cifras de impacto ni testimonios.

## Product Principles

1. La cifra manda: cada pantalla responde una de las preguntas del propietario con un número o una frase verificable.
2. Hecho, hipótesis y sugerencia nunca se confunden, ni en datos ni en presentación.
3. Ninguna cifra sin su periodo y su cobertura.
4. Leer en el teléfono, analizar en escritorio, con la misma verdad en los dos.
5. El dato de un cliente jamás llega a otro.

## Accessibility & Inclusion

Contraste AA en modo claro y oscuro, foco visible, todo operable con teclado, `aria-live` para resultados de importación, `role="alert"` en errores y tablas de datos equivalentes a cada gráfica para lectores de pantalla. Respeta `prefers-reduced-motion`.
