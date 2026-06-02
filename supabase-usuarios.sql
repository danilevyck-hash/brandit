-- ============================================================================
-- Usuarios por persona + roles unificados (admin / secretaria / vendedora).
-- Aplicar A MANO en el SQL Editor de Supabase (proyecto Apps Familia). NO ejecutado.
--
-- Deja EXACTAMENTE estos 5 usuarios activos en user_roles y desactiva el resto.
-- El login identifica por PASSWORD (texto plano), así que las 5 son únicas.
-- Idempotente: re-correr el bloque deja el mismo estado final.
--
-- ⚠️ PENDIENTE (sprint de seguridad futuro): las passwords están en TEXTO PLANO.
--    Hay que hashearlas (bcrypt) y cambiar el login a comparar hash.
-- ============================================================================

-- (A) Borrar usuarios con el rol obsoleto vendedora1/vendedora2 (ya no existe ese rol).
--     Los nuevos Vendedora1/Vendedora2 usan role = 'vendedora', así que NO se borran acá.
DELETE FROM user_roles WHERE role IN ('vendedora1', 'vendedora2');

-- (B) Desactivar TODO lo existente. Abajo reactivamos sólo los 5 de la lista.
UPDATE user_roles SET activo = false;

-- (C) Upsert idempotente de los 5 (borrar por email/password y re-insertar activos).
DELETE FROM user_roles
 WHERE email IN (
        'daniel@confeccionesboston.local',
        'david@confeccionesboston.local',
        'roxana@confeccionesboston.local',
        'vendedora1@confeccionesboston.local',
        'vendedora2@confeccionesboston.local'
       )
    OR password IN ('daniel', 'david', 'roxana', 'vendedora1', 'vendedora2');

INSERT INTO user_roles (email, role, nombre, password, empresa, activo) VALUES
  ('daniel@confeccionesboston.local',     'admin',      'Daniel',     'daniel',     'Confecciones Boston', true),
  ('david@confeccionesboston.local',      'admin',      'David',      'david',      'Confecciones Boston', true),
  ('roxana@confeccionesboston.local',     'secretaria', 'Roxana',     'roxana',     'Confecciones Boston', true),
  ('vendedora1@confeccionesboston.local', 'vendedora',  'Vendedora1', 'vendedora1', 'Confecciones Boston', true),
  ('vendedora2@confeccionesboston.local', 'vendedora',  'Vendedora2', 'vendedora2', 'Confecciones Boston', true);

-- Verificación (debería devolver 5 filas activas):
-- SELECT nombre, role, password, empresa, activo FROM user_roles WHERE activo = true ORDER BY role, nombre;

-- NOTA: si user_roles tiene un CHECK constraint sobre `role` que sólo permite los
-- valores viejos (incluido vendedora1/vendedora2), actualizalo a ('admin','secretaria','vendedora')
-- antes de correr este bloque, o el INSERT de los 'vendedora' fallará.
-- ============================================================================
