# 01 — 2048 Neón: motor jugable + entrada de catálogo

**Estado:** Borrador
**Dependencias:** [01-pantallas-visuales](../../01-pantallas-visuales.md) (Reproductor/HUD/modal), [05-asteroides](../../05-asteroides.md) (patrón de port + GamePlayer), [08-snake](../../08-snake.md) (catálogo en tabla `games`)
**Fecha:** 2026-06-23

**Objetivo:** Añadir "2048 NEÓN" al catálogo (`games` en Supabase) y construir desde cero su motor jugable (grilla 4×4, deslizamiento y fusión de fichas) como `app/components/games/Neon2048.tsx`, integrado en `GamePlayer.tsx` con HUD propio ("Mejor ficha" en vez de "Vidas").

## Alcance

**Incluye:**

- Nueva fila `"2048-neon"` en la tabla `games` de Supabase (vía `apply_migration`), con `title`, `short`, `long`, `cat: "PUZZLE"`, `cover: "cover-2048neon"`, `color: "magenta"`, `best`, `plays`.
- Nueva clase CSS `.cover-2048neon` en `app/globals.css` (descrita, no el CSS completo): grilla de fichas numeradas en gradiente neón magenta/violeta, sin reutilizar `.cover-tetris` ni `.cover-anaconda`.
- Nuevo componente `app/components/games/Neon2048.tsx` (client component): motor de cuadrícula `4×4` construido desde cero (sin fuente en `references/started-games`, ya que no hay puerto de 2048 disponible), con dibujo en `<canvas>` (fichas como rectángulos redondeados de color por valor, número centrado).
- Mecánica: al pulsar una dirección, todas las fichas se deslizan hasta el borde correspondiente; fichas adyacentes con el mismo valor en la línea de deslizamiento se fusionan en una sola con el valor duplicado (una sola fusión por ficha y por movimiento, de mayor a menor distancia al borde, igual que el 2048 original); tras cualquier movimiento que cambie la grilla, aparece una ficha nueva (valor `2` con probabilidad 90%, `4` con probabilidad 10%) en una celda vacía aleatoria.
- Fin de partida: cuando la grilla está completamente llena y ningún movimiento en ninguna de las 4 direcciones produciría una fusión ni un desplazamiento.
- Integración en `app/components/GamePlayer.tsx`:
  - Renderizado condicional: `isNeon2048 = game.id === "2048-neon"`; si es true, se monta `<Neon2048 />` dentro de `.game-arena` (mismo patrón que `isSnake`/`isTetris`/`isAsteroides`).
  - El motor expone `score`, `bestTile` (sustituye a "Vidas" en el HUD, bajo la etiqueta "Mejor ficha") y `level` vía callbacks hacia `GamePlayer`, que alimenta el `player-hud` existente.
  - **PAUSA/REANUDAR**: detiene/reanuda el loop de dibujo y el procesamiento de input del motor; reutiliza el overlay "EN PAUSA" existente.
  - **FIN**: fuerza game over inmediato vía `endSignal` (igual que Snake), abriendo el modal de fin de juego existente con la puntuación final real.
  - **SALIR**: navega a `/juego/2048-neon` (comportamiento estándar, dispara el cleanup del componente).
  - **JUGAR DE NUEVO**: incrementa `resetSignal`, reinicia el motor a su estado inicial (grilla vacía con 2 fichas iniciales de valor `2`, score 0, nivel 1).
  - **GUARDAR PUNTUACIÓN**: cableado real a Supabase, descrito en `02-2048-neon-leaderboard.md`.
- Controles de teclado: `←`/`→`/`↑`/`↓` deslizan la grilla en esa dirección, con `preventDefault` para evitar scroll de página mientras se juega.

**No incluye:**

- Controles táctiles/móviles (jugable solo con teclado en esta spec; en dispositivos táctiles se ve pero no se puede jugar — igual que Asteroides/Tetris/Snake antes de la spec 09).
- Sonido/efectos de audio.
- Autenticación real ni anti-cheat (cualquiera con la clave pública puede guardar cualquier puntuación, igual que el resto del catálogo).
- Tests automatizados (no hay test runner configurado).
- Animaciones de deslizamiento interpoladas entre celdas: las fichas se redibujan directamente en su celda final tras cada movimiento (sin tween), para mantener el motor simple en esta primera versión.
- Modo "deshacer movimiento" o historial de jugadas.

## Modelo de datos

**Nueva fila en `games`** (Supabase):

```typescript
{
  id: "2048-neon",
  title: "2048 NEÓN",
  short: "Desliza y fusiona fichas hasta alcanzar el número definitivo.",
  long: "Una grilla de 4x4 casillas brilla en neón magenta. Desliza las fichas en cualquier dirección para fusionar números iguales y duplicar su valor, mientras una ficha nueva aparece tras cada movimiento. La partida termina cuando la grilla se llena y ningún deslizamiento libera espacio. ¿Hasta qué potencia de dos llegarás?",
  cat: "PUZZLE",
  cover: "cover-2048neon",
  color: "magenta",
  best: 48280,
  plays: "5.7K",
}
```

**Props del componente del motor** (`app/components/games/Neon2048.tsx`):

```typescript
export interface Neon2048Props {
  paused: boolean; // true = el loop interno no procesa input ni dibuja nuevos frames
  resetSignal: number; // al incrementarse, reinicia la grilla desde cero (2 fichas de valor 2)
  endSignal: number; // al incrementarse, fuerza game over inmediato (botón FIN)
  onScoreChange: (score: number) => void; // suma del valor de cada fusión realizada
  onBestTileChange: (bestTile: number) => void; // sustituye a "Vidas" en el HUD, bajo "Mejor ficha"
  onLevelChange: (level: number) => void; // floor(fusiones/10)+1
  onGameOver: () => void; // se dispara cuando no quedan movimientos válidos
}
```

No se introducen tipos nuevos en `lib/data.ts` más allá de la nueva fila de catálogo (reutiliza la interfaz `Game` existente, ya generalizada por la spec 08). El estado interno del motor (grilla `4×4` de valores numéricos o `0` para celda vacía, contador de fusiones, máquina `'playing' | 'gameover'`) vive encapsulado dentro de `Neon2048.tsx` y no se expone fuera de los callbacks anteriores.

**SQL de catálogo** (vía `apply_migration`, columnas de catálogo ya existen en `games` desde la spec 08):

```sql
insert into public.games (id, title, short, long, cat, cover, color, best, plays) values (
  '2048-neon',
  '2048 NEÓN',
  'Desliza y fusiona fichas hasta alcanzar el número definitivo.',
  'Una grilla de 4x4 casillas brilla en neón magenta. Desliza las fichas en cualquier dirección para fusionar números iguales y duplicar su valor, mientras una ficha nueva aparece tras cada movimiento. La partida termina cuando la grilla se llena y ningún deslizamiento libera espacio. ¿Hasta qué potencia de dos llegarás?',
  'PUZZLE',
  'cover-2048neon',
  'magenta',
  48280,
  '5.7K'
);
```

## Plan de implementación

1. **Aplicar la migración** (`apply_migration`) con la fila `"2048-neon"` en `games` definida arriba. Sin cambios de código todavía: `/biblioteca` muestra ya la nueva card (con `cover-2048neon` sin estilo aún, fondo genérico) y `/juego/2048-neon` muestra portada/descripción con leaderboard vacío (`getGameScores` ya generalizado); `/juego/2048-neon/jugar` sigue mostrando el Reproductor simulado porque `GamePlayer` no reconoce `"2048-neon"` todavía.

2. **Añadir `.cover-2048neon`** en `app/globals.css` (grilla de fichas numeradas en gradiente magenta/violeta, paralelo a `.cover-anaconda` pero con motivo de cuadrícula numérica en vez de serpiente). Tras este paso, la card de la Biblioteca y la portada de `/juego/2048-neon` muestran el estilo definitivo.

3. **Crear `app/components/games/Neon2048.tsx`**: motor de grilla `4×4` desde cero, con `useEffect`+cleanup completo (mismo patrón que `Snake.tsx`): inicialización de grilla con 2 fichas de valor `2` en celdas aleatorias, función de deslizamiento por dirección (compactar valores no-cero hacia el borde, fusionar pares iguales adyacentes una sola vez por ficha y por movimiento, recompactar tras fusionar), spawn de ficha nueva tras cada movimiento válido (la grilla cambió), detección de "sin movimientos posibles" en las 4 direcciones para disparar game over, dibujo en `<canvas>` responsive (fichas como rectángulos redondeados, color por valor, número centrado, celda vacía en gris oscuro), listeners de teclado (`←↑→↓` con `preventDefault`). Implementa `Neon2048Props` (recibe `paused`/`resetSignal`/`endSignal`, emite `onScoreChange`/`onBestTileChange`/`onLevelChange`/`onGameOver`). El componente aún no se usa en ninguna página — el sistema sigue funcional igual que en el paso 2.

4. **Modificar `app/components/GamePlayer.tsx`** para renderizado condicional: añade `isNeon2048 = game.id === "2048-neon"` al patrón existente (`isAsteroides`/`isTetris`/`isSnake`/`isFrogger`); si es true, renderiza `<Neon2048 />` dentro de `.game-arena`, con estado React (`neoScore`, `neoBestTile`, `neoLevel`) sincronizado vía los callbacks del motor. En el `player-hud`, el stat "Vidas" se sustituye por "Mejor ficha" cuando `isNeon2048` (mismo patrón que "Líneas"/"Longitud"). `PAUSA/REANUDAR` alterna `paused`; `FIN` incrementa `endSignal`; `JUGAR DE NUEVO` incrementa `resetSignal` y resetea `neoScore`/`neoBestTile`/`neoLevel`; `SALIR` navega a `/juego/2048-neon`. Para el resto del catálogo, sin cambios de comportamiento.

5. **Verificación final**: `npm run lint` y `npm run build` sin errores; recorrido manual en `/juego/2048-neon/jugar` jugando una partida completa (deslizar en las 4 direcciones, fusionar fichas, ver aparecer fichas nuevas, alcanzar game over al llenar la grilla sin movimientos posibles), comprobando que el HUD de React refleja `score`/"Mejor ficha"/nivel en tiempo real, que PAUSA detiene el juego y REANUDAR lo continúa, que FIN abre el modal con la puntuación actual, que JUGAR DE NUEVO reinicia limpio (2 fichas de valor 2), que SALIR navega a `/juego/2048-neon` sin dejar listeners activos, y que el canvas se redimensiona correctamente al cambiar el tamaño de la ventana.

## Criterios de aceptación

- [ ] La tabla `games` incluye la fila `"2048-neon"` con `title`, `short`, `long`, `cat: "PUZZLE"`, `cover: "cover-2048neon"`, `color: "magenta"`, `best` y `plays`.
- [ ] `app/globals.css` define `.cover-2048neon` y la card de "2048 NEÓN" se muestra correctamente en la Biblioteca (`/biblioteca`), incluyendo filtros por búsqueda y categoría `PUZZLE`.
- [ ] `/juego/2048-neon` muestra portada, descripción larga, stat-strip y un leaderboard real (vacío hasta la primera partida), igual que el resto del catálogo data-driven.
- [ ] `/juego/2048-neon/jugar` renderiza un `<canvas>` jugable de grilla `4×4` dentro de `.crt-screen`, en lugar del arena mock.
- [ ] Controles de teclado funcionan: `←↑→↓` deslizan la grilla en esa dirección; estas teclas no provocan scroll de la página.
- [ ] Al deslizar, las fichas se compactan hacia el borde correspondiente, las fichas adyacentes con el mismo valor se fusionan en una con el valor duplicado (máximo una fusión por ficha por movimiento), y el `score` aumenta exactamente en el valor de la ficha fusionada resultante por cada fusión.
- [ ] Tras cualquier movimiento que cambie la grilla, aparece una ficha nueva (valor `2` o `4`) en una celda vacía aleatoria; si el movimiento no cambia la grilla (deslizar contra un borde sin fusiones posibles), no aparece ficha nueva.
- [ ] El HUD de React (`player-hud`) refleja en tiempo real `score`, "Mejor ficha" (en lugar de "Vidas", mostrando el valor numérico de la ficha más alta presente en la grilla) y `level` del motor (`floor(fusiones/10)+1`).
- [ ] Cuando la grilla está llena y ningún movimiento en ninguna dirección produce un cambio (ni fusión ni desplazamiento), se dispara `onGameOver` y aparece el modal de fin de juego existente con la puntuación final real.
- [ ] Botón **PAUSA** detiene el procesamiento de input y el dibujo de nuevos frames, mostrando el overlay "EN PAUSA" existente; **REANUDAR** lo continúa.
- [ ] Botón **FIN** fuerza game over inmediato con la puntuación actual y abre el modal de fin de juego.
- [ ] Botón "JUGAR DE NUEVO" reinicia el motor a su estado inicial (grilla vacía con 2 fichas de valor `2` en posiciones aleatorias, score 0, nivel 1) y cierra el modal.
- [ ] Botón "SALIR" navega a `/juego/2048-neon`, deteniendo el loop y removiendo los listeners de teclado (sin fugas al volver a entrar al Reproductor).
- [ ] El canvas se redimensiona manteniendo la grilla `4×4` cuadrada al cambiar el tamaño de la ventana, sin romper la disposición del juego.
- [ ] Los demás juegos del catálogo siguen funcionando sin cambios de comportamiento.
- [ ] `npm run lint` y `npm run build` finalizan sin errores.

## Decisiones tomadas y descartadas

- **Motor construido desde cero, sin `references/started-games`**: no existe puerto de 2048 en esa carpeta; a diferencia de Asteroides/Tetris (portados de un `game.js` existente), 2048 Neón sigue el precedente de Snake (motor nuevo) por ser una mecánica de grilla discreta sencilla de implementar directamente en canvas.
- **`"Mejor ficha"` sustituye a "Vidas" en el HUD**: se descarta forzar un concepto de "vidas" artificial (2048 no tiene vidas, una sola partida termina al llenarse la grilla); "Mejor ficha" es la métrica de progreso más reconocible del género (equivalente a "Líneas" en Tetris o "Longitud" en Snake).
- **Nivel derivado de `floor(fusiones/10)+1`, no del valor de la mejor ficha**: se descarta usar `log2(bestTile)` como nivel porque duplicaría la información ya mostrada en "Mejor ficha"; contar fusiones da una progresión independiente y visible incluso entre saltos grandes de valor.
- **Sin animación de deslizamiento interpolada**: se descarta el tween de posición entre celdas (común en implementaciones de 2048) para mantener el motor de esta primera versión simple, consistente con que Snake/Tetris tampoco interpolan movimiento entre celdas de grilla.
- **Una sola fusión por ficha y por movimiento**: regla canónica del 2048 original (una ficha recién fusionada no vuelve a fusionarse en el mismo movimiento aunque quede adyacente a otra igual); se porta tal cual para no alterar la mecánica esperada por cualquier jugador familiarizado con el juego.
- **Spawn `2` (90%) / `4` (10%)**: probabilidades estándar del 2048 original; se descarta una distribución propia para mantener la dificultad de progresión reconocible.
- **Color magenta y `.cover-2048neon` nuevo**: PUZZLE ya tiene a Tetris en amarillo; magenta diferencia visualmente ambas entradas de la misma categoría en la Biblioteca, siguiendo el criterio de cobertura de huecos usado por `game-planner` al sugerir este juego.
- **Sin controles táctiles, audio, autenticación ni anti-cheat**: mismas exclusiones que las specs 05/06/07/08, por las mismas razones (alcance acotado, infraestructura no disponible).
- **Motor + canvas + loop en un solo componente (`Neon2048.tsx`)**: mismo criterio que `Asteroides.tsx`/`Snake.tsx` — no hay otro consumidor del motor, mantener todo junto simplifica el desarrollo inicial.

## Riesgos identificados

- **React Strict Mode (modo desarrollo)**: Next.js monta y desmonta los `useEffect` dos veces en desarrollo, lo que podría duplicar temporalmente los listeners de teclado o procesar un mismo input dos veces. Mitigación: verificar manualmente en `npm run dev` que un solo deslizamiento por pulsación de tecla produzca un solo movimiento de grilla, y que el cleanup remueva listeners/RAF correctamente, igual que en `Snake.tsx`.
- **Renders excesivos por callbacks de alta frecuencia**: si `onScoreChange`/`onBestTileChange`/`onLevelChange` se invocan en cada frame en vez de solo tras cada movimiento, el HUD de React podría re-renderizar innecesariamente. Mitigación: invocar los callbacks solo cuando el valor reportado cambia respecto al anterior, y solo tras resolver un movimiento completo (no en el loop de dibujo).
- **Canvas responsive con grilla discreta `4×4`**: igual que en Tetris/Snake, un resize mal manejado puede desalinear las celdas de la grilla lógica respecto al tamaño visual del contenedor. Mitigación: mantener la matriz `4×4` fija en memoria y recalcular solo el tamaño de celda (`BLOCK`) a partir del tamaño real del contenedor en cada resize, manteniendo la grilla cuadrada (mismo ancho que alto) dentro de `.crt-screen`.
- **Regresión de leaderboards compartidos**: la generalización de `lib/leaderboard.ts`/`lib/games.ts` (specs 07/08) ya soporta cualquier `gameId` presente en `games` sin cambios adicionales; el riesgo es únicamente de migración (verificar que la nueva fila no rompa `order by created_at` en `/biblioteca`/`/salon-fama`). Mitigación: tras aplicar la migración del paso 1, verificar `/biblioteca` y `/salon-fama` antes de continuar con el resto del plan.
