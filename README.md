# Calco: pruébate el tatuaje antes de hacértelo

Aplicación web que simula cómo quedaría un tatuaje sobre la foto de tu piel. Estado actual: **fases 1, 2 y 3 completas con proveedor de IA simulado** (landing, asistente, generación, resultado antes/después), y parte de la 4 (créditos, marca de agua, stencil, cuenta). Ver `DECISIONES.md` y `docs/PROGRESO.md`.

## Arrancar en local
```bash
npm install
npm run db:migrate:local      # crea la base de datos local (D1 simulada)
cp .env.example .dev.vars     # y pon al menos SESSION_SECRET
npm run dev                   # http://localhost:3000
```
En local no se envía ningún correo ni se llama a ninguna IA: el enlace de acceso aparece en pantalla y el proveedor de imágenes es simulado (`PROVIDER=mock`). **No cuesta nada.**

Si cambias una migración antes de desplegar, recrea la base local: `rm -rf .wrangler/state && npm run db:migrate:local`.

## Pruebas
```bash
npm test            # lógica: créditos, trabajos, Stripe, moderación (60 pruebas)
npm run test:e2e    # navegador real, escritorio y móvil (34 pruebas; requiere `npm run dev` en marcha)
npm run typecheck
```

## Administración
Tu email debe estar en `ADMIN_EMAILS` (en local ya está en `.dev.vars`; en producción: `wrangler secret put ADMIN_EMAILS`). Al entrar verás «Administración» en la cabecera:
resumen de ingresos, coste de IA y margen · usuarios (regalar o quitar créditos, bloquear, dar o quitar rol de administrador, borrar fotos o cuenta) · estudios · precios editables · registro de auditoría. Las personas sin rol reciben un 404.

## Estudios
El administrador da de alta el estudio (`/admin/estudios`) con su responsable y su plan. El responsable ve **Mi estudio** (`/estudio`): uso mensual, catálogo de flash, equipo, datos para el directorio y solicitudes de clientes. En el asistente, quien pertenece a un estudio activo puede usar el cupo del estudio y probar diseños del catálogo; sus resultados salen sin marca de agua. El directorio público está en `/directorio`.

Los estudios pueden **solicitar el alta** desde `/estudios` (tú recibes un aviso por email y la apruebas o rechazas en `/admin/estudios`). El responsable personaliza su **marca** (color y logo), que aparece en los resultados de sus clientes y en las imágenes que descargan. Cuando un cliente le escribe desde el directorio, el estudio recibe un email.

## Accesibilidad y SEO
`npm run test:e2e` incluye auditorías automáticas con axe (WCAG 2.1 A/AA) en las pantallas principales. Hay `robots.txt`, `sitemap.xml` e imagen para redes (`public/og.png`, se regenera con `node scripts/og.mjs`). Al compilar para producción define `NEXT_PUBLIC_APP_URL` con tu dominio.

## Estructura
- `src/app` páginas y rutas de la API · `src/components` interfaz · `src/lib` lógica (auth, créditos, trabajos, Stripe, moderación) · `src/lib/providers` proveedores de IA tras una interfaz común · `src/prompts` plantillas de prompt versionadas · `migrations` esquema D1 · `docs` diseño técnico.

## Desplegar en Cloudflare
Probado hasta donde se puede sin tu cuenta: `npx opennextjs-cloudflare build` compila y `npx wrangler deploy --dry-run` valida el Worker (1,6 MiB comprimido, con la cola y la tarea horaria). **No se ha desplegado nunca.**

1. `npx wrangler login`, y crea los recursos:
   ```bash
   npx wrangler d1 create tatuaje          # pega el database_id en wrangler.jsonc
   npx wrangler r2 bucket create tatuaje-uploads
   npx wrangler queues create tatuaje-jobs
   ```
2. En `wrangler.jsonc`, cambia `APP_URL` por tu dominio (con `https://`). Deja `QUEUE_MODE` en `queue`.
3. Secretos (`npx wrangler secret put NOMBRE`): `SESSION_SECRET` (cadena aleatoria larga), `ADMIN_EMAILS` (tu email) y, según vayas activando servicios, `RESEND_API_KEY` + `EMAIL_FROM` (y `EMAIL_PROVIDER=resend`), `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`, `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`, `TURNSTILE_SECRET` (y `NEXT_PUBLIC_TURNSTILE_SITEKEY` al compilar), `OPENAI_API_KEY` (y `PROVIDER=openai`).
4. `npm run db:migrate:remote` y `npm run deploy`. Asocia tu dominio al Worker desde el panel de Cloudflare.
5. En R2, crea una regla de ciclo de vida que borre los objetos a las 24 h salvo el prefijo `org/` (catálogos de estudios): es la segunda garantía de borrado, además de la tarea horaria.
6. En Cloudflare, añade reglas de Rate Limiting delante de `/api/auth/*` y `/api/jobs` como defensa extra.
7. En Stripe, crea el webhook hacia `https://TU-DOMINIO/api/stripe/webhook` con los eventos `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`, `customer.subscription.updated`, `customer.subscription.deleted` e `invoice.payment_failed`.

**Antes de abrirlo al público:** `PROVIDER=mock` genera dibujos de ejemplo, no tatuajes reales, y `DISABLE_ABUSE_LIMITS` no debe existir en producción. Comprueba también la revisión legal pendiente (ver `DECISIONES.md`).
