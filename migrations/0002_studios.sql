-- B2B: estudios de tatuaje
CREATE TABLE organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  city TEXT NOT NULL,
  logo_key TEXT,
  accent_color TEXT NOT NULL DEFAULT '#9b83f5',
  plan TEXT NOT NULL DEFAULT 'none' CHECK (plan IN ('none','basic','pro','premium')),
  subscription_status TEXT NOT NULL DEFAULT 'inactive',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  monthly_quota INTEGER NOT NULL DEFAULT 0,
  listed INTEGER NOT NULL DEFAULT 0,
  featured INTEGER NOT NULL DEFAULT 0,
  contact_email TEXT,
  instagram TEXT,
  allowed_domains TEXT NOT NULL DEFAULT '',
  widget_key TEXT UNIQUE,
  created_at INTEGER NOT NULL
);
CREATE TABLE memberships (
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner','artist')),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (org_id, user_id)
);
CREATE TABLE org_usage (
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (org_id, month)
);
CREATE TABLE flash_designs (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  style TEXT,
  r2_key TEXT NOT NULL,
  content_type TEXT NOT NULL,
  tried_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE TABLE leads (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  org_id TEXT NOT NULL REFERENCES organizations(id),
  job_id TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('contact','booking')),
  message TEXT,
  consent_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX leads_org ON leads(org_id, created_at);
ALTER TABLE jobs ADD COLUMN flash_id TEXT;
