-- ═══════════════════════════════════════════════════════════════════════════════
-- BRAND IT — switch_ventas_netas_vw: incluir Notas de Crédito (ventas NETAS reales)
-- (2026-05-31)
--
-- Aplica en: Apps Familia (halqekrjfttpwoqtazjm) via Supabase SQL Editor.
--
-- Contexto: la versión anterior (migration 20260530000000) filtraba
--   tipo_comprobante IN ('Factura','Nota de Debito') y EXCLUÍA las NCs, lo que
--   SOBREESTIMABA las ventas (no restaba devoluciones).
--
-- Hallazgo con data real (mayo 2026): Switch entrega las Notas de Crédito con
--   subtotal_descuento NEGATIVO. Entonces el neto correcto = SUM(subtotal_descuento)
--   sobre TODOS los tipos (Factura + Nota de Debito + Nota de Credito), sin filtro.
--   Validado: Factura $73,608.22 + NC $-10,716.75 = $62,891.47 ≈ ~$62k Boston mayo.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW switch_ventas_netas_vw AS
SELECT
  EXTRACT(YEAR  FROM fecha)::int AS anio,
  EXTRACT(MONTH FROM fecha)::int AS mes,
  COUNT(*)                        AS num_comprobantes,
  SUM(subtotal_descuento)         AS ventas_netas,    -- neto: NCs ya vienen negativas
  SUM(subtotal)                   AS subtotal_bruto,
  SUM(itbms)                      AS itbms,
  SUM(total)                      AS total
FROM switch_facturas
GROUP BY 1, 2;

GRANT SELECT ON switch_ventas_netas_vw TO service_role;
