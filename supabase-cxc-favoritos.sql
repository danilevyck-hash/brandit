-- Migration: Favoritos compartidos de CXC (globales)
-- Run this in Supabase SQL Editor (Apps Familia project)

CREATE TABLE IF NOT EXISTS cxc_favoritos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_key TEXT NOT NULL,
  nombre_normalized TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (company_key, nombre_normalized)
);

ALTER TABLE cxc_favoritos ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS cxc_favoritos_company_idx
  ON cxc_favoritos (company_key);
