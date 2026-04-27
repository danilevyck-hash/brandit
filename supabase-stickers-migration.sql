-- Stickers de Bodega
CREATE TABLE IF NOT EXISTS stickers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  descripcion TEXT NOT NULL,
  talla TEXT NOT NULL,
  color_nombre TEXT NOT NULL,
  color_hex TEXT NOT NULL,
  seccion TEXT NOT NULL,
  estante TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE stickers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all" ON stickers FOR ALL USING (true) WITH CHECK (true);
