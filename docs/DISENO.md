# Documento de diseño: simulador de tatuajes con IA

> **Nota:** las decisiones posteriores (sobre todo hosting y alcance) están en `/DECISIONES.md` y prevalecen sobre este documento.

Estado: **borrador pendiente de tu aprobación**. No hay código de la aplicación todavía.

## 1. Decisiones ya tomadas (tus respuestas)

| Tema | Decisión |
|---|---|
| Coste máximo por imagen | hasta 0,10 € |
| Cuentas | sí, obligatorias para generar |
| Monetización | 3 generaciones gratis por usuario registrado; 1 generación = 1 crédito (incluye sus 3 variantes), regenerar cuesta otro crédito; packs de créditos con Stripe Checkout; marca de agua en lo gratuito; alta resolución y stencil aparte (compra o créditos) |
| B2B | **se construye en la fase 5**: cuentas de estudio con varios tatuadores, suscripción mensual, modo estudio, marca blanca, widget, catálogo de flash, directorio por ciudad y panel de estadísticas |
| Administración | panel de admin (usuarios, créditos, ingresos, coste de IA y margen, regalar o quitar créditos, gestionar estudios) en la fase 5 |
| Hosting | Cloudflare |

## 2. Stack propuesto (cambia respecto al prompt por Cloudflare)

Al desplegar en Cloudflare, Supabase deja de ser la opción natural. Propongo el stack nativo de Cloudflare, que reduce latencia, proveedores y coste.

| Capa | Elección | Motivo |
|---|---|---|
| App | Next.js (App Router) + TypeScript estricto + Tailwind + shadcn/ui | Pedido en el prompt |
| Adaptador | `@opennextjs/cloudflare` sobre Workers | Next.js en Cloudflare con acceso a bindings |
| Imágenes | R2 con regla de ciclo de vida de 24 h | Borrado automático garantizado por la plataforma, no solo por nuestro código |
| Base de datos | D1 (SQLite) con Drizzle ORM | Usuarios, créditos, trabajos, estudios |
| Cola | Cloudflare Queues | Generación asíncrona, reintentos y cancelación |
| Borrado | Cron Trigger cada hora + regla R2 | Doble garantía de borrado |
| Auth | Better Auth (o Auth.js) sobre D1, enlace mágico por email (Resend) y Google | Sin servicio externo extra; email verificado limita abuso |
| Anti-abuso | Turnstile en registro + Rate Limiting binding por usuario e IP | Protege los 3 créditos gratis |
| Pagos | Stripe Checkout (pago único) + webhook | Créditos como libro de movimientos |
| Editor | Konva (canvas, gestos táctiles) | Máscara, mover, escalar, rotar |
| Animación | Framer Motion, respetando `prefers-reduced-motion` | Pedido en el prompt |
| Tests | Vitest (unidad) + Playwright (e2e) | Playwright ya está en el entorno |

Riesgo conocido: los Workers tienen límite de tamaño de bundle (3 MiB gratis / 10 MiB de pago), así que hará falta el plan de pago de Workers (unos 5 $/mes). Procesar imágenes grandes se hace en el navegador (redimensionado a 2048 px) para no consumir CPU del Worker.

## 3. Arquitectura

```
Navegador (Next.js + Konva)
   │  1. sube foto ya redimensionada / sin EXIF  ──► Worker (API) ──► R2 (foto original, TTL 24 h)
   │  2. POST /api/jobs {diseño, máscara, opciones}
   ▼
Worker API ── valida sesión, créditos, rate limit ── moderación (texto + imagen)
   │  reserva 1 crédito (transacción en D1)
   ▼
Cloudflare Queue ──► Consumer
                       ├─ Paso 1: ImageGenerationProvider.createDesign()   → R2 (diseño)
                       └─ Paso 2: ImageGenerationProvider.applyToSkin() ×3 → R2 (variantes)
   │  actualiza estado del trabajo en D1
   ▼
Navegador consulta GET /api/jobs/:id (polling con backoff) → muestra progreso y resultado
```

Interfaz del proveedor, que es lo único que cambia al cambiar de IA:

```ts
interface ImageGenerationProvider {
  createDesign(input: DesignInput): Promise<ImageRef>;
  applyToSkin(input: ApplyInput): Promise<ImageRef[]>; // foto + máscara + diseño
  moderate(input: ModerationInput): Promise<ModerationResult>;
}
```

Implementaciones previstas: `MockProvider` (sin coste, para desarrollo y tests), y una real elegida por ti tras este documento.

Prompts: un único módulo versionado `src/prompts/v1/` con plantillas por estilo y color. El usuario nunca escribe prompts técnicos.

## 4. Modelo de datos (D1)

- `users` (id, email, creado_en, borrado_en)
- `credit_ledger` (id, user_id, delta, motivo [`free_grant`, `purchase`, `generation`, `refund`], job_id, stripe_session_id, creado_en). El saldo es la suma; nunca se edita una fila.
- `jobs` (id, user_id, estado [`queued`, `running`, `done`, `failed`, `cancelled`], opciones JSON, claves R2, error, expira_en)
- `assets` (id, job_id, tipo [`photo`, `mask`, `design`, `variant`], clave_r2, expira_en)
- `purchases` (id, user_id, producto [`credits_pack`, `hires`, `stencil`], stripe_session_id, estado)
- `stripe_events` (event_id único): idempotencia del webhook; un evento repetido no suma créditos dos veces.
- `price_config` (o archivo `pricing.ts`): packs de créditos, planes de estudio y precios de HD/stencil; nada de precios fijos en el código.
- B2B (fase 5, pero con `jobs.org_id` nullable desde la fase 1 para no migrar después):
  - `organizations` (nombre, slug, logo, colores, ciudad, plan, estado de suscripción)
  - `memberships` (org_id, user_id, rol [`owner`, `artist`])
  - `org_usage` (org_id, mes, generaciones usadas, cupo)
  - `flash_designs` (org_id, imagen, nombre, estilo)
  - `directory_listings` (org_id, ciudad, destacado)
  - `leads` (user_id, org_id, job_id, tipo [`contact`, `booking`], consentimiento, creado_en): cada contacto queda registrado para poder facturarlo
- `users.role` (`user`, `admin`) para el panel de administración.

Reglas: la reserva de crédito y el reembolso si el trabajo falla se hacen en la misma transacción que cambia el estado del trabajo, para no cobrar dos veces ni perder créditos.

## 5. Comparativa de proveedores de IA

Los precios proceden de agregadores y revendedores, no de las páginas oficiales. **Hay que confirmarlos antes de presupuestar.** Importes en dólares.

| Opción | Máscara | Imagen de referencia | Precio aprox. por imagen | Encaje |
|---|---|---|---|---|
| OpenAI `gpt-image-2` (edit) | sí | sí | ~0,009 baja, ~0,034 media, ~0,13-0,15 alta | **Recomendada** en calidad media: entra en presupuesto |
| FLUX.1 Fill [pro] (Black Forest Labs / Replicate) | sí | no (solo prompt) | ~0,05 | Buena alternativa para el paso 2; el paso 1 necesitaría otro modelo |
| Gemini "Nano Banana 2" (3.1 Flash Image) | no (edición por instrucciones) | sí | ~0,067 a 1K | Útil como plan B; sin máscara real es menos controlable |
| Gemini "Nano Banana Pro" | no | sí | ~0,134 | Fuera de presupuesto |

Recomendación: `gpt-image-2` con calidad media para los dos pasos, con la máscara dibujada por el usuario. Antes de decidir haría una prueba corta con 5 fotos reales, si me das una clave con un límite de gasto bajo. Hasta entonces no gasto nada.

## 6. Estimación de coste (hipótesis, no medición)

Defino **1 generación = 1 diseño + 3 variantes = 4 llamadas** a calidad media (~0,034 $).

- Coste por generación: ~0,14 $ (≈0,13 €). Es superior a tu tope de 0,10 € si lo cuentas como una sola "imagen".
- Coste por variante suelta (diseño amortizado): ~0,045 $.

Opciones para ajustarlo, a elegir por ti:
1. Calidad baja para el diseño (~0,009 $) y media para las variantes: ~0,11 $.
2. 2 variantes en vez de 3 por defecto, y una tercera bajo petición: ~0,08 $.

Por cada 1.000 usuarios registrados, solo con la parte gratuita (3 generaciones cada uno):

| Escenario | Generaciones | Coste IA aprox. |
|---|---|---|
| 40 % usan los 3 créditos | 1.200 | ~170 $ |
| 100 % los usan (peor caso) | 3.000 | ~420 $ |

A esto se suman infraestructura (Workers de pago ~5 $/mes, R2 y D1 con coste marginal casi nulo a esta escala), email transaccional y comisiones de Stripe sobre las ventas. El precio de los packs de créditos debe cubrir al menos ~0,14 $ por crédito más la comisión de Stripe.

## 6 bis. Monetización y márgenes

Con 1 generación = 1 crédito ≈ 0,14 $ ≈ 0,13 € de coste de IA (sección 6), y sin contar la comisión de Stripe (alrededor de 1,5 % + 0,25 € en tarjetas europeas, verificar) ni el IVA:

| Pack de créditos | Precio | €/crédito | Margen bruto aprox. sobre IA |
|---|---|---|---|
| 10 créditos | 4,99 € | 0,50 € | ~74 % |
| 30 créditos | 9,99 € | 0,33 € | ~61 % |
| 75 créditos | 19,99 € | 0,27 € | ~51 % |

Planes de estudio, suponiendo que usan todo su cupo:

| Plan | Precio/mes | Generaciones | Coste de IA aprox. | Margen bruto aprox. |
|---|---|---|---|---|
| Básico | 29 € | 100 | ~13 € | ~55 % |
| Pro | 59 € | 300 | ~39 € | ~34 % |
| Premium | 99 € | 800 | ~104 € | **negativo (~-5 %)** |

**Aviso:** con el coste actual de 4 llamadas por generación, el plan Premium pierde dinero si el estudio gasta el cupo entero, y la oferta de lanzamiento (mes gratis y 50 % de descuento de por vida) empeora los tres planes. Antes de fijar precios habría que medir el coste real por generación y decidir una de estas vías: bajar el cupo de Premium, subir su precio, o cobrar las generaciones extra. Por eso los precios y cupos van en configuración, no en el código.

Reglas de implementación:
- Los créditos se suman **solo** cuando llega el webhook de Stripe `checkout.session.completed`, con idempotencia por `event_id`.
- El saldo siempre se calcula desde `credit_ledger`; la interfaz lo muestra en la cabecera y el historial de compras va en el perfil.
- Marca de agua discreta en los resultados gratuitos, aplicada en el servidor al servir la imagen, no en el cliente. La versión HD sin marca y el stencil se generan y sirven solo tras comprobar la compra o el gasto de créditos.
- Paywall al agotar las 3 pruebas, con los packs y sin presión agresiva.
- IVA con Stripe Tax y factura descargable (activar la generación de facturas en Checkout).
- Antifraude de cuentas falsas: email verificado o Google, Turnstile y límite por IP y dispositivo. Un límite por huella de dispositivo no es infalible; se valora el riesgo en la fase 6.
- Suscripciones de estudio con Stripe Billing: cupo mensual en `org_usage`, que se reinicia con la renovación (evento `invoice.paid`).
- Contactos con estudios: solo se comparten datos del usuario con su consentimiento explícito en el momento del contacto, y se registra en `leads`. Cobrar por contacto exige que el estudio lo acepte en sus condiciones.
- Widget embebible: iframe con su propio origen y política CSP restrictiva, y clave pública por estudio con lista de dominios permitidos.

## 7. Privacidad, seguridad y legal

- Consentimiento explícito antes de subir fotos; aviso de privacidad visible; "Simulación orientativa; el resultado real depende del tatuador".
- Borrado: regla de ciclo de vida de R2 a 24 h, Cron cada hora y botón "borrar mis fotos" inmediato. Los diseños comprados se guardan en la cuenta; las fotos del cuerpo no.
- Transferencia internacional: enviar fotos a un proveedor de IA fuera de la UE debe constar en la política de privacidad, con el acuerdo de encargado de tratamiento del proveedor. Conviene que lo revise un abogado antes de lanzar.
- Moderación en texto e imagen subida: desnudos, posibles menores, odio y violencia. Opción: la API de moderación de OpenAI. Se aplica antes de gastar crédito de IA de generación.
- Claves solo en variables/secretos de Workers; nunca en el cliente.
- Verificación de edad: casilla de mayoría de edad en el registro. Si quieres algo más fuerte, es una decisión de producto.

## 8. Fases

1. Landing + cuentas + subida de foto + editor de máscara/colocación (sin IA).
2. Generación del diseño con `MockProvider`, luego con el proveedor real.
3. Aplicación sobre la piel, 3 variantes y deslizador antes/después.
4. Registro, 3 pruebas gratis, créditos y pagos con Stripe, marca de agua, descarga HD y stencil, historial, privacidad y borrado automático.
5. Plan para estudios (cuentas, suscripción, modo estudio, marca blanca, widget, catálogo de flash, directorio y estadísticas) y panel de administración.
6. Rate limiting, moderación, tests e2e, pulido visual final y despliegue en Cloudflare.

El despliegue es en Cloudflare (no Vercel), según lo que me dijiste. La fase 5 es la más grande; si hay que recortar, el orden de prioridad que propongo es: cuentas de estudio y suscripción, modo estudio, panel de admin, y después marca blanca, widget, catálogo y directorio.

## 9. Riesgos

| Riesgo | Mitigación |
|---|---|
| El modelo deforma la piel o inventa texto en el tatuaje | Prueba previa con fotos reales, prompts versionados y selección entre variantes |
| Abuso de los créditos gratis | Email verificado, Turnstile, límite por IP y dispositivo |
| Coste por encima del previsto | Calidad configurable, tope diario de gasto, `MockProvider` en desarrollo |
| Contenido ilegal en fotos subidas | Moderación previa, borrado a 24 h, registro mínimo |
| Límite de tamaño y CPU de los Workers | Procesado de imagen en el cliente, trabajo pesado en cola |
| Cambios de precio o de modelo del proveedor | Interfaz `ImageGenerationProvider` |

## 10. Preguntas pendientes

1. ¿Aceptas el stack de Cloudflare (D1 + R2 + Queues) en lugar de Supabase?
2. Una generación = 1 crédito con sus 3 variantes (resuelto, ver sección 6 bis). ¿Quieres reducir el coste con calidad baja en el diseño o con 2 variantes?
3. ¿Qué precio tienen la descarga HD y el stencil, y cuántos créditos cuestan si se pagan con créditos?
4. El plan Premium de estudios pierde dinero con el coste actual (sección 6 bis). ¿Bajamos su cupo, subimos el precio o cobramos extras?
5. ¿Tienes dominio y cuenta de Cloudflare, y un proveedor de email (Resend u otro)?
6. ¿Alguna restricción legal ya acordada (aviso, política de privacidad redactada)?
