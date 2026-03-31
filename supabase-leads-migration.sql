-- Lead comments table
CREATE TABLE IF NOT EXISTS lead_comentarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  comentario TEXT NOT NULL,
  autor TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE lead_comentarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON lead_comentarios FOR ALL USING (true) WITH CHECK (true);

-- New columns on leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS fecha_seguimiento DATE;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS asignado_a TEXT;
