-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: drop ventas_pipeline_boston
--
-- Post-Fase C: pipeline_boston consolidado en ventas_raw. Todos los tipos
-- (Cotizacion, Pedido, Factura, Nota credito/debito, Tiquete, Transaccion)
-- viven juntos en ventas_raw, distinguidos por la columna `tipo`. El upload
-- (/api/ventas/upload) y las queries del dashboard (queries.ts) ya apuntan
-- a ventas_raw.
--
-- Aplicar en Supabase Dashboard SQL Editor — proyecto Apps Familia
-- (halqekrjfttpwoqtazjm).
-- ─────────────────────────────────────────────────────────────────────────────

DROP TABLE IF EXISTS ventas_pipeline_boston CASCADE;
