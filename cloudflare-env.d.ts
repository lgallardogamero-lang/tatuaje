// Tipos de los bindings y variables de Cloudflare (ver wrangler.jsonc y .env.example).
interface CloudflareEnv {
  DB: D1Database;
  BUCKET: R2Bucket;
  JOBS?: Queue<{ jobId: string }>;
  ASSETS: Fetcher;
  IMAGES?: unknown;
  APP_URL: string;
  PROVIDER: string;
  QUEUE_MODE?: string;
  EMAIL_PROVIDER: string;
  SESSION_SECRET: string;
  OPENAI_API_KEY?: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  TURNSTILE_SECRET?: string;
  ADMIN_EMAILS?: string;
}
