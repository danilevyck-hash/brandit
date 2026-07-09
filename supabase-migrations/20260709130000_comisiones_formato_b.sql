-- ═══════════════════════════════════════════════════════════════════════════════
-- BRAND IT — COMISIONES FORMATO B (venta + cobro, estilo fashiongr)
-- Migration (2026-07-09)
--
-- Aplica en: Apps Familia (halqekrjfttpwoqtazjm) via Supabase Dashboard SQL Editor.
--
-- Contexto: el módulo Comisiones actual (tramos por recibo, vendedor del recibo)
-- pasa a ser FORMATO A. Se agrega FORMATO B (venta 1% + cobro 1%, atribución de
-- cobros por CARTERA = dueño del cliente). Cada vendedor tiene UN formato:
--   A: JULICAR, DAVID LEVY, ALBERTO   ·   B: MELCHOR VEGA, EDWIN
--
-- Los nombres de vendedor se comparan NORMALIZADOS (TRIM + espacios colapsados +
-- case-insensitive): Switch tiene duplicados tipo "MELCHOR VEGA" / "Melchor Vega".
-- La normalización vive en código; acá los seeds ya van normalizados (UPPER).
--
-- ADITIVA, NO destructiva, idempotente. Correr UNA vez en el SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 1 — switch_clientes_cartera (maestro cliente → vendedor de cartera)        ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
-- Cache de /apicliente/lista (campos vendedorId + vendedor). El sync (cron) la
-- reemplaza por upsert. Fuente de la atribución por cartera del componente COBRO
-- del Formato B. vendedor_nombre se guarda CRUDO (la normalización es en código).
CREATE TABLE IF NOT EXISTS switch_clientes_cartera (
  cliente_codigo    TEXT PRIMARY KEY,              -- "codigo" del cliente en Switch
  cliente_switch_id INTEGER,                       -- "id" en Switch (join alterno)
  cliente_nombre    TEXT,
  vendedor_id       INTEGER,                       -- vendedorId
  vendedor_nombre   TEXT,                          -- vendedor (crudo)
  synced_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_switch_clientes_cartera_switch_id
  ON switch_clientes_cartera (cliente_switch_id);


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 2 — switch_recibos.vendedor_cartera (nueva columna)                        ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
-- Poblada por el sync de recibos: vendedor del dueño del cliente según
-- switch_clientes_cartera; fallback al vendedor del recibo si el cliente no está
-- en la lista. Las filas históricas quedan NULL: el API resuelve en query-time
-- (cartera actual) hasta que el mes se re-sincronice.
ALTER TABLE switch_recibos ADD COLUMN IF NOT EXISTS vendedor_cartera TEXT;

CREATE INDEX IF NOT EXISTS idx_switch_recibos_vendedor_cartera
  ON switch_recibos (vendedor_cartera);


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 3 — comisiones_config_vendedor (formato por vendedor)                      ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
-- PK = nombre NORMALIZADO (upper, sin espacios dobles). Tasas NO configurables:
--   A = tramos fijos por recibo (<15000 → 0.5%, >=15000 → 1%)
--   B = 1% fijo sobre venta + 1% fijo sobre cobro
CREATE TABLE IF NOT EXISTS comisiones_config_vendedor (
  vendedor_nombre TEXT PRIMARY KEY,                -- normalizado
  formato         TEXT NOT NULL CHECK (formato IN ('A','B')),
  activo          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed inicial. ON CONFLICT DO NOTHING: re-correr no pisa asignaciones editadas.
INSERT INTO comisiones_config_vendedor (vendedor_nombre, formato) VALUES
  ('JULICAR',      'A'),
  ('DAVID LEVY',   'A'),
  ('ALBERTO',      'A'),
  ('MELCHOR VEGA', 'B'),
  ('EDWIN',        'B')
ON CONFLICT (vendedor_nombre) DO NOTHING;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 4 — comisiones_snapshot_recibos: soporte Formato B en el detalle           ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
-- El detalle congelado pasa a guardar TAMBIÉN las líneas del Formato B:
--   formato 'A' + seccion 'cobro'  → recibo clásico (tramos)
--   formato 'B' + seccion 'venta'  → documento de switch_facturas (tipo_doc/numero_doc,
--                                    total = subtotal firmado, tasa 0.01)
--   formato 'B' + seccion 'cobro'  → recibo atribuido por cartera (tasa 0.01)
ALTER TABLE comisiones_snapshot_recibos
  ADD COLUMN IF NOT EXISTS formato    TEXT NOT NULL DEFAULT 'A',
  ADD COLUMN IF NOT EXISTS seccion    TEXT NOT NULL DEFAULT 'cobro',
  ADD COLUMN IF NOT EXISTS tipo_doc   TEXT,        -- 'FA' | 'NC' | 'ND' (solo ventas B)
  ADD COLUMN IF NOT EXISTS numero_doc TEXT;        -- numero del comprobante (solo ventas B)

-- CHECKs enum-like (idempotente: drop + add).
ALTER TABLE comisiones_snapshot_recibos
  DROP CONSTRAINT IF EXISTS chk_snapshot_recibos_formato,
  DROP CONSTRAINT IF EXISTS chk_snapshot_recibos_seccion;
ALTER TABLE comisiones_snapshot_recibos
  ADD CONSTRAINT chk_snapshot_recibos_formato CHECK (formato IN ('A','B')),
  ADD CONSTRAINT chk_snapshot_recibos_seccion CHECK (seccion IN ('venta','cobro'));


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 5 — RLS + Policies (service_role_all, mismo patrón del resto del schema)   ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'switch_clientes_cartera',
    'comisiones_config_vendedor'
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

COMMIT;

-- ─── Verificación ──────────────────────────────────────────────────────────────
SELECT vendedor_nombre, formato, activo FROM comisiones_config_vendedor ORDER BY formato, vendedor_nombre;
SELECT column_name FROM information_schema.columns
WHERE table_name = 'switch_recibos' AND column_name = 'vendedor_cartera';
SELECT column_name FROM information_schema.columns
WHERE table_name = 'comisiones_snapshot_recibos' AND column_name IN ('formato','seccion','tipo_doc','numero_doc');
