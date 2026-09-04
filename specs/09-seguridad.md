# 09 — Endurecimiento de seguridad

**Estado:** Implementado
**Dependencias:** [08-autenticacion](08-autenticacion.md) (políticas RLS de `scores` con `user_id`; Supabase Auth activo)
**Fecha:** 2026-06-25

**Objetivo:** Aplicar el checklist de seguridad de `references/security/security-checklist.md`:
corregir las políticas RLS permisivas en `scores`, habilitar RLS en `games`, revocar la
función `rls_auto_enable()` expuesta, activar las restricciones de contraseña de Supabase
Auth (longitud mínima, leaked-password protection, max signup rate) y añadir security
headers HTTP en Next.js.

## Alcance

**Incluye:**

- Verificar si RLS está habilitado en `games`; si no lo está, habilitarlo y añadir política
  SELECT pública (`USING (true)`).
- Reemplazar la política `scores_insert_authenticated` (`WITH CHECK (true)`) por
  `WITH CHECK (auth.uid() = user_id OR user_id IS NULL)`.
- Reemplazar la política `scores_insert_public` (`WITH CHECK (true)`) por
  `WITH CHECK (user_id IS NULL)`.
- Revocar `EXECUTE` de `rls_auto_enable()` a los roles `anon` y `authenticated`
  (la función se mantiene, solo deja de ser invocable vía API pública).
- Activar en Supabase Auth: longitud mínima de contraseña ≥ 8 caracteres, leaked-password
  protection (HaveIBeenPwned) y max signup rate por IP — vía Supabase Management API.
- Añadir security headers HTTP en `next.config.ts`:
  `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy: strict-origin-when-cross-origin`.

**No incluye:**

- Políticas RLS de UPDATE o DELETE en `scores` o `games` (no hay flujos de escritura
  para esas operaciones en la app).
- Content-Security-Policy (CSP) — requiere auditoría de todos los orígenes externos
  usados y scope propio.
- Auditoría o cambios a otros ajustes de Supabase Auth (MFA, OTP, etc.).
- Cambios a la lógica de autenticación implementada en spec 10.

## Modelo de datos

No se introducen tablas ni tipos nuevos. Se documentan aquí los cambios SQL y de
configuración que aplica el spec.

**Migración SQL** (vía `apply_migration`):

```sql
-- 1. RLS en games (habilitar + política SELECT pública si no existe)
alter table public.games enable row level security;

create policy "games_select_public"
  on public.games for select
  using (true);

-- 2. Corregir política INSERT de scores para authenticated
drop policy if exists "scores_insert_authenticated" on public.scores;

create policy "scores_insert_authenticated"
  on public.scores for insert
  to authenticated
  with check (auth.uid() = user_id or user_id is null);

-- 3. Corregir política INSERT de scores para anon
drop policy if exists "scores_insert_public" on public.scores;

create policy "scores_insert_public"
  on public.scores for insert
  to anon, authenticated
  with check (user_id is null);

-- 4. Revocar EXECUTE de rls_auto_enable() a roles públicos
revoke execute on function public.rls_auto_enable() from anon, authenticated;
```

**Supabase Auth settings** (Supabase Management API — no son SQL):

- `password_min_length`: 8
- `password_hibp_enabled`: true (leaked-password protection vía HaveIBeenPwned)
- `rate_limit_email_sent`: valor recomendado por Supabase para limitar signups por IP
  (confirmar el campo exacto al implementar consultando la API).

**Next.js** (`next.config.ts`):

- Bloque `headers()` añadido con `source: '/(.*)'` y los tres headers:
  `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`.
  Sin cambios a rutas, componentes ni lógica de la app.

## Plan de implementación

1. **Verificar estado actual de RLS en `games`** con `list_tables` o `get_advisors`.
   Si ya está habilitado con política SELECT pública, omitir esa parte de la migración.

2. **Aplicar migración SQL** vía `apply_migration` con los cuatro bloques del modelo
   de datos: RLS en `games`, corrección de `scores_insert_authenticated`,
   corrección de `scores_insert_public`, y revocación de `rls_auto_enable()`.

3. **Verificar con `get_advisors`** que los warnings `rls_policy_always_true` y
   `anon_security_definer_function_executable` / `authenticated_security_definer_function_executable`
   han desaparecido del reporte.

4. **Configurar Supabase Auth** vía Management API (PATCH al endpoint de config/auth
   del proyecto): `password_min_length: 8`, `password_hibp_enabled: true`,
   y el campo de rate-limit de signup por IP (confirmar nombre exacto en la API
   antes de aplicar).

5. **Añadir security headers en `next.config.ts`**: bloque `headers()` con
   `source: '/(.*)'` y los tres headers del checklist. Sin tocar ninguna otra
   configuración del archivo.

6. **Verificación final**: `npm run lint` y `npm run build` sin errores; comprobar
   en DevTools (Network → response headers) que los tres headers aparecen en
   cualquier ruta de la app.

## Criterios de aceptación

- [ ] `get_advisors` no reporta `rls_policy_always_true` para ninguna política de `scores`.
- [ ] `get_advisors` no reporta `anon_security_definer_function_executable` ni
      `authenticated_security_definer_function_executable` para `rls_auto_enable()`.
- [ ] Un usuario autenticado no puede insertar una fila en `scores` con un `user_id`
      distinto al suyo (`auth.uid()`).
- [ ] Un usuario anónimo no puede insertar una fila en `scores` con un `user_id` no nulo.
- [ ] El flujo de guardar puntuación como invitado (spec 10) sigue funcionando
      (`user_id` nulo, sin sesión).
- [ ] El flujo de guardar puntuación logueado (spec 10) sigue funcionando
      (`user_id = auth.uid()`).
- [ ] RLS está habilitado en `games` y la tabla sigue siendo legible públicamente
      (la home, `/biblioteca` y `/juego/[id]` cargan sin errores).
- [ ] Supabase Auth rechaza contraseñas de menos de 8 caracteres en el registro.
- [ ] Supabase Auth rechaza contraseñas comprometidas conocidas (HaveIBeenPwned).
- [ ] Los headers `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` y
      `Referrer-Policy: strict-origin-when-cross-origin` aparecen en las respuestas
      HTTP de cualquier ruta de la app.
- [ ] `npm run lint` y `npm run build` finalizan sin errores.

## Decisiones tomadas y descartadas

- **Sí:** revocar `EXECUTE` de `rls_auto_enable()` en vez de eliminarla — la función
  puede seguir siendo útil desde el dashboard/CLI de Supabase; lo que se cierra es
  su invocación pública vía `/rest/v1/rpc/`.
- **Sí:** `scores_insert_authenticated` con `WITH CHECK (auth.uid() = user_id OR user_id IS NULL)`
  — permite que un usuario logueado guarde tanto con su ID como sin él (flujo invitado
  desde una sesión autenticada), sin permitir suplantar el ID de otro usuario.
- **Sí:** `scores_insert_public` con `WITH CHECK (user_id IS NULL)` — los anónimos solo
  pueden insertar sin `user_id`; no pueden asociar una puntuación a ninguna cuenta.
- **Sí:** política SELECT `USING (true)` en `games` — el checklist lo reconoce explícitamente
  como patrón válido para lectura pública; no genera warning.
- **No:** Content-Security-Policy (CSP) — requiere inventariar todos los orígenes externos
  (Supabase, fuentes, scripts) y un proceso de prueba/error propio; queda para un spec futuro.
- **No:** cambios a otras opciones de Supabase Auth (MFA, OTP expiry, etc.) — fuera del
  alcance del checklist.
- **Sí:** configurar Auth settings vía Management API en la implementación, no manualmente
  en el dashboard — para que queden documentados y sean reproducibles.
