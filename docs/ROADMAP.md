# DecisionOS — Roadmap

Una fase por sesión de trabajo. Al empezar una fase, el estado se toma de la nota del proyecto en Obsidian (`01 Proyectos/DecisionOS.md`: "Estado actual", "Próximo paso", "Problemas conocidos") y de `git log`. Ninguna fase se da por cerrada sin `/validar`, `/security-review` cuando toque, y la actualización de `docs/`.

| Fase | Objetivo | Entrega | Criterio de salida |
|---|---|---|---|
| **0 · Fundación** (2026-11-11) | Arquitectura, modelo de datos, multi-tenant, documentación | `CLAUDE.md`, `docs/*`, repo iniciado | Documentos revisados y decisiones N2 aprobadas o anotadas como pendientes |
| **1 · Esqueleto y tenants** | Proyecto Next.js + Supabase operativo con organizaciones, membresías e invitaciones | Scaffold (`/nuevo-proyecto app-gestion decisionos`, adaptando el modelo de roles a `memberships`), migración `0001_core`, login, crear organización, invitar, cambiar rol, `audit_log`, CI en GitHub (preview en Vercel pospuesta a producción, D-028) | pgTAP con denegación cruzada en verde en CI; E2E de login y membresía; `/security-review` |
| **2 · Importación y datos** | Entrada de datos reales | Migraciones `0002_business` y `0003_imports_jobs`; asistente de importación CSV/Excel (subir, mapear, validar por fila, confirmar, revertir); `jobs` con Vercel Cron; catálogo de productos y clientes | Importar un archivo real de una distribuidora de principio a fin; medir tiempo por 10 000 filas; `EXPLAIN (ANALYZE)` de las políticas sobre `sale_lines`; test cruzado de storage; `/security-review` |
| **3 · Executive Dashboard, Sales y Profit** | Primeras respuestas al propietario | Ronda de conceptos Impeccable y `DESIGN.md`; vistas de métricas (`0004_metrics_views`); dashboard ejecutivo; ventas por periodo con variación; margen por producto y cliente con cobertura | Cifras cuadradas contra el archivo origen en un test; Lighthouse y presupuesto de métricas de la plantilla; INP medido con DevTools |
| **4 · Inventory y Cash** | Capital inmovilizado y riesgo de clientes | Rotación y días de inventario, inventario sin movimiento, antigüedad de saldos, concentración y riesgo por cliente | Mismos criterios que la fase 3 |
| **5 · Insights, Reports y Alerts** | De métricas a diagnóstico | Migración `0005_insights`; motor de reglas (hechos) que genera insights; estados (visto, descartado, hecho); alertas por correo; informe periódico | Cada insight muestra su evidencia; test de reglas con datos de seed; `/security-review` (envío de correo) |
| **6 · AI Business Advisor** | Priorizar y explicar | Adaptador LLM en `lib/server/ai/` (proveedor y modelo decididos con documentación vigente); hipótesis y sugerencias citando insights; caché por organización y periodo; límites de uso | El LLM nunca produce una cifra que no esté en `metric_snapshot`; test que lo comprueba; evaluación manual con un propietario |
| **7 · Plataforma** | Crecer sin reconstruir | Salida a producción: proyecto Supabase en la nube y despliegue en Vercel (D-028); API `v1` con tokens por organización; suscripciones y planes; primera integración directa con un sistema origen real | Decidido con datos de las fases 2 a 6 |

## Fuera del roadmap hasta nueva decisión

Captura operativa, CFDI, multi-moneda real, app móvil nativa, marketplace de integraciones.

## Casos límite que toda fase cubre (en plan y tests)

Organización sin datos · usuario sin membresía · sesión caducada a mitad de un formulario · doble envío · importación repetida del mismo archivo · importación a medias por corte de función · revocar un rol con sesión abierta · archivo con columnas inesperadas o codificación distinta de UTF-8 · cifras sin costo (cobertura parcial) · periodos sin ventas.
