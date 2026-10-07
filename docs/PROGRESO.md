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
