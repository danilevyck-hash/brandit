-- ═══════════════════════════════════════════════════════════════════════════════
-- BRAND IT — SCHEMA COMISIONES (Confecciones Boston, single-empresa)
-- Migration (2026-07-08)
--
-- Aplica en: Apps Familia (halqekrjfttpwoqtazjm) via Supabase Dashboard SQL Editor.
--
-- Contexto: módulo de Comisiones basado en COBROS (recibos de pago), no en
-- facturas emitidas. Fuente de los cobros: /apireporte/recibos del API de Switch
-- (mismo token que facturas). Verificado en vivo 2026-07-08 contra Boston: cada
-- recibo trae vendedor + vendedorId + codigoVendedor limpios (533/623 = DAVID
-- LEVY), cliente (id/codigo/nombre), sucursal y total. NO trae id/secuencial de
-- recibo → el sync hace delete+insert por (mes) en cada corrida.
--
-- Diseño RLS: mismo patrón que switch_api_schema — policy service_role_all
-- (Brand It usa supabase-server con service_role key, bypass RLS). Cero acceso
-- público.
-- ═══════════════════════════════════════════════════════════════════════════════


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 1 — switch_recibos (cache de cobros del API /apireporte/recibos)           ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
-- Sin UNIQUE: Switch no da id/secuencial de recibo. El sync reemplaza limpio por
-- mes (delete WHERE fecha en [inicio, finExcl) + insert). raw_data guarda el
-- payload completo para debug / reproceso sin re-pegarle al API.
CREATE TABLE IF NOT EXISTS switch_recibos (
  id                 BIGSERIAL PRIMARY KEY,
  fecha              DATE NOT NULL,                 -- de fechaCreacion (dia)
  fecha_creacion     TIMESTAMPTZ,                   -- crudo con hora (orden/desempate)
  cliente_switch_id  INTEGER,                       -- clienteId (join a maestro)
  cliente_codigo     TEXT,                          -- clienteCodigo (join al panel CXC)
  cliente_nombre     TEXT,
  vendedor_id        INTEGER,                       -- vendedorId
  vendedor_nombre    TEXT,                          -- vendedor
  vendedor_codigo    TEXT,                          -- codigoVendedor
  sucursal_id        INTEGER,                       -- sucursalId
  sucursal_codigo    TEXT,                          -- codigoSucursal
  total              NUMERIC(14,2) NOT NULL DEFAULT 0,
  es_retencion       BOOLEAN NOT NULL DEFAULT false,  -- retencion ITBMS (calculada en el sync)
  synced_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  raw_data           JSONB                          -- payload completo del recibo
);

CREATE INDEX IF NOT EXISTS idx_switch_recibos_fecha          ON switch_recibos (fecha);
CREATE INDEX IF NOT EXISTS idx_switch_recibos_cliente_codigo ON switch_recibos (cliente_codigo);
CREATE INDEX IF NOT EXISTS idx_switch_recibos_vendedor_id    ON switch_recibos (vendedor_id);
CREATE INDEX IF NOT EXISTS idx_switch_recibos_es_retencion   ON switch_recibos (es_retencion);


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 2 — comisiones_snapshot (comision generada de un mes, congelada)           ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
-- Una fila por (anio, mes): el cierre de comision de ese periodo. Guarda los
-- parametros con que se genero (vendedores incluidos, clientes excluidos) y los
-- totales, para que el reporte sea reproducible aunque cambien los recibos o la
-- seleccion despues.
CREATE TABLE IF NOT EXISTS comisiones_snapshot (
  id                    BIGSERIAL PRIMARY KEY,
  anio                  INTEGER NOT NULL,
  mes                   INTEGER NOT NULL,
  vendedor              TEXT NOT NULL DEFAULT 'JULICAR',
  vendedores_incluidos  JSONB NOT NULL,                     -- ids/nombres seleccionados
  clientes_excluidos    JSONB NOT NULL DEFAULT '[]'::jsonb, -- codigos excluidos (default = todos incluidos)
  total_cobrado         NUMERIC(14,2) NOT NULL,
  total_comision        NUMERIC(14,2) NOT NULL,
  generado_por          TEXT,
  generado_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (anio, mes)
);


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 3 — comisiones_snapshot_recibos (detalle congelado del snapshot)           ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
-- Los recibos que entraron en el snapshot, con la tasa y comision aplicadas al
-- momento del cierre. ON DELETE CASCADE: borrar el snapshot borra su detalle.
CREATE TABLE IF NOT EXISTS comisiones_snapshot_recibos (
  id               BIGSERIAL PRIMARY KEY,
  snapshot_id      BIGINT NOT NULL REFERENCES comisiones_snapshot(id) ON DELETE CASCADE,
  fecha            DATE,
  cliente_codigo   TEXT,
  cliente_nombre   TEXT,
  vendedor_nombre  TEXT,
  total            NUMERIC(14,2) NOT NULL,
  tasa             NUMERIC(6,4) NOT NULL,
  comision         NUMERIC(14,2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_comisiones_snapshot_recibos_snapshot ON comisiones_snapshot_recibos (snapshot_id);


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 4 — RLS + Policies (service_role_all en todas)                             ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'switch_recibos',
    'comisiones_snapshot',
    'comisiones_snapshot_recibos'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS service_role_all ON %I', t);
    EXECUTE format(
      'CREATE POLICY service_role_all ON %I FOR ALL USING (auth.role() = ''service_role'')',
      t
    );
  END LOOP;
END$$;
