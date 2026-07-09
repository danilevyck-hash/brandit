-- ═══════════════════════════════════════════════════════════════════════════════
-- SEC-1 — Cerrar RLS abierta en clients / quotations / quotation_items / print_jobs
-- (2026-07-09)
--
-- Aplica en: Apps Familia (halqekrjfttpwoqtazjm) via Supabase Dashboard SQL Editor.
--
-- Problema: supabase-brandit.sql creó políticas "Allow all ... USING(true)" que,
-- combinadas con el anon key público del bundle, dejaban estas 4 tablas abiertas a
-- lectura/escritura/borrado desde internet sin login. El código ya NO usa el anon
-- key (todas las rutas API usan service_role + requireRoles), así que dropear estas
-- políticas cierra el hueco sin romper la app.
--
-- IMPORTANTE: correr esto SOLO después de desplegar el código de esta rama
-- (fix/audit-2026-07), que migró las 4 rutas a service_role. service_role hace
-- bypass de RLS, por lo que la app sigue funcionando; el acceso anónimo queda
-- bloqueado (RLS activa sin política permisiva = deny by default).
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1) Quitar las políticas permisivas abiertas.
DROP POLICY IF EXISTS "Allow all on clients"         ON clients;
DROP POLICY IF EXISTS "Allow all on quotations"      ON quotations;
DROP POLICY IF EXISTS "Allow all on quotation_items" ON quotation_items;
DROP POLICY IF EXISTS "Allow all on print_jobs"      ON print_jobs;

-- 2) Asegurar RLS activa + una única política service_role_all (idempotente).
--    Mismo patrón que el resto del schema (switch_* etc). anon/authenticated NO
--    tienen política => deny by default. service_role bypasea igual, pero dejamos
--    la política explícita por consistencia y claridad.
DO $$
DECLARE
  t text;
  tables text[] := ARRAY['clients', 'quotations', 'quotation_items', 'print_jobs'];
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
