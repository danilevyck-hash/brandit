-- ═══════════════════════════════════════════════════════════════════════════════
-- BRAND IT — SCHEMA SWITCH API (sync Boston independiente)
-- Migration — Sprint integración Switch
-- (2026-05-30)
--
-- Aplica en: Apps Familia (halqekrjfttpwoqtazjm) via Supabase Dashboard SQL Editor.
--
-- Contexto: Brand It (Confecciones Boston, single-empresa) tendrá su propio sync
-- con Switch API usando un usuario API dedicado. Estas tablas COEXISTEN con
-- ventas_raw / cxc_rows / cxc_aging durante la transición — la migración de
-- queries (UI lee de switch_facturas) va en sprints D/E, separados.
--
-- Diseño: mismo patrón RLS que el schema base — service_role_all (Brand It usa
-- supabase-server con service_role key, bypass RLS). Cero acceso público.
-- ═══════════════════════════════════════════════════════════════════════════════


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 1 — switch_facturas (Facturas + Notas Crédito + Notas Débito de Switch)   ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
CREATE TABLE IF NOT EXISTS switch_facturas (
  id                  BIGSERIAL PRIMARY KEY,
  factura_id          TEXT NOT NULL,                 -- id del comprobante en Switch
  numero              TEXT NOT NULL,
  fecha               DATE NOT NULL,
  cliente_codigo      TEXT,
  cliente_nombre      TEXT,
  vendedor_codigo     TEXT,
  vendedor_nombre     TEXT,
  subtotal            NUMERIC(14,2) NOT NULL,
  subtotal_descuento  NUMERIC(14,2) NOT NULL,        -- base pre-impuesto, KEY para reportes
  itbms               NUMERIC(14,2) NOT NULL DEFAULT 0,
  total               NUMERIC(14,2) NOT NULL,
  tipo_comprobante    TEXT NOT NULL,                 -- 'Factura' | 'Nota de Credito' | 'Nota de Debito'
  is_wholesale        BOOLEAN NOT NULL DEFAULT false,
  sucursal_codigo     TEXT,
  synced_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  raw_data            JSONB,                         -- payload completo para debug
  UNIQUE (factura_id, tipo_comprobante)
);

CREATE INDEX IF NOT EXISTS idx_switch_facturas_fecha            ON switch_facturas (fecha);
CREATE INDEX IF NOT EXISTS idx_switch_facturas_cliente_codigo   ON switch_facturas (cliente_codigo);
CREATE INDEX IF NOT EXISTS idx_switch_facturas_vendedor_codigo  ON switch_facturas (vendedor_codigo);
CREATE INDEX IF NOT EXISTS idx_switch_facturas_tipo             ON switch_facturas (tipo_comprobante);


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 2 — switch_estadocuenta (snapshot puntual de CxC, REPLACE all en sync)     ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
CREATE TABLE IF NOT EXISTS switch_estadocuenta (
  id                  BIGSERIAL PRIMARY KEY,
  cliente_codigo      TEXT NOT NULL,
  cliente_nombre      TEXT,
  factura_numero      TEXT,
  fecha_emision       DATE,
  fecha_vencimiento   DATE,
  dias_vencido        INTEGER,                       -- viene calculado de Switch
  bucket              TEXT,                          -- '0-30' | '31-60' | '61-90' | '91-120' | '121-180' | '181-270' | '271-365' | '+365'
  saldo               NUMERIC(14,2) NOT NULL,
  synced_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_switch_estadocuenta_cliente_codigo ON switch_estadocuenta (cliente_codigo);
CREATE INDEX IF NOT EXISTS idx_switch_estadocuenta_bucket         ON switch_estadocuenta (bucket);


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 3 — switch_sync_log (auditoría de cada corrida de sync)                    ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
CREATE TABLE IF NOT EXISTS switch_sync_log (
  id              BIGSERIAL PRIMARY KEY,
  sync_type       TEXT NOT NULL,                     -- 'facturas' | 'estadocuenta' | 'costo_diario'
  started_at      TIMESTAMPTZ NOT NULL,
  finished_at     TIMESTAMPTZ,
  status          TEXT NOT NULL,                     -- 'success' | 'partial' | 'error'
  rows_synced     INTEGER DEFAULT 0,
  rows_skipped    INTEGER DEFAULT 0,
  skip_details    JSONB,                             -- array de skips con detalle (campo + valor crudo)
  error_message   TEXT
);


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 4 — switch_costo_diario (costo total de ventas por día, upsert por fecha)  ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
CREATE TABLE IF NOT EXISTS switch_costo_diario (
  id            BIGSERIAL PRIMARY KEY,
  fecha         DATE NOT NULL,
  costo_total   NUMERIC(14,2) NOT NULL,
  synced_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (fecha)
);


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 5 — switch_ventas_netas_vw (agregado mensual, Boston only)                 ║
-- ║ Ventas netas = base pre-impuesto (subtotal_descuento) de comprobantes que  ║
-- ║ suman: Factura + Nota de Debito. Notas de Crédito quedan EXCLUIDAS del      ║
-- ║ filtro (per spec). Ver NOTA al pie si "netas" debe restar NC.              ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
CREATE OR REPLACE VIEW switch_ventas_netas_vw AS
SELECT
  EXTRACT(YEAR  FROM fecha)::int AS anio,
  EXTRACT(MONTH FROM fecha)::int AS mes,
  COUNT(*)                        AS num_comprobantes,
  SUM(subtotal_descuento)         AS ventas_netas,    -- base pre-impuesto (KEY para reportes)
  SUM(subtotal)                   AS subtotal_bruto,
  SUM(itbms)                      AS itbms,
  SUM(total)                      AS total
FROM switch_facturas
WHERE tipo_comprobante IN ('Factura', 'Nota de Debito')
GROUP BY 1, 2;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 6 — RLS + Policies (service_role_all en todas) + GRANT de la vista         ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'switch_facturas',
    'switch_estadocuenta',
    'switch_sync_log',
    'switch_costo_diario'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS service_role_all ON %I', t);
    EXECUTE format(
      'CREATE POLICY service_role_all ON %I FOR ALL USING (auth.role() = ''service_role'')',
      t
    );
  END LOOP;
END$$;

GRANT SELECT ON switch_ventas_netas_vw TO service_role;


-- ═══════════════════════════════════════════════════════════════════════════════
-- NOTA (pendiente de confirmar con Daniel):
--   La vista filtra tipo_comprobante IN ('Factura', 'Nota de Debito') tal como
--   indica el spec. Si "ventas netas" debe ser neto de devoluciones (restar las
--   Notas de Crédito), el cambio es de una línea: incluir 'Nota de Credito' con
--   signo negativo en un SUM(CASE ...). Se deja literal al spec por ahora.
-- ═══════════════════════════════════════════════════════════════════════════════
