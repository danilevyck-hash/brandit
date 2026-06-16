-- ============================================================================
-- Pedidos en Producción — dos tablas nuevas. Aplicar A MANO en el SQL Editor de
-- Supabase. NO se ejecuta automáticamente.
--
-- Organizador de pedidos del taller (cliente, tipo de personalización,
-- trabajador asignado, estado, fecha de entrega, orden manual de la cola).
--
-- Patrón Brand It:
--   · Borrado FÍSICO (DELETE real), abierto a todos los roles.
--   · Auditoría = TEXT con el NOMBRE del usuario de sesión (created_by). Sin FK.
--   · RLS CERRADO (enable sin policies): la API usa SERVICE_ROLE_KEY y bypassa
--     RLS. La seguridad real está en requireRoles() de la capa API.
-- ============================================================================

CREATE TABLE IF NOT EXISTS pedidos_produccion (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente        text NOT NULL,                          -- requerido
  tipo           text NOT NULL,                          -- DTF | UV DTF | Sublimación | Bordado | Grabado láser | Gran formato | Confección
  trabajador     text,                                   -- opcional, nombre libre (no FK)
  estado         text NOT NULL DEFAULT 'Pendiente',      -- Pendiente | En proceso | Listo
  fecha_entrega  date,                                   -- opcional
  notas          text,                                   -- opcional
  orden          integer NOT NULL DEFAULT 0,             -- reordenamiento manual de la cola
  created_by     text,                                   -- nombre del usuario de sesión
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pedidos_produccion_estado_chk
    CHECK (estado IN ('Pendiente','En proceso','Listo')),
  CONSTRAINT pedidos_produccion_tipo_chk
    CHECK (tipo IN ('DTF','UV DTF','Sublimación','Bordado','Grabado láser','Gran formato','Confección'))
);

-- RLS cerrado: enable sin policies. La seguridad real está en requireRoles().
ALTER TABLE pedidos_produccion ENABLE ROW LEVEL SECURITY;

-- Índices --------------------------------------------------------------------
-- Cola ordenada manualmente (la query más común: lista general).
CREATE INDEX IF NOT EXISTS pedidos_produccion_orden_idx
  ON pedidos_produccion (orden);
-- Agrupar / filtrar por estado.
CREATE INDEX IF NOT EXISTS pedidos_produccion_estado_idx
  ON pedidos_produccion (estado);

-- Catálogo de trabajadores del taller ----------------------------------------
-- Alimenta el selector del form y la vista "por trabajador". Nombre único.
CREATE TABLE IF NOT EXISTS pedidos_equipo (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      text NOT NULL UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- RLS cerrado: enable sin policies.
ALTER TABLE pedidos_equipo ENABLE ROW LEVEL SECURITY;
-- ============================================================================
