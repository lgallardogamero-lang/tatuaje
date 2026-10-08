# Calco: pruébate el tatuaje antes de hacértelo

Aplicación web que simula cómo quedaría un tatuaje sobre la foto de tu piel. Estado actual: **Fase 1 completa** (landing, foto, diseño y editor de colocación, sin IA) más el backend de las fases 2-4 sin interfaz completa. Ver `DECISIONES.md` y `docs/PROGRESO.md`.

## Arrancar en local
```bash
npm install
npm run db:migrate:local      # crea la base de datos local (D1 simulada)
cp .env.example .dev.vars     # y pon al menos SESSION_SECRET
npm run dev                   # http://localhost:3000
```
En local no se envía ningún correo ni se llama a ninguna IA: el enlace de acceso aparece en pantalla y el proveedor de imágenes es simulado (`PROVIDER=mock`). **No cuesta nada.**

## Pruebas
```bash
npm test            # lógica: créditos, trabajos, Stripe, moderación (27 pruebas)
npm run test:e2e    # navegador real, escritorio y móvil (8 pruebas; requiere `npm run dev` en marcha)
npm run typecheck
```

## Estructura
- `src/app` páginas y rutas de la API · `src/components` interfaz · `src/lib` lógica (auth, créditos, trabajos, Stripe, moderación) · `src/lib/providers` proveedores de IA tras una interfaz común · `src/prompts` plantillas de prompt versionadas · `migrations` esquema D1 · `docs` diseño técnico.

## Desplegar en Cloudflare (cuando decidas)
1. `wrangler d1 create tatuaje` y pega el `database_id` en `wrangler.jsonc`; crea el bucket R2 y la cola.
2. Secretos: `wrangler secret put SESSION_SECRET` (y los de `.env.example` que vayas usando).
3. `npm run db:migrate:remote` y `npm run deploy`.

Pendiente antes de producción: `worker.ts` (consumidor de la cola y tarea de borrado horario), claves reales y revisión legal. Detalle en `DECISIONES.md`.
