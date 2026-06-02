-- ============================================================================
-- Guías de Transporte — Port fashiongr → Brand It.  EMPEZAR LIMPIO.
-- Aplicar A MANO en el SQL Editor de Supabase (proyecto Apps Familia). NO ejecutado.
--
-- El Guías viejo de Brand It puede tener guia_transporte/guia_items con estructura
-- distinta (transportista texto libre NOT NULL, sin modo_entrega). Este script:
--   (1) crea transportistas (catálogo) + las tablas si faltan,
--   (2) VACÍA todo (datos viejos eran prueba),
--   (3) alinea la estructura al DDL del .md (§1.5) — mono-empresa (sin `empresa`),
--   (4) seed de los 6 transportistas, (5) trigger updated_at (lo usa el cron).
--
-- ADAPTACIONES Brand It:
--   · Mono-empresa  → guia_items SIN columna `empresa`.
--   · Auditoría     → vía logActivity (texto). No hay FK a usuarios en estas tablas.
--   · RLS cerrado   → la API usa service-role y bypassa RLS.
-- ============================================================================

-- 1) Catálogo de transportistas (PRIMERO; la cabecera lo referencia) -----------
CREATE TABLE IF NOT EXISTS transportistas (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre     text NOT NULL UNIQUE,
  activo     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE transportistas ENABLE ROW LEVEL SECURITY;

-- 2) Tablas guía (CREATE para instalación fresca; ALTER abajo cubre tablas viejas)
CREATE TABLE IF NOT EXISTS guia_transporte (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero        integer NOT NULL,
  fecha         date NOT NULL,
  modo_entrega  text NOT NULL DEFAULT 'entrega_directa',  -- 'transportista' | 'entrega_directa'
  transportista_id uuid REFERENCES transportistas(id),
  transportista text,                                      -- legacy (nullable), sin uso en el código nuevo
  placa         text,
  tipo_despacho text,                                      -- 'externo' | 'directo' (al despachar)
  nombre_chofer text,
  entregado_por text,
  receptor_nombre text,
  cedula        text,
  numero_guia_transp text,
  firma_base64  text,
  firma_entregador_base64 text,
  observaciones text,
  monto_total   numeric(10,2) DEFAULT 0,
  estado        text DEFAULT 'Pendiente Bodega',
  motivo_rechazo text,
  deleted       boolean DEFAULT false,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS guia_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guia_id     uuid NOT NULL REFERENCES guia_transporte(id) ON DELETE CASCADE,
  orden       integer NOT NULL,
  cliente     text,
  direccion   text,
  facturas    text,
  bultos      integer DEFAULT 0,
  numero_guia_transp text,
  deleted     boolean DEFAULT false
);

-- 3) VACIAR (datos viejos = prueba) -------------------------------------------
TRUNCATE TABLE guia_items, guia_transporte RESTART IDENTITY CASCADE;
TRUNCATE TABLE transportistas RESTART IDENTITY CASCADE;

-- 4) Alinear guia_transporte (cubre tablas viejas con estructura parcial) ------
ALTER TABLE guia_transporte ADD COLUMN IF NOT EXISTS modo_entrega text NOT NULL DEFAULT 'entrega_directa';
ALTER TABLE guia_transporte ADD COLUMN IF NOT EXISTS transportista_id uuid REFERENCES transportistas(id);
ALTER TABLE guia_transporte ADD COLUMN IF NOT EXISTS transportista text;       -- legacy
ALTER TABLE guia_transporte ALTER COLUMN transportista DROP NOT NULL;          -- el viejo lo tenía NOT NULL
ALTER TABLE guia_transporte ADD COLUMN IF NOT EXISTS placa text;
ALTER TABLE guia_transporte ADD COLUMN IF NOT EXISTS tipo_despacho text;
ALTER TABLE guia_transporte ADD COLUMN IF NOT EXISTS nombre_chofer text;
ALTER TABLE guia_transporte ADD COLUMN IF NOT EXISTS entregado_por text;
ALTER TABLE guia_transporte ADD COLUMN IF NOT EXISTS receptor_nombre text;
ALTER TABLE guia_transporte ADD COLUMN IF NOT EXISTS cedula text;
ALTER TABLE guia_transporte ADD COLUMN IF NOT EXISTS numero_guia_transp text;
ALTER TABLE guia_transporte ADD COLUMN IF NOT EXISTS firma_base64 text;
ALTER TABLE guia_transporte ADD COLUMN IF NOT EXISTS firma_entregador_base64 text;
ALTER TABLE guia_transporte ADD COLUMN IF NOT EXISTS observaciones text;
ALTER TABLE guia_transporte ADD COLUMN IF NOT EXISTS monto_total numeric(10,2) DEFAULT 0;
ALTER TABLE guia_transporte ADD COLUMN IF NOT EXISTS estado text DEFAULT 'Pendiente Bodega';
ALTER TABLE guia_transporte ADD COLUMN IF NOT EXISTS motivo_rechazo text;
ALTER TABLE guia_transporte ADD COLUMN IF NOT EXISTS deleted boolean DEFAULT false;
ALTER TABLE guia_transporte ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE guia_transporte ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- CHECKs de coherencia modo_entrega / transportista_id (re-crear idempotente).
ALTER TABLE guia_transporte DROP CONSTRAINT IF EXISTS guia_transporte_modo_entrega_valido;
ALTER TABLE guia_transporte ADD CONSTRAINT guia_transporte_modo_entrega_valido
  CHECK (modo_entrega IN ('transportista','entrega_directa'));
ALTER TABLE guia_transporte DROP CONSTRAINT IF EXISTS guia_transporte_modo_coherente;
ALTER TABLE guia_transporte ADD CONSTRAINT guia_transporte_modo_coherente CHECK (
  (modo_entrega = 'transportista'   AND transportista_id IS NOT NULL) OR
  (modo_entrega = 'entrega_directa' AND transportista_id IS NULL)
);
CREATE INDEX IF NOT EXISTS idx_guia_transporte_transportista_id ON guia_transporte(transportista_id);

-- 5) Alinear guia_items + QUITAR multi-empresa --------------------------------
ALTER TABLE guia_items ADD COLUMN IF NOT EXISTS cliente text;
ALTER TABLE guia_items ADD COLUMN IF NOT EXISTS direccion text;
ALTER TABLE guia_items ADD COLUMN IF NOT EXISTS facturas text;
ALTER TABLE guia_items ADD COLUMN IF NOT EXISTS bultos integer DEFAULT 0;
ALTER TABLE guia_items ADD COLUMN IF NOT EXISTS numero_guia_transp text;
ALTER TABLE guia_items ADD COLUMN IF NOT EXISTS deleted boolean DEFAULT false;
ALTER TABLE guia_items DROP COLUMN IF EXISTS empresa;     -- mono-empresa (Confecciones Boston)

-- 6) Seed de los 6 transportistas canónicos -----------------------------------
INSERT INTO transportistas (nombre) VALUES
  ('RedNblue'), ('Transporte Sol'), ('Mojica'), ('Edwin'), ('Sanjur'), ('Boston')
ON CONFLICT (nombre) DO NOTHING;

-- 7) updated_at automático (lo usa el cron de resumen) ------------------------
CREATE EXTENSION IF NOT EXISTS moddatetime SCHEMA extensions;
DROP TRIGGER IF EXISTS set_updated_at ON guia_transporte;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON guia_transporte
  FOR EACH ROW EXECUTE PROCEDURE extensions.moddatetime(updated_at);

-- RLS: se deja cerrado. La API usa SUPABASE_SERVICE_ROLE_KEY y bypassa RLS.
-- ============================================================================
