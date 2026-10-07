-- Usuarios y sesiones
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  adult_confirmed_at INTEGER,
  privacy_accepted_at INTEGER,
  created_at INTEGER NOT NULL,
  deleted_at INTEGER
);
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE TABLE magic_links (
  token_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  created_at INTEGER NOT NULL
);

-- Libro de créditos: el saldo es siempre la suma de delta.
CREATE TABLE credit_ledger (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('free_grant','purchase','generation','refund','admin_grant','admin_revoke','asset_purchase')),
  job_id TEXT,
  ref TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX ledger_user ON credit_ledger(user_id);
-- Una concesión gratuita por usuario y un cobro/reembolso por trabajo.
CREATE UNIQUE INDEX ledger_unique_ref ON credit_ledger(reason, ref) WHERE ref IS NOT NULL;

-- Trabajos de generación
CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  org_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('queued','running','done','failed','cancelled')),
  options TEXT NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0,
  stage TEXT,
  error TEXT,
  charge TEXT NOT NULL DEFAULT 'credit' CHECK (charge IN ('credit','org','refunded')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX jobs_user ON jobs(user_id, created_at);
CREATE INDEX jobs_expires ON jobs(expires_at);

CREATE TABLE assets (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('photo','mask','reference','design','design_wm','variant','variant_wm')),
  r2_key TEXT NOT NULL,
  content_type TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX assets_job ON assets(job_id);
CREATE INDEX assets_expires ON assets(expires_at);

-- Compras (Stripe) e idempotencia de webhooks
CREATE TABLE purchases (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  product TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'eur',
  stripe_session_id TEXT UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('pending','paid','failed','refunded')),
  meta TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE stripe_events (
  event_id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  received_at INTEGER NOT NULL
);

-- Derechos de descarga comprados (HD sin marca de agua / stencil) por trabajo
CREATE TABLE entitlements (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('hd','stencil')),
  created_at INTEGER NOT NULL,
  UNIQUE (job_id, kind)
);

-- Anti-abuso: contador por ventana
CREATE TABLE rate_limits (
  key TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY (key, window_start)
);
