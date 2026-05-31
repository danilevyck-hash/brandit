-- ═══════════════════════════════════════════════════════════════════════════════
-- BRAND IT — Módulo Ventas single-empresa (Boston). Vistas unificadas + RPCs.
-- (2026-05-31)  Aplicar manual en Supabase SQL Editor (Apps Familia).
--
-- Portado del molde Multifashion de fashiongr, ADAPTADO:
--   - Una sola empresa (Boston): sin filtro de empresa, sin split retail/wholesale.
--   - Fuente unificada por boundary 2026-05-01:
--       historia  (< 2026-05-01) = ventas_raw     (subtotal YA firmado, NC negativas)
--       forward   (>= 2026-05-01) = switch_facturas (subtotal_descuento YA firmado)
--     → la vista SUMA directo, sin CASE de signo (distinto al molde, cuya fuente
--       traía NC en positivo; acá ambas vienen firmadas → verificado YTD $285,585).
--   - Margen SÍ se muestra: costo historia = ventas_raw.costo; costo forward =
--     switch_costo_diario. Margen/utilidad a nivel mes/YTD/día (NO por vendedor/cliente).
--   - Tickets = COUNT(DISTINCT doc_id).
--   - Lógica same-period day-by-day conservada tal cual el molde.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── Vista unificada a nivel DOCUMENTO ────────────────────────────────────────
-- fecha, doc_id, vendedor, cliente, subtotal_neto (firmado), tipo, anio, mes.
CREATE OR REPLACE VIEW ventas_doc_vw AS
  -- Historia: ventas_raw < 2026-05-01 (subtotal ya firmado; NCs negativas)
  SELECT
    anio, mes, fecha::date AS fecha,
    n_sistema::text        AS doc_id,
    vendedor, cliente,
    subtotal::numeric      AS subtotal_neto,
    tipo                   AS tipo
  FROM ventas_raw
  WHERE fecha < DATE '2026-05-01'
UNION ALL
  -- Forward: switch_facturas >= 2026-05-01 (subtotal_descuento ya firmado)
  SELECT
    EXTRACT(YEAR  FROM fecha)::int AS anio,
    EXTRACT(MONTH FROM fecha)::int AS mes,
    fecha::date                   AS fecha,
    factura_id::text              AS doc_id,
    vendedor_nombre               AS vendedor,
    cliente_nombre                AS cliente,
    subtotal_descuento::numeric   AS subtotal_neto,
    tipo_comprobante              AS tipo
  FROM switch_facturas
  WHERE fecha >= DATE '2026-05-01';

GRANT SELECT ON ventas_doc_vw TO service_role;

-- ── Vista de costo por DÍA (para margen mes/YTD/día) ─────────────────────────
CREATE OR REPLACE VIEW ventas_costo_dia_vw AS
  SELECT fecha::date AS fecha, SUM(costo_total)::numeric AS costo
  FROM switch_costo_diario
  WHERE fecha >= DATE '2026-05-01'
  GROUP BY 1
UNION ALL
  SELECT fecha::date AS fecha, SUM(costo)::numeric AS costo
  FROM ventas_raw
  WHERE fecha < DATE '2026-05-01'
  GROUP BY 1;

GRANT SELECT ON ventas_costo_dia_vw TO service_role;


-- ═════════════════════════════════════════════════════════════════════════════
-- 1) ventas_overview_v1 — KPIs YTD + meses[12] (same-period day-by-day) + margen
-- ═════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION ventas_overview_v1(p_year int, p_mes int)
RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_ventas numeric; v_tickets bigint; v_ticket_prom numeric;
  v_costo numeric; v_utilidad numeric; v_margen numeric;
  v_ventas_prev numeric; v_costo_prev numeric; v_margen_prev numeric;
  v_meses jsonb;
BEGIN
  -- YTD actual (ventas firmadas + tickets distinct doc).
  SELECT COALESCE(SUM(subtotal_neto), 0), COUNT(DISTINCT doc_id)
  INTO v_ventas, v_tickets
  FROM ventas_doc_vw WHERE anio = p_year AND mes <= p_mes;
  v_ticket_prom := CASE WHEN v_tickets > 0 THEN v_ventas / v_tickets ELSE 0 END;

  -- Costo/utilidad/margen YTD (costo por día, mismo período).
  SELECT COALESCE(SUM(costo), 0) INTO v_costo
  FROM ventas_costo_dia_vw
  WHERE fecha >= make_date(p_year, 1, 1)
    AND fecha <= LEAST(CURRENT_DATE, (make_date(p_year, p_mes, 1) + INTERVAL '1 month' - INTERVAL '1 day')::date);
  v_utilidad := v_ventas - v_costo;
  v_margen   := CASE WHEN v_ventas > 0 THEN v_utilidad / v_ventas ELSE NULL END;

  -- YTD año anterior (mismo nº de meses) para margenPrev.
  SELECT COALESCE(SUM(subtotal_neto), 0) INTO v_ventas_prev
  FROM ventas_doc_vw WHERE anio = p_year - 1 AND mes <= p_mes;
  SELECT COALESCE(SUM(costo), 0) INTO v_costo_prev
  FROM ventas_costo_dia_vw
  WHERE fecha >= make_date(p_year - 1, 1, 1)
    AND fecha <= (make_date(p_year - 1, p_mes, 1) + INTERVAL '1 month' - INTERVAL '1 day')::date;
  v_margen_prev := CASE WHEN v_ventas_prev > 0 THEN (v_ventas_prev - v_costo_prev) / v_ventas_prev ELSE NULL END;

  -- meses[12] con same-period day-by-day (idéntico al molde).
  WITH mes_meta AS (
    SELECT m.mes,
      make_date(p_year, m.mes, 1) AS inicio,
      (make_date(p_year, m.mes, 1) + INTERVAL '1 month' - INTERVAL '1 day')::date AS fin_full,
      make_date(p_year - 1, m.mes, 1) AS prev_inicio,
      (make_date(p_year - 1, m.mes, 1) + INTERVAL '1 month' - INTERVAL '1 day')::date AS prev_fin_full
    FROM generate_series(1, 12) AS m(mes)
  ),
  mes_corte AS (
    SELECT mm.*,
      (CURRENT_DATE BETWEEN mm.inicio AND mm.fin_full) AS es_parcial,
      CASE WHEN (CURRENT_DATE BETWEEN mm.inicio AND mm.fin_full)
        THEN (SELECT MAX(fecha) FROM ventas_doc_vw WHERE fecha BETWEEN mm.inicio AND mm.fin_full)
        ELSE mm.fin_full END AS fecha_corte
    FROM mes_meta mm
  ),
  mes_resuelto AS (
    SELECT mc.*,
      CASE
        WHEN mc.es_parcial AND mc.fecha_corte IS NOT NULL
          THEN LEAST(mc.prev_inicio + (mc.fecha_corte - mc.inicio), mc.prev_fin_full)
        WHEN NOT mc.es_parcial THEN mc.prev_fin_full
        ELSE NULL END AS dia_corte_anio_anterior
    FROM mes_corte mc
  ),
  mes_agg AS (
    SELECT mr.mes, mr.es_parcial, mr.fecha_corte, mr.dia_corte_anio_anterior,
      COALESCE((SELECT SUM(subtotal_neto) FROM ventas_doc_vw
                WHERE mr.fecha_corte IS NOT NULL AND fecha BETWEEN mr.inicio AND mr.fecha_corte), 0)::numeric AS ventas,
      COALESCE((SELECT COUNT(DISTINCT doc_id) FROM ventas_doc_vw
                WHERE mr.fecha_corte IS NOT NULL AND fecha BETWEEN mr.inicio AND mr.fecha_corte), 0)::int AS tickets,
      COALESCE((SELECT SUM(subtotal_neto) FROM ventas_doc_vw
                WHERE mr.dia_corte_anio_anterior IS NOT NULL AND fecha BETWEEN mr.prev_inicio AND mr.dia_corte_anio_anterior), 0)::numeric AS ventas_prev
    FROM mes_resuelto mr
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'mes', CASE a.mes WHEN 1 THEN 'Ene' WHEN 2 THEN 'Feb' WHEN 3 THEN 'Mar' WHEN 4 THEN 'Abr'
                        WHEN 5 THEN 'May' WHEN 6 THEN 'Jun' WHEN 7 THEN 'Jul' WHEN 8 THEN 'Ago'
                        WHEN 9 THEN 'Sep' WHEN 10 THEN 'Oct' WHEN 11 THEN 'Nov' ELSE 'Dic' END,
      'ventas', a.ventas, 'tickets', a.tickets,
      'ticketProm', CASE WHEN a.tickets > 0 THEN a.ventas / a.tickets ELSE 0 END,
      'vs2025', CASE WHEN a.tickets = 0 AND a.ventas = 0 THEN NULL
                     WHEN a.ventas_prev > 0 THEN (a.ventas - a.ventas_prev) / a.ventas_prev
                     ELSE NULL END,
      'es_periodo_parcial', a.es_parcial,
      'fecha_corte', CASE WHEN a.es_parcial AND a.fecha_corte IS NOT NULL THEN to_char(a.fecha_corte, 'YYYY-MM-DD') ELSE NULL END,
      'dia_corte_anio_anterior', CASE WHEN a.es_parcial AND a.dia_corte_anio_anterior IS NOT NULL THEN to_char(a.dia_corte_anio_anterior, 'YYYY-MM-DD') ELSE NULL END
    ) ORDER BY a.mes
  ) INTO v_meses FROM mes_agg a;

  RETURN jsonb_build_object(
    'ytdVentas', v_ventas, 'ytdTickets', v_tickets, 'ticketProm', v_ticket_prom,
    'ytdCosto', v_costo, 'ytdUtilidad', v_utilidad,
    'margen', v_margen, 'margenPrev', v_margen_prev,
    'meses', COALESCE(v_meses, '[]'::jsonb)
  );
END;
$$;
GRANT EXECUTE ON FUNCTION ventas_overview_v1(int, int) TO service_role;


-- ═════════════════════════════════════════════════════════════════════════════
-- 2) ventas_detalle_mensual_v1 — día-por-día + heatmap + margen (mes/día)
-- ═════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION ventas_detalle_mensual_v1(p_year int, p_mes int)
RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_mes_inicio date; v_mes_fin_full date; v_mes_fin_real date;
  v_dias_en_mes int; v_dia_actual int; v_is_mes_actual boolean;
  v_prev_mes_inicio date; v_prev_mes_fin date;
  v_yoy_mes_inicio date; v_yoy_mes_fin date;
  v_ventas_cur numeric; v_tickets_cur bigint; v_ticket_prom numeric; v_proyeccion numeric;
  v_costo_cur numeric; v_utilidad_cur numeric; v_margen_cur numeric;
  v_mom_ventas numeric; v_mom_tickets bigint; v_mom_tiene boolean;
  v_yoy_ventas numeric; v_yoy_tickets bigint; v_yoy_tiene boolean;
  v_dias jsonb; v_mejor jsonb; v_peor jsonb; v_heatmap jsonb;
BEGIN
  v_mes_inicio   := make_date(p_year, p_mes, 1);
  v_mes_fin_full := (v_mes_inicio + INTERVAL '1 month' - INTERVAL '1 day')::date;
  v_dias_en_mes  := EXTRACT(DAY FROM v_mes_fin_full)::int;
  v_is_mes_actual := (p_year = EXTRACT(YEAR FROM CURRENT_DATE)::int AND p_mes = EXTRACT(MONTH FROM CURRENT_DATE)::int);

  SELECT COALESCE(MAX(d), 0) INTO v_dia_actual FROM (
    SELECT EXTRACT(DAY FROM fecha)::int AS d FROM ventas_doc_vw
    WHERE fecha BETWEEN v_mes_inicio AND v_mes_fin_full
    GROUP BY EXTRACT(DAY FROM fecha)::int HAVING SUM(subtotal_neto) <> 0
  ) s;
  v_mes_fin_real := CASE WHEN v_dia_actual > 0 THEN make_date(p_year, p_mes, v_dia_actual) ELSE v_mes_inicio END;

  IF p_mes > 1 THEN v_prev_mes_inicio := make_date(p_year, p_mes - 1, 1);
  ELSE v_prev_mes_inicio := make_date(p_year - 1, 12, 1); END IF;
  v_prev_mes_fin := LEAST(v_prev_mes_inicio + (v_dia_actual - 1), (v_prev_mes_inicio + INTERVAL '1 month' - INTERVAL '1 day')::date);
  v_yoy_mes_inicio := make_date(p_year - 1, p_mes, 1);
  v_yoy_mes_fin := LEAST(v_yoy_mes_inicio + (v_dia_actual - 1), (v_yoy_mes_inicio + INTERVAL '1 month' - INTERVAL '1 day')::date);

  -- Totales mes corriente + margen (costo del mismo rango de días).
  SELECT COALESCE(SUM(subtotal_neto), 0), COUNT(DISTINCT doc_id)
  INTO v_ventas_cur, v_tickets_cur
  FROM ventas_doc_vw WHERE fecha BETWEEN v_mes_inicio AND v_mes_fin_real;
  v_ticket_prom := CASE WHEN v_tickets_cur > 0 THEN v_ventas_cur / v_tickets_cur ELSE 0 END;
  v_proyeccion  := CASE WHEN v_is_mes_actual AND v_dia_actual > 0 THEN (v_ventas_cur / v_dia_actual) * v_dias_en_mes ELSE NULL END;
  SELECT COALESCE(SUM(costo), 0) INTO v_costo_cur FROM ventas_costo_dia_vw WHERE fecha BETWEEN v_mes_inicio AND v_mes_fin_real;
  v_utilidad_cur := v_ventas_cur - v_costo_cur;
  v_margen_cur   := CASE WHEN v_ventas_cur > 0 THEN v_utilidad_cur / v_ventas_cur ELSE NULL END;

  SELECT COALESCE(SUM(subtotal_neto), 0), COUNT(DISTINCT doc_id) INTO v_mom_ventas, v_mom_tickets
  FROM ventas_doc_vw WHERE fecha BETWEEN v_prev_mes_inicio AND v_prev_mes_fin;
  v_mom_tiene := (v_mom_tickets > 0);
  SELECT COALESCE(SUM(subtotal_neto), 0), COUNT(DISTINCT doc_id) INTO v_yoy_ventas, v_yoy_tickets
  FROM ventas_doc_vw WHERE fecha BETWEEN v_yoy_mes_inicio AND v_yoy_mes_fin;
  v_yoy_tiene := (v_yoy_tickets > 0);

  -- dias[]: ventas + utilidad por día (utilidad = ventas_dia - costo_dia).
  WITH dias AS (SELECT generate_series(1, v_dias_en_mes) AS d),
  cur AS (
    SELECT EXTRACT(DAY FROM fecha)::int AS d, SUM(subtotal_neto)::numeric AS ventas, COUNT(DISTINCT doc_id)::int AS tickets
    FROM ventas_doc_vw WHERE fecha BETWEEN v_mes_inicio AND v_mes_fin_full GROUP BY EXTRACT(DAY FROM fecha)::int
  ),
  costo AS (
    SELECT EXTRACT(DAY FROM fecha)::int AS d, SUM(costo)::numeric AS costo
    FROM ventas_costo_dia_vw WHERE fecha BETWEEN v_mes_inicio AND v_mes_fin_full GROUP BY EXTRACT(DAY FROM fecha)::int
  ),
  prev AS (
    SELECT EXTRACT(DAY FROM fecha)::int AS d, SUM(subtotal_neto)::numeric AS ventas_prev
    FROM ventas_doc_vw WHERE fecha BETWEEN v_prev_mes_inicio AND (v_prev_mes_inicio + INTERVAL '1 month' - INTERVAL '1 day')::date
    GROUP BY EXTRACT(DAY FROM fecha)::int
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'dia', d.d, 'ventas', COALESCE(cur.ventas, 0),
      'utilidad', CASE WHEN cur.ventas IS NULL THEN NULL ELSE COALESCE(cur.ventas,0) - COALESCE(costo.costo,0) END,
      'n_tickets', COALESCE(cur.tickets, 0), 'ventas_mes_anterior', COALESCE(prev.ventas_prev, 0)
    ) ORDER BY d.d
  ) INTO v_dias
  FROM dias d LEFT JOIN cur ON cur.d = d.d LEFT JOIN costo ON costo.d = d.d LEFT JOIN prev ON prev.d = d.d;

  WITH dd AS (
    SELECT fecha, SUM(subtotal_neto) AS ventas FROM ventas_doc_vw
    WHERE fecha BETWEEN v_mes_inicio AND v_mes_fin_real GROUP BY fecha HAVING SUM(subtotal_neto) <> 0
  )
  SELECT
    (SELECT jsonb_build_object('fecha', to_char(fecha,'YYYY-MM-DD'), 'ventas', ventas) FROM dd ORDER BY ventas DESC LIMIT 1),
    (SELECT jsonb_build_object('fecha', to_char(fecha,'YYYY-MM-DD'), 'ventas', ventas) FROM dd ORDER BY ventas ASC LIMIT 1)
  INTO v_mejor, v_peor;

  WITH dows AS (
    SELECT EXTRACT(DOW FROM fecha)::int AS dow, SUM(subtotal_neto) AS ventas FROM ventas_doc_vw
    WHERE fecha BETWEEN v_mes_inicio AND v_mes_fin_real GROUP BY fecha, EXTRACT(DOW FROM fecha)::int HAVING SUM(subtotal_neto) <> 0
  ),
  agg AS (SELECT dow, AVG(ventas)::numeric AS prom, COUNT(*)::int AS n FROM dows GROUP BY dow),
  dows_all AS (SELECT generate_series(0,6) AS dow)
  SELECT jsonb_agg(
    jsonb_build_object('dow', da.dow,
      'dow_label', CASE da.dow WHEN 0 THEN 'Dom' WHEN 1 THEN 'Lun' WHEN 2 THEN 'Mar' WHEN 3 THEN 'Mié' WHEN 4 THEN 'Jue' WHEN 5 THEN 'Vie' ELSE 'Sáb' END,
      'ventas_promedio', COALESCE(agg.prom, 0), 'count_dias', COALESCE(agg.n, 0)
    ) ORDER BY da.dow
  ) INTO v_heatmap FROM dows_all da LEFT JOIN agg ON agg.dow = da.dow;

  RETURN jsonb_build_object(
    'year', p_year, 'mes', p_mes,
    'mes_label', CASE p_mes WHEN 1 THEN 'Enero' WHEN 2 THEN 'Febrero' WHEN 3 THEN 'Marzo' WHEN 4 THEN 'Abril'
                            WHEN 5 THEN 'Mayo' WHEN 6 THEN 'Junio' WHEN 7 THEN 'Julio' WHEN 8 THEN 'Agosto'
                            WHEN 9 THEN 'Septiembre' WHEN 10 THEN 'Octubre' WHEN 11 THEN 'Noviembre' ELSE 'Diciembre' END,
    'is_mes_actual', v_is_mes_actual, 'dia_actual', v_dia_actual, 'dias_en_mes', v_dias_en_mes,
    'dias', COALESCE(v_dias, '[]'::jsonb),
    'totales', jsonb_build_object(
      'ventas', v_ventas_cur, 'costo', v_costo_cur, 'utilidad', v_utilidad_cur,
      'n_tickets', v_tickets_cur, 'ticket_promedio', v_ticket_prom,
      'margen', v_margen_cur, 'proyeccion_cierre', v_proyeccion
    ),
    'mes_anterior', jsonb_build_object('ventas', v_mom_ventas, 'n_tickets', v_mom_tickets, 'tiene_data', v_mom_tiene),
    'yoy', jsonb_build_object('ventas', v_yoy_ventas, 'n_tickets', v_yoy_tickets, 'tiene_data', v_yoy_tiene),
    'mejor_dia', v_mejor, 'peor_dia', v_peor,
    'heatmap_dia_semana', COALESCE(v_heatmap, '[]'::jsonb)
  );
END;
$$;
GRANT EXECUTE ON FUNCTION ventas_detalle_mensual_v1(int, int) TO service_role;


-- ═════════════════════════════════════════════════════════════════════════════
-- 3) ventas_vendedoras_v1 — ranking (same-period). Sin margen por vendedor.
-- ═════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION ventas_vendedoras_v1(
  p_year int, p_periodo text, p_mes int DEFAULT NULL, p_trimestre int DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_ai date; v_aff date; v_pi date; v_pff date; v_af date; v_pf date;
  v_off int; v_parcial boolean; v_top text; v_vend jsonb;
  v_vt numeric; v_tt bigint; v_vtp numeric; v_ttp bigint;
  v_py int; v_pm int; v_pt int;
BEGIN
  IF p_periodo = 'mes' THEN
    IF p_mes IS NULL OR p_mes < 1 OR p_mes > 12 THEN RAISE EXCEPTION 'p_mes requerido (1..12)'; END IF;
    v_ai := make_date(p_year, p_mes, 1); v_aff := (v_ai + INTERVAL '1 month' - INTERVAL '1 day')::date;
    IF p_mes > 1 THEN v_py := p_year; v_pm := p_mes - 1; ELSE v_py := p_year - 1; v_pm := 12; END IF;
    v_pi := make_date(v_py, v_pm, 1); v_pff := (v_pi + INTERVAL '1 month' - INTERVAL '1 day')::date;
  ELSIF p_periodo = 'trimestre' THEN
    IF p_trimestre IS NULL OR p_trimestre < 1 OR p_trimestre > 4 THEN RAISE EXCEPTION 'p_trimestre requerido (1..4)'; END IF;
    v_ai := make_date(p_year, (p_trimestre - 1) * 3 + 1, 1); v_aff := (v_ai + INTERVAL '3 months' - INTERVAL '1 day')::date;
    IF p_trimestre > 1 THEN v_py := p_year; v_pt := p_trimestre - 1; ELSE v_py := p_year - 1; v_pt := 4; END IF;
    v_pi := make_date(v_py, (v_pt - 1) * 3 + 1, 1); v_pff := (v_pi + INTERVAL '3 months' - INTERVAL '1 day')::date;
  ELSIF p_periodo = 'ytd' THEN
    v_ai := make_date(p_year, 1, 1); v_aff := make_date(p_year, 12, 31);
    v_pi := make_date(p_year - 1, 1, 1); v_pff := make_date(p_year - 1, 12, 31);
  ELSE RAISE EXCEPTION 'p_periodo inválido: %', p_periodo; END IF;

  SELECT MAX(fecha) INTO v_af FROM ventas_doc_vw WHERE fecha BETWEEN v_ai AND v_aff;
  v_parcial := (CURRENT_DATE BETWEEN v_ai AND v_aff);
  IF v_af IS NULL THEN
    RETURN jsonb_build_object('vendedoras','[]'::jsonb,'total_vendedoras_periodo',0,'ventas_total',0,'tickets_total',0,
      'ventas_total_prev',0,'tickets_total_prev',0,'fecha_corte',NULL,'es_periodo_parcial',v_parcial,'dia_corte_anio_anterior',NULL);
  END IF;
  IF v_parcial THEN v_off := v_af - v_ai; v_pf := LEAST(v_pi + v_off, v_pff);
  ELSE v_af := v_aff; v_pf := v_pff; END IF;

  SELECT REGEXP_REPLACE(TRIM(vendedor), '\s+', ' ', 'g') INTO v_top
  FROM ventas_doc_vw WHERE fecha BETWEEN v_ai AND v_af
    AND vendedor IS NOT NULL AND TRIM(vendedor) <> '' AND UPPER(TRIM(vendedor)) <> 'DEFAULT'
  GROUP BY REGEXP_REPLACE(TRIM(vendedor), '\s+', ' ', 'g') ORDER BY SUM(subtotal_neto) DESC LIMIT 1;

  WITH actual AS (
    SELECT REGEXP_REPLACE(TRIM(vendedor), '\s+', ' ', 'g') AS vendedor, SUM(subtotal_neto) AS ventas, COUNT(DISTINCT doc_id) AS tickets
    FROM ventas_doc_vw WHERE fecha BETWEEN v_ai AND v_af
      AND vendedor IS NOT NULL AND TRIM(vendedor) <> '' AND UPPER(TRIM(vendedor)) <> 'DEFAULT'
    GROUP BY REGEXP_REPLACE(TRIM(vendedor), '\s+', ' ', 'g')
  ),
  prev AS (
    SELECT REGEXP_REPLACE(TRIM(vendedor), '\s+', ' ', 'g') AS vendedor, SUM(subtotal_neto) AS ventas, COUNT(DISTINCT doc_id) AS tickets
    FROM ventas_doc_vw WHERE fecha BETWEEN v_pi AND v_pf
      AND vendedor IS NOT NULL AND TRIM(vendedor) <> '' AND UPPER(TRIM(vendedor)) <> 'DEFAULT'
    GROUP BY REGEXP_REPLACE(TRIM(vendedor), '\s+', ' ', 'g')
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'nombre', a.vendedor, 'tickets', a.tickets, 'ventas', a.ventas,
      'ticket_promedio', CASE WHEN a.tickets > 0 THEN a.ventas / a.tickets ELSE 0 END,
      'top', (a.vendedor = v_top),
      'delta_ventas_pct', CASE WHEN COALESCE(p.ventas,0) > 0 THEN (a.ventas - p.ventas) / p.ventas ELSE NULL END,
      'delta_tickets_pct', CASE WHEN COALESCE(p.tickets,0) > 0 THEN (a.tickets - p.tickets)::numeric / p.tickets ELSE NULL END
    ) ORDER BY a.ventas DESC
  ) INTO v_vend FROM actual a LEFT JOIN prev p ON p.vendedor = a.vendedor;

  SELECT COALESCE(SUM(subtotal_neto),0), COUNT(DISTINCT doc_id) INTO v_vt, v_tt
  FROM ventas_doc_vw WHERE fecha BETWEEN v_ai AND v_af
    AND vendedor IS NOT NULL AND TRIM(vendedor) <> '' AND UPPER(TRIM(vendedor)) <> 'DEFAULT';
  SELECT COALESCE(SUM(subtotal_neto),0), COUNT(DISTINCT doc_id) INTO v_vtp, v_ttp
  FROM ventas_doc_vw WHERE fecha BETWEEN v_pi AND v_pf
    AND vendedor IS NOT NULL AND TRIM(vendedor) <> '' AND UPPER(TRIM(vendedor)) <> 'DEFAULT';

  RETURN jsonb_build_object(
    'vendedoras', COALESCE(v_vend, '[]'::jsonb),
    'total_vendedoras_periodo', jsonb_array_length(COALESCE(v_vend, '[]'::jsonb)),
    'ventas_total', v_vt, 'tickets_total', v_tt, 'ventas_total_prev', v_vtp, 'tickets_total_prev', v_ttp,
    'fecha_corte', to_char(v_af, 'YYYY-MM-DD'), 'es_periodo_parcial', v_parcial,
    'dia_corte_anio_anterior', to_char(v_pf, 'YYYY-MM-DD')
  );
END;
$$;
GRANT EXECUTE ON FUNCTION ventas_vendedoras_v1(int, text, int, int) TO service_role;


-- ═════════════════════════════════════════════════════════════════════════════
-- 4) ventas_clientes_v1 — clientes recurrentes (>=2 tickets, excl. CONTADO/CF)
-- ═════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION ventas_clientes_v1(
  p_fecha_inicio date, p_fecha_fin date, p_limit int DEFAULT 50
)
RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_cli jsonb; v_total_cli int; v_total_v numeric; v_total_t bigint;
  v_ml CONSTANT text[] := ARRAY['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
BEGIN
  IF p_limit IS NULL OR p_limit < 1 THEN p_limit := 50; END IF;
  IF p_limit > 500 THEN p_limit := 500; END IF;

  WITH base AS (
    SELECT cliente, subtotal_neto, fecha, doc_id,
      EXTRACT(YEAR FROM fecha)::int AS f_anio, EXTRACT(MONTH FROM fecha)::int AS f_mes
    FROM ventas_doc_vw
    WHERE fecha BETWEEN p_fecha_inicio AND p_fecha_fin
      AND cliente IS NOT NULL AND TRIM(UPPER(cliente)) NOT IN ('CONTADO', 'CONSUMIDOR FINAL', '')
  ),
  cli AS (
    SELECT cliente, SUM(subtotal_neto)::numeric AS total_ytd, COUNT(DISTINCT doc_id)::int AS tickets_ytd, MAX(fecha) AS ultima
    FROM base GROUP BY cliente
    HAVING COUNT(DISTINCT doc_id) >= 2 AND SUM(subtotal_neto) > 0
    ORDER BY SUM(subtotal_neto) DESC LIMIT p_limit
  ),
  ml AS (
    SELECT EXTRACT(YEAR FROM gs)::int AS mes_anio, EXTRACT(MONTH FROM gs)::int AS mes_idx
    FROM generate_series(date_trunc('month', p_fecha_inicio), date_trunc('month', p_fecha_fin), INTERVAL '1 month') AS gs
  ),
  mpc AS (
    SELECT b.cliente, b.f_anio AS mes_anio, b.f_mes AS mes_idx, SUM(b.subtotal_neto)::numeric AS ventas, COUNT(DISTINCT b.doc_id)::int AS tickets
    FROM base b JOIN cli ON cli.cliente = b.cliente GROUP BY b.cliente, b.f_anio, b.f_mes
  ),
  cm AS (
    SELECT c.cliente, jsonb_agg(
      jsonb_build_object('mes_anio', ml.mes_anio, 'mes_idx', ml.mes_idx, 'mes_label', v_ml[ml.mes_idx],
        'ventas', COALESCE(mpc.ventas, 0), 'tickets', COALESCE(mpc.tickets, 0)) ORDER BY ml.mes_anio, ml.mes_idx
    ) AS meses
    FROM cli c CROSS JOIN ml LEFT JOIN mpc ON mpc.cliente = c.cliente AND mpc.mes_anio = ml.mes_anio AND mpc.mes_idx = ml.mes_idx
    GROUP BY c.cliente
  )
  SELECT jsonb_agg(
    jsonb_build_object('nombre', c.cliente, 'total_ytd', c.total_ytd, 'tickets_ytd', c.tickets_ytd,
      'ticket_prom', CASE WHEN c.tickets_ytd > 0 THEN c.total_ytd / c.tickets_ytd ELSE 0 END,
      'ultima_compra', to_char(c.ultima, 'YYYY-MM-DD'), 'meses', cm.meses) ORDER BY c.total_ytd DESC
  ) INTO v_cli FROM cli c LEFT JOIN cm ON cm.cliente = c.cliente;

  SELECT jsonb_array_length(COALESCE(v_cli, '[]'::jsonb))::int,
    COALESCE((SELECT SUM((e->>'total_ytd')::numeric) FROM jsonb_array_elements(COALESCE(v_cli,'[]'::jsonb)) e), 0),
    COALESCE((SELECT SUM((e->>'tickets_ytd')::int) FROM jsonb_array_elements(COALESCE(v_cli,'[]'::jsonb)) e), 0)
  INTO v_total_cli, v_total_v, v_total_t;

  RETURN jsonb_build_object(
    'fecha_inicio', to_char(p_fecha_inicio,'YYYY-MM-DD'), 'fecha_fin', to_char(p_fecha_fin,'YYYY-MM-DD'),
    'limit', p_limit, 'total_clientes', v_total_cli, 'total_ventas', v_total_v, 'total_tickets', v_total_t,
    'clientes', COALESCE(v_cli, '[]'::jsonb)
  );
END;
$$;
GRANT EXECUTE ON FUNCTION ventas_clientes_v1(date, date, int) TO service_role;

NOTIFY pgrst, 'reload schema';
