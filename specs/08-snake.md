# 08 — Snake: motor jugable + catálogo de games en Supabase

**Estado:** Aprobado
**Dependencias:** [01-pantallas-visuales](01-pantallas-visuales.md) (Reproductor `/juego/[id]/jugar`, HUD, modal de fin de juego),
[05-asteroides](05-asteroides.md) (patrón de port de motor + integración en GamePlayer),
[06-leaderboard-asteroides-supabase](06-leaderboard-asteroides-supabase.md) y
[07-engranajes](07-engranajes.md) (tablas `games`/`scores`, `lib/leaderboard.ts` generalizado)
**Fecha:** 2026-06-12

**Objetivo:** Ampliar el esquema de `games` en Supabase con las columnas de catálogo (`short`/`long`/`cat`/`cover`/`color`/`best`/`plays`), completar las filas existentes (`asteroides`, `tetris`) con esos datos, agregar `"snake"` con un motor jugable desde cero (grid + sprites de fruta de `snake-assets`) y leaderboard real (vacío), y hacer que `/biblioteca`, `/juego/[id]`, `/juego/[id]/jugar`, `GamePlayer` y `/salon-fama` lean el catálogo desde `games` en vez de `GAMES`/`lib/data.ts`.

## Alcance

**Incluye:**

- **Migración SQL** (`apply_migration`):
  - `ALTER TABLE games ADD COLUMN`: `short text`, `long text`, `cat text`, `cover text`, `color text`, `best integer`, `plays text`.
  - `UPDATE games` para `"asteroides"` y `"tetris"` con sus valores actuales (copiados literal de `GAMES` en `lib/data.ts`).
  - `INSERT` de la fila `"snake"` con todos los campos de catálogo. **Sin** seed en `scores` (leaderboard vacío).
- **Nuevo `lib/games.ts`**: `getGames(supabase): Promise<Game[]>` y `getGame(supabase, id): Promise<Game | null>`, mapeando filas de `games` al shape `Game` (reutilizando el `interface Game` de `lib/data.ts`).
- **`app/biblioteca/page.tsx`**: pasa a obtener la lista de juegos vía `getGames` (cliente Supabase, patrón `useEffect` como `/salon-fama`), búsqueda/filtro por `cat`/título sobre esa lista (3 juegos: ASTEROIDES, TETRIS, SNAKE). `CATS` sigue viniendo de `lib/data.ts` (solo es la lista de chips de filtro).
- **`app/juego/[id]/page.tsx`** y **`app/juego/[id]/jugar/page.tsx`**: usan `getGame(supabase, id)` en vez de `GAMES.find`; `notFound()` si no existe en `games`.
- **`app/salon-fama/page.tsx`**: las pestañas se generan desde `getGames(supabase)` (3 pestañas) en vez de `GAMES.map`; todas usan `getGameScores` (real, SNAKE puede estar vacío).
- **Nueva clase CSS `.cover-anaconda`** en `app/globals.css`.
- **Copia de `fruits.png`** (de `references/source-assets/snake-assets/`) a `public/`.
- **Nuevo componente `app/components/games/Snake.tsx`**: motor grid-based desde cero, sprites de fruta, controles de flechas, "Longitud" + nivel/velocidad cada N frutas, game over al chocar con borde o cola propia.
- **`app/components/GamePlayer.tsx`**: generaliza `isAsteroides`/`isTetris` añadiendo `isSnake`; HUD "Vidas"→"Longitud" para snake; `PAUSA`/`FIN`/`JUGAR DE NUEVO`/`SALIR` conectados al motor; "GUARDAR PUNTUACIÓN" → `saveGameScore(supabase, "snake", ...)`.

**No incluye:**

- Migrar las ~8 entradas restantes de `GAMES` a `games` (quedan inaccesibles vía `/juego/[id]`/`/biblioteca`/`/salon-fama`, pero `GAMES`/`Game`/`PLAYERS`/`seededScores`/`CATS` permanecen en `lib/data.ts` sin borrarse, por si una spec futura las retoma).
- Controles táctiles/WASD, audio, autenticación real.
- Wrap-around toroidal (game over al chocar con cualquier borde, igual que con la propia cola).
- Seed de `scores` para `"snake"`, anti-cheat, rate limiting, edición/borrado, paginación, refresco en tiempo real, recalcular `best`/`plays` desde `scores`.
- Tests automatizados.

## Modelo de datos

**Migración SQL** (`apply_migration`):

```sql
alter table public.games
  add column short text,
  add column long text,
  add column cat text,
  add column cover text,
  add column color text,
  add column best integer,
  add column plays text;

update public.games set
  short = 'Esquiva y destruye un campo de asteroides infinito.',
  long = 'Pilotas una nave triangular a la deriva en un campo toroidal de rocas espaciales. Dispara para fragmentar los asteroides grandes en trozos cada vez más pequeños, recoge el power-up de disparo triple y sobrevive oleada tras oleada. Tres vidas, cero margen de error.',
  cat = 'SHOOTER',
  cover = 'cover-asteroides',
  color = 'cyan',
  best = 38500,
  plays = '1.8K'
where id = 'asteroides';

update public.games set
  short = 'El clásico de las piezas que caen: encaja, gira y limpia líneas.',
  long = 'El tablero vertical de 10x20 recibe las siete piezas clásicas, más una pieza extra en forma de tuerca como guiño mecánico. Gíralas con wall-kicks, usa la pieza fantasma para planificar la caída y completa filas enteras para que desaparezcan, mientras la velocidad aumenta sin piedad cada 10 líneas. Una pieza atascada en lo alto y el mecanismo se detiene para siempre.',
  cat = 'PUZZLE',
  cover = 'cover-tetris',
  color = 'yellow',
  best = 215000,
  plays = '2.3K'
where id = 'tetris';

alter table public.games
  alter column short set not null,
  alter column long set not null,
  alter column cat set not null,
  alter column cover set not null,
  alter column color set not null,
  alter column best set not null,
  alter column plays set not null;

insert into public.games (id, title, short, long, cat, cover, color, best, plays) values (
  'snake',
  'SNAKE',
  'Crece comiendo fruta sin chocar con nada — ni contigo mismo.',
  'Una serpiente de píxeles recorre una grilla de neón devorando frutas digitalizadas de un viejo cartucho. Cada bocado la alarga, acelera el juego y sube de nivel. Un giro de más contra el borde o tu propia cola, y el run termina ahí mismo.',
  'ARCADE',
  'cover-anaconda',
  'magenta',
  11400,
  '3.6K'
);
```

No se inserta seed en `scores` para `"snake"` — el leaderboard arranca vacío.

**Nuevo `lib/games.ts`** (reutiliza `interface Game` de `lib/data.ts`, sin tipos nuevos):

```typescript
export async function getGames(supabase: SupabaseClient): Promise<Game[]>;
// select * from games order by created_at asc; mapea cada fila al shape Game
// (cast de `cat`/`color` a los union types de Game)

export async function getGame(
  supabase: SupabaseClient,
  id: string,
): Promise<Game | null>;
// select * from games where id = id; null si no existe
```

**Nueva clase CSS `.cover-anaconda`** en `app/globals.css`: gradiente de fondo oscuro con acento magenta (paralelo a `.cover-snake` pero en magenta en vez de verde/cyan) — grilla de neón + un punto/fruta como elemento distintivo, para diferenciarse visualmente de `"serpentina"`.

**Copia de asset**: `references/source-assets/snake-assets/fruits.png` → `public/snake-assets/fruits.png`. `sprites.js` se usa solo como referencia de coordenadas (no se copia tal cual; sus coordenadas del atlas de frutas se portan como una constante `FRUITS` dentro de `Snake.tsx`).

**Props del componente del motor** (`app/components/games/Snake.tsx`):

```typescript
export interface SnakeProps {
  paused: boolean; // true = el loop interno no actualiza ni dibuja nuevos frames
  resetSignal: number; // al incrementarse, reinicia la serpiente desde cero
  endSignal: number; // al incrementarse, fuerza game over inmediato (botón FIN)
  onScoreChange: (score: number) => void;
  onLengthChange: (length: number) => void; // sustituye a "Vidas" en el HUD
  onLevelChange: (level: number) => void; // floor(frutas/5)+1
  onGameOver: () => void; // se dispara al chocar con borde o con su propia cola
}
```

**Diseño del motor** (encapsulado en `Snake.tsx`, mismo patrón de `useEffect`+cleanup que `Asteroides.tsx`/`Tetris.tsx`):

- Grid lógico fijo `COLS=24` × `ROWS=18` (proporción 4:3, igual que `.crt-screen`); `BLOCK` (tamaño de celda en px) se recalcula al tamaño real del contenedor en cada resize, sin tocar la matriz del juego.
- Serpiente inicial: 3 segmentos horizontales centrados, moviéndose a la derecha.
- Comida: una celda libre aleatoria; sprite elegido al azar entre las frutas del atlas (`fruits.png`/coordenadas portadas de `sprites.js`), dibujado con `ctx.drawImage` escalado a `BLOCK`.
- Cada fruta comida: `score += 10 * level`, `length += 1`, se reposiciona la comida; cada 5 frutas, `level += 1` y el intervalo de movimiento (`moveInterval`) disminuye (más velocidad), con un mínimo (`60ms`).
- Colisión con cualquier borde del grid o con su propia cola → `onGameOver()` (sin wrap-around).
- Controles: `←↑→↓` cambian la dirección (ignorando giros de 180° instantáneos sobre sí misma), con `preventDefault`.

## Plan de implementación

1. **Aplicar la migración** (`apply_migration`): añade las columnas de catálogo a `games`, rellena `"asteroides"`/`"tetris"` con sus datos actuales, las marca `not null`, e inserta la fila `"snake"` (sin seed en `scores`). Sin cambios de código todavía — `/biblioteca`, `/juego/[id]` y `/salon-fama` siguen funcionando igual que hoy (vía `GAMES`).

2. **Crear `lib/games.ts`** con `getGames(supabase)` y `getGame(supabase, id)`, mapeando filas de `games` al shape `Game`. Aún no se usa en ninguna página — el sistema sigue funcional.

3. **Añadir `.cover-anaconda`** en `app/globals.css`, y modificar `app/juego/[id]/page.tsx` y `app/juego/[id]/jugar/page.tsx` para usar `getGame(supabase, id)` en vez de `GAMES.find`, con `notFound()` si la fila no existe en `games`. Tras este paso: `/juego/asteroides`, `/juego/tetris` y `/juego/snake` (y sus `/jugar`) funcionan vía Supabase — `/juego/snake` muestra portada `.cover-anaconda`, descripción y leaderboard vacío (vía `getGameScores`, ya incluido en `getRealGameIds`); `/juego/snake/jugar` aún muestra el Reproductor simulado (mock) porque `GamePlayer` no reconoce `"snake"` todavía. El resto de `id` de `GAMES` que no están en `games` ahora dan 404 en estas dos rutas (efecto esperado, documentado en Alcance).

4. **Modificar `app/biblioteca/page.tsx`**: obtiene la lista vía `getGames(createClient())` en un `useEffect` (estado inicial `[]`, patrón igual a `/salon-fama`), y filtra esa lista por `cat`/título en vez de `GAMES`. `CATS` sigue viniendo de `lib/data.ts` (solo es la lista de chips). Tras este paso, `/biblioteca` muestra 3 cards (ASTEROIDES, TETRIS, SNAKE), todas navegables correctamente gracias al paso 3.

5. **Modificar `app/salon-fama/page.tsx`**: en un `useEffect` al montar, obtiene `getGames(createClient())` y genera las pestañas desde ese resultado (3: ASTEROIDES, TETRIS, SNAKE) en vez de `GAMES.map`; la pestaña por defecto es la primera de esa lista. Todas usan `getGameScores` (SNAKE puede mostrarse vacío hasta la primera partida guardada).

6. **Crear `app/components/games/Snake.tsx`**: copiar `fruits.png` a `public/snake-assets/`, portar el atlas de frutas (constante `FRUITS`, coordenadas tomadas de `sprites.js`), e implementar el motor grid `24×18` con loop propio (`requestAnimationFrame`), listeners de teclado (`←↑→↓` con `preventDefault`), `SnakeProps` (`paused`/`resetSignal`/`endSignal`, emite `onScoreChange`/`onLengthChange`/`onLevelChange`/`onGameOver`), progresión de nivel/velocidad cada 5 frutas, y cleanup completo en `useEffect`. El componente aún no se usa en ninguna página — el sistema sigue funcional igual que en el paso 5.

7. **Modificar `app/components/GamePlayer.tsx`**: generaliza `isAsteroides`/`isTetris` añadiendo `isSnake = game.id === "snake"`; renderiza `<Snake />` dentro de `.game-arena` con estado React (`snkScore`, `snkLength`, `snkLevel`) sincronizado vía callbacks. En el `player-hud`, el stat "Vidas" se sustituye por "Longitud" cuando `isSnake` (igual patrón que "Líneas" de Tetris). `PAUSA/REANUDAR` alterna `paused`; `FIN` incrementa `endSignal`; `JUGAR DE NUEVO` incrementa `resetSignal` y resetea `snkScore`/`snkLength`/`snkLevel`; `SALIR` navega a `/juego/snake` sin cambios de patrón. "GUARDAR PUNTUACIÓN" para `"snake"` llama a `saveGameScore(createClient(), "snake", name, displayScore)`. Para Asteroides/Tetris y el resto, sin cambios de comportamiento.

8. **Verificación final**: `npm run lint` y `npm run build` sin errores; recorrido manual — `/biblioteca` muestra 3 cards (ASTEROIDES, TETRIS, SNAKE) y los filtros de búsqueda/categoría funcionan sobre ellas; `/juego/asteroides` y `/juego/tetris` siguen mostrando su leaderboard real sin regresión; `/juego/snake` muestra portada, descripción y leaderboard vacío; `/juego/snake/jugar` renderiza el canvas de Snake jugable (mover con flechas, comer fruta con sprite, crecer, subir nivel/velocidad cada 5 frutas, game over al chocar con borde o cola); HUD refleja `score`/"Longitud"/nivel en tiempo real; PAUSA/REANUDAR/FIN/JUGAR DE NUEVO/SALIR funcionan; GUARDAR PUNTUACIÓN inserta en `scores` (`game_id: "snake"`) y aparece tras recargar en `/juego/snake` y en la pestaña SNAKE de `/salon-fama` (junto con las pestañas ASTEROIDES/TETRIS funcionando igual que antes).

## Criterios de aceptación

- [ ] La migración añade a `games` las columnas `short`, `long`, `cat`, `cover`, `color`, `best`, `plays` (todas `not null` tras el backfill), rellena `"asteroides"`/`"tetris"` con sus valores actuales de `lib/data.ts`, e inserta la fila `"snake"` con todos los campos; `scores` no recibe seed para `"snake"`.
- [ ] `lib/games.ts` exporta `getGames(supabase)` y `getGame(supabase, id)`, devolviendo objetos con el shape `Game`.
- [ ] `app/globals.css` define `.cover-anaconda` y se ve correctamente como portada de "SNAKE".
- [ ] `/biblioteca` muestra exactamente 3 cards (ASTEROIDES, TETRIS, SNAKE), leídas de `getGames(supabase)`; el buscador por título y los chips de categoría (`CATS`) filtran correctamente sobre esas 3.
- [ ] `/juego/asteroides` y `/juego/tetris` siguen mostrando portada, descripción, stat-strip y leaderboard real (sin regresión), ahora vía `getGame`/`getGameScores`.
- [ ] `/juego/snake` muestra portada `.cover-anaconda`, `short`/`long` de la fila `"snake"`, stat-strip con su `best`/`plays`, y un leaderboard vacío (sin filas, hasta la primera partida guardada).
- [ ] Cualquier `id` de `GAMES` que no exista en `games` da `notFound()` en `/juego/[id]` y `/juego/[id]/jugar`.
- [ ] `/salon-fama` muestra exactamente 3 pestañas (ASTEROIDES, TETRIS, SNAKE) generadas desde `getGames`; ASTEROIDES y TETRIS siguen mostrando podio/tabla reales sin regresión; SNAKE muestra podio/tabla vacíos hasta que haya puntuaciones.
- [ ] `/juego/snake/jugar` renderiza un `<canvas>` jugable de grid 24×18 dentro de `.crt-screen`, en lugar del arena mock.
- [ ] Controles de teclado funcionan: `←↑→↓` cambian la dirección de la serpiente (sin permitir giro de 180° instantáneo) y no provocan scroll de página.
- [ ] La comida se dibuja con sprites de fruta tomados de `fruits.png`/atlas portado, eligiendo una fruta al azar cada vez que se genera nueva comida.
- [ ] Al comer una fruta: la serpiente crece un segmento, `score += 10 * level`, y aparece nueva comida en una celda libre.
- [ ] Cada 5 frutas comidas, `level += 1` y la velocidad de movimiento aumenta (hasta un mínimo de intervalo).
- [ ] Chocar con cualquier borde del grid o con la propia cola dispara `onGameOver()` y abre el modal de fin de juego existente con la puntuación final real.
- [ ] El HUD de React (`player-hud`) refleja en tiempo real `score`, "Longitud" (en lugar de "Vidas") y `level` del motor de Snake.
- [ ] Botón **PAUSA** detiene el juego y muestra el overlay "EN PAUSA"; **REANUDAR** lo continúa.
- [ ] Botón **FIN** fuerza game over inmediato con la puntuación actual y abre el modal de fin de juego.
- [ ] Botón "JUGAR DE NUEVO" reinicia el motor (serpiente de 3 segmentos, score 0, longitud inicial, nivel 1) y cierra el modal.
- [ ] Botón "SALIR" navega a `/juego/snake`, deteniendo el loop y removiendo los listeners de teclado (sin fugas al reentrar).
- [ ] En el Reproductor de SNAKE, introducir iniciales y pulsar "GUARDAR PUNTUACIÓN" inserta una fila en `scores` (`game_id: "snake"`) y muestra el toast "PUNTUACIÓN GUARDADA"; tras recargar `/juego/snake` o la pestaña SNAKE de `/salon-fama`, la puntuación aparece en el leaderboard.
- [ ] `npm run lint` y `npm run build` finalizan sin errores.

## Decisiones tomadas y descartadas

- **Ampliar `games` con todas las columnas de catálogo y migrar `/biblioteca`, `/juego/[id]`, `GamePlayer` y `/salon-fama` a leer desde ahí, en vez de mantener un branch `GAMES.find(...) ?? getGame(...)`**: se descarta la fusión de fuentes (mock + Supabase) porque dejaría el catálogo en dos sistemas paralelos permanentemente. Migrar el _shape_ completo a `games` ahora deja `/biblioteca`/`/salon-fama` con una sola fuente de verdad, al costo de que las ~8 entradas de `GAMES` sin fila en `games` queden temporalmente inaccesibles vía rutas — efecto aceptado explícitamente.
- **Backfill de `"asteroides"`/`"tetris"` con sus datos completos de catálogo, en vez de dejarlos solo con `id`/`title`**: necesario para que `/biblioteca` y `/salon-fama` puedan tratar a los 3 juegos (`asteroides`, `tetris`, `snake`) de forma uniforme con `getGames`, sin condicionales especiales para los dos primeros.
- **`GAMES`, `Game`, `PLAYERS`, `seededScores`, `CATS` permanecen en `lib/data.ts` sin eliminarse**: `CATS` se sigue usando para los chips de filtro de `/biblioteca`; `PLAYERS`/`seededScores`/el resto de `GAMES` quedan sin consumidores activos tras esta spec, pero borrarlos está fuera de alcance (podrían retomarse si una spec futura migra el resto del catálogo).
- **Nueva entrada `"snake"` separada de `"serpentina"`**: mismo criterio que asteroides/rocas y tetris/caída — no se toca `"serpentina"` (mock, sin relación con esta spec).
- **Nombre genérico `"snake"`/SNAKE en vez de un nombre temático en español**: paralelo a la decisión ya tomada para Tetris (nombre universalmente reconocido del género en vez de un alias). `"serpentina"` se queda con su naming temático propio.
- **Color magenta y `.cover-anaconda` nuevo (no reusar `.cover-snake`)**: magenta era el color menos saturado del catálogo y diferencia visualmente a "SNAKE" de "SERPENTINA" (verde) en `/biblioteca`.
- **Motor construido desde cero, sin `references/started-games`**: no existe puerto de Snake en esa carpeta; los `snake-assets` (`fruits.png`/`sprites.js`) son solo gráficos de fruta, que se integran como sprites de comida. El cuerpo/cabeza de la serpiente se dibuja con formas de canvas en el estilo neón del proyecto (sin sprite propio).
- **Game over al chocar con cualquier borde (sin wrap-around)**: se descarta el comportamiento toroidal de Asteroides porque el snake clásico (incluido el de referencia "googlesnakegame" de donde vienen los sprites) usa paredes sólidas; mantiene la tensión característica del género.
- **"Longitud" sustituye a "Vidas" en el HUD, nivel cada 5 frutas**: mismo criterio que "Líneas" en Tetris — Snake no tiene concepto nativo de "vidas" (una colisión termina la partida), y la longitud es la métrica de progreso más natural.
- **Controles solo de flechas, sin WASD**: se mantiene el patrón minimalista de Asteroides/Tetris (un solo esquema de control por juego, sin alternativas).
- **Sin seed de `scores` para `"snake"`**: a diferencia de asteroides/tetris (que arrancaron con 10 filas de seed), se decide explícitamente lanzar con la tabla vacía para este juego; el leaderboard se llena solo con partidas reales.
- **`/salon-fama` con pestañas desde `getGames` (3) en vez de `GAMES.map` (10)**: consistencia con `/biblioteca` — todas las pantallas de catálogo comparten la misma fuente (`games`), evitando que `"snake"` quede sin pestaña por no estar en `GAMES`.
- **Sin controles táctiles, audio, autenticación, anti-cheat ni recálculo de `best`/`plays`**: mismas exclusiones que las specs 05/06/07, por las mismas razones (alcance acotado, infraestructura no disponible).

## Riesgos identificados

- **Migración sobre `games` en producción afecta juegos ya en uso**: el `ALTER`/`UPDATE` sobre `"asteroides"`/`"tetris"` toca el camino que ya sirve sus leaderboards reales. Mitigación: tras la migración (paso 1) y antes de tocar código (paso 3), verificar con `list_tables`/`execute_sql` que ambas filas quedaron con los valores correctos; tras el paso 3, verificar `/juego/asteroides` y `/juego/tetris` antes de continuar con `/biblioteca`/`/salon-fama`.
- **Regresión visible en `/biblioteca` y `/salon-fama`**: tras los pasos 4 y 5, las ~8 entradas de `GAMES` sin fila en `games` dejan de aparecer en ambas pantallas (efecto aceptado y documentado, pero es un cambio visible importante del catálogo). Si se detecta que algo dependía de esas entradas (links externos, otras páginas), habría que revisarlo aparte.
- **React Strict Mode (modo desarrollo)**: doble montaje de `useEffect` podría duplicar temporalmente el loop o los listeners de teclado de `Snake.tsx`. Mitigación: verificar en `npm run dev` que no haya doble velocidad de movimiento ni inputs duplicados, y que el cleanup remueva listeners/RAF correctamente — mismo patrón que `Asteroides.tsx`/`Tetris.tsx`.
- **Canvas responsive con grilla discreta 24×18**: igual que en Tetris, un resize mal manejado puede desalinear el grid o la posición de la comida respecto al tablero lógico. Mitigación: mantener `COLS`/`ROWS` fijos y recalcular solo `BLOCK` a partir del tamaño real del contenedor.
- **Carga asíncrona de `fruits.png`**: el sprite de fruta puede no estar listo en los primeros frames del loop. Mitigación: cargar la imagen una vez al montar (`Image()` + `onload`) y, mientras no esté lista, dibujar la comida con un placeholder simple (rectángulo de color) hasta que el sprite esté disponible.
- **Renders excesivos por callbacks a alta frecuencia**: si `onScoreChange`/`onLengthChange`/`onLevelChange` se invocan en cada frame, el HUD re-renderiza innecesariamente. Mitigación: invocar solo cuando el valor cambia respecto al anterior, igual que en `Asteroides.tsx`/`Tetris.tsx`.
- **`getGames` y orden de pestañas/cards**: si `games` crece en el futuro, el orden (`order by created_at asc`) determinará el orden de cards/pestañas. No es un problema ahora (3 filas con orden conocido: asteroides, tetris, snake), pero conviene tenerlo en cuenta si se agregan más juegos.
