# 01 — CONEXIÓN: motor jugable + entrada de catálogo + integración en GamePlayer

**Estado:** Borrador
**Dependencias:** [01-pantallas-visuales](../../01-pantallas-visuales.md) (Reproductor `/juego/[id]/jugar`, HUD, modal de fin de juego), [05-asteroides](../../05-asteroides.md) (patrón de port + integración en GamePlayer), [08-snake](../../08-snake.md) (catálogo en tabla `games` de Supabase, `.cover-<id>`, branch `is<Nombre>` en GamePlayer)
**Fecha:** 2026-06-17

**Objetivo:** Añadir el juego `"conexion"` (puzzle tipo Flow Free: unir pares de nodos del mismo color trazando caminos que no se crucen hasta llenar la cuadrícula) como fila en la tabla `games`, con un motor jugable en canvas desde cero y su integración en `GamePlayer`.

## Alcance

**Incluye:**

- **Fila nueva en la tabla `games`** de Supabase (vía `apply_migration`): `id: "conexion"`, `title: "CONEXIÓN"`, `cat: "PUZZLE"`, `cover: "cover-cables"`, `color: "cyan"`, con `short`/`long`/`best`/`plays` en el tono retro-gamer del catálogo. Solo `insert` en `games`; **sin** `create table` ni RLS (ya existen).
- **Nueva clase CSS `.cover-cables`** en `app/globals.css`: portada con fondo oscuro y acento cyan, evocando nodos conectados por cables de neón (sin escribir aquí el CSS completo, solo descrito).
- **Nuevo componente `app/components/games/Conexion.tsx`** (client component): motor de puzzle grid-based desde cero (canvas responsive sobre `.crt-screen`, proporción 4:3), con un set fijo de niveles predefinidos (tableros con pares de nodos), trazado de caminos por arrastre, validación de "sin cruces" y detección de tablero completo. Loop de render por `requestAnimationFrame` o redibujo por evento, encapsulado en un `useEffect` con limpieza completa de listeners y `cancelAnimationFrame` al desmontar.
- **Integración en `app/components/GamePlayer.tsx`**: branch `isConexion = game.id === "conexion"` siguiendo el patrón de `isSnake`/`isTetris`; render condicional de `<Conexion />` dentro de `.game-arena`; HUD con el stat "Pares" (pares conectados / total) en lugar de "Vidas"; `level` proveniente del motor (número de puzzle actual); botones `PAUSA`/`FIN`/`JUGAR DE NUEVO`/`SALIR` conectados al motor vía `paused`/`endSignal`/`resetSignal`.
- **Controles**: arrastre con ratón/puntero (pointer events) para trazar el camino desde un nodo; además **controles de teclado** (`←↑→↓` mueven el cursor de trazado desde el nodo seleccionado, `Enter`/`Espacio` selecciona el nodo bajo el cursor, `Backspace` borra el camino del color activo), con `preventDefault` en las flechas, `Espacio` y `Backspace` para evitar scroll/navegación de página.

**No incluye:**

- Persistencia del leaderboard ni el cableado de "GUARDAR PUNTUACIÓN" → eso va en `02-conexion-leaderboard.md`. En esta spec, "GUARDAR PUNTUACIÓN" sigue mostrando solo el toast (sin escritura en BD), igual que para los juegos mock.
- Seed de `scores` para `"conexion"` (va en `02-…`).
- Generación procedural de tableros: los niveles son un set fijo predefinido dentro del componente.
- Controles táctiles dedicados más allá de los pointer events ya descritos, audio, autenticación, anti-cheat ni tests automatizados.
- Refactor/generalización de `lib/games.ts`, `lib/leaderboard.ts`, `/juego/[id]`, `/salon-fama` o `/biblioteca` — ya son data-driven contra `games`; esta spec solo **añade** una fila.
- Cambios a los demás juegos del catálogo (siguen igual).

## Modelo de datos

**Fila nueva en `games`** (`apply_migration`):

```sql
insert into public.games (id, title, short, long, cat, cover, color, best, plays) values (
  'conexion',
  'CONEXIÓN',
  'Une los nodos por color sin cruzar un solo cable.',
  'Una placa de circuito de neón espera energía. Une cada par de nodos del mismo color trazando cables que jamás se cruzan, y llena la rejilla por completo para cerrar el circuito. Cada tablero resuelto desbloquea otro más enrevesado: más colores, menos espacio, cero margen para un cruce.',
  'PUZZLE',
  'cover-cables',
  'cyan',
  9800,
  '2.1K'
);
```

No se usa `create table` ni RLS (las tablas `games`/`scores` ya existen). No se modifica el `interface Game` de `lib/data.ts` (la fila reutiliza ese shape).

**Nueva clase CSS `.cover-cables`** en `app/globals.css`: gradiente oscuro con acento cyan (paralelo a `.cover-snake`/`.cover-anaconda`), dibujando con `background-image` unos nodos (círculos de neón) unidos por segmentos en ángulo recto, para sugerir "cables conectados" y diferenciarse de las demás portadas PUZZLE.

**Props del componente del motor** (`app/components/games/Conexion.tsx`):

```typescript
export interface ConexionProps {
  paused: boolean; // true = el motor ignora input y no avanza
  resetSignal: number; // al incrementarse, reinicia al primer puzzle desde cero
  endSignal: number; // al incrementarse, fuerza game over inmediato (botón FIN)
  onScoreChange: (score: number) => void;
  onPairsChange: (connected: number, total: number) => void; // sustituye a "Vidas" en el HUD
  onLevelChange: (level: number) => void; // número de puzzle actual (1-based)
  onGameOver: () => void; // se dispara con el botón FIN (o al agotar la lista de puzzles)
}
```

**Estado interno del motor** (encapsulado en `Conexion.tsx`, mismo patrón `useEffect`+cleanup que `Snake.tsx`/`Asteroides.tsx`):

```typescript
// Un puzzle predefinido: cuadrícula NxN con pares de nodos por color.
interface Puzzle {
  size: number; // p.ej. 5, 6, 7 (cuadrícula cuadrada)
  // pares de endpoints; cada color aparece exactamente dos veces
  endpoints: { color: number; r: number; c: number }[];
}

// Estado mutable del run:
// - puzzleIndex: índice en la lista fija de puzzles (0-based; level = puzzleIndex+1)
// - paths: Map<color, Array<{r,c}>> caminos trazados por color
// - score acumulado, pares conectados del puzzle actual
```

**Diseño del motor:**

- Lista fija de puzzles (constante `PUZZLES` dentro del componente), ordenados de menor a mayor dificultad (más colores, mayor `size`). Empieza en `5×5`.
- `BLOCK` (tamaño de celda en px) se recalcula al tamaño real del contenedor en cada resize; la matriz lógica (`size`, `endpoints`) no cambia.
- Trazado: al arrastrar desde un nodo (o pulsar `Enter`/`Espacio` sobre él), se extiende el camino de ese color celda a celda por celdas adyacentes (orto­gonales). Un camino no puede pasar por una celda ya ocupada por **otro** color (regla "sin cruces"); si entra en una celda de su propio camino, lo recorta hasta ahí.
- Conectar un par: cuando el camino de un color toca su segundo endpoint, ese par queda **conectado**; `onPairsChange(connected, total)` se actualiza.
- **Tablero completo**: cuando todos los pares están conectados **y** todas las celdas de la rejilla están cubiertas, el puzzle se considera resuelto: `score += 100 * size` (bonus por tamaño), `puzzleIndex += 1`, `onLevelChange(puzzleIndex+1)`, se carga el siguiente puzzle. Si era el último de la lista, se dispara `onGameOver()` (run completado).
- **Puntuación**: además del bonus por puzzle resuelto, cada par conectado suma `+10`; cruzar/recortar no penaliza (puzzle, no arcade de reflejos).
- `paused` congela todo el input; `endSignal` fuerza `onGameOver()` con el score actual; `resetSignal` vuelve a `puzzleIndex = 0`, score 0, caminos vacíos.

## Plan de implementación

1. **Aplicar la migración** (`apply_migration`): `insert` de la fila `"conexion"` en `games` con todos los campos de catálogo. Sin cambios de código. Tras este paso, `/biblioteca` muestra una 4ª card (CONEXIÓN), `/juego/conexion` muestra portada/descripción/leaderboard (vacío vía el camino genérico `getGameScores`) y `/juego/conexion/jugar` usa todavía el Reproductor mock; `/salon-fama` añade una pestaña CONEXIÓN. La portada se ve sin estilo hasta el paso 2.

2. **Añadir `.cover-cables`** en `app/globals.css`. Tras este paso, la card y el detalle de CONEXIÓN muestran su portada de neón. El sistema sigue funcional; `/juego/conexion/jugar` sigue mostrando el mock.

3. **Crear `app/components/games/Conexion.tsx`**: definir la constante `PUZZLES` (lista fija de tableros), implementar el motor grid con canvas responsive (recalcula `BLOCK` al contenedor `.crt-screen`, 4:3), el trazado por pointer events y por teclado (`←↑→↓`/`Enter`/`Espacio`/`Backspace` con `preventDefault` donde corresponde), la validación "sin cruces", la detección de par conectado y de tablero completo, y la `ConexionProps` (recibe `paused`/`resetSignal`/`endSignal`, emite `onScoreChange`/`onPairsChange`/`onLevelChange`/`onGameOver`), con cleanup completo en el `useEffect`. El componente aún no se usa en ninguna página — el sistema sigue funcional igual que en el paso 2.

4. **Modificar `app/components/GamePlayer.tsx`**: añadir `isConexion = game.id === "conexion"` y estado local (`cnxScore`, `cnxConnected`, `cnxTotal`, `cnxLevel`); render condicional de `<Conexion />` dentro de `.game-arena`; en `displayScore`/`level` añadir el branch de conexion; en el `player-hud`, el stat "Vidas" se sustituye por "Pares" (mostrando `cnxConnected/cnxTotal`) cuando `isConexion` (mismo patrón que "Líneas"/"Longitud"); `level` viene del motor. `PAUSA/REANUDAR` alterna `paused`; `FIN` incrementa `endSignal`; `JUGAR DE NUEVO` incrementa `resetSignal` y resetea el estado local de conexion; `SALIR` navega a `/juego/conexion`. "GUARDAR PUNTUACIÓN" para conexion sigue siendo solo visual en esta spec (se conecta a Supabase en `02-…`). El resto de juegos, sin cambios.

5. **Verificación final**: `npm run lint` y `npm run build` sin errores; recorrido manual — `/biblioteca` muestra 4 cards y los filtros (búsqueda + chip PUZZLE) incluyen CONEXIÓN; `/juego/conexion` muestra portada `.cover-cables`, descripción y stat-strip con su `best`/`plays`; `/juego/conexion/jugar` renderiza el canvas jugable; se puede trazar un camino arrastrando desde un nodo y con teclado, no se permite cruzar otro color, conectar todos los pares y cubrir la rejilla avanza al siguiente puzzle; el HUD refleja score, "Pares" y nivel en tiempo real; PAUSA/REANUDAR/FIN/JUGAR DE NUEVO/SALIR funcionan; los demás juegos siguen sin regresión.

## Criterios de aceptación

- [ ] La migración inserta en `games` la fila `"conexion"` con `id`, `title`, `short`, `long`, `cat: "PUZZLE"`, `cover: "cover-cables"`, `color: "cyan"`, `best` y `plays`; no se ejecuta `create table` ni RLS.
- [ ] `app/globals.css` define `.cover-cables` y la card de CONEXIÓN se ve correctamente en `/biblioteca` y `/juego/conexion`.
- [ ] `/biblioteca` muestra CONEXIÓN como una card más, filtrable por el chip `PUZZLE` y por búsqueda de título.
- [ ] `/juego/conexion` muestra portada, `short`/`long`, stat-strip con su `best`/`plays` y el leaderboard por el camino genérico (vacío hasta `02-…`).
- [ ] `/juego/conexion/jugar` renderiza un `<canvas>` jugable dentro de `.crt-screen`, en lugar del arena mock.
- [ ] Arrastrando desde un nodo se traza un camino celda a celda por celdas adyacentes ortogonales; soltar fija el camino actual.
- [ ] Controles de teclado funcionan: `←↑→↓` mueven el trazado desde el nodo seleccionado, `Enter`/`Espacio` selecciona el nodo bajo el cursor, `Backspace` borra el camino del color activo; ninguna de estas teclas provoca scroll/navegación de página.
- [ ] Un camino no puede atravesar una celda ocupada por otro color (regla "sin cruces"); entrar en una celda del propio camino lo recorta hasta ahí.
- [ ] Cuando el camino de un color toca su segundo endpoint, ese par cuenta como conectado y el HUD "Pares" se incrementa.
- [ ] Cuando todos los pares están conectados y todas las celdas de la rejilla están cubiertas, el puzzle se resuelve, suma puntos y carga el siguiente puzzle (con `level` incrementado); resolver el último puzzle de la lista dispara `onGameOver()`.
- [ ] El HUD de React refleja en tiempo real `score`, "Pares" (`conectados/total`, en lugar de "Vidas") y `level` (número de puzzle) del motor.
- [ ] Botón **PAUSA** congela el motor y muestra el overlay "EN PAUSA"; **REANUDAR** lo continúa.
- [ ] Botón **FIN** fuerza game over inmediato con la puntuación actual y abre el modal de fin de juego.
- [ ] Botón "JUGAR DE NUEVO" reinicia el motor al primer puzzle (score 0, sin caminos, nivel 1) y cierra el modal.
- [ ] Botón "SALIR" navega a `/juego/conexion`, deteniendo el render y removiendo los listeners (sin fugas al reentrar).
- [ ] El canvas se redimensiona manteniendo proporción 4:3 sin desalinear la rejilla ni los nodos.
- [ ] Los demás juegos del catálogo siguen sin cambios de comportamiento.
- [ ] `npm run lint` y `npm run build` finalizan sin errores.

## Decisiones tomadas y descartadas

- **Sí — `cat: "PUZZLE"`, `color: "cyan"`**: respeta la sugerencia ya registrada (`game-suggestions.md`) y cubre un hueco: dentro de PUZZLE conviven `caída` (magenta) y `tetris` (yellow), faltaba un PUZZLE cyan. Cyan encaja además con la estética "circuito/cable de neón".
- **Sí — `id: "conexion"` / `title: "CONEXIÓN"`**: kebab-case único frente a `games`, `GAMES` y `game-suggestions.md`; título en mayúsculas con tilde, en el tono del catálogo (`CAÍDA`, `INVASORES`).
- **Sí — `cover-cables` nuevo (no reusar otra portada)**: igual criterio que `.cover-anaconda` vs `.cover-snake` — portada propia para diferenciar visualmente la card en `/biblioteca`.
- **Sí — motor desde cero, sin `references/started-games`**: no hay puerto de Flow/Free en esa carpeta (solo asteroids/tetris/arkanoid); el género es simple de implementar como rejilla + trazado.
- **Sí — set fijo de puzzles predefinidos, no generación procedural**: garantiza que todos los tableros tienen solución única conocida y dificultad creciente controlada; generar tableros resolubles al vuelo es un problema mayor, fuera de alcance.
- **Sí — "Pares" (`conectados/total`) sustituye a "Vidas" en el HUD**: mismo criterio que "Líneas" (Tetris) / "Longitud" (Snake) — un puzzle no tiene "vidas"; los pares conectados son la métrica de progreso natural.
- **Sí — `level` = número de puzzle (del motor), no la fórmula `floor(score/2500)+1`**: el avance real del juego es pasar de un tablero al siguiente, igual que Tetris/Snake reportan su nivel propio.
- **Sí — controles de arrastre (pointer) + teclado**: el género es naturalmente de arrastre; se añade un esquema de teclado para mantener jugabilidad sin ratón, coherente con que el resto de motores son jugables por teclado. Sin controles táctiles dedicados más allá de pointer events.
- **No — penalizar cruces/errores con puntos o "vidas"**: se descarta convertirlo en arcade de presión; recortar un camino es parte normal de resolver el puzzle.
- **No — generación procedural, niveles infinitos, pistas/undo global, audio**: fuera de alcance; el run termina al resolver el último puzzle de la lista fija (o con FIN).
- **No — tocar `"caída"`/`"tetris"` ni el resto del catálogo**: la fila `"conexion"` es independiente.

## Riesgos identificados

| Riesgo                                                                                                 | Mitigación                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| React Strict Mode (doble montaje del `useEffect` en dev) duplica listeners de pointer/teclado o el RAF | Cleanup exhaustivo en el `useEffect` (`removeEventListener`, `cancelAnimationFrame`); verificar en `npm run dev` que no haya doble trazado ni doble avance de puzzle. |
| Re-render del HUD por callbacks de alta frecuencia                                                     | Invocar `onScoreChange`/`onPairsChange`/`onLevelChange` solo cuando el valor cambia respecto al anterior, igual que en `Asteroides.tsx`/`Snake.tsx`.                  |
| Canvas responsive con grilla discreta (resize desalinea celdas/nodos respecto al tablero lógico)       | Mantener `size`/`endpoints` fijos y recalcular solo `BLOCK` a partir del tamaño real del contenedor; mapear coordenadas de pointer a celda con ese `BLOCK`.           |
| Mapeo de coordenadas de pointer → celda incorrecto en pantallas con `devicePixelRatio` alto            | Usar `getBoundingClientRect()` del canvas y dividir por `BLOCK` lógico, no por píxeles físicos.                                                                       |
| Orden de cards/pestañas depende de `created_at`                                                        | La fila `"conexion"` se inserta después de las existentes, por lo que aparece al final de `/biblioteca` y `/salon-fama` (efecto esperado, no rompe nada).             |

## Lo que **no** está en esta spec

- Persistencia del leaderboard de CONEXIÓN ni el cableado de "GUARDAR PUNTUACIÓN" (va en `02-conexion-leaderboard.md`).
- Seed de `scores` para `"conexion"` (va en `02-…`).
- Generación procedural de tableros, pistas, deshacer global, audio, controles táctiles dedicados, autenticación, anti-cheat y tests automatizados.

Cada uno de esos, si se aborda, va en su propia spec.
