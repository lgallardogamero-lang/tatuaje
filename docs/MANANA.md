# Lo que necesito de ti (guía paso a paso)

Todo lo demás está hecho y probado. Esto es lo que depende de tus cuentas, **de lo más importante a lo menos**. Marca cada paso y pásame lo que se pide en cada uno. Los secretos (claves) **no me los pegues en el chat**: te digo abajo cómo configurarlos tú mismo.

## 1. Datos para los textos legales (10 minutos, sin coste)
Pásame, para rellenar privacidad, aviso legal y condiciones:
- Nombre o razón social (o tu nombre si eres autónomo)
- NIF/CIF
- Domicilio
- Email de contacto para privacidad y soporte
- Si tienes inscripción en el Registro Mercantil

Después, **que un abogado revise los textos** (privacidad, condiciones, aviso legal, cookies y la casilla de desistimiento). Es lo único de esta lista que no puedo sustituir.

## 2. Cuenta de Cloudflare y dominio (20 minutos, ~5 €/mes el plan de Workers)
1. En el panel de Cloudflare, apunta tu dominio a Cloudflare (si aún no lo está) y activa el plan **Workers de pago** (el gratuito no admite colas ni el tamaño del Worker).
2. En tu ordenador (no aquí): clona el repositorio, ejecuta `npm install` y `npx wrangler login`.
3. Sigue la sección **Desplegar en Cloudflare** del `README.md` (crear D1, R2 y la cola; poner `database_id` y `APP_URL` en `wrangler.jsonc`).
4. Me pasas solo: el nombre del dominio y si el despliegue funcionó o el error que salga.

## 3. Correo con Resend (15 minutos, gratis hasta 3.000 correos al mes)
1. Crea cuenta en resend.com y **verifica tu dominio** (te dará unos registros DNS que pegas en Cloudflare).
2. Crea una API key. Guárdala tú: `npx wrangler secret put RESEND_API_KEY`.
3. Configura también `EMAIL_FROM` (por ejemplo `Calco <hola@tudominio.com>`) y `EMAIL_PROVIDER=resend` en `wrangler.jsonc`.
Sin esto nadie puede entrar en producción (los enlaces de acceso no se enviarían).

## 4. Prueba corta del proveedor de IA real (10 minutos, ~0,05 €)
1. En platform.openai.com crea una cuenta, **pon un límite de gasto bajo (5 €)** en Billing y crea una API key.
2. En tu ordenador, con una foto tuya de un brazo (JPG/PNG):
   ```bash
   OPENAI_API_KEY=sk-... npm run probar:openai -- mi-brazo.jpg "un lobo geométrico en línea fina"          # en seco: no llama a nada
   OPENAI_API_KEY=sk-... npm run probar:openai -- mi-brazo.jpg "un lobo geométrico en línea fina" --yes   # de verdad: 2 llamadas
   ```
3. Se crea la carpeta `salida-prueba/` con el diseño y el resultado. **Mírala y dime**: ¿parece tinta bajo la piel? ¿respeta luz y tono? ¿el tatuaje está dentro de la zona? Con eso decidimos modelo y calidad (`OPENAI_IMAGE_MODEL`, `OPENAI_IMAGE_QUALITY`) y fijamos el coste real por generación para los precios.
4. Si el script da error, pégame el mensaje (sin la clave): casi seguro es el nombre del modelo o un parámetro, y se corrige en minutos.

## 4b. (Opcional) Cuánto cuesta de verdad
Con la prueba anterior ya sabrás el coste real por imagen. Pásamelo y ajusto en el panel de administración «Coste de IA por imagen» y revisamos los planes de estudios (el Premium hoy pierde dinero con el coste estimado).

## 5. Stripe, para cobrar (20 minutos; sin coste fijo, comisión por venta)
1. Crea cuenta en stripe.com. **Empieza en modo prueba.**
2. Activa **Stripe Tax** si vas a vender con IVA (y añade tus datos fiscales).
3. Claves de prueba: `npx wrangler secret put STRIPE_SECRET_KEY` (la `sk_test_...`).
4. Webhook: en Stripe → Developers → Webhooks, añade `https://TU-DOMINIO/api/stripe/webhook` con los eventos que lista el README, y guarda el secreto: `npx wrangler secret put STRIPE_WEBHOOK_SECRET`.
5. Compra de prueba con la tarjeta `4242 4242 4242 4242`: deben sumarse los créditos. Si va bien, repites con las claves reales.
6. Suscripción de estudio (prueba): entra como responsable de un estudio sin plan, en `/estudio` marca la casilla y pulsa «Contratar»; tras pagar con la tarjeta de prueba el plan debe aparecer activo. Comprueba también «Gestionar suscripción y facturas» (activa antes el portal de clientes en Stripe → Settings → Billing → Customer portal).

## 6. Entrar con Google (opcional, 15 minutos, gratis)
En Google Cloud Console → credenciales OAuth: URI de redirección `https://TU-DOMINIO/api/auth/google/callback`. Secretos: `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`. Si no lo configuras, el botón de Google no aparece y se entra solo con enlace por email.

## 7. Anti-bots con Turnstile (opcional, 5 minutos, gratis)
En Cloudflare → Turnstile, crea un widget. Secreto `TURNSTILE_SECRET` y, al compilar, `NEXT_PUBLIC_TURNSTILE_SITEKEY` y `NEXT_PUBLIC_APP_URL` (tu dominio con https).

## 8. Antes de abrir al público
- [ ] `PROVIDER=openai` (no `mock`)
- [ ] `DISABLE_ABUSE_LIMITS` **no** existe en producción
- [ ] `ADMIN_EMAILS` con tu email (secreto)
- [ ] `APP_URL` con tu dominio y `https://`
- [ ] Regla de ciclo de vida en R2 y reglas de Rate Limiting en Cloudflare (README, pasos 5 y 6)
- [ ] Textos legales revisados por un abogado
- [ ] Una compra de prueba completa de principio a fin con tu propia tarjeta en modo prueba de Stripe

## Cómo configurar un secreto sin enseñármelo
```bash
npx wrangler secret put NOMBRE_DEL_SECRETO
# te pide el valor por teclado; no queda en el historial ni en el repositorio
```
