# 07 — Tetris: motor jugable con leaderboard real en Supabase

**Estado:** Aprobado
**Dependencias:** [01-pantallas-visuales](01-pantallas-visuales.md) (Reproductor `/juego/[id]/jugar`, HUD, modal de fin de juego), [05-asteroides](05-asteroides.md) (patrón de port de motor + integración en GamePlayer), [06-leaderboard-asteroides-supabase](06-leaderboard-asteroides-supabase.md) (tablas `games`/`scores` ya existentes en Supabase, `lib/leaderboard.ts` a generalizar)
**Fecha:** 2026-06-12

**Objetivo:** Portar el motor de Tetris de `references/started-games/03-tetris/game.js` a un componente React/canvas jugable, agregarlo al catálogo como nueva entrada `"tetris"` (TETRIS) integrada en el Reproductor con HUD y leaderboard real en Supabase, generalizando de paso `lib/leaderboard.ts` y la lógica de `/juego/[id]` y `/salon-fama` para que cualquier juego con fila en `games` use leaderboard real sin más branches hardcodeados.

## Alcance

**Incluye:**

- Nueva entrada `"tetris"` en `lib/data.ts` (`GAMES`): `id: "tetris"`, `title: "TETRIS"`, `cat: "PUZZLE"`, `color: "yellow"`, `cover: "cover-tetris"`, `short`/`long`/`best`/`plays` en el tono retro-gamer del resto del catálogo (`best` ~210.000-220.000).
- Nueva clase CSS `.cover-tetris` en `app/globals.css` (tema mecánico/industrial: engranajes, piezas metálicas, acento amarillo).
- Nuevo componente `app/components/games/Tetris.tsx` (client component): port del motor de `references/started-games/03-tetris/game.js` — tablero 10×20, las 8 piezas (incluida la pieza "N"/tuerca), rotación con wall-kicks, pieza fantasma (ghost), limpieza de líneas, puntuación/nivel/velocidad, soft/hard drop, y mini-canvas de "siguiente pieza" dentro del mismo componente.
- Integración en `app/components/GamePlayer.tsx`: renderizado condicional (generaliza el patrón `isAsteroides` para incluir `"tetris"` sin romper el branch de Asteroides), HUD con `score`/`level` del motor y el stat "Vidas" sustituido por "Líneas" para este juego, `PAUSA`/`FIN`/`JUGAR DE NUEVO`/`SALIR` conectados al motor, incluyendo soporte para alternar pausa desde la tecla `P` dentro del canvas.
- Controles de teclado (`←`/`→` mover, `↓` soft drop, `↑`/`X` rotar, `Espacio` hard drop, `P` pausa) con `preventDefault` para evitar scroll de página.
- Generalización de `lib/leaderboard.ts`: `getAsteroidesScores`/`saveAsteroidesScore` → `getGameScores(supabase, gameId)`/`saveGameScore(supabase, gameId, playerName, score)`, actualizando la llamada existente de Asteroides.
- `/juego/[id]` y `/salon-fama` pasan a ser data-driven: si `id` existe en la tabla `games`, usan leaderboard real (`getGameScores`); si no, `seededScores` como hasta ahora.
- Migración SQL: inserta fila en `games` para `"tetris"` + seed de ~10-12 filas en `scores` (rango ~60.000-210.000, nombres de `PLAYERS`).
- "GUARDAR PUNTUACIÓN" en el Reproductor de TETRIS inserta en `scores` vía `saveGameScore`.

**No incluye:**

- Controles táctiles/móviles.
- Sonido/audio.
- Autenticación real (se mantiene el input manual de iniciales).
- Cambios a otras entradas del catálogo (`caída` sigue mock, sin tocar).
- Validación anti-cheat, rate limiting, edición/borrado de puntuaciones, paginación.
- Recalcular `best`/`plays` de `"tetris"` desde `scores` (siguen siendo valores estáticos mock, igual que asteroides).
- Refresco en tiempo real del leaderboard tras guardar.
- Tests automatizados (no hay test runner configurado).

## Modelo de datos

**Nueva entrada en `GAMES`** (`lib/data.ts`):

```typescript
{
  id: "tetris",
  title: "TETRIS",
  short: "El clásico de las piezas que caen: encaja, gira y limpia líneas.",
  long: "El tablero vertical de 10x20 recibe las siete piezas clásicas, más una pieza extra en forma de tuerca como guiño mecánico. Gíralas con wall-kicks, usa la pieza fantasma para planificar la caída y completa filas enteras para que desaparezcan, mientras la velocidad aumenta sin piedad cada 10 líneas. Una pieza atascada en lo alto y el mecanismo se detiene para siempre.",
  cat: "PUZZLE",
  cover: "cover-tetris",
  color: "yellow",
  best: 215000,
  plays: "2.3K",
}
```

**Props del componente del motor** (`app/components/games/Tetris.tsx`):

```typescript
export interface TetrisProps {
  paused: boolean; // true = el loop interno no actualiza ni dibuja nuevos frames
  resetSignal: number; // al incrementarse, reinicia el tablero desde cero
  endSignal: number; // al incrementarse, fuerza game over inmediato (botón FIN)
  onScoreChange: (score: number) => void;
  onLinesChange: (lines: number) => void; // sustituye a "vidas" en el HUD
  onLevelChange: (level: number) => void; // floor(lines/10)+1, igual que el original
  onTogglePause: () => void; // se dispara al pulsar "P" dentro del canvas
  onGameOver: () => void; // se dispara al no poder spawnear la siguiente pieza
}
```

El componente renderiza un contenedor con **dos `<canvas>`**: el principal (tablero 10×20, responsive, llena `.game-arena`) y un mini-canvas "SIGUIENTE" posicionado en una esquina (absolute, ~80×80px), ambos dibujados desde el mismo loop interno. Las clases `COLORS`/`PIECES`/`LINE_SCORES`, las funciones `collide`/`rotateCW`/`tryRotate`/`clearLines`/`ghostY` y la máquina de drop (`dropInterval`/`dropAccum`) se portan tal cual desde `game.js`, encapsuladas dentro de un `useEffect` con cleanup completo (listeners de teclado, `cancelAnimationFrame`, `ResizeObserver`) al desmontar — mismo patrón que `Asteroides.tsx`.

**Migración SQL** (vía `apply_migration`, las tablas `games`/`scores` y sus políticas RLS ya existen desde la spec 06):

```sql
insert into public.games (id, title) values ('tetris', 'TETRIS');

insert into public.scores (game_id, player_name, score, created_at) values
  ('tetris', 'BIT_LORD',   212500, '2026-05-09'),
  ('tetris', 'ARKADYA',    198300, '2026-05-27'),
  ('tetris', 'DROID_X',    176900, '2026-05-14'),
  ('tetris', 'RGB_QUEEN',  159400, '2026-06-02'),
  ('tetris', 'PIXEL_DAD',  142000, '2026-05-19'),
  ('tetris', 'RETROVIRA',  121800, '2026-05-31'),
  ('tetris', 'VECTORX',    103500, '2026-05-06'),
  ('tetris', 'JOY_STK',     86200, '2026-05-23'),
  ('tetris', 'PX_KAI',      71400, '2026-06-04'),
  ('tetris', 'NEONFOX',     62700, '2026-05-11');
```

**Nuevas firmas en `lib/leaderboard.ts`** (reemplazan/generalizan las actuales `getAsteroidesScores`/`saveAsteroidesScore`):

```typescript
export async function getGameScores(
  supabase: SupabaseClient,
  gameId: string,
): Promise<ScoreRow[]>; // select scores where game_id = gameId, order desc, limit 10, mapeado con mapScoreRows

export async function saveGameScore(
  supabase: SupabaseClient,
  gameId: string,
  playerName: string,
  score: number,
): Promise<void>; // insert en scores; no lanza si falla, solo console.error

export async function getRealGameIds(
  supabase: SupabaseClient,
): Promise<string[]>; // select id from games — ids con leaderboard real
```

`mapScoreRows` no cambia. La llamada existente en `GamePlayer.tsx` para Asteroides pasa a usar `saveGameScore(supabase, "asteroides", name, displayScore)`.

**`/juego/[id]/page.tsx`** (server component): obtiene `getRealGameIds(supabase)`; si `id` está incluido, usa `getGameScores(supabase, id)`; si no, `seededScores(id.length * 17 + 3, 10)` como hasta ahora.

**`/salon-fama/page.tsx`**: en un `useEffect` al montar, llama una vez a `getRealGameIds(supabase)` y guarda el resultado en estado (`realGameIds`); cuando la pestaña activa (`tab`) está en `realGameIds`, otro `useEffect` llama a `getGameScores(supabase, tab)` y usa ese resultado para podio y tabla; para el resto de pestañas, sin cambios (`seededScores`).

No se introducen tipos nuevos en `lib/data.ts`; `ScoreRow` se reutiliza igual que en la spec 06.

## Plan de implementación

1. **Agregar la entrada `"tetris"` a `GAMES`** (`lib/data.ts`) y la clase `.cover-tetris` en `app/globals.css`. El sistema sigue funcional: la card aparece en la Biblioteca con su portada, `/juego/tetris` muestra el detalle con leaderboard `seededScores`, y `/juego/tetris/jugar` usa el Reproductor simulado actual.

2. **Crear `app/components/games/Tetris.tsx`**: portar el motor completo de `references/started-games/03-tetris/game.js` (tablero 10×20, las 8 piezas incluida "N"/tuerca, `rotateCW`/`tryRotate` con wall-kicks, `clearLines`, `ghostY`, `LINE_SCORES`, progresión de `dropInterval`/nivel) a un componente client con `<canvas>` principal responsive + mini-canvas "SIGUIENTE", loop propio (`requestAnimationFrame`), listeners de teclado (`←`/`→`/`↓`/`↑`/`X`/`Espacio`/`P`) con `preventDefault`. Implementa `TetrisProps` (`paused`/`resetSignal`/`endSignal`, emite `onScoreChange`/`onLinesChange`/`onLevelChange`/`onTogglePause`/`onGameOver`), con cleanup completo en el `useEffect` al desmontar. El componente aún no se usa en ninguna página — el sistema sigue funcional igual que en el paso 1.

3. **Modificar `app/components/GamePlayer.tsx`** para renderizado condicional: si `game.id === "tetris"`, renderiza `<Tetris />` dentro de `.game-arena` (generaliza el patrón `isAsteroides` para que ambos branches coexistan sin romperse), con estado React (`tetScore`, `tetLines`, `tetLevel`) sincronizado vía los callbacks del motor. En el `player-hud`, el stat "Vidas" se sustituye por "Líneas" cuando `game.id === "tetris"` (resto de juegos sin cambios). `PAUSA/REANUDAR` alterna `paused` (y `onTogglePause` desde la tecla "P" del canvas invoca el mismo handler); `FIN` incrementa `endSignal`; `JUGAR DE NUEVO` incrementa `resetSignal` y resetea `tetScore`/`tetLines`/`tetLevel`; `SALIR` navega a `/juego/tetris` sin cambios de comportamiento. Para Asteroides y el resto del catálogo, estos botones siguen comportándose como hasta ahora.

4. **Generalizar `lib/leaderboard.ts`**: reemplazar `getAsteroidesScores`/`saveAsteroidesScore` por `getGameScores(supabase, gameId)`/`saveGameScore(supabase, gameId, playerName, score)`, y añadir `getRealGameIds(supabase)`. Actualizar la llamada de "GUARDAR PUNTUACIÓN" de Asteroides en `GamePlayer.tsx` a `saveGameScore(supabase, "asteroides", name, displayScore)`. El sistema sigue funcional — el leaderboard de Asteroides funciona igual, ahora vía las funciones generalizadas (las páginas siguen llamando con `"asteroides"` hardcodeado hasta el paso 6).

5. **Aplicar la migración** (`apply_migration`) con la fila de `games` para `"tetris"` y el seed de 10 filas en `scores` definidos en el modelo de datos. Sin cambios de código todavía; `/juego/tetris` y `/salon-fama` siguen mostrando `seededScores` para `"tetris"` (la fila ya existe en `games` pero las páginas aún no la consultan).

6. **Modificar `app/juego/[id]/page.tsx`**: obtener `getRealGameIds(supabase)` y, si `id` está incluido, usar `getGameScores(supabase, id)` en vez de `seededScores`. Tras este paso, `/juego/asteroides` y `/juego/tetris` muestran leaderboard real (con datos de seed); el resto de `id` siguen con `seededScores`.

7. **Modificar `app/salon-fama/page.tsx`**: en un `useEffect` al montar, llamar `getRealGameIds(createClient())` y guardar el resultado en estado (`realGameIds`); cuando `tab` está en `realGameIds`, otro `useEffect` llama `getGameScores(createClient(), tab)` y usa ese resultado para podio y tabla; para el resto de pestañas, sin cambios (`seededScores`).

8. **Conectar "GUARDAR PUNTUACIÓN" para `"tetris"`**: en `GamePlayer.tsx`, al pulsar el botón con `game.id === "tetris"`, llamar a `saveGameScore(createClient(), "tetris", name, displayScore)` antes de `setSaved(true)`, igual que Asteroides. Para el resto de juegos, sigue siendo solo visual.

9. **Verificación final**: `npm run lint` y `npm run build` sin errores; recorrido manual en `/juego/tetris/jugar` jugando una partida completa (mover, rotar con `↑`/`X`, soft/hard drop, limpiar líneas, ver subir el nivel y la velocidad, ver el mini-canvas "SIGUIENTE" actualizarse, pausar con el botón y con `P`, perder al apilarse hasta arriba); comprobar que el HUD refleja `score`/`level`/`Líneas` en tiempo real, que FIN/JUGAR DE NUEVO/SALIR funcionan, que "GUARDAR PUNTUACIÓN" inserta en `scores` y aparece tras recargar en `/juego/tetris` y en `/salon-fama` (pestaña TETRIS); confirmar que Asteroides y el resto del catálogo siguen funcionando sin cambios.

## Criterios de aceptación

- [ ] `lib/data.ts` incluye la entrada `"tetris"` en `GAMES` con `id`, `title`, `short`, `long`, `cat: "PUZZLE"`, `cover: "cover-tetris"`, `color: "yellow"`, `best` y `plays`.
- [ ] `app/globals.css` define `.cover-tetris` y la card de "TETRIS" se muestra correctamente en la Biblioteca (`/`), incluyendo filtros por búsqueda y categoría `PUZZLE`.
- [ ] `/juego/tetris/jugar` renderiza un `<canvas>` jugable de 10×20 dentro de `.crt-screen`, en lugar del arena mock, junto con el mini-canvas "SIGUIENTE" mostrando la próxima pieza.
- [ ] Controles de teclado funcionan: `←`/`→` mueven la pieza, `↓` hace soft drop (+1 punto), `↑`/`X` rotan con wall-kicks, `Espacio` hace hard drop; estas teclas no provocan scroll de la página.
- [ ] Las 8 piezas (incluida la "N"/tuerca) aparecen, caen, rotan y se bloquean al colisionar; al completar una fila esta se elimina y las superiores descienden, sumando puntos según `LINE_SCORES` × nivel.
- [ ] El nivel sube cada 10 líneas eliminadas (`floor(lines/10)+1`) y la velocidad de caída aumenta en consecuencia.
- [ ] El HUD de React (`player-hud`) refleja en tiempo real `score`, "Líneas" (en lugar de "Vidas") y `level` del motor de Tetris.
- [ ] Si una pieza nueva no puede spawnear (tablero lleno arriba), se dispara `onGameOver` y aparece el modal de fin de juego existente con la puntuación final real.
- [ ] Botón **PAUSA** detiene el juego (loop, física y dibujo) y muestra el overlay "EN PAUSA" existente; **REANUDAR** lo continúa. La tecla `P` dentro del canvas produce el mismo efecto.
- [ ] Botón **FIN** fuerza game over inmediato con la puntuación actual y abre el modal de fin de juego.
- [ ] Botón "JUGAR DE NUEVO" reinicia el motor a su estado inicial (tablero vacío, score 0, líneas 0, nivel 1) y cierra el modal.
- [ ] Botón "SALIR" navega a `/juego/tetris`, deteniendo el loop y removiendo los listeners de teclado (sin fugas al volver a entrar al Reproductor).
- [ ] `lib/leaderboard.ts` exporta `getGameScores`, `saveGameScore` y `getRealGameIds` con las firmas descritas; las funciones específicas de Asteroides (`getAsteroidesScores`/`saveAsteroidesScore`) ya no existen.
- [ ] La migración inserta la fila `"tetris"` en `games` y 10 filas de seed en `scores` para `game_id = "tetris"`.
- [ ] `/juego/tetris` muestra un leaderboard real de hasta 10 filas leídas de `scores` (no `seededScores`), con las filas de seed visibles tras la migración.
- [ ] `/juego/asteroides` sigue mostrando su leaderboard real (sin regresión) ahora a través de `getGameScores(supabase, "asteroides")`.
- [ ] `/juego/[id]` para cualquier `id` que no esté en `games` sigue mostrando `seededScores`, sin cambios visuales ni de comportamiento.
- [ ] En `/salon-fama`, las pestañas "ASTEROIDES" y "TETRIS" muestran podio y tabla con datos reales de `scores`; el resto de pestañas siguen usando `seededScores`.
- [ ] En el Reproductor de Tetris, al terminar una partida, introducir iniciales y pulsar "GUARDAR PUNTUACIÓN" inserta una fila nueva en `scores` (`game_id: "tetris"`) y muestra el toast "PUNTUACIÓN GUARDADA".
- [ ] Tras guardar una puntuación de Tetris y recargar `/juego/tetris` o `/salon-fama` (pestaña TETRIS), la nueva puntuación aparece en el leaderboard en la posición correcta según su valor.
- [ ] Los demás juegos del catálogo (`bloque-buster`, `caída`, etc.) siguen mostrando el Reproductor simulado sin cambios de comportamiento.
- [ ] `npm run lint` y `npm run build` finalizan sin errores.

## Decisiones tomadas y descartadas

- **Nueva entrada `"tetris"` separada, en vez de modificar `"caída"`**: igual que asteroides vs rocas, se descarta tocar `"caída"` (mock, sin relación con esta spec) para no afectar su posición/leaderboard actual en el catálogo.
- **Nombre "tetris"/TETRIS en vez de un nombre temático propio ("engranajes")**: decisión tomada tras iniciar la implementación (la spec se aprobó originalmente con la entrada "engranajes"). Tetris es el nombre universalmente reconocido para este género de juego de piezas que caen; usar el nombre genérico evita que el catálogo necesite un nombre propio para diferenciarse, y la pieza extra "N"/tuerca (gris metálico) sigue aportando una diferencia de **jugabilidad** real frente a `"caída"`, no solo de naming. Esto supersede la decisión original de la spec ("Temática 'engranajes' (industrial/mecánica) en vez de un nombre genérico"); todo el código y la migración ya implementados (`id`, `title`, clase CSS, componente, filas en `games`/`scores`) se renombraron de `engranajes`/`ENGRANAJES`/`Engranajes` a `tetris`/`TETRIS`/`Tetris` en el mismo PR.
- **Tema visual (cover mecánico/industrial con engranajes, ⚙ y acento amarillo) se mantiene**: aunque el nombre pasa a ser genérico ("Tetris"), la portada `.cover-tetris` conserva la estética de engranajes/piezas metálicas — sigue funcionando como diferenciador visual frente a `"caída"` en la Biblioteca y no requiere rediseño.
- **Color amarillo**: se descarta cyan (saturado en el catálogo: asteroides, bloque-buster, duelo-pixel) y magenta (ya usado por caída); amarillo conecta con la temática industrial/advertencia del cover y ya convive con otras entradas (rocas, glotón) sin choque al estar en categorías distintas.
- **"Líneas" sustituye a "Vidas" en el HUD para este juego**: se descarta forzar un concepto de "vidas" artificial en Tetris (no existe en el motor original); "Líneas" es la métrica natural y más informativa. Requiere un pequeño condicional en `GamePlayer.tsx` (label + valor numérico en vez de corazones), aceptado como costo menor.
- **Incluir el mini-canvas "SIGUIENTE" (a diferencia de Asteroides, que no dibuja HUD propio)**: se descarta omitirlo porque es información de juego central en Tetris (planificar la siguiente pieza), no un duplicado del HUD de React; se mantiene dentro del mismo componente para no añadir estado/plumbing extra a `GamePlayer`.
- **Generalizar `lib/leaderboard.ts` y la lógica de `/juego/[id]`/`/salon-fama` ahora, no diferir**: se descarta añadir un segundo branch hardcodeado `=== "tetris"` junto al de `"asteroides"`. Generalizar ahora (`getGameScores`/`saveGameScore`/`getRealGameIds`, lookup en `games`) deja el sistema listo para un tercer juego real sin tocar páginas compartidas; si se hubiera diferido, el próximo juego habría requerido el mismo refactor más un branch adicional que deshacer.
- **Controles incluyen `X` (rotación alternativa) y `P` (pausa por teclado) tal como en el original**: se descarta simplificar a solo flechas+Espacio; `P` requiere el callback `onTogglePause` porque `paused` es estado controlado por `GamePlayer`, no por el motor — el motor no puede cambiarlo directamente.
- **Seed y `best` en rango similar a `"caída"` (~60.000-220.000)**: ambas son variantes de "piezas que caen" con escalas de puntuación comparables (líneas × nivel + bonos de drop); usar un rango muy distinto se vería incoherente en `/salon-fama`.
- **Motor + canvas + loop + mini-canvas en un solo componente (`Tetris.tsx`)**: mismo criterio que `Asteroides.tsx` — no hay otro consumidor del motor, mantener todo junto simplifica el port y el cleanup.
- **Sin controles táctiles, sonido, autenticación, anti-cheat ni recálculo de `best`/`plays`**: se mantienen las mismas exclusiones que las specs 05/06, por las mismas razones (alcance acotado, infraestructura no disponible o fuera de alcance actual).

## Riesgos identificados

- **React Strict Mode (modo desarrollo)**: doble montaje de `useEffect` podría duplicar temporalmente el loop, los listeners de teclado o el `ResizeObserver` de ambos canvases. Mitigación: verificar en `npm run dev` que no haya doble velocidad de caída ni inputs duplicados, y que el cleanup remueva listeners/RAF/observer correctamente.
- **Renders excesivos por callbacks a alta frecuencia**: si `onScoreChange`/`onLinesChange`/`onLevelChange` se invocan en cada frame, el HUD re-renderiza innecesariamente. Mitigación: invocar solo cuando el valor cambia respecto al anterior, igual que en `Asteroides.tsx`.
- **Canvas responsive con grilla discreta (10×20)**: a diferencia de Asteroides (mundo continuo escalado por `ctx.scale`), Tetris depende de un tamaño de celda (`BLOCK`) entero/consistente; un resize mal manejado puede desalinear el grid o el ghost piece respecto al tablero lógico. Mitigación: mantener `COLS`/`ROWS` fijos y recalcular `BLOCK` (y el tamaño del mini-canvas) a partir del tamaño real del contenedor en cada resize, sin tocar la matriz `board`.
- **Generalización de `lib/leaderboard.ts` y de `/juego/[id]`/`/salon-fama`**: el refactor del paso 4/6/7 toca el camino que ya usa Asteroides en producción; un error de signatura o de filtrado por `gameId` podría romper silenciosamente su leaderboard. Mitigación: tras el refactor, verificar `/juego/asteroides` y la pestaña ASTEROIDES de `/salon-fama` antes de continuar, antes de aplicar la migración de `"tetris"`.
- **Tecla `P` y botón PAUSA pueden desincronizarse**: si el usuario pulsa `P` justo cuando `paused` cambia por el botón en el mismo frame, `onTogglePause` podría revertir un cambio reciente (estado `paused` un frame desfasado dentro del motor). Mitigación: aceptado como riesgo menor de UX (un toggle de más se corrige con la siguiente pulsación); no requiere lógica adicional de sincronización.
