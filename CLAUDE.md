# Brandit — Website Interno de Confecciones Boston

Sistema interno de cotizaciones de producción para el negocio de confección de mi hermano. Gestión de costos de materiales, mano de obra, impresión y márgenes.

## Stack
- **Framework:** Next.js 14 (App Router)
- **Database:** Supabase (PostgreSQL)
- **Hosting:** Vercel
- **Styling:** Tailwind CSS
- **PDF:** jsPDF + jspdf-autotable (cotizaciones)

## Módulos
| Módulo | Ruta | Descripción |
|--------|------|-------------|
| Cotizaciones | `/cotizaciones` | Lista con búsqueda, filtro por estado, debounce |
| Nueva Cotización | `/cotizacion/nueva` | Cliente + items confección + impresión + totales |
| Detalle | `/cotizacion/[id]` | Vista, cambio estado, PDF, eliminar con modal |
| Dashboard | `/` | KPIs, gráficos, módulos drag-and-drop, seguimiento |
| CXC | `/cxc` | Cuentas por cobrar, clientes, leads |

## Auth
- Login con password contra tabla `user_roles` en Supabase
- Cookie httpOnly `brandit_session` con token SHA-256 firmado con AUTH_SECRET
- Middleware protege todas las rutas (páginas y APIs)
- Logout via DELETE /api/auth
- Env var: `AUTH_SECRET`

## Base de datos
- Schema en `supabase-brandit.sql`
- RLS cerrado: solo `service_role` puede acceder
- Tablas: clients, quotations, quotation_items, print_jobs, user_roles
- Server client: `src/lib/supabase-server.ts` (usa SUPABASE_SERVICE_ROLE_KEY)

## Design System
- Colores: navy (#0F172A), brandit-orange (#F97316), cream
- Dark mode soportado (toggle en navbar)
- Fuente: Inter
- Botones: rounded-xl, min-h-[44px] touch targets
- Cards responsive: tabla en desktop, cards en mobile
- Toasts para feedback (éxito/error)
- Loading spinners animados

## Deploy
```bash
git push origin main   # Auto-deploy via Vercel
```

## Env vars en Vercel
- `AUTH_SECRET` — firma los tokens de sesión
- `SUPABASE_SERVICE_ROLE_KEY` — service role key
- `NEXT_PUBLIC_SUPABASE_URL` — URL del proyecto
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — anon key


## Regla de Calidad
- Todo código debe funcionar a la primera. No pushear sin verificar el flujo completo end-to-end.
- Verificar: datos fluyen escritura → DB → lectura → UI
- Auth en serverless: usar tokens HMAC firmados, NO Maps en memoria
- No hacer fire-and-forget (.then().catch()) para operaciones críticas — siempre await
- useState en useEffect como dependencia puede causar re-renders destructivos — usar useRef para estado interno
- Verificar compatibilidad de formatos antes de integrar (PNG/JPEG en jsPDF, DER/P1363 en WebAuthn)
- Si no puedo probar en browser, simular el flujo con script
