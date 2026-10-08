# Registro de progreso

Se actualiza en cada hito. Nada de lo hecho hasta ahora ha costado dinero.

## Decisiones tomadas en autónomo
- Dirección visual: tinta azulada + hueso + violeta de stencil (color del papel de transferencia). Titulares Gloock, cuerpo Hanken Grotesk.
- Stack: Next.js 15.5 + OpenNext para Cloudflare, D1, R2, Queues.
- Editor con Canvas 2D propio (en vez de Konva): menos dependencias y control total de gestos táctiles.
- Auth propia con enlace mágico (tokens hasheados, cookie httpOnly). Email por consola en desarrollo; Resend cuando haya clave.
- Proveedor de IA: `mock` (genera SVG sin coste). El proveedor real se enchufa sin tocar el resto.
- Textos legales: borradores redactados por Claude, sin revisión de abogado.

## Hitos
- [x] Documento de diseño (`docs/DISENO.md`)
- [x] Andamiaje del proyecto (config Next/Cloudflare/TypeScript)
- [x] Esquema de base de datos (usuarios, libro de créditos, trabajos, activos, compras, estudios, leads)
- [x] Núcleo del servidor: auth con enlace mágico, créditos atómicos, trabajos, borrado a 24 h, moderación, prompts versionados, proveedor simulado y proveedor OpenAI (sin probar)
- [x] 19 pruebas unitarias/integración (cobro concurrente, reembolso único, purga, moderación, validación de imágenes)

## Decisión de negocio tomada
- El plan Premium de estudios tiene cupo 400 en `src/lib/config.ts` (tu plan decía 800). Con el coste actual de IA, 800 generaciones por 99 € pierden dinero. Es un valor de configuración; cámbialo cuando midamos el coste real.
- [x] API: auth (enlace mágico, Google sin probar), trabajos, archivos con control de acceso, desbloqueo HD/stencil, checkout y webhook de Stripe, borrado de fotos y de cuenta
- [x] Sistema de diseño y landing (hero con tatuaje que se traza sobre piel, estilos, precios, FAQ), revisada con capturas en escritorio y móvil
- [x] 26 pruebas pasando (incluye firma y idempotencia de Stripe)

## Notas técnicas
- TypeScript fijado en 5.9: Next 15 no soporta TypeScript 7.
- `next.config.mjs` en vez de `.ts` por el mismo motivo.
- Los generadores de la galería y del proveedor simulado son SVG ilustrativos, no representan la calidad de la IA real.
- [x] **Fase 1 completa:** asistente de foto, diseño y colocación (editor con gestos táctiles, rueda, teclado y pincel de máscara), 3 propuestas visuales, `DECISIONES.md`
- [x] Acceso por enlace mágico con interfaz, cuenta mínima (créditos, movimientos, borrar fotos, eliminar cuenta), páginas legales en borrador, página provisional de estudios
- [x] 27 pruebas de lógica + 8 de navegador (escritorio y móvil), compilación de producción correcta
- [x] **Fases 2 y 3 (con proveedor simulado):** generación de diseño y variantes desde la interfaz, progreso con animación, cancelar y recuperar el crédito, resultado con deslizador antes/después, regenerar, acceso en la misma pantalla (el enlace se puede abrir en otra pestaña), aviso de pago al quedarse sin créditos
- [x] **Parte de la Fase 4:** quitar marca de agua y stencil con créditos o tarjeta, historial de pruebas y movimientos, borrado de fotos y de cuenta
- [x] 27 pruebas de lógica + 10 de navegador (escritorio y móvil, incluye el flujo completo de generación)
- [ ] Pendiente Fase 4: probar pagos contra Stripe real (necesita claves), facturas con Stripe Tax
- [ ] Pendiente Fase 5: estudios (cuentas, suscripción, modo estudio, marca blanca, widget, directorio) y panel de administración
- [ ] Pendiente Fase 6: `worker.ts` para la cola y el borrado horario en Cloudflare, límites de peticiones en Cloudflare, despliegue
- [x] **Administración:** panel (resumen con ingresos, coste de IA y margen; usuarios; estudios; precios editables; registro de auditoría), roles, bloqueo de usuarios, 36 pruebas de lógica
- [x] **Legal y privacidad:** banner de cookies con gestión, aviso legal, consentimiento de desistimiento en pagos, descarga de datos, cabeceras de seguridad
- [x] 16 pruebas de navegador (escritorio y móvil) incluyendo administración y cookies
- [x] **Lado del estudio:** panel propio, equipo, catálogo de flash, modo estudio con cupo mensual y resultados sin marca de agua, directorio público por ciudad, solicitudes de clientes con consentimiento
- [x] 46 pruebas de lógica + 18 de navegador (incluye el recorrido completo: alta del estudio, catálogo, directorio, contacto y generación)
- [x] Correcciones: fechas en hora de Madrid (evitaba un fallo de hidratación), interruptor del directorio inmediato, botones con nombres distintos, singular de "prueba"
- [x] `worker.ts` (cola y borrado horario), compilación OpenNext y validación `wrangler --dry-run` correctas; 49 pruebas de lógica
- [ ] Pendiente Fase 6: desplegar de verdad en Cloudflare, reglas de límite de peticiones y regla de ciclo de vida en R2 (necesitan tu cuenta), pruebas con servicios reales
- [x] **Accesibilidad:** auditorías axe en 10 pantallas (escritorio y móvil); corregidos 3 fallos
- [x] **Páginas 404 y de error, robots, sitemap, imagen para redes**
- [x] **Embudo de estudios:** solicitud de alta pública, cola de aprobación en el panel de administración, emails de aviso
- [x] **Marca blanca:** color y logo del estudio en resultados y descargas
- [x] 59 pruebas de lógica + 30 de navegador
- [ ] Pendiente estudios: widget embebible, suscripción con Stripe, cobro por contacto, estadísticas por cliente
- [x] **Revisión de seguridad:** pruebas de aislamiento entre usuarios y estudios, CSRF, enlaces de un solo uso, bloqueo de usuarios, webhook; corregida una política de seguridad que se pisaba
- [x] **Next 16.4:** `npm audit` sin vulnerabilidades; pruebas y empaquetado para Cloudflare siguen pasando
- [x] 60 pruebas de lógica + 34 de navegador (escritorio y móvil)
- [x] **Marca de agua en PNG y máscara para OpenAI** con código propio (lector/escritor de PNG, texto en diagonal, conversión de máscara): ya no depende de Cloudflare Images; 69 pruebas de lógica
