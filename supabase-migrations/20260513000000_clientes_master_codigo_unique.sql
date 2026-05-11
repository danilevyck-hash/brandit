-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: clientes_master_codigo_unique
--
-- Habilita UPSERT por `codigo` en clientes_master para soportar Fase D
-- (auto-populate desde uploads de CxC y Ventas).
--
-- Partial unique index — solo aplica a rows activas (deleted = false) con
-- codigo no nulo. Esto permite reutilizar codigos de clientes eliminados
-- (soft delete) sin colisión.
--
-- Aplicar en Supabase Dashboard SQL Editor — proyecto Apps Familia
-- (halqekrjfttpwoqtazjm).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS clientes_master_codigo_unique
  ON clientes_master(codigo)
  WHERE deleted = false AND codigo IS NOT NULL;
