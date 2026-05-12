-- RPC ventas_clientes_monthly_12m: serie mensual de los últimos 12 meses
-- absolutos por cliente, para alimentar sparklines en el Tab Clientes.
--
-- Retorna: TABLE(cliente_codigo text, monthly numeric[])
--   - cliente_codigo: del CSV de Switch, ya garantizado no-null por el filtro.
--   - monthly: array de 12 numbers. Index 0 = mes más viejo (hace 11 meses
--     desde el primer día del mes actual). Index 11 = mes actual.
--     Meses sin facturas → 0 (no null), garantizado por LEFT JOIN +
--     generate_series + COALESCE.
--
-- Filtros (consistentes con matview clientes_empresa_12m_vw post Fase C):
--   - empresa = 'confecciones_boston'
--   - tipo = 'Factura' (excluye Cotizaciones/Pedidos/Notas/Tiquetes para que
--     el sparkline refleje ventas reales).
--   - cliente_codigo IS NOT NULL (clientes huérfanos no tendrán entrada).
--
-- Universo: clientes con al menos una factura en los últimos 12 meses
-- (clientes inactivos quedan fuera, consistente con matview).
--
-- Aplicar en Apps Familia SQL editor (proyecto halqekrjfttpwoqtazjm).

CREATE OR REPLACE FUNCTION ventas_clientes_monthly_12m()
RETURNS TABLE (cliente_codigo text, monthly numeric[])
LANGUAGE sql STABLE AS $$
  WITH bounds AS (
    SELECT (date_trunc('month', NOW()) - INTERVAL '11 months')::date AS start_date
  ),
  filtered AS (
    SELECT
      r.cliente_codigo,
      (EXTRACT(YEAR FROM r.fecha)::int * 12 + EXTRACT(MONTH FROM r.fecha)::int)
        - (EXTRACT(YEAR FROM b.start_date)::int * 12 + EXTRACT(MONTH FROM b.start_date)::int) AS month_offset,
      r.subtotal
    FROM ventas_raw r, bounds b
    WHERE r.empresa = 'confecciones_boston'
      AND r.tipo = 'Factura'
      AND r.fecha >= b.start_date
      AND r.cliente_codigo IS NOT NULL
  ),
  aggregated AS (
    SELECT cliente_codigo, month_offset, SUM(subtotal)::numeric AS total
    FROM filtered
    GROUP BY cliente_codigo, month_offset
  ),
  clientes_activos AS (
    SELECT DISTINCT cliente_codigo FROM filtered
  )
  SELECT
    c.cliente_codigo,
    array_agg(COALESCE(a.total, 0)::numeric ORDER BY ms.m_off) AS monthly
  FROM clientes_activos c
  CROSS JOIN generate_series(0, 11) AS ms(m_off)
  LEFT JOIN aggregated a
    ON a.cliente_codigo = c.cliente_codigo
   AND a.month_offset = ms.m_off
  GROUP BY c.cliente_codigo
$$;

GRANT EXECUTE ON FUNCTION ventas_clientes_monthly_12m() TO service_role;
