CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario TEXT NOT NULL,
  accion TEXT NOT NULL,
  detalle TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON activity_log FOR ALL USING (true) WITH CHECK (true);
