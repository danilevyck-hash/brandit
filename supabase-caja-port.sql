-- ============================================================================
-- Caja Menuda — Port fashiongr → Brand It.  EMPEZAR LIMPIO (sin datos viejos).
-- Aplicar A MANO en el SQL Editor de Supabase (proyecto Apps Familia).
-- NO ejecutado automáticamente.
--
-- Las 4 tablas (caja_periodos, caja_gastos, caja_responsables, caja_categorias)
-- YA EXISTEN con datos/estructura viejos. Este script: (1) las vacía,
-- (2) alinea su estructura a la de fashiongr, (3) crea índices.
--
-- ADAPTACIONES Brand It:
--   · Mono-empresa  → se ELIMINA la columna `empresa` de caja_gastos.
--   · created_by / deleted_by = TEXT (sin FK a usuarios) — guardan el NOMBRE del
--     usuario de la sesión (igual patrón que notas_entrega). No dependen de
--     user_roles, así borrar un usuario nunca rompe la historia financiera.
--   · responsable_id = FK a caja_responsables (tabla propia del módulo).
--   · RLS queda CERRADO (sin policies "open"): la API usa service-role y bypassa
--     RLS. La seguridad real está en requireRoles() de la capa API.
--   · Responsables: SIN seed (Daniel los carga después).
-- ============================================================================

-- 0) VACIAR las 4 tablas (CASCADE resuelve las FKs entre gastos/periodos) ------
TRUNCATE TABLE caja_gastos, caja_periodos, caja_responsables, caja_categorias
  RESTART IDENTITY CASCADE;

-- 1) caja_periodos -----------------------------------------------------------
ALTER TABLE caja_periodos ADD COLUMN IF NOT EXISTS repuesto    boolean DEFAULT false;
ALTER TABLE caja_periodos ADD COLUMN IF NOT EXISTS repuesto_at timestamptz;
ALTER TABLE caja_periodos ADD COLUMN IF NOT EXISTS deleted     boolean DEFAULT false;
ALTER TABLE caja_periodos ADD COLUMN IF NOT EXISTS created_by  text;   -- nombre del usuario
ALTER TABLE caja_periodos ADD COLUMN IF NOT EXISTS created_at  timestamptz DEFAULT now();
ALTER TABLE caja_periodos ALTER COLUMN fondo_inicial SET DEFAULT 200;
ALTER TABLE caja_periodos ALTER COLUMN estado        SET DEFAULT 'abierto';  -- 'abierto' | 'cerrado'

-- 2) caja_responsables (catálogo de personas) --------------------------------
ALTER TABLE caja_responsables ADD COLUMN IF NOT EXISTS activo     boolean DEFAULT true;
ALTER TABLE caja_responsables ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- Seed: Roxana (los demás responsables se agregan desde la app con "+ responsable").
INSERT INTO caja_responsables (nombre)
SELECT 'Roxana'
WHERE NOT EXISTS (
  SELECT 1 FROM caja_responsables WHERE lower(trim(nombre)) = 'roxana'
);

-- 3) caja_categorias (catálogo de categorías de gasto) -----------------------
ALTER TABLE caja_categorias ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
CREATE UNIQUE INDEX IF NOT EXISTS caja_categorias_nombre_key ON caja_categorias (nombre);

-- Seed de categorías genéricas (editable; NO es data de negocio sensible).
-- Si las querés vacías, borrá este INSERT.
INSERT INTO caja_categorias (nombre) VALUES
  ('Materiales'), ('Transporte'), ('Alimentación'),
  ('Papelería'), ('Mantenimiento'), ('Otros')
ON CONFLICT (nombre) DO NOTHING;

-- 4) caja_gastos -------------------------------------------------------------
ALTER TABLE caja_gastos ADD COLUMN IF NOT EXISTS descripcion    text;
ALTER TABLE caja_gastos ADD COLUMN IF NOT EXISTS proveedor      text;
ALTER TABLE caja_gastos ADD COLUMN IF NOT EXISTS nro_factura    text;
ALTER TABLE caja_gastos ADD COLUMN IF NOT EXISTS responsable    text DEFAULT '';
ALTER TABLE caja_gastos ADD COLUMN IF NOT EXISTS responsable_id uuid
      REFERENCES caja_responsables(id) ON DELETE SET NULL;
ALTER TABLE caja_gastos ADD COLUMN IF NOT EXISTS categoria      text DEFAULT 'Varios';
ALTER TABLE caja_gastos ADD COLUMN IF NOT EXISTS deleted        boolean DEFAULT false;
ALTER TABLE caja_gastos ADD COLUMN IF NOT EXISTS deleted_by     text;        -- nombre del usuario
ALTER TABLE caja_gastos ADD COLUMN IF NOT EXISTS deleted_at     timestamptz;
ALTER TABLE caja_gastos ADD COLUMN IF NOT EXISTS created_by     text;        -- nombre del usuario
ALTER TABLE caja_gastos ADD COLUMN IF NOT EXISTS nombre         text;        -- legacy: espejo de descripcion

-- Mono-empresa: quitar columna empresa (requerido).
ALTER TABLE caja_gastos DROP COLUMN IF EXISTS empresa;

-- (Opcional) leftover del flujo vale/vuelto del Brand It viejo — ya no se usa.
-- Descomentá si querés limpiar del todo:
-- ALTER TABLE caja_gastos DROP COLUMN IF EXISTS estado;

-- 5) Índices -----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS caja_periodos_created_by_idx   ON caja_periodos(created_by);
CREATE INDEX IF NOT EXISTS caja_gastos_created_by_idx     ON caja_gastos(created_by);
CREATE INDEX IF NOT EXISTS caja_gastos_responsable_id_idx ON caja_gastos(responsable_id);
CREATE INDEX IF NOT EXISTS caja_gastos_deleted_at_idx     ON caja_gastos(deleted_at) WHERE deleted = true;

-- RLS: se deja como está (cerrado). La API usa SUPABASE_SERVICE_ROLE_KEY y bypassa RLS.
-- ============================================================================
