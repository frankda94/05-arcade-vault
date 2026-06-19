# 09 — Controles táctiles para los motores jugables

**Estado:** Implementado
**Dependencias:** [05-asteroides](05-asteroides.md), [07-engranajes](07-engranajes.md) (Tetris), [08-snake](08-snake.md) — los tres motores y `GamePlayer` ya existentes, sin cambios a su lógica interna
**Fecha:** 2026-06-19

**Objetivo:** Añadir una franja de controles táctiles (D-pad + botones de acción) debajo de `.crt-screen` en `GamePlayer`, visible solo en dispositivos con puntero táctil primario (`pointer: coarse`), que simula eventos de teclado para pilotar Asteroides, Tetris y Snake sin tocar la lógica interna de ninguno de los tres motores.

## Alcance

**Incluye:**

- **Nuevo componente `app/components/games/TouchControls.tsx`**: franja de botones configurable por juego (D-pad + hasta 2 botones de acción), que simula eventos de teclado (`KeyboardEvent("keydown"/"keyup")`) sobre `window` con el mismo `code` que el motor correspondiente ya escucha. No conoce la lógica de ningún juego — solo dispara/suelta códigos de tecla.
- **Nuevo hook `useIsTouchDevice()`** (dentro del mismo archivo o en `lib/`, a decidir en implementación): usa `window.matchMedia("(pointer: coarse)")` con listener de cambios, para mostrar/ocultar la franja dinámicamente (ej. si se conecta/desconecta un mouse).
- **Configuración de botones por juego** (definida en `GamePlayer.tsx` o pasada como prop a `TouchControls`):
  - **Asteroides**: `◀` `▶` (rotar, modo _hold_, `ArrowLeft`/`ArrowRight`), `▲` (acelerar, modo _hold_, `ArrowUp`), `DISPARAR` (modo _tap_, `Space`).
  - **Tetris**: `◀` `▶` (mover, modo _repeat_ con auto-repeat estilo navegador, `ArrowLeft`/`ArrowRight`), `▼` (bajada rápida, modo _repeat_, `ArrowDown`), `ROTAR` (modo _tap_, `ArrowUp`), `CAÍDA` (modo _tap_, `Space`).
  - **Snake**: D-pad de 4 flechas (modo _tap_, `ArrowUp`/`ArrowDown`/`ArrowLeft`/`ArrowRight`).
- **Tres modos de disparo de evento** dentro de `TouchControls`:
  - **hold**: `keydown` en `touchstart`, `keyup` en `touchend`/`touchcancel` (rotar/acelerar de Asteroides).
  - **repeat**: `keydown` inmediato en `touchstart`, luego repetido cada ~33ms tras un delay inicial de ~500ms (imita el auto-repeat nativo del navegador con tecla física mantenida), `keyup` en `touchend`/`touchcancel` (movimiento/bajada de Tetris).
  - **tap**: un solo par `keydown`+`keyup` por toque (disparar de Asteroides, rotar/caída de Tetris, direcciones de Snake).
- **Modificar `app/components/GamePlayer.tsx`**: renderiza `<TouchControls />` debajo de `.crt-screen` (dentro de `.crt`, antes de `.crt-bottom` o después, a definir en implementación visual) cuando `useIsTouchDevice()` es `true` y el juego es Asteroides/Tetris/Snake; no se renderiza para el resto (placeholders mock).
- **Nuevas clases CSS** en `app/globals.css` para la franja y los botones (D-pad, botones de acción), con tamaño mínimo de área táctil ~44px, estética neón/CRT consistente con el resto de la UI, y `touch-action: none` para evitar scroll/zoom accidental al pulsar.

**No incluye:**

- Gestos táctiles (swipe/tap directo sobre el canvas).
- Vibración háptica (`navigator.vibrate`).
- Bloqueo o forzado de orientación de pantalla (Screen Orientation API).
- Toggle manual de usuario para activar/desactivar los controles táctiles — la detección por `pointer: coarse` es la única fuente de verdad.
- Cambios a la lógica interna de `Asteroides.tsx`, `Tetris.tsx` o `Snake.tsx` — los tres siguen escuchando `keydown`/`keyup` exactamente igual que hoy.
- Soporte para los juegos placeholder/mock (no migrados a Supabase) — la franja solo aplica a los 3 juegos reales.
- Tests automatizados.

## Modelo de datos

No se introduce persistencia ni tablas nuevas. Se documentan aquí los tipos/props del nuevo componente.

**`app/components/games/TouchControls.tsx`**:

```typescript
export type TouchButtonMode = "hold" | "repeat" | "tap";

export interface TouchButtonConfig {
  code: string; // ej. "ArrowLeft", "Space" — debe coincidir con el e.code que ya escucha el motor
  label: string; // texto/símbolo del botón, ej. "◀", "DISPARAR"
  mode: TouchButtonMode;
}

export interface TouchControlsProps {
  dpad: {
    up?: TouchButtonConfig;
    down?: TouchButtonConfig;
    left?: TouchButtonConfig;
    right?: TouchButtonConfig;
  };
  actions: TouchButtonConfig[]; // hasta 2, renderizados a la derecha (ej. DISPARAR; o ROTAR + CAÍDA)
}
```

**Configuraciones por juego** (constantes definidas en `GamePlayer.tsx`, pasadas como prop según `game.id`):

```typescript
const ASTEROIDES_TOUCH: TouchControlsProps = {
  dpad: {
    left: { code: "ArrowLeft", label: "◀", mode: "hold" },
    right: { code: "ArrowRight", label: "▶", mode: "hold" },
    up: { code: "ArrowUp", label: "▲", mode: "hold" },
  },
  actions: [{ code: "Space", label: "DISPARAR", mode: "tap" }],
};

const TETRIS_TOUCH: TouchControlsProps = {
  dpad: {
    left: { code: "ArrowLeft", label: "◀", mode: "repeat" },
    right: { code: "ArrowRight", label: "▶", mode: "repeat" },
    down: { code: "ArrowDown", label: "▼", mode: "repeat" },
  },
  actions: [
    { code: "ArrowUp", label: "ROTAR", mode: "tap" },
    { code: "Space", label: "CAÍDA", mode: "tap" },
  ],
};

const SNAKE_TOUCH: TouchControlsProps = {
  dpad: {
    up: { code: "ArrowUp", label: "▲", mode: "tap" },
    down: { code: "ArrowDown", label: "▼", mode: "tap" },
    left: { code: "ArrowLeft", label: "◀", mode: "tap" },
    right: { code: "ArrowRight", label: "▶", mode: "tap" },
  },
  actions: [],
};
```

**`useIsTouchDevice()`** (hook, ubicación a definir en implementación — ej. dentro de `TouchControls.tsx` o `lib/useIsTouchDevice.ts`):

```typescript
function useIsTouchDevice(): boolean;
// usa window.matchMedia("(pointer: coarse)").matches + listener "change"
// SSR-safe: false hasta que el efecto corre en cliente (evita mismatch de hidratación)
```

## Plan de implementación

1. **Crear `useIsTouchDevice()`**: hook con `matchMedia("(pointer: coarse)")` + listener `change`, `false` por defecto (SSR-safe). Aún sin consumidores — el sistema sigue funcionando igual que hoy.

2. **Crear `app/components/games/TouchControls.tsx`**: componente que recibe `TouchControlsProps` (D-pad + `actions`), renderiza los botones configurados y, por cada uno, implementa los 3 modos (`hold`/`repeat`/`tap`) disparando `KeyboardEvent("keydown"/"keyup")` con el `code` indicado sobre `window`, con cleanup de `setInterval`/listeners en `touchend`/`touchcancel`. Aún no se usa en ninguna página — sigue sin afectar nada existente.

3. **Añadir clases CSS en `app/globals.css`** para la franja (`.touch-controls`), el D-pad y los botones de acción: tamaño mínimo de toque ~44px, `touch-action: none`, estética neón/CRT coherente con `.crt-bottom`/`.btn`. Sin componente que las use todavía — sin cambios visuales en ninguna página.

4. **Modificar `app/components/GamePlayer.tsx`**: define las constantes `ASTEROIDES_TOUCH`/`TETRIS_TOUCH`/`SNAKE_TOUCH`, llama a `useIsTouchDevice()`, y renderiza `<TouchControls {...config} />` debajo de `.crt-screen` cuando el hook devuelve `true` y `isAsteroides`/`isTetris`/`isSnake`. Para el resto de juegos (placeholders mock) y en desktop, no se renderiza nada — comportamiento idéntico al actual.

5. **Verificación final**: `npm run lint` y `npm run build` sin errores; recorrido manual con emulación táctil de Chrome DevTools (device toolbar) en `/juego/asteroides/jugar`, `/juego/tetris/jugar` y `/juego/snake/jugar` — la franja aparece, cada botón controla correctamente su acción (incluyendo el auto-repeat de Tetris al mantener), y desaparece al desactivar la emulación táctil (puntero `fine`); confirmar también que en desktop normal (sin emulación) la franja no aparece en ninguno de los 3 juegos ni en los placeholders.

## Criterios de aceptación

- [ ] `useIsTouchDevice()` devuelve `true`/`false` según `matchMedia("(pointer: coarse)")` y se actualiza dinámicamente si cambia el tipo de puntero (sin recargar la página).
- [ ] `TouchControls.tsx` renderiza el D-pad y los botones de acción según la configuración recibida, sin conocer la lógica de ningún motor.
- [ ] Modo **hold**: al pulsar y mantener un botón se dispara un `keydown` y se mantiene "presionado" hasta soltar (`keyup` en `touchend`/`touchcancel`), sin repetición.
- [ ] Modo **repeat**: al mantener pulsado, se dispara un `keydown` inmediato, luego se repite cada ~33ms tras un delay inicial de ~500ms, y se emite `keyup` al soltar.
- [ ] Modo **tap**: cada toque dispara exactamente un par `keydown`+`keyup`.
- [ ] En `/juego/asteroides/jugar` con emulación táctil: `◀`/`▶` rotan la nave mientras se mantienen, `▲` acelera mientras se mantiene, `DISPARAR` dispara un proyectil por toque — sin cambios en `Asteroides.tsx`.
- [ ] En `/juego/tetris/jugar` con emulación táctil: `◀`/`▶` mueven la pieza con auto-repeat al mantener, `▼` hace bajada rápida con auto-repeat, `ROTAR` gira la pieza por toque, `CAÍDA` hace caída instantánea por toque — sin cambios en `Tetris.tsx`.
- [ ] En `/juego/snake/jugar` con emulación táctil: el D-pad de 4 flechas cambia la dirección de la serpiente por toque (sin permitir giro de 180°, igual que con teclado) — sin cambios en `Snake.tsx`.
- [ ] La franja de controles táctiles es visible solo cuando `pointer: coarse` es verdadero; en desktop con mouse/teclado (`pointer: fine`) no se renderiza en ninguno de los 3 juegos.
- [ ] La franja no se renderiza en los juegos placeholder/mock (no migrados a Supabase).
- [ ] Los botones tienen un área táctil mínima de ~44px y `touch-action: none` (sin scroll/zoom accidental al pulsar).
- [ ] El teclado físico sigue funcionando exactamente igual que antes en los 3 juegos (sin regresión), tanto en desktop como en un dispositivo táctil con teclado conectado.
- [ ] `npm run lint` y `npm run build` finalizan sin errores.

## Decisiones tomadas y descartadas

- **Simular eventos de teclado en vez de añadir props de control táctil a cada motor**: se descarta tocar `Asteroides.tsx`/`Tetris.tsx`/`Snake.tsx` porque ya escuchan `keydown`/`keyup` con la misma lógica que necesitamos; un componente que dispara esos eventos sintéticos reutiliza esa lógica con cero riesgo de regresión y sin duplicar código de input en 3 archivos.
- **Franja fija debajo de `.crt-screen`, no overlay flotante sobre el canvas**: se prioriza no tapar nunca el área jugable, aceptando el costo de menos alto de canvas disponible en pantallas pequeñas.
- **Detección con `matchMedia("(pointer: coarse)")` en vez de `"ontouchstart" in window`**: evita falsos positivos en laptops con pantalla táctil pero uso primario de mouse/teclado.
- **Auto-repeat de Tetris con cadencia ~500ms delay / ~33ms entre repeticiones (no una cadencia fija simplificada)**: para que el botón táctil se sienta igual que mantener la tecla física (que dispara `keydown` repetidos vía el auto-repeat nativo del SO/navegador), evitando una experiencia de movimiento perceptiblemente distinta entre desktop y móvil.
- **Un solo componente `TouchControls` configurable por juego, en vez de 3 componentes separados**: el layout (D-pad + hasta 2 acciones) y los 3 modos de disparo son comunes a los 3 juegos; solo cambia la configuración de botones, que se pasa como prop desde `GamePlayer`.
- **Sin gestos táctiles, vibración háptica, bloqueo de orientación, ni toggle manual de usuario**: alcance acotado a la necesidad concreta (poder jugar en móvil); estas mejoras quedan disponibles para una spec futura si se necesitan.
- **Sin cambios a los juegos placeholder/mock**: la franja solo tiene sentido para los 3 juegos con motor real; los placeholders no tienen lógica de teclado que simular.

## Riesgos identificados

- **Eventos sintéticos de teclado no siempre se comportan idéntico a un `keydown` real del navegador**: algunos motores podrían depender de propiedades del evento real (ej. `e.repeat`, `e.isTrusted`) que un `KeyboardEvent` construido manualmente no replica exactamente. Mitigación: revisar el uso de `e.repeat` en `Tetris.tsx` (línea ~431, para `KeyP`) y confirmar que no afecta a los códigos usados por la franja táctil (`ArrowLeft/Right/Down/Up`, `Space`).
- **Auto-repeat simulado con `setInterval` puede desincronizarse del frame loop** (`requestAnimationFrame`) de cada motor, causando movimiento ligeramente distinto al de teclado físico. Mitigación: usar las mismas constantes de timing (~500ms/~33ms) en los 3 juegos y verificar manualmente que la sensación es equivalente.
- **Múltiples toques simultáneos (multi-touch) sobre dos botones del D-pad**: el navegador puede no disparar `touchend` correctamente si el dedo se desliza fuera del botón sin levantarse. Mitigación: además de `touchend`/`touchcancel`, escuchar `touchmove` y soltar (`keyup`) si el punto de contacto sale del área del botón.
- **Conflicto con scroll/zoom táctil del navegador**: sin `touch-action: none` y `preventDefault` en los handlers, los toques sobre la franja podrían hacer scroll de la página o zoom. Mitigación: aplicar `touch-action: none` vía CSS y `e.preventDefault()` en `touchstart` de cada botón.
- **Pantallas muy pequeñas en landscape**: la franja fija debajo de `.crt-screen` puede dejar muy poco alto para el canvas en móviles en horizontal. Mitigación: verificar manualmente en emulación de varios tamaños (ej. iPhone SE, Pixel) en portrait y landscape; si el espacio es insuficiente, ajustar el tamaño de los botones por media query (sin cambiar el alcance de esta spec).
