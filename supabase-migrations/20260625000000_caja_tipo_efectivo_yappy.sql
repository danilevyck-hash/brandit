-- BRAND IT — Caja Menuda: separa caja efectivo vs Yappy
-- 2026-06-25 — Aplicar manual en Supabase SQL Editor
--
-- Agrega columna tipo a caja_periodos y caja_gastos para distinguir
-- efectivo de Yappy. Aditivo: filas existentes quedan en 'efectivo'.

-- Agrega columna tipo para separar caja efectivo vs Yappy
ALTER TABLE caja_periodos ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'efectivo';
ALTER TABLE caja_gastos ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'efectivo';

-- Restringe valores permitidos
ALTER TABLE caja_periodos DROP CONSTRAINT IF EXISTS caja_periodos_tipo_check;
ALTER TABLE caja_periodos ADD CONSTRAINT caja_periodos_tipo_check CHECK (tipo IN ('efectivo','yappy'));
ALTER TABLE caja_gastos DROP CONSTRAINT IF EXISTS caja_gastos_tipo_check;
ALTER TABLE caja_gastos ADD CONSTRAINT caja_gastos_tipo_check CHECK (tipo IN ('efectivo','yappy'));
