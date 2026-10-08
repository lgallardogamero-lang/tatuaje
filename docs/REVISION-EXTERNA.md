# Encargo de revisión externa (para Codex u otro revisor)

Proyecto: **Calco**, web en español para probarse un tatuaje en una foto de la propia piel con IA.
Stack: Next.js 16.3.8 (fijado; la 16.4.0 rompe el Worker), React 19, Tailwind 4, TypeScript, Cloudflare Workers + D1 + R2 + Queues (OpenNext), Stripe, tests con vitest y Playwright.

**Antes de tocar nada:** lee `AGENTS.md` (esta versión de Next.js tiene cambios importantes; consulta `node_modules/next/dist/docs/`), `DECISIONES.md` y `docs/DISENO.md`.

## Reglas del encargo
- Trabaja en una **rama aparte**, no en `claude/gracious-hopper-nsoero`.
- Cambios **pequeños y justificados**; no reescribas por estilo.
- Todo cambio debe pasar `npm test` (unitarios), `npm run test:e2e` y `npm run build`.
- No subas la versión de `next` ni cambies dependencias sin motivo.
- No pongas claves ni datos reales en el código.

## Qué revisar, por prioridad
1. **Créditos y pagos** (`src/lib/credits.ts`, `stripe.ts`, `billing.ts`, `api/stripe/*`): gasto atómico, devolución idempotente, índice único (reason, ref), webhook con firma y sin doble proceso. Buscar condiciones de carrera.
2. **Seguridad y privacidad** (`auth.ts`, `storage.ts`, `api/jobs/*`, `jobs.ts`, `worker.ts`): sesiones, CSRF por Origin, aislamiento entre usuarios, acceso a fotos, borrado a las 24 h, CSP, límites de abuso (`ratelimit.ts`).
3. **Flujo de IA** (`providers/openai.ts`, `src/prompts/v1.ts`, `mask.ts`, `png.ts`): el proveedor real **nunca se ha probado contra OpenAI**; revisar parámetros, formato de máscara, errores transitorios y reembolso del crédito si falla.
4. **Estudios y administración** (`studio*.ts`, `admin.ts`, rutas `/admin`, `/estudio`): permisos, cuotas, audit log, precios editables.
5. **Simplificación**: código duplicado o muerto, sin cambiar el comportamiento.

## Qué entregar
Una lista de hallazgos ordenada por gravedad (archivo, línea, qué pasa, cómo reproducirlo) y, si procede, commits pequeños en la rama aparte con los tests pasando.
