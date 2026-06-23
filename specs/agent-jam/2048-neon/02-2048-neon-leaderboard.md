# 02 — 2048 Neón: leaderboard real con seed en Supabase

**Estado:** Borrador
**Dependencias:** [01-2048-neon-motor](01-2048-neon-motor.md) (juego jugable y entrada en `games`), [06-leaderboard-asteroides-supabase](../../06-leaderboard-asteroides-supabase.md) (tablas `games`/`scores`, RLS pública), [08-snake](../../08-snake.md) (`lib/leaderboard.ts`/`lib/games.ts` ya generalizados, catálogo data-driven)

**Fecha:** 2026-06-23

**Objetivo:** Sembrar `scores` con puntuaciones iniciales para `"2048-neon"` y cablear el botón "GUARDAR PUNTUACIÓN" del Reproductor a una inserción real, para que `/juego/2048-neon` y la pestaña "2048 NEÓN" de `/salon-fama` muestren su leaderboard real.

## Alcance

**Incluye:**

- Seed en la misma migración (o en una migración subsiguiente) de ~10-12 filas en `scores` para `game_id = "2048-neon"`, con nombres tomados de `PLAYERS` (`lib/data.ts`), puntuaciones en el rango plausible de una partida de 2048 (~8.000-65.000) y fechas de ejemplo, para que el leaderboard no se vea vacío en el primer despliegue.
- `app/components/GamePlayer.tsx`: al pulsar "GUARDAR PUNTUACIÓN" con `game.id === "2048-neon"`, llama a `saveGameScore(createClient(), "2048-neon", name, displayScore)` (ya generalizado desde la spec 07), antes de `setSaved(true)`.
- `/juego/2048-neon` (`app/juego/[id]/page.tsx`, server component) y la pestaña "2048 NEÓN" de `/salon-fama` (`app/salon-fama/page.tsx`) muestran el leaderboard real vía el camino genérico ya existente (`getGame`/`getGames` + `getGameScores`), sin condicionales nuevos por `id` — ambos archivos ya son data-driven desde la spec 08 y no requieren cambios de código en esta spec.

**No incluye:**

- Autenticación real ni atribución de jugador vía sesión — se mantiene el input manual de iniciales ya existente (máx. 10 caracteres, default "INVITADO").
- Validación anti-cheat, rate limiting o límites de puntuación — cualquiera con la clave pública puede insertar cualquier valor, igual que el resto del catálogo.
- Edición o borrado de puntuaciones, ni paginación del leaderboard.
- Actualizar `best`/`plays` de la fila `"2048-neon"` en `games` con datos derivados de `scores` — esos campos siguen siendo el valor estático fijado en `01-2048-neon-motor.md`.
- Refrescar automáticamente el leaderboard de `/juego/2048-neon` o `/salon-fama` en tiempo real tras guardar (el jugador ve su score nuevo al navegar/recargar esas páginas, no instantáneamente desde el Reproductor).
- Tests automatizados (no hay test runner configurado).

## Modelo de datos

**Seed de `scores`** (vía `apply_migration`, tabla y políticas RLS ya existen desde la spec 06):

```sql
insert into public.scores (game_id, player_name, score, created_at) values
  ('2048-neon', 'GLITCHA',   64800, '2026-06-05'),
  ('2048-neon', 'PX_KAI',    58200, '2026-05-30'),
  ('2048-neon', 'NEONFOX',   51600, '2026-06-10'),
  ('2048-neon', 'Z3R0COOL',  46900, '2026-05-19'),
  ('2048-neon', 'M00NRYU',   41300, '2026-06-01'),
  ('2048-neon', 'VAULT_07',  36700, '2026-05-24'),
  ('2048-neon', 'ATARI_KID', 31200, '2026-06-14'),
  ('2048-neon', 'CYBER_LU',  26500, '2026-05-12'),
  ('2048-neon', 'MAGENTA88', 21800, '2026-06-08'),
  ('2048-neon', 'SCANLINE',  17400, '2026-05-27'),
  ('2048-neon', 'BIT_LORD',  13100, '2026-06-17'),
  ('2048-neon', 'ARKADYA',    9600, '2026-05-21');
```

No se introducen tipos ni funciones nuevas en `lib/leaderboard.ts`: `getGameScores`, `saveGameScore`, `mapScoreRows` y `getRealGameIds` ya están generalizados por `gameId` desde la spec 07/08 y funcionan para `"2048-neon"` sin modificación.

## Plan de implementación

1. **Aplicar el seed de `scores`** (`apply_migration`) con las 12 filas para `game_id = "2048-neon"` definidas arriba. Sin cambios de código: `/juego/2048-neon` y la pestaña "2048 NEÓN" de `/salon-fama` ya muestran estas 12 filas tras este paso, porque ambas páginas ya leen `scores` por `gameId` de forma genérica desde la spec 08 (siempre que `01-2048-neon-motor.md` ya esté implementado y la fila exista en `games`).

2. **Conectar "GUARDAR PUNTUACIÓN" para `"2048-neon"`**: en `GamePlayer.tsx`, añadir la llamada `saveGameScore(createClient(), "2048-neon", name, displayScore)` al `if`/`else if` existente de `saveScore` (mismo patrón que Asteroides/Tetris/Snake/Frogger), antes de `setSaved(true)`.

3. **Verificación final**: `npm run lint` y `npm run build` sin errores; recorrido manual — jugar una partida de "2048 NEÓN", pulsar FIN, introducir iniciales y "GUARDAR PUNTUACIÓN" (confirmar toast "PUNTUACIÓN GUARDADA"), luego ir a `/juego/2048-neon` y a `/salon-fama` (pestaña "2048 NEÓN") y verificar que la nueva puntuación aparece en el leaderboard junto a las 12 de seed, ordenadas correctamente por puntuación descendente; confirmar que el resto de juegos/pestañas del catálogo siguen mostrando su leaderboard sin cambios.

## Criterios de aceptación

- [ ] La migración inserta 12 filas de seed en `scores` para `game_id = "2048-neon"`, con nombres de `PLAYERS`, puntuaciones en el rango ~9.000-65.000 y fechas plausibles.
- [ ] `/juego/2048-neon` muestra un leaderboard de hasta 10 filas leídas de `scores` (no vacío), ordenadas por puntuación descendente, con las filas de seed visibles tras la migración.
- [ ] En `/salon-fama`, la pestaña "2048 NEÓN" muestra el podio (top 3) y la tabla con los datos reales de `scores` para `"2048-neon"`.
- [ ] En el Reproductor de "2048 NEÓN", al terminar una partida, introducir iniciales y pulsar "GUARDAR PUNTUACIÓN" inserta una fila nueva en `scores` (`game_id: "2048-neon"`, `player_name`, `score` de la partida) y muestra el toast "PUNTUACIÓN GUARDADA".
- [ ] Tras guardar una puntuación de "2048 NEÓN" y recargar `/juego/2048-neon` o la pestaña "2048 NEÓN" de `/salon-fama`, la nueva puntuación aparece en el leaderboard en la posición correcta según su valor.
- [ ] Para el resto de juegos del catálogo, "GUARDAR PUNTUACIÓN" y sus leaderboards siguen funcionando sin cambios de comportamiento.
- [ ] `npm run lint` y `npm run build` finalizan sin errores.

## Decisiones tomadas y descartadas

- **Seed de 12 filas en vez de lanzar `scores` vacío**: se descarta el enfoque de Snake (lanzar vacío) para que el leaderboard de "2048 NEÓN" no se vea desolador en el primer despliegue, siguiendo el criterio de Asteroides/Tetris (juegos con mecánica de puntuación acumulativa donde un leaderboard lleno comunica mejor el rango de puntuaciones alcanzables).
- **Rango de puntuaciones ~9.000-65.000**: estimado a partir de la fórmula de score del motor (suma del valor de cada ficha fusionada); alcanzar la ficha "2048" típicamente acumula puntuaciones en ese orden de magnitud en implementaciones estándar del juego, dando un rango coherente con el `best: 48280` fijado en el catálogo.
- **Reutilizar `saveGameScore`/`getGameScores` ya generalizados, sin nuevas funciones en `lib/leaderboard.ts`**: se descarta crear `saveNeon2048Score`/`getNeon2048Scores` específicos, ya que la generalización de la spec 07 cubre cualquier `gameId` sin necesidad de código adicional; añadir funciones específicas sería un retroceso al patrón pre-spec-07.
- **Sin recálculo de `best`/`plays` desde `scores`**: misma decisión que el resto del catálogo (specs 06/07/08) — esos campos siguen siendo valores estáticos fijados en `01-2048-neon-motor.md`, no derivados de las puntuaciones reales guardadas.
- **Sin refresco en tiempo real del leaderboard tras guardar**: se descarta suscripción realtime o revalidación automática; el jugador ve su puntuación nueva al navegar o recargar, igual que el resto del catálogo.

## Riesgos identificados

- **React Strict Mode (modo desarrollo)**: el `useEffect` que consulta `scores` para la pestaña "2048 NEÓN" en `/salon-fama` puede ejecutarse dos veces en desarrollo (doble fetch). No es un bug funcional (solo doble lectura), pero conviene verificar que no cause parpadeo visible en la tabla/podio, igual que se documentó para Asteroides en la spec 06.
- **Regresión de leaderboards compartidos**: el seed de esta spec inserta filas nuevas en la tabla `scores` ya usada por todos los juegos reales del catálogo; un `game_id` mal escrito (typo respecto a `"2048-neon"` en `games`) dejaría el leaderboard vacío sin error visible. Mitigación: tras aplicar la migración, verificar con `execute_sql`/`list_tables` que las 12 filas tienen exactamente `game_id = '2048-neon'` antes de continuar con el paso 2.
- **RLS pública de inserción en `scores`**: cualquiera con la clave pública puede insertar puntuaciones arbitrarias para `"2048-neon"` (mismo riesgo aceptado que el resto del catálogo desde la spec 06); sin mitigación adicional en esta spec.
