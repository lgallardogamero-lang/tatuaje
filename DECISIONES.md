# Decisiones tomadas en autónomo (para revisar)

Cada punto indica qué se decidió, por qué y cómo cambiarlo. Ordenadas de más a menos importantes.

## 1. Hosting: Cloudflare, no Vercel + Supabase  ⚠️ REVISAR PRIMERO
- **Conflicto:** durante la sesión dijiste "cloudfare" y que tenías dominio y cuenta ahí; más tarde indicas Vercel + Supabase.
- **Decisión:** se mantiene **Cloudflare** (Workers con OpenNext, D1, R2, Queues) porque ya está construido y probado sobre él y tienes la cuenta. Cambiar ahora costaría rehacer la capa de datos, el almacenamiento y la cola.
- **Si prefieres Vercel + Supabase:** el acoplamiento está concentrado en `src/lib/db.ts` (D1), `src/lib/storage.ts` (R2), `src/lib/env.ts`, `src/lib/jobs.ts` (cola) y `wrangler.jsonc`/`worker.ts`. Es una migración de 1-2 días, no una reescritura. Dímelo y la hago.

## 2. Alcance: fases 1, 2 y 3 hechas (con IA simulada); resto pendiente
- Confirmaste Cloudflare y el proveedor simulado, así que se hicieron las fases 2 y 3 juntas (el trabajo de IA genera diseño y variantes en una sola cadena). Estudios, administración y despliegue siguen pendientes.
- **Ojo:** antes de recibir ese límite ya estaba hecho el backend de las fases 2-4 (créditos, trabajos con proveedor simulado, Stripe, borrado a 24 h) con 27 pruebas. No tiene interfaz completa: faltan la pantalla de resultado, la cuenta y el panel de estudios. Nada de B2B ni administración está construido más allá del esquema de base de datos.

- También se han añadido, aunque son de fases posteriores, páginas mínimas para que ningún enlace dé 404: `/cuenta` (créditos, movimientos, borrar fotos y cuenta; la privacidad lo exigía) y `/estudios` (solo informativa, con los planes previstos y un aviso de "muy pronto").

## 3. Presupuesto de IA: tope ~0,25 € por generación
- Coste estimado con el proveedor recomendado (`gpt-image-2`, calidad media): ~0,14 $ por generación de pago (diseño + 3 variantes) y ~0,07 $ por una prueba gratuita (diseño + 1 variante). Cabe en el tope con margen.
- Calidad "alta" en las variantes llevaría la generación a ~0,5 $, por encima del tope: no se usa. Los precios salen de agregadores y no se han verificado en la web oficial.
- **No se ha gastado nada ni se ha llamado a ninguna API de pago.** El proveedor real (`src/lib/providers/openai.ts`) está escrito pero **sin probar**.

## 4. Pruebas gratuitas: 1 variante y marca de agua
- Según tu última indicación, quien aún no ha comprado créditos recibe 1 variante (`FREE_VARIANTS` en `src/lib/config.ts`); quien ha comprado, 3.
- Los textos de la landing que hablaban de "tres variantes" para todos se han ajustado.

## 5. Marca: "Calco"
- Nombre provisional elegido por su significado (papel de transferencia). Cámbialo en `Logo.tsx`, `layout.tsx` y los textos si ya tienes otro nombre.

## 6. Propuesta visual elegida: A (Calco)
- Detalle y alternativas en `docs/PROPUESTAS_VISUALES.md`.

## 7. Editor propio en Canvas 2D (no Konva)
- Menos dependencias, control total de los gestos táctiles (arrastrar, pellizcar, girar), teclado accesible. Si más adelante necesitas capas o transformadores avanzados, se puede cambiar a Konva.

## 8. Plan Premium de estudios: cupo 400, no 800
- Con el coste actual 800 generaciones por 99 € pierden dinero (ver `docs/DISENO.md` §6 bis). Está en `src/lib/config.ts`. Los estudios no se construyen todavía.

## 9. Textos legales: borradores sin revisión de abogado
- Los textos de privacidad, condiciones y cookies son **borradores redactados por Claude**. Hay que revisarlos con un abogado antes de lanzar (en especial la transferencia de fotos a un proveedor de IA fuera de la UE).

## 10. Servicios sin probar (necesitan cuentas o claves tuyas)
- Envío de email real (Resend), Google OAuth, Stripe (webhook probado en tests con firmas simuladas, no contra Stripe), Turnstile, proveedor de IA real, marca de agua en imágenes rasterizadas (el proveedor real devuelve PNG y falta el binding de Cloudflare Images), conversión de la máscara al formato "transparente = editar" que pide OpenAI.
- En desarrollo el correo se imprime por consola y el enlace de acceso aparece en pantalla.

## 11. Variable `DISABLE_ABUSE_LIMITS`
- Solo para local y pruebas: desactiva el límite de pruebas gratis por IP y dispositivo (si no, las pruebas e2e agotarían el límite de 3 cuentas por IP). Está en `.dev.vars`. **Nunca debe definirse en producción.**

## 12. Administración, permisos y legal (añadido a petición tuya)
- **Quién es administrador:** quien tenga su email en `ADMIN_EMAILS`. En local puse el tuyo en `.dev.vars` (no se sube a git). En producción hay que definirlo como secreto. Un administrador puede dar el rol a otros desde el panel, pero no puede bloquearse, quitarse el rol ni borrar a otro administrador sin quitarle antes el rol.
- **Lo que NO puede ver el administrador:** las fotos. El panel no tiene forma de verlas; solo borrarlas.
- **Registro de auditoría:** toda acción de administración (créditos, bloqueos, roles, precios, estudios) queda en `admin_log`, sin pantalla para editarlo.
- **Precios editables** en el panel (`settings`); un pago iniciado se abona con el precio con el que se creó, aunque cambies los precios después.
- **Coste de IA:** es una estimación (imágenes × coste unitario configurable). Se guarda por día en `usage_daily`, que sobrevive al borrado de los trabajos y no contiene datos personales. No descuenta comisiones de Stripe y el IVA se calcula al 21 %.
- **Cookies:** hoy solo hay cookies técnicas, así que el banner no es legalmente obligatorio; lo añadí igualmente con «Rechazar» y «Aceptar» al mismo nivel, panel por categorías y «Gestionar cookies» en el pie. La elección caduca a los 12 meses. Si añades analítica, cárgala solo con `hasConsent("analytics")` (`src/lib/consent.ts`).
- **Consentimiento de desistimiento:** el pago con tarjeta exige marcar una casilla (el servidor lo rechaza si falta) y guarda la fecha. El texto exacto debe validarlo un abogado.
- **Derechos RGPD:** descarga de todos los datos en JSON y borrado desde la cuenta; la privacidad menciona qué ve el administrador.
- **Cabeceras de seguridad** (CSP, anti-iframe, HSTS, etc.). La CSP lleva `'unsafe-inline'` en scripts porque Next lo necesita sin nonces; mejorable en el futuro. **No probada en producción real.**
- **Estudios (hecho):** panel propio (`/estudio`), modo estudio en el asistente con cupo mensual, catálogo de flash, equipo, directorio por ciudad (`/directorio`) y solicitudes de clientes. Decisiones: los resultados del modo estudio salen **sin marca de agua** y con diseño y stencil incluidos (paga el estudio), pero se siguen borrando a las 24 h; el cliente solo comparte su email con el estudio con una casilla de consentimiento expreso que queda registrada (`leads.consent_at`), con límite de 5 contactos al día y 1 por estudio y día; un estudio solo aparece en el directorio con plan activo y si su responsable lo activa (o el administrador).
- **Alta de estudios por solicitud:** cualquier usuario con cuenta puede pedirla en `/estudios`; yo no activo nada solo. La apruebas o rechazas tú en `/admin/estudios`, con aviso por email a ti (todos los de `ADMIN_EMAILS`) y a quien la pidió. Se puede elegir el plan al aprobar, incluido "sin plan". Hay límites: una solicitud pendiente por persona y 3 al día.
- **Aviso al estudio por email** cuando un cliente le escribe (solo con el consentimiento del cliente). Hoy el correo se imprime en consola; funcionará de verdad cuando configures Resend.
- **Marca blanca:** color y logo del estudio en sus resultados y en las imágenes descargadas. El color se rechaza si no se lee (contraste mínimo 4,5:1 con el texto de los botones y 3:1 con el fondo). El logo: solo JPG, PNG o WEBP de hasta 1 MB, nunca SVG (podría llevar scripts).
- **Estudios (pendiente):** widget embebible para su web, suscripción mensual con Stripe (el plan se activa a mano), cobro por contacto a los estudios y estadísticas por cliente. El negocio B2B funciona de forma manual hasta que se haga.

## 13. Despliegue: preparado pero sin desplegar
- `worker.ts` añade a la web el consumidor de la cola de generaciones y la tarea horaria de borrado; el código que corre fuera de una petición web obtiene su entorno con `withEnv` (`src/lib/env.ts`). Probado con pruebas unitarias, con la compilación real de OpenNext y con `wrangler deploy --dry-run`. **Nunca se ha ejecutado en Cloudflare** (la cola y el cron solo se pueden comprobar ahí).
- `QUEUE_MODE` queda en `queue` en `wrangler.jsonc` y en `inline` en `.dev.vars`. Los pasos y la lista de comprobaciones están en el README.

## 14. Accesibilidad y SEO
- Auditorías automáticas con axe (WCAG 2.1 A/AA): pasan en las páginas públicas, el asistente, la cuenta, el resultado y todo el panel de administración. Corregí tres fallos que encontraron (tira de estilos sin acceso por teclado, ilustración sin texto alternativo y tablas desplazables). Una auditoría automática no sustituye a una revisión manual con lector de pantalla.
- Hay páginas 404 y de error con la marca, `robots.txt` (bloquea API, administración, cuenta, estudio y resultados), `sitemap.xml` e imagen para redes.

## 15. Otros
- TypeScript fijado en 5.9 y `next.config.mjs`: Next 15 no soporta TypeScript 7.
- Las muestras de la galería y el proveedor simulado son ilustraciones SVG generadas por código; no representan la calidad de la IA real. Para una landing definitiva conviene sustituirlas por resultados reales.
- Retención: las fotos subidas se borran a las 24 h siempre; los resultados comprados se conservan 30 días.
