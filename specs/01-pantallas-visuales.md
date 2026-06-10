# 01 — Pantallas visuales de Arcade Vault

**Estado:** Aprobado
**Dependencias:** Ninguna (primer spec del proyecto)
**Fecha:** 2026-06-10

**Objetivo:** Portar las 5 pantallas de `references/templates/` (Biblioteca, Detalle de juego, Reproductor, Auth y Salón de la Fama) a rutas reales de Next.js App Router con Tailwind v4, manteniendo la interactividad de UI existente pero sin backend ni sesión real.

## Alcance

**Incluye:**

- 5 rutas reales en App Router:
  - `/` — Biblioteca (grid de juegos, búsqueda, filtros por categoría)
  - `/juego/[id]` — Detalle del juego (info, leaderboard)
  - `/juego/[id]/jugar` — Reproductor (HUD, CRT animado, modal de fin de partida)
  - `/login` — Auth (login / registro / invitado)
  - `/salon-fama` — Salón de la Fama (podio + tabla de puntuaciones por juego)
- Componente `Nav` compartido (enlaces, menú móvil hamburguesa) y footer, integrados en `app/layout.tsx`.
- `lib/data.ts`: port a TypeScript de `GAMES`, `CATS`, `PLAYERS` y `seededScores` desde `references/templates/data.jsx`.
- Interactividad de UI ya presente en las plantillas:
  - Biblioteca: búsqueda en vivo, chips de categoría, tilt 3D de las cards al pasar el mouse.
  - Detalle: navegación a Reproductor / vuelta a Biblioteca.
  - Reproductor: bucle de puntuación simulado, pausa, nivel, fin de juego con modal, input de iniciales y botón "guardar puntuación" (estado local del componente, sin persistencia).
  - Auth: tabs "Iniciar sesión" / "Crear cuenta", todos los botones (incluido invitado, Google, GitHub) navegan a `/`.
  - Salón de la Fama: tabs por juego, podio y tabla animada.
  - Nav: menú móvil abrir/cerrar.
- Estilos: reutilizar `app/globals.css` (ya contiene el tema portado de `styles.css`).

**No incluye:**

- Autenticación real, sesión persistida (`av_user`), o cualquier estado "logueado". Todas las pantallas se muestran en estado "invitado".
- Persistencia real de puntuaciones (localStorage `av_scores`) — el flujo de "guardar puntuación" es solo visual/local.
- Lógica real de los juegos (motor de juego, controles, colisiones).
- Cambios de SEO/metadata avanzados por página, más allá del título básico.
- Tests automatizados (no hay test runner configurado).
- Cualquier feature no presente en las plantillas actuales (multijugador real, perfiles, tienda de créditos, etc.) — quedaría para specs futuros.

## Modelo de datos

Se porta `references/templates/data.jsx` a `lib/data.ts`, tipado, sin cambios de contenido:

```typescript
export type GameColor = "cyan" | "magenta" | "yellow" | "green";

export interface Game {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
  cover: string;   // clase CSS de portada (cover-bricks, cover-tetro, ...)
  color: GameColor;
  best: number;
  plays: string;
}

export interface ScoreRow {
  rank: number;
  name: string;
  score: number;
  date: string;
}

export const GAMES: Game[];
export const CATS: readonly ["TODOS", "ARCADE", "PUZZLE", "SHOOTER", "VERSUS"];
export const PLAYERS: string[];

export function seededScores(seed: number, count?: number): ScoreRow[];
```

No se introduce ninguna estructura nueva: es el mismo contenido de `GAMES`, `CATS`, `PLAYERS` y la misma implementación de `seededScores` (PRNG determinista basado en `seed`), solo tipado y exportado como módulo ES desde `lib/data.ts`.

## Plan de implementación

1. **Crear `lib/data.ts`**: portar `GAMES`, `CATS`, `PLAYERS` y `seededScores` desde `references/templates/data.jsx`, tipado según el modelo de datos. Sin UI todavía; el sistema sigue funcionando igual.

2. **Crear `Nav`** (`app/components/Nav.tsx`, client component) y montarlo en `app/layout.tsx` junto con el footer fijo. Adaptar de `nav.jsx`: usar `usePathname()` para resaltar el link activo, `next/link` para navegar, menú móvil con `useState` para abrir/cerrar. Estado siempre "invitado": botón "Iniciar Sesión" enlaza a `/login`. Coin counter estático ("CRÉDITOS · 03").

3. **Implementar `/` (Biblioteca)**: `app/page.tsx` + `app/components/GameCard.tsx`, adaptados de `biblioteca.jsx`. Búsqueda y chips de categoría con `useState`/`useMemo`, tilt 3D en hover, grid de `GAMES`. Click en una card navega a `/juego/[id]`.

4. **Implementar `/juego/[id]` (Detalle)**: `app/juego/[id]/page.tsx`, adaptado de `detalle.jsx`. Busca el juego en `GAMES` por `id` (404 si no existe vía `notFound()`), muestra info, tags, stat-strip y leaderboard con `seededScores`. Botones "Jugar ahora" → `/juego/[id]/jugar`, "Volver al Vault" → `/`.

5. **Implementar `/juego/[id]/jugar` (Reproductor)**: `app/juego/[id]/jugar/page.tsx`, client component adaptado de `reproductor.jsx`. Mismo bucle de puntuación simulado, HUD, pausa, niveles, CRT animado y modal de fin de juego con input de iniciales y "guardar puntuación" (estado local, sin localStorage). "Salir" → `/juego/[id]`, "Volver al Vault" → `/`.

6. **Implementar `/login` (Auth)**: `app/login/page.tsx`, client component adaptado de `auth.jsx`. Tabs "Iniciar sesión"/"Crear cuenta", formulario controlado, todos los botones (submit, invitado, Google, GitHub) navegan a `/` mediante `useRouter().push("/")`.

7. **Implementar `/salon-fama` (Salón de la Fama)**: `app/salon-fama/page.tsx`, client component adaptado de `salon.jsx`. Tabs por juego (`useState`), podio top 3 y tabla animada con `seededScores`. Sin fila "tu mejor marca" (siempre invitado). Botón "Volver a la biblioteca" → `/`.

8. **Verificación final**: `npm run lint` y `npm run build` sin errores; recorrido manual por las 5 rutas comprobando navegación cruzada, responsive (breakpoints ya definidos en `globals.css`) y que las animaciones/efectos visuales (scanlines, CRT, neón, tilt, podio) se vean igual que en `references/templates/Arcade Vault.html`.

## Criterios de aceptación

- [ ] `lib/data.ts` exporta `GAMES`, `CATS`, `PLAYERS` y `seededScores` con los mismos valores y comportamiento que `references/templates/data.jsx`.
- [ ] La ruta `/` muestra el hero, la barra de búsqueda, los chips de categoría (`TODOS`, `ARCADE`, `PUZZLE`, `SHOOTER`, `VERSUS`) y el grid de las 8 cards de `GAMES`.
- [ ] En `/`, escribir en el buscador y/o seleccionar un chip filtra el grid en tiempo real; si no hay resultados se muestra el mensaje "NO HAY RESULTADOS".
- [ ] Hacer click en una card o en su botón "JUGAR" navega a `/juego/[id]` con el `id` correcto.
- [ ] `/juego/[id]` muestra portada, tags, descripción larga, stat-strip (partidas, mejor global, dificultad) y un leaderboard de 10 filas generado con `seededScores`.
- [ ] En `/juego/[id]`, "▶ JUGAR AHORA" navega a `/juego/[id]/jugar` y "VOLVER AL VAULT" navega a `/`.
- [ ] `/juego/[id]/jugar` muestra el HUD (jugador, puntuación, vidas, nivel) que se actualiza automáticamente, el CRT animado, y los botones PAUSA/REANUDAR, FIN y SALIR funcionan.
- [ ] Al pulsar "FIN" aparece el modal de fin de juego con la puntuación final; al introducir iniciales y pulsar "GUARDAR PUNTUACIÓN" se muestra el toast "PUNTUACIÓN GUARDADA"; "JUGAR DE NUEVO" reinicia el estado y "VOLVER AL VAULT" navega a `/`.
- [ ] `/login` muestra el formulario con tabs "INICIAR SESIÓN"/"CREAR CUENTA" (el campo correo solo aparece en "CREAR CUENTA"), y todos sus botones de acción (submit, invitado, Google, GitHub) navegan a `/`.
- [ ] `/salon-fama` muestra el podio (top 3) y la tabla de puntuaciones para el juego seleccionado; cambiar de tab actualiza podio y tabla; no aparece la fila "tu mejor marca".
- [ ] El `Nav` aparece en las 5 rutas, resalta el link activo correctamente, y en viewport móvil el botón hamburguesa abre/cierra el panel lateral.
- [ ] `npm run lint` y `npm run build` finalizan sin errores.
- [ ] El aspecto visual (colores, tipografías, efectos neón/scanlines/CRT, animaciones) coincide con `references/templates/Arcade Vault.html` abierto en el navegador.

## Decisiones tomadas y descartadas

- **Rutas reales de Next.js en vez de router por hash**: se descarta replicar `app.jsx` (SPA con `location.hash` y `useState`). Next.js App Router ya da routing real, mejor para SEO/navegación nativa y es la convención del proyecto.
- **Estado siempre "invitado"**: se descarta portar `av_user`/localStorage de la plantilla. Como este spec es solo visual, no tiene sentido simular sesión sin autenticación real; se deja para un spec futuro de autenticación.
- **Botones de Auth navegan a `/`**: en lugar de no hacer nada, se usa la navegación como demostración del flujo visual completo, sin implicar que se creó una cuenta o sesión real.
- **Reproductor mantiene su simulación interactiva** (bucle de puntuación, pausa, modal de fin de juego): se decide mantenerla porque es parte del comportamiento visual/UX de la pantalla, pero el "guardar puntuación" queda en estado local del componente (no localStorage), ya que la persistencia real queda fuera de alcance.
- **Datos mock en `lib/data.ts`**: se descarta duplicar datos por pantalla; se centralizan para que Biblioteca, Detalle y Salón de la Fama usen la misma fuente, igual que en las plantillas.
- **Reutilizar `app/globals.css` tal cual**: ya contiene el port completo de `styles.css` (confirmado al revisar el archivo), por lo que no se requiere trabajo adicional de estilos salvo ajustes puntuales si surgen durante la implementación.
