-- ═══════════════════════════════════════════════════════════════════════════════
-- BRAND IT — SCHEMA COMPLETO PARA APPS FAMILIA
-- Migration consolidada — Fase A del sprint de independencia
-- (2026-05-12)
--
-- Aplica en: Apps Familia (halqekrjfttpwoqtazjm) via Supabase Dashboard SQL Editor.
-- Pre-condición: Apps Familia VACÍA (sin schema previo de estas tablas, salvo
-- ventas_pipeline_boston que se aplicó en Fase 0 del sprint anterior y se
-- elimina en Fase C).
--
-- DECISIONES DE DISEÑO (justificadas al final del archivo):
--   (1) Boston-scoping: opción (b) — mantener columna empresa/company_key
--       + CHECK constraint. Menos invasivo vs eliminar la columna.
--   (2) clientes_master: empieza VACÍA. Auto-populate desde uploads (Fase D).
--   (3) Brand It-internas (clients, quotations, leads, etc.) clonadas tal cual
--       de fashion-group (no son Boston-specific en su mayoría).
--   (4) ERP shared (ventas_raw, cxc_*, clientes_master): Boston-only via CHECK.
--   (5) VIEW cxc_aging y MATVIEW clientes_empresa_12m_vw: definiciones idénticas
--       a fashion-group — los CHECK upstream garantizan que sólo procesan Boston.
--   (6) RPCs portados sin modificación (genéricos a "empresa" — Brand It pasa Boston).
-- ═══════════════════════════════════════════════════════════════════════════════


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ SECCIÓN 1 — Brand It internas                                             ║
-- ║ Tablas que pertenecen al negocio interno de Brand It (no ERP). Cero       ║
-- ║ relación con empresa Boston a nivel schema (varias tienen `empresa` como  ║
-- ║ campo libre con valores 'ambas'/'confecciones_boston'/'brand_it').        ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- ── user_roles ──────────────────────────────────────────────────────────────
-- Auth de Brand It (cookie HMAC validates contra password en esta tabla).
-- 4 usuarios: admin, secretaria, vendedora1, vendedora2.
CREATE TABLE IF NOT EXISTS user_roles (
  id        BIGSERIAL PRIMARY KEY,
  email     TEXT UNIQUE NOT NULL,
  role      TEXT NOT NULL CHECK (role IN ('admin', 'secretaria', 'vendedora', 'vendedora1', 'vendedora2')),
  nombre    TEXT NOT NULL,
  password  TEXT NOT NULL,
  empresa   TEXT,                -- 'ambas' | 'confecciones_boston' | 'brand_it'
  activo    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── clients (negocio textil de Brand It, no ERP) ────────────────────────────
CREATE TABLE IF NOT EXISTS clients (
  id         BIGSERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  phone      TEXT,
  email      TEXT,
  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── quotations + quotation_items + print_jobs ───────────────────────────────
CREATE TABLE IF NOT EXISTS quotations (
  id         BIGSERIAL PRIMARY KEY,
  client_id  BIGINT REFERENCES clients(id) ON DELETE SET NULL,
  date       DATE NOT NULL DEFAULT CURRENT_DATE,
  status     TEXT NOT NULL DEFAULT 'pendiente'
             CHECK (status IN ('pendiente', 'aprobado', 'entregado', 'cancelado')),
  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quotation_items (
  id                BIGSERIAL PRIMARY KEY,
  quotation_id      BIGINT NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  description       TEXT NOT NULL,
  size_color        TEXT,
  quantity          INTEGER NOT NULL DEFAULT 1,
  fabric_qty        NUMERIC(10,2) DEFAULT 0,
  fabric_price      NUMERIC(10,2) DEFAULT 0,
  lining_qty        NUMERIC(10,2) DEFAULT 0,
  lining_price      NUMERIC(10,2) DEFAULT 0,
  thread_qty        NUMERIC(10,2) DEFAULT 0,
  thread_price      NUMERIC(10,2) DEFAULT 0,
  buttons_qty       NUMERIC(10,2) DEFAULT 0,
  buttons_price     NUMERIC(10,2) DEFAULT 0,
  packaging_qty     NUMERIC(10,2) DEFAULT 0,
  packaging_price   NUMERIC(10,2) DEFAULT 0,
  labor_cost        NUMERIC(10,2) DEFAULT 0,
  seamstress        TEXT,
  sale_price        NUMERIC(10,2) DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS print_jobs (
  id                  BIGSERIAL PRIMARY KEY,
  quotation_id        BIGINT NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  description         TEXT NOT NULL,
  ink_cost            NUMERIC(10,2) DEFAULT 0,
  paper_cost          NUMERIC(10,2) DEFAULT 0,
  yard_price          NUMERIC(10,2) DEFAULT 0,
  yards_qty           NUMERIC(10,2) DEFAULT 0,
  design_size         TEXT,
  design_qty          INTEGER DEFAULT 1,
  design_unit_price   NUMERIC(10,2) DEFAULT 0,
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quotations_client      ON quotations(client_id);
CREATE INDEX IF NOT EXISTS idx_quotations_date        ON quotations(date DESC);
CREATE INDEX IF NOT EXISTS idx_quotation_items_quotation ON quotation_items(quotation_id);
CREATE INDEX IF NOT EXISTS idx_print_jobs_quotation   ON print_jobs(quotation_id);

-- ── leads + lead_comentarios ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leads (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre             TEXT NOT NULL,
  empresa            TEXT,
  telefono           TEXT,
  email              TEXT,
  estado             TEXT NOT NULL DEFAULT 'prospecto',
  estado_venta       TEXT DEFAULT 'activo',
  notas              TEXT,
  vendedora          TEXT,
  empresa_vendedora  TEXT,
  fecha_seguimiento  DATE,
  asignado_a         TEXT,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lead_comentarios (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  comentario  TEXT NOT NULL,
  autor       TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_created           ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_comentarios_lead   ON lead_comentarios(lead_id);

-- ── stickers (bodega QR) ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stickers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  descripcion     TEXT NOT NULL,
  talla           TEXT NOT NULL,
  color_nombre    TEXT NOT NULL,
  color_hex       TEXT NOT NULL,
  seccion         TEXT NOT NULL,
  estante         TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── notas_entrega + items + admin_firmas ───────────────────────────────────
CREATE TABLE IF NOT EXISTS notas_entrega (
  id              SERIAL PRIMARY KEY,
  numero          TEXT UNIQUE NOT NULL,        -- NE-001, NE-002, ...
  fecha           DATE NOT NULL DEFAULT CURRENT_DATE,
  cliente         TEXT NOT NULL,
  atencion        TEXT,
  estado          TEXT NOT NULL DEFAULT 'abierta',   -- abierta | aprobada | cerrada
  aprobado_por    TEXT,
  aprobado_at     TIMESTAMPTZ,
  scan_url        TEXT,
  cerrada_at      TIMESTAMPTZ,
  created_by      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  -- v2 alters
  tipo            TEXT NOT NULL DEFAULT 'pedido',
  contacto        TEXT,
  numero_contacto TEXT
);

CREATE TABLE IF NOT EXISTS notas_entrega_items (
  id          SERIAL PRIMARY KEY,
  nota_id     INT REFERENCES notas_entrega(id) ON DELETE CASCADE,
  marca       TEXT,
  descripcion TEXT NOT NULL,
  color       TEXT,
  talla       TEXT,
  cantidad    INT NOT NULL DEFAULT 1,
  sort_order  INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS admin_firmas (
  id            SERIAL PRIMARY KEY,
  nombre        TEXT UNIQUE NOT NULL,
  firma_base64  TEXT NOT NULL,                 -- PNG base64
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE SEQUENCE IF NOT EXISTS notas_entrega_seq START 1;

-- ── caja: periodos, responsables, categorias, gastos ────────────────────────
CREATE TABLE IF NOT EXISTS caja_periodos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero          INTEGER,
  fecha_apertura  DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_cierre    DATE,
  fondo_inicial   NUMERIC(10,2) NOT NULL DEFAULT 0,
  estado          TEXT NOT NULL DEFAULT 'abierto',   -- abierto | cerrado
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  repuesto        BOOLEAN DEFAULT FALSE,
  repuesto_at     TIMESTAMPTZ,
  deleted         BOOLEAN DEFAULT FALSE,
  created_by      TEXT
);

CREATE TABLE IF NOT EXISTS caja_responsables (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      TEXT NOT NULL,
  activo      BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS caja_categorias (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS caja_gastos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  periodo_id      UUID REFERENCES caja_periodos(id) ON DELETE SET NULL,
  fecha           DATE NOT NULL DEFAULT CURRENT_DATE,
  nombre          TEXT,
  ruc             TEXT,
  dv              TEXT,
  factura         TEXT,
  subtotal        NUMERIC(10,2) DEFAULT 0,
  itbms           NUMERIC(10,2) DEFAULT 0,
  total           NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  categoria       TEXT,
  responsable     TEXT,
  descripcion     TEXT,
  proveedor       TEXT,
  nro_factura     TEXT,
  empresa         TEXT,           -- 'brand_it' | 'confecciones_boston' | 'ambas' (libre)
  deleted         BOOLEAN DEFAULT FALSE,
  created_by      TEXT,
  deleted_by      TEXT,
  deleted_at      TIMESTAMPTZ,
  responsable_id  UUID REFERENCES caja_responsables(id) ON DELETE SET NULL,
  estado          TEXT DEFAULT 'completado'        -- vale | completado (vale/vuelto flow)
);

CREATE INDEX IF NOT EXISTS idx_caja_gastos_periodo  ON caja_gastos(periodo_id);
CREATE INDEX IF NOT EXISTS idx_caja_gastos_fecha    ON caja_gastos(fecha DESC);

-- ── activity_log ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activity_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario     TEXT NOT NULL,
  accion      TEXT NOT NULL,
  detalle     TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_created ON activity_log(created_at DESC);

-- ── cxc_favoritos (favoritos del tab CxC, scoped por company_key) ───────────
CREATE TABLE IF NOT EXISTS cxc_favoritos (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_key         TEXT NOT NULL,
  nombre_normalized   TEXT NOT NULL,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (company_key, nombre_normalized)
);

CREATE INDEX IF NOT EXISTS cxc_favoritos_company_idx ON cxc_favoritos (company_key);

-- ── cxc_client_overrides (notas + seguimiento por cliente, sin company_key) ─
-- Schema actual de fashion-group (sin company_key — overrides cross-empresa).
-- Para Brand It single-empresa: igual diseño, sin scope adicional.
CREATE TABLE IF NOT EXISTS cxc_client_overrides (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_normalized     TEXT UNIQUE NOT NULL,
  correo                TEXT,
  telefono              TEXT,
  celular               TEXT,
  contacto              TEXT,
  resultado_contacto    TEXT,
  proximo_seguimiento   DATE,
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ SECCIÓN 2 — ERP shared schema (Boston-only via CHECK)                    ║
-- ║ Schema clonado de fashion-group + CHECK constraint para enforce          ║
-- ║ single-empresa Boston a nivel DB.                                         ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- ── clientes_master ─────────────────────────────────────────────────────────
-- Directorio maestro de clientes. Brand It arranca VACÍO y auto-populate via
-- uploads (Fase D). Schema clonado de fashion-group con simplificación:
-- algunos campos opcionales raros (provincia, distrito, etc.) preservados
-- para compatibilidad con cxc_aging VIEW que los lee, pero sin obligación.
CREATE TABLE IF NOT EXISTS clientes_master (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo               TEXT,
  nombre               TEXT NOT NULL,
  nombre_normalized    TEXT NOT NULL,
  razon_social         TEXT,
  identificacion       TEXT,
  email                TEXT,
  telefono             TEXT,
  celular              TEXT,
  provincia            TEXT,
  deleted              BOOLEAN NOT NULL DEFAULT FALSE,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW(),
  dv                   TEXT,
  notas                TEXT,
  last_synced_at       TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_clientes_master_normalized
  ON clientes_master(nombre_normalized) WHERE deleted = false;
CREATE INDEX IF NOT EXISTS idx_clientes_master_codigo ON clientes_master(codigo);

-- ── ventas_raw ──────────────────────────────────────────────────────────────
-- Schema clonado de fashion-group (ventas_v2.sql + alters). CHECK enforce Boston.
-- Tras Fase C, AQUÍ aterrizan TODOS los tipos (Factura + Cotizacion + Pedido +
-- Notas + Transacciones + Tiquetes), no sólo facturas.
CREATE TABLE IF NOT EXISTS ventas_raw (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa       TEXT NOT NULL CHECK (empresa = 'confecciones_boston'),
  fecha         DATE NOT NULL,
  mes           INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  anio          INTEGER NOT NULL,
  quarter       INTEGER NOT NULL CHECK (quarter BETWEEN 1 AND 4),
  tipo          TEXT NOT NULL,
  n_sistema     TEXT,
  n_fiscal      TEXT,
  vendedor      TEXT,
  cliente       TEXT,
  cliente_id    UUID REFERENCES clientes_master(id) ON DELETE SET NULL,
  cliente_codigo TEXT,
  costo         NUMERIC(15,2),
  descuento     NUMERIC(15,2),
  subtotal      NUMERIC(15,2),
  itbms         NUMERIC(15,2),
  total         NUMERIC(15,2),
  utilidad      NUMERIC(15,2),
  pct_utilidad  NUMERIC(10,4),
  uploaded_by   UUID,
  uploaded_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ventas_raw_empresa_anio       ON ventas_raw(empresa, anio);
CREATE INDEX IF NOT EXISTS idx_ventas_raw_anio_mes           ON ventas_raw(anio, mes);
CREATE INDEX IF NOT EXISTS idx_ventas_raw_empresa_anio_mes   ON ventas_raw(empresa, anio, mes);
CREATE INDEX IF NOT EXISTS idx_ventas_raw_cliente_id         ON ventas_raw(cliente_id);
CREATE INDEX IF NOT EXISTS idx_ventas_raw_cliente_codigo     ON ventas_raw(cliente_codigo);
CREATE INDEX IF NOT EXISTS idx_ventas_raw_tipo               ON ventas_raw(tipo);

-- Unique constraint para dedupe en upserts (mismo patrón fashion-group)
ALTER TABLE ventas_raw
  DROP CONSTRAINT IF EXISTS ventas_raw_unique_factura;
ALTER TABLE ventas_raw
  ADD CONSTRAINT ventas_raw_unique_factura UNIQUE (empresa, tipo, n_sistema, fecha);

-- ── ventas_metas ────────────────────────────────────────────────────────────
-- IMPORTANTE: el código de Brand It (queries.ts:META_EMPRESA_DISPLAY) busca
-- la meta por empresa = 'Confecciones Boston' (display name, no normalizado).
-- Inconsistencia heredada de fashion-group: ventas_raw.empresa es key
-- normalizado, ventas_metas.empresa es display name. No corrijo acá para
-- mantener paridad con el código existente.
CREATE TABLE IF NOT EXISTS ventas_metas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa     TEXT NOT NULL CHECK (empresa = 'Confecciones Boston'),
  anio        INTEGER NOT NULL,
  meta        NUMERIC(15,2) NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (empresa, anio)
);

-- ── cxc_uploads + cxc_rows (per-factura) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS cxc_uploads (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_key   TEXT NOT NULL CHECK (company_key = 'confecciones_boston'),
  filename      TEXT,
  row_count     INTEGER DEFAULT 0,
  uploaded_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cxc_uploads_company       ON cxc_uploads(company_key);
CREATE INDEX IF NOT EXISTS idx_cxc_uploads_uploaded_at   ON cxc_uploads(uploaded_at DESC);

CREATE TABLE IF NOT EXISTS cxc_rows (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id           UUID NOT NULL REFERENCES cxc_uploads(id) ON DELETE CASCADE,
  company_key         TEXT NOT NULL CHECK (company_key = 'confecciones_boston'),
  cliente_codigo      TEXT,
  cliente_id          UUID REFERENCES clientes_master(id) ON DELETE SET NULL,
  fecha               DATE,
  comprobante         TEXT,
  n_sistema           TEXT,
  n_fiscal            TEXT,
  debito              NUMERIC DEFAULT 0,
  credito             NUMERIC DEFAULT 0,
  saldo               NUMERIC DEFAULT 0,
  fecha_vencimiento   DATE,
  dias_vencidos       INTEGER
);

CREATE INDEX IF NOT EXISTS idx_cxc_rows_upload         ON cxc_rows(upload_id);
CREATE INDEX IF NOT EXISTS idx_cxc_rows_company_key    ON cxc_rows(company_key);
CREATE INDEX IF NOT EXISTS idx_cxc_rows_cliente_codigo ON cxc_rows(cliente_codigo);
CREATE INDEX IF NOT EXISTS idx_cxc_rows_cliente_id     ON cxc_rows(cliente_id);
CREATE INDEX IF NOT EXISTS idx_cxc_rows_dias_vencidos  ON cxc_rows(dias_vencidos);


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ SECCIÓN 3 — Views                                                         ║
-- ║ cxc_aging: shape del schema viejo (id, codigo, nombre, buckets) para     ║
-- ║   compatibilidad con código existente. Buckets computados via FILTER.    ║
-- ║ clientes_empresa_12m_vw (materialized): rolling 12m por (cliente, empresa)║
-- ║   con delta same-period real (post-fix de fashion-group).                ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

DROP VIEW IF EXISTS cxc_aging CASCADE;
CREATE VIEW cxc_aging AS
SELECT
  md5(r.company_key || '|' || COALESCE(r.cliente_codigo, ''))::uuid AS id,
  MAX(r.upload_id)                    AS upload_id,
  r.company_key,
  r.cliente_codigo                    AS codigo,
  r.cliente_id,
  COALESCE(m.nombre, r.cliente_codigo) AS nombre,
  COALESCE(m.nombre_normalized,
           upper(regexp_replace(regexp_replace(COALESCE(r.cliente_codigo, ''), '[.,]', '', 'g'), '\s+', ' ', 'g')))
                                       AS nombre_normalized,
  COALESCE(m.email, '')               AS correo,
  COALESCE(m.telefono, '')            AS telefono,
  COALESCE(m.celular, '')             AS celular,
  ''::text                            AS contacto,
  'Panamá'::text                      AS pais,
  COALESCE(m.provincia, '')           AS provincia,
  ''::text                            AS distrito,
  ''::text                            AS corregimiento,
  0::numeric                          AS limite_credito,
  0::numeric                          AS limite_morosidad,
  COALESCE(SUM(r.debito - r.credito) FILTER (WHERE r.dias_vencidos BETWEEN   0 AND  30), 0) AS d0_30,
  COALESCE(SUM(r.debito - r.credito) FILTER (WHERE r.dias_vencidos BETWEEN  31 AND  60), 0) AS d31_60,
  COALESCE(SUM(r.debito - r.credito) FILTER (WHERE r.dias_vencidos BETWEEN  61 AND  90), 0) AS d61_90,
  COALESCE(SUM(r.debito - r.credito) FILTER (WHERE r.dias_vencidos BETWEEN  91 AND 120), 0) AS d91_120,
  COALESCE(SUM(r.debito - r.credito) FILTER (WHERE r.dias_vencidos BETWEEN 121 AND 180), 0) AS d121_180,
  COALESCE(SUM(r.debito - r.credito) FILTER (WHERE r.dias_vencidos BETWEEN 181 AND 270), 0) AS d181_270,
  COALESCE(SUM(r.debito - r.credito) FILTER (WHERE r.dias_vencidos BETWEEN 271 AND 365), 0) AS d271_365,
  COALESCE(SUM(r.debito - r.credito) FILTER (WHERE r.dias_vencidos > 365), 0)               AS mas_365,
  COALESCE(SUM(r.debito - r.credito), 0)                                                    AS total
FROM cxc_rows r
LEFT JOIN clientes_master m ON m.id = r.cliente_id AND m.deleted = false
GROUP BY r.company_key, r.cliente_codigo, r.cliente_id,
         m.nombre, m.nombre_normalized, m.email, m.telefono, m.celular, m.provincia
HAVING ABS(COALESCE(SUM(r.debito - r.credito), 0)) >= 0.01;

-- ── clientes_empresa_12m_vw (materialized) ──────────────────────────────────
-- Idéntica a fashion-group post-fix same-period (migration 20260510040000).
-- Para Brand It single-empresa, queries siempre filtran WHERE empresa = Boston.
DROP MATERIALIZED VIEW IF EXISTS clientes_empresa_12m_vw CASCADE;
CREATE MATERIALIZED VIEW clientes_empresa_12m_vw AS
WITH
  normalized AS (
    SELECT
      r.empresa,
      r.subtotal,
      r.fecha,
      r.anio,
      r.mes,
      COALESCE(
        NULLIF(
          TRIM(REGEXP_REPLACE(REGEXP_REPLACE(UPPER(r.cliente), '[.,]', '', 'g'), '\s+', ' ', 'g')),
          ''
        ),
        '(Sin nombre)'
      ) AS cliente_norm
    FROM ventas_raw r
    WHERE r.cliente IS NOT NULL
  ),
  filtered AS (
    SELECT *
    FROM normalized
    WHERE cliente_norm NOT IN (
      'CONFECCIONES BOSTON', 'MULTI FASHION HOLDING', 'MULTIFASHION', 'BOSTON',
      'CONTADO', 'VENTAS', '(Sin nombre)'
    )
  ),
  cutoff AS (
    SELECT (date_trunc('month', NOW())::date - INTERVAL '12 months')::date AS d
  ),
  current_year AS (
    SELECT EXTRACT(YEAR FROM CURRENT_DATE)::int AS y
  ),
  max_mes AS (
    SELECT COALESCE(MAX(f.mes), 12) AS m
    FROM filtered f, current_year cy
    WHERE f.anio = cy.y
  ),
  active_pairs AS (
    SELECT DISTINCT f.cliente_norm, f.empresa
    FROM filtered f, cutoff c
    WHERE f.fecha >= c.d
  ),
  ytd_actual AS (
    SELECT f.cliente_norm, f.empresa, SUM(f.subtotal) AS compras_ytd
    FROM filtered f, current_year cy, max_mes mm
    WHERE f.anio = cy.y AND f.mes <= mm.m
    GROUP BY f.cliente_norm, f.empresa
  ),
  prev_year AS (
    SELECT f.cliente_norm, f.empresa, SUM(f.subtotal) AS compras_anio_anterior
    FROM filtered f, current_year cy, max_mes mm
    WHERE f.anio = cy.y - 1 AND f.mes <= mm.m
    GROUP BY f.cliente_norm, f.empresa
  ),
  ultima AS (
    SELECT cliente_norm, empresa, MAX(fecha) AS ultima_compra
    FROM filtered
    GROUP BY cliente_norm, empresa
  )
SELECT
  ap.cliente_norm                                                     AS cliente_norm,
  m.id                                                                AS cliente_id,
  COALESCE(m.nombre, ap.cliente_norm)                                 AS cliente_nombre,
  COALESCE(m.codigo, '—')                                             AS cliente_codigo,
  ap.empresa                                                          AS empresa,
  COALESCE(ya.compras_ytd, 0)::numeric                                AS compras_ytd,
  COALESCE(py.compras_anio_anterior, 0)::numeric                      AS compras_anio_anterior,
  CASE
    WHEN COALESCE(py.compras_anio_anterior, 0) > 0
      THEN ((COALESCE(ya.compras_ytd, 0) - py.compras_anio_anterior) / py.compras_anio_anterior)::numeric
    ELSE NULL
  END                                                                 AS delta_vs_2025,
  u.ultima_compra                                                     AS ultima_compra,
  COALESCE(NULLIF(m.celular, ''), NULLIF(m.telefono, ''))             AS whatsapp
FROM active_pairs ap
LEFT JOIN ytd_actual ya ON ya.cliente_norm = ap.cliente_norm AND ya.empresa = ap.empresa
LEFT JOIN prev_year  py ON py.cliente_norm = ap.cliente_norm AND py.empresa = ap.empresa
LEFT JOIN ultima     u  ON u.cliente_norm  = ap.cliente_norm AND u.empresa  = ap.empresa
LEFT JOIN clientes_master m ON m.nombre_normalized = ap.cliente_norm AND m.deleted = false
ORDER BY u.ultima_compra DESC NULLS LAST;

CREATE UNIQUE INDEX IF NOT EXISTS idx_clientes_empresa_12m_vw_unq
  ON clientes_empresa_12m_vw (cliente_norm, empresa);
CREATE INDEX IF NOT EXISTS idx_clientes_empresa_12m_vw_empresa_ultima
  ON clientes_empresa_12m_vw (empresa, ultima_compra DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_clientes_empresa_12m_vw_cliente_id
  ON clientes_empresa_12m_vw (cliente_id);


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ SECCIÓN 4 — RPCs                                                          ║
-- ║ Portados sin modificación de fashion-group. Brand It pasa Boston como    ║
-- ║ parámetro implícito (filtra rows del result en JS).                       ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION ventas_dashboard_summary(p_anio int)
RETURNS TABLE (
  empresa text,
  mes int,
  total_subtotal numeric,
  total_costo numeric,
  total_utilidad numeric,
  total_facturado numeric,
  filas bigint
)
LANGUAGE sql STABLE AS $$
  SELECT
    empresa,
    mes,
    SUM(subtotal)::numeric  AS total_subtotal,
    SUM(costo)::numeric     AS total_costo,
    SUM(utilidad)::numeric  AS total_utilidad,
    SUM(total)::numeric     AS total_facturado,
    COUNT(*)::bigint        AS filas
  FROM ventas_raw
  WHERE anio = p_anio
  GROUP BY empresa, mes
  ORDER BY empresa, mes
$$;

CREATE OR REPLACE FUNCTION refresh_clientes_empresa_12m_vw()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY clientes_empresa_12m_vw;
END;
$$;

-- ── ventas_topclientes_summary + ventas_clientes_detalle_summary ────────────
-- Portados de fashion-group (migration 20260425013739). Genéricos a "empresa";
-- Brand It llamaría con Boston en el filtro. Si Brand It no los usa puede
-- omitirse, pero los incluyo por completitud (el código actual no los referencia
-- pero podrían ser útiles a futuro).
CREATE OR REPLACE FUNCTION ventas_topclientes_summary(
  p_anio int,
  p_limit int DEFAULT 50
)
RETURNS TABLE (
  cliente text,
  cliente_norm text,
  total_subtotal numeric,
  total_utilidad numeric
)
LANGUAGE sql STABLE AS $$
  WITH normalized AS (
    SELECT
      cliente,
      COALESCE(
        NULLIF(TRIM(REGEXP_REPLACE(REGEXP_REPLACE(UPPER(cliente), '[.,]', '', 'g'), '\s+', ' ', 'g')), ''),
        '(Sin nombre)'
      ) AS cliente_norm,
      subtotal,
      utilidad
    FROM ventas_raw
    WHERE anio = p_anio AND cliente IS NOT NULL
  )
  SELECT
    MAX(cliente)::text   AS cliente,
    cliente_norm,
    SUM(subtotal)::numeric AS total_subtotal,
    SUM(utilidad)::numeric AS total_utilidad
  FROM normalized
  GROUP BY cliente_norm
  ORDER BY SUM(subtotal) DESC
  LIMIT p_limit
$$;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ SECCIÓN 5 — RLS + Policies (service_role_all en todas)                   ║
-- ║ Brand It usa supabase-server con service_role key (bypass RLS), entonces ║
-- ║ una policy service_role_all es suficiente. Cero acceso público.          ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'user_roles', 'clients', 'quotations', 'quotation_items', 'print_jobs',
    'leads', 'lead_comentarios',
    'stickers',
    'notas_entrega', 'notas_entrega_items', 'admin_firmas',
    'caja_periodos', 'caja_responsables', 'caja_categorias', 'caja_gastos',
    'activity_log',
    'cxc_favoritos', 'cxc_client_overrides',
    'clientes_master',
    'ventas_raw', 'ventas_metas',
    'cxc_uploads', 'cxc_rows'
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


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ SECCIÓN 6 — REFRESH inicial + GRANTs                                     ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- VIEW cxc_aging — grant SELECT a service_role + authenticated/anon (queries
-- via REST necesitan acceso aunque sea via service role).
GRANT SELECT ON cxc_aging TO service_role, authenticated, anon;

-- Materialized view: refresh inicial (vacía hasta que haya uploads).
REFRESH MATERIALIZED VIEW clientes_empresa_12m_vw;
GRANT SELECT ON clientes_empresa_12m_vw TO service_role;

-- RPCs
GRANT EXECUTE ON FUNCTION ventas_dashboard_summary(int)           TO service_role;
GRANT EXECUTE ON FUNCTION ventas_topclientes_summary(int, int)    TO service_role;
GRANT EXECUTE ON FUNCTION refresh_clientes_empresa_12m_vw()       TO service_role;


-- ═══════════════════════════════════════════════════════════════════════════════
-- DECISIONES JUSTIFICADAS
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- (1) BOSTON-SCOPING — Opción (b): mantener columna + CHECK constraint
--     Por qué (b) y no (a) "eliminar columna":
--       • Código de Fase 2 ya filtra con .eq("empresa", "confecciones_boston").
--         Eliminar la columna obliga a reescribir cada query, alto riesgo de regresión.
--       • VIEW cxc_aging y MATVIEW clientes_empresa_12m_vw referencian empresa
--         como GROUP BY / partition column. Removerla requiere rewrite estructural.
--       • CHECK constraint logra la misma garantía data-integrity ("solo Boston
--         entra a la tabla") con cero rewrite de código.
--       • RPCs (ventas_dashboard_summary, etc.) son genéricos a empresa — el
--         CHECK garantiza que solo procesan Boston aunque la firma sea agnóstica.
--       • Si Brand It quisiera agregar otra empresa (improbable), solo hay que
--         relajar el CHECK — cero rewrite de código/queries.
--
-- (2) CLIENTES_MASTER AUTO-POPULATE
--     Brand It arranca VACÍO. Estrategia para Fase D:
--       • /api/ventas/upload (listacomprobantes): extrae (CODIGO, CLIENTE) por
--         fila; deduplica; UPSERT en clientes_master por codigo. Si no existe →
--         INSERT con nombre + nombre_normalized. Si existe → UPDATE solo
--         nombre + updated_at (preserva contacto y campos master-only).
--       • /api/cxc/upload (detallessaldos): mismo patrón. El CSV trae CODIGO
--         siempre; si el formato Switch incluye NOMBRE/CONTACTO/EMAIL (a verificar
--         con un sample real), upsertar también esos campos en clientes_master.
--       • Match cliente_id en cxc_rows/ventas_raw va DESPUÉS del upsert para
--         que clientes_master nuevos ya estén disponibles.
--       • Single source of truth para el directorio: los uploads.
--
-- (3) INCONSISTENCIA HEREDADA: ventas_metas.empresa vs ventas_raw.empresa
--     ventas_raw usa key normalizado ('confecciones_boston'), ventas_metas usa
--     display name ('Confecciones Boston'). Lo dejo igual que fashion-group para
--     no romper el código actual de Brand It (queries.ts:META_EMPRESA_DISPLAY).
--     Limpieza futura: convertir a key normalizado y migrar la data existente.
--
-- (4) RPCs INCLUIDOS:
--     ventas_dashboard_summary: usado por queries.ts:fetchVentasResumen
--     refresh_clientes_empresa_12m_vw: usado por cron (Fase E)
--     ventas_topclientes_summary: NO usado por código actual de Brand It, lo
--     incluyo por completitud (útil para futuros reportes top-clients).
--     ventas_clientes_detalle_summary: NO incluido — no usado por Brand It,
--     definición compleja (~150 líneas), incluir solo si Brand It lo necesita.
--
-- (5) CXC_AGING SIMPLIFICACIONES vs fashion-group:
--     • MAX(r.upload_id) en lugar de NULL::uuid: para que la query del GET
--       de /api/cxc/route.ts (filtra por upload_id) funcione. Cada cliente
--       tiene un solo upload activo (delete-then-insert pattern del parser).
--     • home_dashboard_summary RPC NO incluido — usa tablas (reclamos,
--       guia_transporte, directorio_clientes) que NO existen en Brand It.
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- FIN
-- ═══════════════════════════════════════════════════════════════════════════════
