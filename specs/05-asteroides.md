# 05 — Asteroides: juego jugable con canvas

**Estado:** Aprobado
**Dependencias:** [01-pantallas-visuales](01-pantallas-visuales.md) (Reproductor `/juego/[id]/jugar`, HUD, modal de fin de juego)
**Fecha:** 2026-06-11

**Objetivo:** Portar el juego Asteroids de `references/started-games/02-asteroids` (canvas HTML5 vanilla JS) a un componente React jugable con canvas responsive, integrado como nueva entrada `"asteroides"` del catálogo y conectado al HUD y modal de fin de juego ya existentes en el Reproductor.

## Alcance

**Incluye:**

- Nueva entrada `"asteroides"` en `lib/data.ts` (`GAMES`): `id: "asteroides"`, `title: "ASTEROIDES"`, `cat: "SHOOTER"`, `color: "cyan"`, `cover: "cover-asteroides"`, con `short`/`long`/`best`/`plays` redactados en el mismo tono retro-gamer del resto del catálogo.
- Nueva clase CSS `.cover-asteroides` en `app/globals.css` para la portada de la card/detalle (estilo espacial: estrellas, asteroide, nave).
- Nuevo componente `app/components/games/Asteroides.tsx` (client component): port del motor de `references/started-games/02-asteroids/game.js` —clases `Ship`, `Asteroid`, `Bullet`, `Particle`, `PowerUp`, utilidades (`wrap`, `dist`, `rand`, `randInt`), constantes (`RADII`, `SPEEDS`, `POINTS`, power-up) y el loop `update`/`draw`— encapsulado dentro de un `useEffect` con limpieza completa de listeners de teclado y `cancelAnimationFrame` al desmontar.
- Canvas responsive: se redimensiona para llenar `.crt-screen` (mantiene `aspect-ratio: 4/3`), recalculando la resolución lógica del mundo al cambiar el tamaño del contenedor.
- Sin HUD propio dibujado en canvas (se elimina el `drawHUD`/`drawOverlay` de `game.js`); el canvas solo dibuja nave, asteroides, balas, partículas y power-ups.
- Integración en `app/components/GamePlayer.tsx`:
  - Renderizado condicional: si `game.id === "asteroides"`, se monta `<Asteroides />` dentro de `.game-arena` (reemplaza los divs mock `.grid-floor`/`.enemy`/`.player-ship`); para el resto de juegos, `GamePlayer` se mantiene sin cambios (mock actual).
  - El motor expone `score`, `lives`, `level` y estado del power-up triple ("3x") vía callbacks/estado hacia `GamePlayer`, que alimenta el `player-hud` existente (incluyendo un indicador adicional cuando el triple disparo está activo).
  - **PAUSA/REANUDAR**: detiene/reanuda el loop interno del motor; se reutiliza el overlay "EN PAUSA" existente.
  - **FIN**: fuerza game over inmediato en el motor (igual que perder la última vida) y abre el modal de fin de juego existente con la puntuación final real.
  - **SALIR**: navega a `/juego/asteroides` (sin cambios respecto al comportamiento actual, dispara el cleanup del componente).
  - **JUGAR DE NUEVO**: reinicia el motor a su estado inicial (nave centrada, 3 vidas, nivel 1, score 0, asteroides nuevos).
  - **GUARDAR PUNTUACIÓN**: se mantiene visual/local (toast "PUNTUACIÓN GUARDADA"), sin persistencia, igual que el resto del catálogo.
- Controles de teclado (`←`/`→` rotar, `↑` propulsar, `Espacio` disparar) con `preventDefault` para evitar scroll de la página mientras se juega.
- Mecánica de power-up de disparo triple ("3x") portada tal cual (drop chance, duración, recolección, disparo triple).

**No incluye:**

- Controles táctiles/móviles (el juego es jugable solo con teclado; en dispositivos táctiles se ve pero no se puede jugar).
- Persistencia real de puntuaciones (localStorage/backend) — sigue la decisión de [01-pantallas-visuales](01-pantallas-visuales.md).
- Cambios al motor/UI de los demás juegos del catálogo (siguen en modo simulado/mock).
- Sonido/efectos de audio (el `game.js` original tampoco los tiene).
- Cambios a `/salon-fama` o a la página de detalle más allá de que `"asteroides"` aparezca automáticamente por estar en `GAMES` (el leaderboard usa `seededScores` ya genérico).
- Tests automatizados (no hay test runner configurado).

## Modelo de datos

**Nueva entrada en `GAMES`** (`lib/data.ts`):

```typescript
{
  id: "asteroides",
  title: "ASTEROIDES",
  short: "Esquiva y destruye un campo de asteroides infinito.",
  long: "Pilotas una nave triangular a la deriva en un campo toroidal de rocas espaciales. Dispara para fragmentar los asteroides grandes en trozos cada vez más pequeños, recoge el power-up de disparo triple y sobrevive oleada tras oleada. Tres vidas, cero margen de error.",
  cat: "SHOOTER",
  cover: "cover-asteroides",
  color: "cyan",
  best: 38500,
  plays: "1.8K",
}
```

**Props del componente del motor** (`app/components/games/Asteroides.tsx`):

```typescript
export interface AsteroidesProps {
  paused: boolean; // true = el loop interno no actualiza ni dibuja nuevos frames
  resetSignal: number; // al incrementarse, reinicia el juego desde cero
  endSignal: number; // al incrementarse, fuerza game over inmediato (botón FIN)
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onLevelChange: (level: number) => void;
  onPowerUpChange: (secondsLeft: number) => void; // 0 = power-up inactivo
  onGameOver: () => void; // se dispara cuando lives llega a 0 (natural o forzado por FIN)
}
```

No se introducen tipos nuevos en `lib/data.ts` más allá del nuevo objeto en `GAMES` (reutiliza la interfaz `Game` existente). El estado interno del motor (`Ship`, `Asteroid`, `Bullet`, `Particle`, `PowerUp`, máquina de estados `'playing' | 'dead' | 'gameover'`) vive encapsulado dentro de `Asteroides.tsx` y no se expone fuera de los callbacks anteriores.

## Plan de implementación

1. **Agregar la entrada `"asteroides"` a `GAMES`** (`lib/data.ts`) y la clase `.cover-asteroides` en `app/globals.css`. El sistema sigue funcional: el juego aparece en la Biblioteca con su portada, en `/juego/asteroides` se ve el detalle con leaderboard, y `/juego/asteroides/jugar` usa el Reproductor simulado actual (sin cambios todavía).

2. **Crear `app/components/games/Asteroides.tsx`**: portar el motor completo de `references/started-games/02-asteroids/game.js` (clases `Ship`, `Asteroid`, `Bullet`, `Particle`, `PowerUp`, constantes `RADII`/`SPEEDS`/`POINTS`/power-up, utilidades `wrap`/`dist`/`rand`/`randInt`) a un componente client con `<canvas>` responsive (resize al contenedor `.crt-screen`, manteniendo 4:3), loop propio (`requestAnimationFrame`), listeners de teclado con `preventDefault`, sin dibujo de HUD propio. Implementa `AsteroidesProps` (recibe `paused`/`resetSignal`/`endSignal`, emite `onScoreChange`/`onLivesChange`/`onLevelChange`/`onPowerUpChange`/`onGameOver`), con cleanup completo en el `useEffect` al desmontar. El componente aún no se usa en ninguna página — el sistema sigue funcional igual que en el paso 1.

3. **Modificar `app/components/GamePlayer.tsx`** para renderizado condicional: si `game.id === "asteroides"`, renderiza `<Asteroides />` dentro de `.game-arena` (en vez de los divs mock `.grid-floor`/`.enemy`/`.player-ship`), con estado React (`score`, `lives`, `level`, `powerUpSeconds`) sincronizado vía los callbacks del motor. Para `"asteroides"`, `level` proviene del motor (no de la fórmula `Math.floor(score/2500)+1`). Se añade un indicador "3x Xs" en el `player-hud` cuando `powerUpSeconds > 0`. Para el resto de juegos, `GamePlayer` no cambia (sigue el mock simulado).

4. **Conectar los botones del HUD al motor para `"asteroides"`**: `PAUSA/REANUDAR` alterna la prop `paused`; `FIN` incrementa `endSignal` (fuerza game over y abre el modal con la puntuación real); `JUGAR DE NUEVO` incrementa `resetSignal` (reinicia nave/asteroides/score/vidas/nivel) y resetea el estado local del modal; `SALIR` mantiene su comportamiento actual (navega a `/juego/asteroides`, desmontando el componente y limpiando listeners/loop). Para los demás juegos del catálogo, estos botones siguen comportándose como hasta ahora.

5. **Verificación final**: `npm run lint` y `npm run build` sin errores; recorrido manual en `/juego/asteroides/jugar` jugando una partida completa (rotar, propulsar, disparar, recoger power-up 3x, partir asteroides grandes→medianos→pequeños, perder las 3 vidas), comprobando que el HUD de React refleja score/vidas/nivel/3x en tiempo real, que PAUSA detiene el juego y REANUDAR lo continúa, que FIN abre el modal con la puntuación actual, que GUARDAR PUNTUACIÓN muestra el toast sin persistir nada, que JUGAR DE NUEVO reinicia limpio, que SALIR navega a `/juego/asteroides` sin dejar listeners activos, y que el canvas se redimensiona correctamente al cambiar el tamaño de la ventana.

## Criterios de aceptación

- [ ] `lib/data.ts` incluye la entrada `"asteroides"` en `GAMES` con `id`, `title`, `short`, `long`, `cat: "SHOOTER"`, `cover: "cover-asteroides"`, `color: "cyan"`, `best` y `plays`.
- [ ] `app/globals.css` define `.cover-asteroides` y la card de "ASTEROIDES" se muestra correctamente en la Biblioteca (`/`), incluyendo filtros por búsqueda y categoría `SHOOTER`.
- [ ] `/juego/asteroides` muestra portada, descripción larga, stat-strip y un leaderboard de 10 filas generado con `seededScores`, igual que el resto de juegos.
- [ ] `/juego/asteroides/jugar` renderiza un `<canvas>` jugable dentro de `.crt-screen`, en lugar del arena mock (`.grid-floor`/`.enemy`/`.player-ship`).
- [ ] Controles de teclado funcionan: `←`/`→` rotan la nave, `↑` la propulsa (con llama de propulsor visible), `Espacio` dispara; estas teclas no provocan scroll de la página.
- [ ] Los asteroides se mueven, rotan, envuelven los bordes (toroidal) y al ser destruidos por una bala se dividen (grande→2 medianos→2 pequeños) y desaparecen al ser pequeños, sumando 100/50/20 puntos respectivamente.
- [ ] El power-up "3x" aparece ocasionalmente al destruir asteroides, puede recogerse, y mientras está activo la nave dispara en triple abanico; el HUD de React muestra "3x Xs" mientras está activo y desaparece al expirar.
- [ ] El HUD de React (`player-hud`) refleja en tiempo real `score`, `lives` (corazones) y `level`/nivel del motor (no la fórmula simulada anterior).
- [ ] Al colisionar la nave con un asteroide sin invencibilidad, se pierde una vida, hay explosión de partículas y la nave reaparece con invencibilidad temporal (parpadeo); al perder las 3 vidas se dispara `onGameOver` y aparece el modal de fin de juego existente con la puntuación final real.
- [ ] Al destruir todos los asteroides de un nivel, se genera el siguiente nivel con más asteroides (`3 + level`), reflejado en el HUD.
- [ ] Botón **PAUSA** detiene el juego (loop, física y dibujo) y muestra el overlay "EN PAUSA" existente; **REANUDAR** lo continúa desde donde quedó.
- [ ] Botón **FIN** fuerza game over inmediato con la puntuación actual y abre el modal de fin de juego.
- [ ] En el modal, introducir iniciales y pulsar "GUARDAR PUNTUACIÓN" muestra el toast "PUNTUACIÓN GUARDADA" sin persistir datos (igual que el resto del catálogo).
- [ ] Botón "JUGAR DE NUEVO" reinicia el motor a su estado inicial (score 0, 3 vidas, nivel 1, nave centrada, asteroides nuevos) y cierra el modal.
- [ ] Botón "SALIR" navega a `/juego/asteroides`, deteniendo el loop y removiendo los listeners de teclado (sin fugas al volver a entrar al Reproductor).
- [ ] El canvas se redimensiona manteniendo proporción 4:3 al cambiar el tamaño de la ventana, sin romper la disposición del juego.
- [ ] Los demás juegos del catálogo (`bloque-buster`, `caida`, etc.) siguen mostrando el Reproductor simulado sin cambios de comportamiento.
- [ ] `npm run lint` y `npm run build` finalizan sin errores.

## Decisiones tomadas y descartadas

- **Nueva entrada `"asteroides"` separada, en vez de reemplazar `"rocas"`**: aunque `"rocas"` ya tiene temática de asteroides, se descarta modificarla o reutilizarla para no afectar su leaderboard/posición actual en el catálogo; `"rocas"` se queda como está (placeholder simulado, sin relación con esta spec).
- **Nueva clase `.cover-asteroides` en vez de reutilizar `.cover-rocas`**: se descarta compartir portada para diferenciar visualmente ambas entradas en la Biblioteca, ya que coexisten con temáticas similares.
- **HUD solo en React, canvas sin HUD propio**: se descarta portar `drawHUD`/`drawOverlay` de `game.js` (duplicaría información y complicaría sincronizar el modal de fin de juego existente). El motor solo dibuja elementos del juego y reporta estado vía callbacks.
- **Canvas responsive en vez de resolución fija 800x600 escalada por CSS**: se descarta el escalado CSS porque se vería borroso en pantallas grandes; el canvas recalcula su resolución lógica al tamaño real de `.crt-screen`.
- **Control total del ciclo de vida (pausa/fin/reinicio) desde React**: se descarta mantener la máquina de estados `'playing'/'dead'/'gameover'` autónoma de `game.js` tal cual, para poder reutilizar el overlay "EN PAUSA" y el modal de fin de juego ya existentes en `GamePlayer`, mediante props (`paused`, `endSignal`, `resetSignal`) y callbacks.
- **Sin persistencia de puntuaciones**: se mantiene la decisión de [01-pantallas-visuales](01-pantallas-visuales.md) — "GUARDAR PUNTUACIÓN" es solo visual. Persistencia real (si se decide) quedaría para un spec futuro que cubra todo el catálogo, no solo Asteroides.
- **Sin controles táctiles/móviles**: se descarta ampliar el alcance a controles en pantalla; el juego queda jugable solo con teclado por ahora. Controles táctiles quedarían para un spec futuro si se requiere soporte móvil completo.
- **Motor + canvas + loop en un solo componente (`app/components/games/Asteroides.tsx`)**: se descarta separar la lógica pura en `lib/games/asteroides.ts` por ahora, ya que no hay otro consumidor de ese motor; mantener todo junto simplifica el port inicial. Si en el futuro se agregan más juegos con motores similares, se podría extraer un patrón común.
- **Power-up de disparo triple ("3x") portado tal cual**: se descarta simplificar/omitir esta mecánica porque es parte central de la jugabilidad original y no añade complejidad significativa al port.
- **Encapsular motor y listeners dentro del componente con cleanup completo**: se descarta el patrón de `game.js` (estado y listeners a nivel de módulo global, loop indefinido), ya que en una SPA de Next.js el componente se monta/desmonta al navegar y dejar listeners/loops activos causaría fugas y comportamiento duplicado al reentrar a `/jugar`.

## Riesgos identificados

- **React Strict Mode (modo desarrollo)**: Next.js monta y desmonta los `useEffect` dos veces en desarrollo, lo que podría duplicar temporalmente el loop o los listeners de teclado si el cleanup no es exhaustivo. Mitigación: verificar manualmente en `npm run dev` que no haya doble disparo (drag/disparo duplicado, velocidad doble) y que `cancelAnimationFrame`/`removeEventListener` se llamen correctamente en cada cleanup.
- **Renders excesivos por callbacks a 60fps**: si `onScoreChange`/`onLivesChange`/`onLevelChange`/`onPowerUpChange` se invocan en cada frame, el HUD de React podría re-renderizar innecesariamente. Mitigación: invocar los callbacks solo cuando el valor reportado cambia respecto al anterior (comparación antes de llamar a `setState`).
- **Canvas responsive y recálculo de coordenadas**: redimensionar el canvas en caliente (al cambiar el tamaño de ventana) requiere reescalar posiciones/velocidades del mundo del juego; un manejo incorrecto puede dejar objetos fuera de los límites, distorsionar el wrap toroidal o cambiar la dificultad percibida. Mitigación: usar una resolución lógica interna fija (p. ej. 800x600) para toda la física/posiciones, y solo escalar el `<canvas>` visualmente vía `ctx.scale`/transform al tamaño real del contenedor, evitando recalcular `W`/`H` del motor en cada resize.
