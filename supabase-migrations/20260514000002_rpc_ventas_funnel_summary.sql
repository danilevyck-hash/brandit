-- RPC ventas_funnel_summary: agrega counts + totales por tipo del año, filtrado
-- a Confecciones Boston. Reemplaza el patrón 3-queries-paralelas-a-ventas_raw
-- del fetchFunnel anterior que topaba en 1000 filas (default Supabase JS sin
-- paginación). Al hacer el GROUP BY en SQL, el resultado es ≤7 filas (una por
-- tipo) — ningún límite de transporte aplica.
--
-- Shape: TABLE(tipo text, count bigint, total numeric). El cliente mapea
-- a FunnelStats {cotizaciones, pedidos, facturas} × {count, total}.

CREATE OR REPLACE FUNCTION ventas_funnel_summary(p_anio int)
RETURNS TABLE (
  tipo text,
  count bigint,
  total numeric
)
LANGUAGE sql STABLE AS $$
  SELECT
    tipo,
    COUNT(*)::bigint     AS count,
    SUM(total)::numeric  AS total
  FROM ventas_raw
  WHERE anio = p_anio
    AND empresa = 'confecciones_boston'
  GROUP BY tipo
$$;

GRANT EXECUTE ON FUNCTION ventas_funnel_summary(int) TO service_role;
