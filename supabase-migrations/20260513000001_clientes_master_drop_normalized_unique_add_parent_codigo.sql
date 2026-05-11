-- Drop UNIQUE en nombre_normalized (Switch Soft tiene duplicados legítimos)
-- Defensive: handle both constraint case y plain unique index case
ALTER TABLE clientes_master DROP CONSTRAINT IF EXISTS idx_clientes_master_normalized;
DROP INDEX IF EXISTS idx_clientes_master_normalized;

-- Recrear como index regular (no unique) para queries rápidas por nombre
CREATE INDEX idx_clientes_master_normalized ON clientes_master(nombre_normalized);

-- Columna parent_codigo nullable para consolidación manual futura
ALTER TABLE clientes_master
  ADD COLUMN IF NOT EXISTS parent_codigo text DEFAULT NULL;

-- Index parcial para queries que agregan por COALESCE(parent_codigo, codigo)
CREATE INDEX IF NOT EXISTS idx_clientes_master_parent_codigo
  ON clientes_master(parent_codigo)
  WHERE parent_codigo IS NOT NULL;

COMMENT ON COLUMN clientes_master.parent_codigo IS
  'Optional pointer to canonical codigo when this client is a duplicate of another. NULL = independent entity. Used in reports via GROUP BY COALESCE(parent_codigo, codigo).';
