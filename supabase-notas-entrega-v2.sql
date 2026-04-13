-- Migration: Nota de entrega v2 — tipo, contacto, numero_contacto
-- Run this in Supabase SQL Editor (Apps Familia project)

ALTER TABLE notas_entrega ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'pedido';
ALTER TABLE notas_entrega ADD COLUMN IF NOT EXISTS contacto TEXT;
ALTER TABLE notas_entrega ADD COLUMN IF NOT EXISTS numero_contacto TEXT;
