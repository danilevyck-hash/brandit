-- Refactor matview clientes_empresa_12m_vw: JOIN clientes_master por
-- cliente_codigo (key estable del ERP) en lugar de nombre_normalized.
--
-- BUG PREVIO:
--   La matview computaba `cliente_norm` con UPPER + strip `[.,]` + collapse
--   whitespace. El upload de Fase D guarda `clientes_master.nombre_normalized`
--   con lowercase + strip diacríticos (NFD) + collapse whitespace, pero
--   MANTIENE puntos/comas. Las dos normalizaciones nunca coinciden:
--     Cliente "Tana, S.A."
--       matview cliente_norm     → "TANA SA"
--       master  nombre_normalized → "tana, s.a."
--   El JOIN `m.nombre_normalized = ap.cliente_norm` retornaba siempre FALSE,
--   produciendo 100% de rows con cliente_id = NULL (todos huérfanos).
--
-- FIX:
--   Cambiar la key de agrupamiento y el JOIN a `cliente_codigo`, que es
--   estable y compartido entre ventas_raw y clientes_master (ambos lo
--   reciben del CSV de Switch directo).
--
-- CAMBIOS PRESERVADOS DE FASE C (aplicada manualmente en Apps Familia):
--   - WHERE r.tipo = 'Factura' en el CTE normalized (excluye Cotizaciones,
--     Pedidos, Notas, Tiquetes, Transacciones del cálculo de YTD/12m).
--
-- CAMBIOS NUEVOS:
--   - WHERE r.cliente_codigo IS NOT NULL (rows sin código del ERP son
--     anómalas y se descartan; verificado que la cantidad es trivial).
--   - CTE `nombre_fallback`: último nombre visto en ventas_raw por código,
--     usado si clientes_master.nombre está vacío.
--   - Display de nombre con prioridad: m.nombre → último de raw → '(Sin nombre)'.
--   - Index único `(cliente_codigo, empresa)` reemplaza `(cliente_norm, empresa)`.
--   - Columna `cliente_norm` removida del result (no la consume queries.ts).
--
-- PRESERVADO (sin cambios):
--   - Same-period strict: `max_mes` cap aplicado tanto a YTD como a prev_year.
--   - Universo 12m rolling: clientes con al menos una factura en últimos 12m.
--   - Filtros NOT IN ('CONFECCIONES BOSTON', 'CONTADO', ...) en CTE filtered
--     (siguen usando cliente_norm porque aplican ANTES del agrupamiento).
--
-- Aplicar en Apps Familia SQL editor (proyecto halqekrjfttpwoqtazjm).

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
      r.cliente_codigo,
      r.cliente,
      COALESCE(
        NULLIF(
          TRIM(REGEXP_REPLACE(REGEXP_REPLACE(UPPER(r.cliente), '[.,]', '', 'g'), '\s+', ' ', 'g')),
          ''
        ),
        '(Sin nombre)'
      ) AS cliente_norm
    FROM ventas_raw r
    WHERE r.cliente IS NOT NULL
      AND r.tipo = 'Factura'
      AND r.cliente_codigo IS NOT NULL
  ),
  filtered AS (
    -- cliente_norm sigue siendo útil para descartar nombres "malos" conocidos.
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
    SELECT DISTINCT f.cliente_codigo, f.empresa
    FROM filtered f, cutoff c
    WHERE f.fecha >= c.d
  ),
  ytd_actual AS (
    SELECT f.cliente_codigo, f.empresa, SUM(f.subtotal) AS compras_ytd
    FROM filtered f, current_year cy, max_mes mm
    WHERE f.anio = cy.y AND f.mes <= mm.m
    GROUP BY f.cliente_codigo, f.empresa
  ),
  prev_year AS (
    SELECT f.cliente_codigo, f.empresa, SUM(f.subtotal) AS compras_anio_anterior
    FROM filtered f, current_year cy, max_mes mm
    WHERE f.anio = cy.y - 1 AND f.mes <= mm.m
    GROUP BY f.cliente_codigo, f.empresa
  ),
  ultima AS (
    SELECT cliente_codigo, empresa, MAX(fecha) AS ultima_compra
    FROM filtered
    GROUP BY cliente_codigo, empresa
  ),
  nombre_fallback AS (
    -- Último nombre visto en ventas_raw por (codigo, empresa). Usado si
    -- clientes_master no tiene match o nombre está vacío.
    SELECT DISTINCT ON (cliente_codigo, empresa)
      cliente_codigo,
      empresa,
      cliente AS nombre_fallback
    FROM filtered
    ORDER BY cliente_codigo, empresa, fecha DESC
  )
SELECT
  ap.cliente_codigo                                                   AS cliente_codigo,
  m.id                                                                AS cliente_id,
  COALESCE(m.nombre, nf.nombre_fallback, '(Sin nombre)')              AS cliente_nombre,
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
LEFT JOIN ytd_actual ya       ON ya.cliente_codigo = ap.cliente_codigo AND ya.empresa = ap.empresa
LEFT JOIN prev_year  py       ON py.cliente_codigo = ap.cliente_codigo AND py.empresa = ap.empresa
LEFT JOIN ultima     u        ON u.cliente_codigo  = ap.cliente_codigo AND u.empresa  = ap.empresa
LEFT JOIN nombre_fallback nf  ON nf.cliente_codigo = ap.cliente_codigo AND nf.empresa = ap.empresa
LEFT JOIN clientes_master m   ON m.codigo = ap.cliente_codigo AND m.deleted = false
ORDER BY u.ultima_compra DESC NULLS LAST;

CREATE UNIQUE INDEX IF NOT EXISTS idx_clientes_empresa_12m_vw_unq
  ON clientes_empresa_12m_vw (cliente_codigo, empresa);
CREATE INDEX IF NOT EXISTS idx_clientes_empresa_12m_vw_empresa_ultima
  ON clientes_empresa_12m_vw (empresa, ultima_compra DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_clientes_empresa_12m_vw_cliente_id
  ON clientes_empresa_12m_vw (cliente_id);

REFRESH MATERIALIZED VIEW clientes_empresa_12m_vw;
GRANT SELECT ON clientes_empresa_12m_vw TO service_role;
