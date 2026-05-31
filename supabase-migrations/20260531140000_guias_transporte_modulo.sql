-- ═══════════════════════════════════════════════════════════════════════════════
-- BRAND IT — Módulo Guías de transporte (mono-empresa Boston). Recrea las 3 tablas.
-- (2026-05-31)  Aplicar manual en Supabase SQL Editor (Apps Familia).
--
-- Portado del molde de fashiongr, ADAPTADO:
--   - MONO-EMPRESA: guia_items NO tiene columna `empresa` (Brand It = solo Boston).
--   - CRÍTICO: UNIQUE(numero) en guia_transporte (la numeración con retry depende de eso).
--   - guia_transporte / guia_items se RECREAN (drop+create; estaban vacías → seguro).
--   - transportistas: CREATE IF NOT EXISTS (seed VACÍO — Daniel carga los reales).
--   - RLS service_role_all (patrón Brand It; supabase-server usa service_role).
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── transportistas (catálogo; vacío) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transportistas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      text NOT NULL UNIQUE,
  activo      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── guia_transporte (recrear) ────────────────────────────────────────────────
DROP TABLE IF EXISTS guia_items CASCADE;
DROP TABLE IF EXISTS guia_transporte CASCADE;

CREATE TABLE guia_transporte (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero                   integer NOT NULL,
  fecha                    date NOT NULL,
  modo_entrega             text NOT NULL DEFAULT 'entrega_directa'
                             CHECK (modo_entrega IN ('transportista', 'entrega_directa')),
  transportista_id         uuid REFERENCES transportistas(id) ON DELETE SET NULL,
  transportista            text,                 -- legacy texto libre (respaldo, no se escribe)
  placa                    text,
  nombre_chofer            text,
  tipo_despacho            text DEFAULT 'externo'
                             CHECK (tipo_despacho IN ('externo', 'directo')),
  observaciones            text,
  monto_total              numeric(14,2) NOT NULL DEFAULT 0,
  estado                   text NOT NULL DEFAULT 'Pendiente Bodega'
                             CHECK (estado IN ('Pendiente Bodega', 'Completada', 'Despachada', 'Rechazada')),
  motivo_rechazo           text,
  entregado_por            text,
  numero_guia_transp       text,
  receptor_nombre          text,
  cedula                   text,
  nombre_entregador        text,
  cedula_entregador        text,
  firma_base64             text,                 -- firma del receptor (despacho)
  firma_entregador_base64  text,                 -- firma de quien entrega
  firma_transportista      text,                 -- legacy
  deleted                  boolean NOT NULL DEFAULT false,
  created_at               timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT guia_transporte_numero_unique UNIQUE (numero)
);

CREATE INDEX idx_guia_transporte_numero  ON guia_transporte (numero DESC);
CREATE INDEX idx_guia_transporte_estado  ON guia_transporte (estado);
CREATE INDEX idx_guia_transporte_fecha   ON guia_transporte (fecha);
CREATE INDEX idx_guia_transporte_deleted ON guia_transporte (deleted);
CREATE INDEX idx_guia_transporte_created ON guia_transporte (created_at);

-- ── guia_items (sin columna empresa) ─────────────────────────────────────────
CREATE TABLE guia_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guia_id             uuid NOT NULL REFERENCES guia_transporte(id) ON DELETE CASCADE,
  orden               integer NOT NULL,
  cliente             text,
  direccion           text,
  facturas            text,
  bultos              integer NOT NULL DEFAULT 0,
  numero_guia_transp  text,
  deleted             boolean NOT NULL DEFAULT false
);

CREATE INDEX idx_guia_items_guia_id ON guia_items (guia_id);

-- ── RLS service_role_all ─────────────────────────────────────────────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['transportistas', 'guia_transporte', 'guia_items'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS service_role_all ON %I', t);
    EXECUTE format('CREATE POLICY service_role_all ON %I FOR ALL USING (auth.role() = ''service_role'')', t);
  END LOOP;
END$$;

NOTIFY pgrst, 'reload schema';
