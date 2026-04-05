-- Migration: Add estado column to caja_gastos for vale/vuelto flow
-- Run this in Supabase SQL Editor (Apps Familia project)

ALTER TABLE caja_gastos ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'completado';

-- Set existing gastos to completado
UPDATE caja_gastos SET estado = 'completado' WHERE estado IS NULL;
