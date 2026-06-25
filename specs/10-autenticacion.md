# 10 — Autenticación: registro, login y sesión

**Estado:** aprobado
**Dependencias:** [01-pantallas-visuales](01-pantallas-visuales.md) (UI de `/login` y `Nav` a reemplazar)
**Fecha:** 2026-06-24

**Objetivo:** Reemplazar el mock de `/login` por registro e inicio de sesión reales con Supabase Auth (email/contraseña con confirmación obligatoria y recuperación de contraseña, más Google/GitHub vía OAuth), reflejar la sesión en `Nav`, vincular el nombre de usuario al guardar puntuación, y mantener "jugar como invitado" intacto.

## Alcance

**Incluye:**

- Registro con email + contraseña, con confirmación de email obligatoria antes de poder iniciar sesión.
- Inicio de sesión con email + contraseña.
- Inicio de sesión social con Google y GitHub (`supabase.auth.signInWithOAuth`), asumiendo que ambos providers ya están configurados en el dashboard de Supabase.
- Ruta de callback OAuth/confirmación de email (`/auth/callback`) que intercambia el código por una sesión y redirige.
- Recuperación de contraseña: enlace "olvidé mi contraseña" → email de Supabase → `/login/reset-password` para fijar la nueva contraseña.
- Cerrar sesión.
- `middleware.ts` en la raíz que refresca la sesión SSR en cada request (usa `utils/supabase/middleware.ts`, ya existente pero no conectado).
- `Nav` muestra el nombre del usuario + botón de cerrar sesión cuando hay sesión; mantiene "Iniciar Sesión" cuando no la hay.
- "Jugar como invitado" se mantiene exactamente igual que hoy (sin cuenta, sin restricciones).
- Al guardar puntuación en `GamePlayer`, si hay sesión, el campo de nombre se autorrellena con el display name de la cuenta y queda bloqueado (no editable); sin sesión, sigue editable como hoy (default `"INVITADO"`).
- Columna `user_id` (uuid, nullable, FK a `auth.users`) en `scores`, rellenada solo cuando quien guarda está logueado.

**Fuera de alcance (para futuros specs):**

- Configurar los providers OAuth de Google/GitHub en el dashboard de Supabase (lo hace el usuario manualmente).
- Edición de perfil (cambiar display name, avatar, email) después del registro.
- Roles, permisos o áreas administrativas.
- Mostrar el historial de puntuaciones propias del usuario logueado (más allá del leaderboard ya existente).
- Eliminar cuentas o exportar datos (RGPD-style).
- Rate limiting / protección anti-bot en el formulario de registro.

## Modelo de datos

**Migración SQL** (Supabase, vía `apply_migration`):

```sql
alter table public.scores add column user_id uuid references auth.users(id);

-- ya existe "scores_insert_public" (insert para todos); se añade política
-- explícita de insert para autenticados, y se mantiene la pública para invitados.
```

`auth.users` ya lo gestiona Supabase Auth (no se crea tabla de perfiles nueva). El display
name del registro se guarda en `user_metadata.display_name` vía
`supabase.auth.signUp({ email, password, options: { data: { display_name } } })`.

**Páginas/rutas nuevas:**

- `app/login/page.tsx` (reescrita) — tabs "INICIAR SESIÓN" / "CREAR CUENTA" reales:
  - Login: `email` + `password` → `supabase.auth.signInWithOAuth` (Google/GitHub) o
    `supabase.auth.signInWithPassword({ email, password })`.
  - Registro: `display_name` (antes "Usuario") + `email` + `password` →
    `supabase.auth.signUp(...)`, muestra mensaje "revisa tu correo para confirmar".
  - "Jugar como invitado" → sin cambios, sigue redirigiendo a `/`.
  - Enlace "¿Olvidaste tu contraseña?" → `supabase.auth.resetPasswordForEmail(email, { redirectTo: ".../login/reset-password" })`.
- `app/login/reset-password/page.tsx` (nueva) — formulario de nueva contraseña →
  `supabase.auth.updateUser({ password })`, luego redirige a `/`.
- `app/auth/callback/route.ts` (nueva, route handler) — recibe `?code=...` (de OAuth o de
  confirmación de email/reset), llama `supabase.auth.exchangeCodeForSession(code)`,
  redirige a `/` (o a `/login/reset-password` si el flujo es de reset).
- `middleware.ts` (nuevo, raíz del proyecto) — usa `utils/supabase/middleware.ts` para
  refrescar la sesión en cada request, excluyendo estáticos/`_next`.

**Componentes existentes que cambian:**

- `app/components/Nav.tsx` — recibe `user: { displayName: string } | null` como prop;
  con sesión muestra el nombre + botón "CERRAR SESIÓN" (`supabase.auth.signOut()` +
  `router.refresh()`); sin sesión, el botón "Iniciar Sesión" actual sin cambios.
- `app/layout.tsx` — server component: obtiene el usuario vía
  `utils/supabase/server.ts` (`supabase.auth.getUser()`) y pasa el `displayName`
  (`user.user_metadata.display_name`) a `<Nav user={...} />`.
- `app/components/GamePlayer.tsx` — al montar, si hay sesión (vía cliente browser),
  `setName(displayName)` y el input de nombre (línea ~326) pasa a `disabled` cuando
  `user !== null`; `saveGameScore` pasa también `user?.id ?? null` para rellenar
  `user_id`.
- `lib/leaderboard.ts` — `saveGameScore` añade el parámetro `userId: string | null` e
  incluye `user_id: userId` en el `insert`.

## Plan de implementación

1. Migración SQL: añadir `user_id uuid references auth.users(id)` a `scores` y la política de insert para `authenticated` (manteniendo la pública existente para invitados). Verificar con `list_tables`.
2. Crear `middleware.ts` en la raíz usando `utils/supabase/middleware.ts` para refrescar la sesión SSR en cada request (excluyendo `_next`/estáticos). El resto de la app sigue funcionando igual.
3. Actualizar `lib/leaderboard.ts`: `saveGameScore` acepta `userId: string | null` y lo incluye en el `insert`. Actualizar la única llamada existente en `GamePlayer.tsx` para pasar `null` temporalmente (sin romper el guardado actual).
4. Crear `app/auth/callback/route.ts`: recibe `?code=...`, llama `exchangeCodeForSession`, redirige a `/` (o a `/login/reset-password` si `type=recovery`).
5. Reescribir el tab "INICIAR SESIÓN" de `app/login/page.tsx`: formulario real con `signInWithPassword`, manejo de error (credenciales inválidas / email no confirmado) y redirect a `/` en éxito. Botones Google/GitHub ya disparan `signInWithOAuth` con `redirectTo` al callback. "Jugar como invitado" sin cambios.
6. Reescribir el tab "CREAR CUENTA": campo "Usuario" pasa a `display_name`, `signUp` con `options.data.display_name`, mensaje "revisa tu correo para confirmar tu cuenta" tras éxito.
7. Añadir enlace "¿Olvidaste tu contraseña?" en el tab de login: `resetPasswordForEmail` + mensaje de confirmación de envío.
8. Crear `app/login/reset-password/page.tsx`: formulario de nueva contraseña, `updateUser({ password })`, redirect a `/` tras éxito.
9. Actualizar `app/layout.tsx`: obtener `user` server-side (`utils/supabase/server.ts`) y pasarlo a `<Nav user={...} />`.
10. Actualizar `app/components/Nav.tsx`: prop `user`, render condicional (nombre + "CERRAR SESIÓN" vía `signOut` + `router.refresh()`, o el botón "Iniciar Sesión" actual).
11. Actualizar `app/components/GamePlayer.tsx`: obtener usuario client-side al montar, autorrellenar y bloquear el input de nombre si hay sesión, y pasar `user?.id ?? null` a `saveGameScore` en las cuatro llamadas existentes.

## Criterios de aceptación

- [ ] Registrarse con email/contraseña nuevos muestra el mensaje de "revisa tu correo" y no inicia sesión automáticamente.
- [ ] Confirmar el email (clic en el enlace recibido) redirige a `/` con sesión iniciada.
- [ ] Intentar iniciar sesión antes de confirmar el email muestra un error y no concede sesión.
- [ ] Iniciar sesión con email/contraseña correctos redirige a `/` y `Nav` muestra el display name.
- [ ] Iniciar sesión con contraseña incorrecta muestra un error sin redirigir.
- [ ] Pulsar "GOOGLE" o "GITHUB" inicia el flujo OAuth y, tras autorizar, vuelve a la app con sesión iniciada y `Nav` actualizado.
- [ ] "¿Olvidaste tu contraseña?" envía el email de recuperación y muestra confirmación de envío.
- [ ] El enlace del email de recuperación abre `/login/reset-password`; fijar una nueva contraseña permite iniciar sesión con ella después.
- [ ] "Jugar como invitado" sigue llevando a `/` sin requerir cuenta, exactamente como hoy.
- [ ] Con sesión iniciada, recargar cualquier página mantiene la sesión (no se pierde al navegar ni al refrescar).
- [ ] "CERRAR SESIÓN" en `Nav` termina la sesión y vuelve a mostrar "Iniciar Sesión".
- [ ] Con sesión iniciada, el campo de nombre en el modal de "GUARDAR PUNTUACIÓN" aparece prerrellenado con el display name y no se puede editar.
- [ ] Sin sesión, el campo de nombre en "GUARDAR PUNTUACIÓN" sigue editable con default "INVITADO", igual que hoy.
- [ ] Guardar una puntuación logueado inserta la fila en `scores` con `user_id` igual al id del usuario; guardar como invitado inserta `user_id` nulo.
- [ ] `npm run lint` y `npm run build` pasan sin errores.

## Decisiones tomadas y descartadas

- **Sí:** un único spec para todo (email/contraseña, OAuth, reset, vínculo con scores) — decisión explícita del usuario, pese a tocar varios dominios. Se documenta aquí porque la recomendación inicial era dividirlo en 3 specs encadenados.
- **No:** login por "username" (como en el mock actual). Supabase Auth autentica por email; el campo "Usuario" del mock pasa a ser un display name guardado en `user_metadata`, no una credencial de login.
- **Sí:** display name en `user_metadata` de Supabase Auth. No se crea tabla `profiles` — no hay otros datos de perfil en el alcance de este spec.
- **No:** tabla `profiles` separada. Innecesaria mientras el único dato de perfil sea el display name.
- **Sí:** confirmación de email obligatoria antes de poder iniciar sesión (comportamiento default de Supabase Auth).
- **Sí:** configuración de los providers OAuth (Google/GitHub) en el dashboard de Supabase queda fuera del código — la hace el usuario manualmente. El spec solo cubre `signInWithOAuth` y el callback.
- **Sí:** al guardar puntuación logueado, el nombre se autorrellena y se bloquea (no editable) — evita que alguien guarde con un nombre distinto al de su cuenta.
- **Sí:** `user_id` nullable en `scores` (en vez de hacerlo obligatorio) para no romper el flujo de invitado, que se mantiene intacto.
- **No:** mostrar historial de puntuaciones propias del usuario logueado. Fuera de alcance — el leaderboard ya existente no cambia de forma, solo gana el dato `user_id`.
- **No:** rate limiting / protección anti-bot en registro. Fuera de alcance de este spec; Supabase ya aplica límites básicos por defecto.
