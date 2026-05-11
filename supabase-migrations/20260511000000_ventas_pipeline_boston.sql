-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: ventas_pipeline_boston
--
-- Tabla propia de Brand It para capturar Cotizaciones y Pedidos de Boston
-- que el parser de fashiongr descarta del archivo Switch listacomprobantes.
-- Las facturas siguen viviendo en ventas_raw (cargadas vía fashiongr).
--
-- Brand It tiene su propio parser de listacomprobantes_boston.csv que
-- ingiere solo TIPO IN ('COTIZACION', 'PEDIDO') a esta tabla. Forma parte
-- del funnel B2B de Boston (cotizaciones → pedidos → facturas).
--
-- Aplicar en Supabase Dashboard SQL Editor (project rspocgqhtpveytgbtler).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ventas_pipeline_boston (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa text NOT NULL DEFAULT 'confecciones_boston'
    CHECK (empresa = 'confecciones_boston'),
  tipo text NOT NULL CHECK (tipo IN ('Cotizacion', 'Pedido')),
  fecha date NOT NULL,
  anio int NOT NULL,
  mes int NOT NULL CHECK (mes BETWEEN 1 AND 12),
  quarter int NOT NULL CHECK (quarter BETWEEN 1 AND 4),
  n_sistema text,
  n_fiscal text,
  vendedor text,
  cliente text,
  cliente_id uuid,
  cliente_codigo text,
  subtotal numeric DEFAULT 0,
  total numeric DEFAULT 0,
  uploaded_at timestamptz DEFAULT now(),
  uploaded_by uuid
);

CREATE INDEX IF NOT EXISTS idx_vpb_empresa_anio_mes
  ON ventas_pipeline_boston(empresa, anio, mes);
CREATE INDEX IF NOT EXISTS idx_vpb_cliente_codigo
  ON ventas_pipeline_boston(cliente_codigo);
CREATE INDEX IF NOT EXISTS idx_vpb_vendedor
  ON ventas_pipeline_boston(vendedor);

ALTER TABLE ventas_pipeline_boston ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_role_all ON ventas_pipeline_boston;
CREATE POLICY service_role_all ON ventas_pipeline_boston
  FOR ALL USING (auth.role() = 'service_role');
