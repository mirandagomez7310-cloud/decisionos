# DecisionOS — Product Brief

> Fuente: brief fundacional del 2026-11-11. Este documento no añade requisitos: recoge los del brief y marca como **pendiente** lo que aún no está definido.

## Qué es

Plataforma SaaS B2B de Business Intelligence + soporte a decisiones con IA para distribuidoras y mayoristas en México. Se conecta a los datos que la empresa ya tiene (hoy: CSV y Excel; mañana: integraciones) y los convierte en diagnósticos, alertas, análisis y recomendaciones accionables.

**No es** un ERP, ni un dashboard genérico, ni un sistema de captura operativa. No sustituye el sistema de ventas, inventario o facturación del cliente: lo lee.

## Cliente inicial

- Distribuidoras y empresas mayoristas con inventario, ventas recurrentes y múltiples clientes.
- Usuario principal: propietario o director general. Usuarios secundarios: gerentes de ventas, compras y finanzas (pendiente de validar).
- Mercado inicial: México (moneda MXN, español, horario local). La arquitectura no asume un solo país ni sector.

## Propuesta de valor

Ayudar al propietario a responder, con datos verificables:

1. ¿Dónde estoy perdiendo dinero?
2. ¿Qué productos son realmente rentables?
3. ¿Qué inventario está inmovilizando capital?
4. ¿Qué clientes representan riesgos?
5. ¿Por qué están cambiando mis ventas?
6. ¿Qué decisiones debería priorizar?

## Principios no negociables

- **Hechos, hipótesis y sugerencias se distinguen siempre.** Cada insight lleva su tipo y apunta a la evidencia (cifras y periodo) que lo sustenta.
- **Los cálculos financieros son deterministas.** Se hacen en SQL o TypeScript con tests; el LLM lee cifras ya calculadas y redacta o prioriza, nunca calcula.
- **Datos aislados por organización.** Un cliente jamás ve datos de otro; la garantía vive en la base de datos (RLS), no solo en la aplicación.
- **Auditoría.** Importaciones, cambios de configuración y acciones de administración quedan registradas.

## Módulos (arquitectura modular; solo se construyen cuando el roadmap lo indica)

| # | Módulo | Pregunta que responde | Estado |
|---|---|---|---|
| 1 | Executive Dashboard | Estado del negocio en una pantalla | Diseñado, no construido |
| 2 | Sales Intelligence | Por qué cambian las ventas | Diseñado, no construido |
| 3 | Profit Intelligence | Qué productos y clientes son rentables | Diseñado, no construido |
| 4 | Inventory Intelligence | Qué inventario inmoviliza capital | Diseñado, no construido |
| 5 | Cash Intelligence | Cobranza, riesgo de clientes, flujo | Diseñado, no construido |
| 6 | AI Business Advisor | Qué priorizar y por qué | Diseñado, no construido |
| 7 | Data Import & Integrations | Cómo entran los datos | Diseñado, no construido |
| 8 | Reports & Alerts | Qué ha cambiado y a quién avisar | Diseñado, no construido |
| 9 | Multi-tenant Administration | Organizaciones, usuarios, roles, auditoría | Diseñado, no construido |

## Fuera de alcance (por ahora)

- Captura de ventas, compras o inventario dentro de DecisionOS.
- Facturación electrónica (CFDI) y contabilidad.
- Integraciones directas con ERP: primero CSV/Excel; la API llega después (ver `ROADMAP.md`).
- Suscripciones y cobro: previstos en el modelo, no implementados.

## Pendiente de definir con el cliente

- Sistemas de origen reales de las primeras distribuidoras (qué ERP o punto de venta usan y qué exportan).
- Formato y periodicidad de los datos (diario, semanal; por factura o agregado).
- Métricas de éxito del producto (adopción, tiempo hasta el primer insight, retención).
- Modelo de precios y planes.
