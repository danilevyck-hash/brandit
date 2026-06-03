-- ============================================================================
-- switch_sync_cursor — progreso reanudable del sync de estado de cuenta (CxC).
-- Aplicar A MANO en Supabase SQL Editor (proyecto Apps Familia). NO ejecutado.
--
-- Por qué: el estado de cuenta de Switch es per-cliente (~361 clientes) y debe
-- correrse SECUENCIAL (sesión única de Switch). Para no morir por timeout, el
-- sync procesa por tiempo y guarda acá dónde quedó; el cron encadena hasta
-- completar la "vuelta". Idempotente.
--
-- Modelo: 1 fila por sync_type (singleton). Si NO hay fila → no hay vuelta en
-- curso (la próxima corrida lista clientes y arranca una vuelta nueva). Al
-- completar la vuelta, la fila se BORRA.
-- ============================================================================

CREATE TABLE IF NOT EXISTS switch_sync_cursor (
  sync_type        text PRIMARY KEY,                 -- 'estadocuenta' (singleton por tipo)
  run_stamp        timestamptz NOT NULL,             -- runStamp de la vuelta (lo usa el reconcile e idempotencia)
  clientes         jsonb NOT NULL DEFAULT '[]'::jsonb, -- lista completa de la vuelta: [{ "id": <num>, "nombre": <text|null> }]
  offset_idx       integer NOT NULL DEFAULT 0,        -- próximo índice a procesar dentro de `clientes`
  queried_codigos  jsonb NOT NULL DEFAULT '[]'::jsonb, -- acumulado de cliente_codigo consultados OK (para el reconcile final)
  total            integer NOT NULL DEFAULT 0,        -- length(clientes) — informativo
  updated_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE switch_sync_cursor IS
  'Cursor de progreso del sync de estado de cuenta (CxC) de Switch. Permite reanudar la vuelta entre corridas del cron sin re-listar ni timeoutear. 1 fila por sync_type; se borra al completar la vuelta.';

-- RLS cerrado: la API/cron usan service-role y bypassan RLS (igual que el resto).
ALTER TABLE switch_sync_cursor ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';

-- ── (Opcional) reset manual si querés forzar una vuelta nueva desde cero:
-- DELETE FROM switch_sync_cursor WHERE sync_type = 'estadocuenta';
-- ============================================================================
