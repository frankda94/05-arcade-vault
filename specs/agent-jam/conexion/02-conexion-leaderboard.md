# 02 — CONEXIÓN: leaderboard real en Supabase

**Estado:** Borrador
**Dependencias:** [01-conexion-motor](01-conexion-motor.md) (juego jugable, fila `"conexion"` en `games`, botón "GUARDAR PUNTUACIÓN" en GamePlayer), [06-leaderboard-asteroides-supabase](../../06-leaderboard-asteroides-supabase.md) (tabla `scores`, helpers genéricos `getGameScores`/`saveGameScore`), [08-snake](../../08-snake.md) (catálogo en tabla `games`, camino genérico de leaderboard ya data-driven)
**Fecha:** 2026-06-17

**Objetivo:** Dar a `"conexion"` un leaderboard real persistido en la tabla `scores` de Supabase, sembrándolo con ~10 puntuaciones de ejemplo y conectando el botón "GUARDAR PUNTUACIÓN" del Reproductor a `saveGameScore(supabase, "conexion", name, score)`.

## Alcance

**Incluye:**

- **Seed de `scores`** (vía `apply_migration`): ~10 filas para `game_id = "conexion"`, con nombres tomados de `PLAYERS` (`lib/data.ts`), puntuaciones plausibles (rango coherente con `best: 9800` del catálogo) y fechas de ejemplo en mayo-junio 2026. Solo `insert` en `scores`; las tablas y las políticas RLS ya existen.
- **Cableado de "GUARDAR PUNTUACIÓN"** en `app/components/GamePlayer.tsx`: añadir el branch `isConexion` en `saveScore` para llamar a `saveGameScore(createClient(), "conexion", name, displayScore)`, siguiendo el mismo patrón que `"asteroides"`/`"tetris"`/`"snake"`.
- Que `/juego/conexion` y la pestaña CONEXIÓN de `/salon-fama` muestren ese leaderboard real **por el camino genérico ya existente** (`getGameScores` / `getRealGameIds`), sin cambios adicionales en esas páginas.

**No incluye:**

- Cambios a `lib/leaderboard.ts`, `lib/games.ts`, `/juego/[id]/page.tsx`, `/salon-fama/page.tsx` ni `/biblioteca/page.tsx`: ya son data-driven contra `games`/`scores` y tratan cualquier `id` de forma uniforme; esta spec solo añade datos y un branch de guardado.
- `create table` / políticas RLS (ya existen desde la spec 06).
- Autenticación, anti-cheat, rate limiting, edición/borrado, paginación, refresco en tiempo real ni recálculo de `best`/`plays` desde `scores`.
- Controles táctiles, audio ni tests automatizados.

## Modelo de datos

**Seed en `scores`** (`apply_migration`), nombres de `PLAYERS` (`lib/data.ts`), orden descendente de score:

```sql
insert into public.scores (game_id, player_name, score, created_at) values
  ('conexion', 'ARKADYA',   9800, '2026-05-14'),
  ('conexion', 'RGB_QUEEN', 9100, '2026-05-21'),
  ('conexion', 'VECTORX',   8450, '2026-05-09'),
  ('conexion', 'SCANLINE',  7900, '2026-05-27'),
  ('conexion', 'BIT_LORD',  7200, '2026-06-02'),
  ('conexion', 'NEONFOX',   6650, '2026-05-18'),
  ('conexion', 'PIXEL_DAD', 5900, '2026-06-07'),
  ('conexion', 'GLITCHA',   5100, '2026-05-31'),
  ('conexion', 'DROID_X',   4400, '2026-06-11'),
  ('conexion', 'JOY_STK',   3700, '2026-05-05');
```

No se crean tablas, tipos ni helpers nuevos: se reutilizan `getGameScores`/`saveGameScore`/`getRealGameIds` y `mapScoreRows` de `lib/leaderboard.ts`, y el shape `ScoreRow` de `lib/data.ts`. La fila `"conexion"` en `games` ya existe (spec `01-…`).

**Cambio en `app/components/GamePlayer.tsx`** (solo en `saveScore`): añadir, junto a los branches existentes,

```typescript
} else if (isConexion) {
  await saveGameScore(createClient(), "conexion", name, displayScore);
}
```

(`isConexion`, `displayScore` y `name` ya existen tras la spec `01-…`).

## Plan de implementación

1. **Aplicar la migración del seed** (`apply_migration`): `insert` de las ~10 filas en `scores` para `game_id = "conexion"`. Sin cambios de código todavía. Tras este paso, `/juego/conexion` y la pestaña CONEXIÓN de `/salon-fama` muestran el leaderboard sembrado por el camino genérico ya existente (`getGameScores`), sin tocar páginas.

2. **Modificar `app/components/GamePlayer.tsx`**: añadir el branch `isConexion` en `saveScore` con `saveGameScore(createClient(), "conexion", name, displayScore)`, antes de `setSaved(true)`. Para el resto de juegos, sin cambios.

3. **Verificación final**: `npm run lint` y `npm run build` sin errores; recorrido manual — `/juego/conexion` y `/salon-fama` (pestaña CONEXIÓN) muestran las 10 filas de seed ordenadas por score descendente; jugar una partida de CONEXIÓN, pulsar FIN, introducir iniciales y "GUARDAR PUNTUACIÓN" (toast "PUNTUACIÓN GUARDADA"); tras recargar `/juego/conexion` o la pestaña CONEXIÓN de `/salon-fama`, la nueva puntuación aparece en la posición correcta; los leaderboards de los demás juegos siguen sin regresión.

## Criterios de aceptación

- [ ] La migración inserta ~10 filas en `scores` para `game_id = "conexion"` con nombres de `PLAYERS`; no se ejecuta `create table` ni RLS.
- [ ] `/juego/conexion` muestra un leaderboard de hasta 10 filas reales de `scores` (no `seededScores`), ordenadas por score descendente, con las filas de seed visibles tras la migración.
- [ ] `/salon-fama`, pestaña CONEXIÓN, muestra el podio (top 3) y la tabla con esos datos reales.
- [ ] En el Reproductor de CONEXIÓN, al terminar una partida, introducir iniciales y pulsar "GUARDAR PUNTUACIÓN" inserta una fila en `scores` (`game_id: "conexion"`, `player_name`, `score`) y muestra el toast "PUNTUACIÓN GUARDADA".
- [ ] Tras guardar y recargar `/juego/conexion` o la pestaña CONEXIÓN de `/salon-fama`, la nueva puntuación aparece en la posición correcta según su valor.
- [ ] Si la inserción falla, el error se loguea con `console.error` y el toast se muestra igual (patrón heredado de la spec 06).
- [ ] Los leaderboards de `asteroides`/`tetris`/`snake` y el resto del catálogo siguen sin regresión.
- [ ] `npm run lint` y `npm run build` finalizan sin errores.

## Decisiones tomadas y descartadas

- **Sí — sembrar `scores` con ~10 filas (no lanzar vacío como Snake)**: CONEXIÓN es PUZZLE, como `tetris`/`asteroides`, que arrancaron sembrados; un leaderboard lleno mantiene la estética del catálogo. Snake fue la excepción explícita; aquí se vuelve al patrón sembrado.
- **Sí — reutilizar el camino genérico (`getGameScores`/`saveGameScore`)**: `lib/leaderboard.ts` ya está generalizado; no hace falta `getConexionScores`/`saveConexionScore` específicos. Solo se añade un branch de `id` en `saveScore`.
- **Sí — rango de seed coherente con `best: 9800`**: la fila top del seed iguala el `best` del catálogo (9800), para que el stat-strip y el leaderboard cuadren.
- **No — recalcular `best`/`plays` desde `scores`**: fuera de alcance, igual que en las specs 06/08; siguen siendo valores estáticos del catálogo.
- **No — auth, anti-cheat, rate limiting, refresco en tiempo real**: mismas exclusiones que la spec 06, por las mismas razones (sin sesión real, alcance acotado).

## Riesgos identificados

| Riesgo                                                                                                            | Mitigación                                                                                                                                                 |
| ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RLS pública de `insert` en `scores` (heredada de spec 06) permite scores/nombres arbitrarios                      | Aceptado explícitamente, igual que en specs 06/08; un spec futuro de auth/anti-cheat lo restringiría.                                                      |
| Regresión de leaderboards compartidos: el seed/insert toca la tabla `scores` que ya sirve a `asteroides`/`tetris` | El seed filtra por `game_id = "conexion"`; verificar con `execute_sql` que solo se insertaron filas de `conexion` y que los otros leaderboards no cambian. |
| Desajuste de zona horaria al formatear `created_at` del seed a `DD/MM/YYYY`                                       | `mapScoreRows` ya formatea usando solo año/mes/día (sin hora/zona), igual que en spec 06.                                                                  |
| React Strict Mode en `/salon-fama` (doble fetch de la pestaña CONEXIÓN en dev)                                    | No es bug funcional (doble lectura); verificar que no haya parpadeo visible, igual que en spec 06.                                                         |

## Lo que **no** está en esta spec

- El motor jugable y la fila de catálogo (están en `01-conexion-motor.md`).
- Cambios a `lib/leaderboard.ts`/`lib/games.ts`/páginas (ya son genéricos).
- Autenticación, anti-cheat, rate limiting, recálculo de `best`/`plays`, refresco en tiempo real, controles táctiles, audio y tests automatizados.

Cada uno de esos, si se aborda, va en su propia spec.
