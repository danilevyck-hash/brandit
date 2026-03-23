-- =============================================
-- Brand It - Tablas para Costos de Producción
-- Ejecutar este SQL en Supabase SQL Editor
-- =============================================

-- Clientes
CREATE TABLE clients (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cotizaciones
CREATE TABLE quotations (
  id BIGSERIAL PRIMARY KEY,
  client_id BIGINT REFERENCES clients(id) ON DELETE SET NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'aprobado', 'entregado', 'cancelado')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Items de confección (líneas de la cotización)
CREATE TABLE quotation_items (
  id BIGSERIAL PRIMARY KEY,
  quotation_id BIGINT NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  size_color TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  fabric_qty NUMERIC(10,2) DEFAULT 0,
  fabric_price NUMERIC(10,2) DEFAULT 0,
  lining_qty NUMERIC(10,2) DEFAULT 0,
  lining_price NUMERIC(10,2) DEFAULT 0,
  thread_qty NUMERIC(10,2) DEFAULT 0,
  thread_price NUMERIC(10,2) DEFAULT 0,
  buttons_qty NUMERIC(10,2) DEFAULT 0,
  buttons_price NUMERIC(10,2) DEFAULT 0,
  packaging_qty NUMERIC(10,2) DEFAULT 0,
  packaging_price NUMERIC(10,2) DEFAULT 0,
  labor_cost NUMERIC(10,2) DEFAULT 0,
  seamstress TEXT,
  sale_price NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trabajos de impresión
CREATE TABLE print_jobs (
  id BIGSERIAL PRIMARY KEY,
  quotation_id BIGINT NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  ink_cost NUMERIC(10,2) DEFAULT 0,
  paper_cost NUMERIC(10,2) DEFAULT 0,
  yard_price NUMERIC(10,2) DEFAULT 0,
  yards_qty NUMERIC(10,2) DEFAULT 0,
  design_size TEXT,
  design_qty INTEGER DEFAULT 1,
  design_unit_price NUMERIC(10,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_quotations_client ON quotations(client_id);
CREATE INDEX idx_quotations_date ON quotations(date DESC);
CREATE INDEX idx_quotation_items_quotation ON quotation_items(quotation_id);
CREATE INDEX idx_print_jobs_quotation ON print_jobs(quotation_id);

-- RLS (Row Level Security) - desactivar para uso sin auth
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE print_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on clients" ON clients FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on quotations" ON quotations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on quotation_items" ON quotation_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on print_jobs" ON print_jobs FOR ALL USING (true) WITH CHECK (true);
