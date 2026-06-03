-- ============================================================================
-- Alinear "empresa" a claves snake_case canónicas: 'confecciones_boston',
-- 'brand_it', 'ambas'. Aplicar A MANO en Supabase SQL Editor. NO ejecutado.
--
-- Brand It es mono-empresa en TODO menos en Leads, donde hay 2 negocios:
-- Confecciones Boston y Brand It. La clave NUNCA debe ser "Confecciones Boston"
-- (con espacios/mayúsculas) en user_roles.empresa ni en leads.empresa_vendedora.
-- ============================================================================

-- ── 1) DIAGNÓSTICO: ver qué valores hay HOY (correr ESTO primero, revisar salida)
SELECT empresa AS user_roles_empresa, COUNT(*) AS n
FROM user_roles GROUP BY empresa ORDER BY n DESC;

SELECT empresa_vendedora, COUNT(*) AS n
FROM leads GROUP BY empresa_vendedora ORDER BY n DESC;

-- ── 2) user_roles: los 5 usuarios → clave correcta -------------------------
-- Daniel, David, Roxana (admin/secretaria) ven las DOS empresas → 'ambas'.
UPDATE user_roles SET empresa = 'ambas'
 WHERE email IN ('daniel@confeccionesboston.local',
                 'david@confeccionesboston.local',
                 'roxana@confeccionesboston.local')
    OR nombre IN ('Daniel', 'David', 'Roxana');

-- Vendedoras → una sola empresa cada una.
UPDATE user_roles SET empresa = 'confecciones_boston'
 WHERE email = 'vendedora1@confeccionesboston.local' OR nombre = 'Vendedora1';

UPDATE user_roles SET empresa = 'brand_it'
 WHERE email = 'vendedora2@confeccionesboston.local' OR nombre = 'Vendedora2';

-- ── 3) leads.empresa_vendedora: normalizar variantes con espacios/mayúsculas
--      a snake_case (idempotente: las ya-correctas quedan igual).
UPDATE leads SET empresa_vendedora = 'confecciones_boston'
 WHERE empresa_vendedora IS NOT NULL
   AND lower(trim(empresa_vendedora)) IN ('confecciones boston', 'confecciones_boston');

UPDATE leads SET empresa_vendedora = 'brand_it'
 WHERE empresa_vendedora IS NOT NULL
   AND lower(trim(empresa_vendedora)) IN ('brand it', 'brand_it');

UPDATE leads SET empresa_vendedora = 'ambas'
 WHERE empresa_vendedora IS NOT NULL
   AND lower(trim(empresa_vendedora)) = 'ambas';

-- ── 4) VERIFICACIÓN: re-correr el diagnóstico — deberían quedar SOLO
--      'confecciones_boston' / 'brand_it' / 'ambas' (+ NULL en leads sin asignar).
-- SELECT empresa, COUNT(*) FROM user_roles GROUP BY empresa;
-- SELECT empresa_vendedora, COUNT(*) FROM leads GROUP BY empresa_vendedora;
--
-- ⚠️ Si el diagnóstico del paso 1 muestra OTRAS variantes en leads.empresa_vendedora
--    (ej. un typo), agregá su UPDATE correspondiente antes de dar por cerrado.
-- ============================================================================
