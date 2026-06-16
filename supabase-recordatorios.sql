-- ============================================================================
-- Recordatorios de Pago — tabla nueva. Aplicar A MANO en el SQL Editor de
-- Supabase (proyecto Apps Familia). NO se ejecuta automáticamente.
--
-- Promesas de pago de clientes en TEXTO LIBRE (sin FK a CxC ni a facturas).
-- "El cliente dijo que paga tal fecha" + seguimiento.
--
-- Patrón Caja Menuda:
--   · Soft-hide: en vez de borrar, se marca `cumplido = true` (análogo a
--     `deleted`). Marcar cumplido oculta el registro de la lista de pendientes.
--   · Auditoría = TEXT con el NOMBRE del usuario de sesión (created_by,
--     cumplido_by). Sin FK a user_roles → borrar un usuario nunca rompe la
--     historia.
--   · RLS CERRADO (enable sin policies): la API usa SUPABASE_SERVICE_ROLE_KEY y
--     bypassa RLS. La seguridad real está en requireRoles() de la capa API.
-- ============================================================================

CREATE TABLE IF NOT EXISTS recordatorios_pago (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente         text NOT NULL,                  -- requerido
  monto           numeric,                        -- opcional
  fecha_prometida date NOT NULL,                  -- requerido
  nota            text,                           -- opcional
  cumplido        boolean NOT NULL DEFAULT false, -- soft-hide (análogo a deleted)
  cumplido_at     timestamptz,
  cumplido_by     text,                           -- nombre del usuario de sesión
  created_by      text,                           -- nombre del usuario de sesión
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- RLS cerrado: enable sin policies. La seguridad real está en requireRoles().
ALTER TABLE recordatorios_pago ENABLE ROW LEVEL SECURITY;

-- Índices --------------------------------------------------------------------
-- Lista de pendientes ordenada por fecha prometida (la query más común).
CREATE INDEX IF NOT EXISTS recordatorios_pago_pendientes_idx
  ON recordatorios_pago (fecha_prometida) WHERE cumplido = false;
-- Auditoría por usuario.
CREATE INDEX IF NOT EXISTS recordatorios_pago_created_by_idx
  ON recordatorios_pago (created_by);
-- ============================================================================
