# Arcade Vault

Plataforma web para jugar arcade online y competir por la mayor puntuación.

## Stack

- **Next.js 16.2** (App Router, Turbopack) + **React 19.2** + **TypeScript 5**
- **Tailwind CSS v4** (vía PostCSS, sin archivo de config)
- **Supabase** — catálogo de juegos, leaderboards y autenticación (`@supabase/ssr`)
- **Resend** — envío del formulario de contacto

## Comandos

```bash
npm run dev       # servidor de desarrollo (Turbopack)
npm run build     # build de producción (NO ejecuta lint)
npm run start     # servidor de producción
npm run lint      # ESLint vía CLI (next lint ya no existe)
```

No hay test runner configurado.

## Variables de entorno (`.env.local`)

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
RESEND_API_KEY=
CONTACT_EMAIL_TO=
```

## Rutas

| Ruta                    | Descripción                                 |
| ----------------------- | ------------------------------------------- |
| `/`                     | Home / landing del catálogo                 |
| `/biblioteca`           | Biblioteca completa de juegos               |
| `/juego/[id]`           | Detalle del juego + leaderboard             |
| `/juego/[id]/jugar`     | Reproductor del juego (`GamePlayer`)        |
| `/salon-fama`           | Salón de la fama global                     |
| `/about`                | Sobre el proyecto + formulario de contacto  |
| `/login`                | Registro / inicio de sesión (Supabase Auth) |
| `/login/reset-password` | Fijar nueva contraseña                      |
| `/auth/callback`        | Callback de OAuth y confirmación de email   |
| `/api/contact`          | POST del formulario de contacto (Resend)    |

## Juegos

Cuatro motores canvas/JS reales: **Asteroides**, **Tetris**, **Snake** y **Frogger**.
El catálogo vive en la tabla `games` de Supabase — ver [`JUEGOS.md`](JUEGOS.md).
En dispositivos táctiles se renderizan controles en pantalla (`TouchControls`).

## Estructura

```
app/            rutas (App Router) + components/ (Nav, GameCard, GamePlayer, games/)
lib/            data.ts (tipos + mocks), games.ts, leaderboard.ts, useIsTouchDevice.ts
utils/supabase/ factories de cliente SSR (client, server, middleware)
proxy.ts        refresca la sesión SSR en cada request (Next 16: reemplaza middleware.ts)
specs/          specs numerados + agent-jam/ (specs autónomos del agente game-jam)
references/     motores de referencia, skins por juego y checklist de seguridad
```

## Spec Driven Design

Las features se diseñan con `/spec` antes de implementarse con `/spec-impl`.
Los specs viven en `specs/` numerados y con estado, dependencias y fecha
(`01-pantallas-visuales` … `11-seguridad`). La UI y los specs están en español.

### Agentes (`.claude/agents/`)

| Agente          | Qué hace                                                                                                                                                               | Escribe en                                                           |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `game-planner`  | Estratega de producto: analiza huecos del catálogo y propone/decide el próximo juego con justificación (categoría, color, viabilidad). No escribe specs ni código.     | `game-suggestions.md`                                                |
| `game-jam`      | Dado un **tema**, diseña un juego de forma autónoma y entrega ≥2 specs completos (motor jugable + leaderboard real) listos para `/spec-impl`. Nunca escribe código.    | `specs/agent-jam/<game-id>/`                                         |
| `mobile-porter` | Cablea los controles táctiles (spec 09) de **un** juego añadiendo su config `<JUEGO>_TOUCH`. No toca el motor del juego, `TouchControls.tsx` ni `useIsTouchDevice.ts`. | `app/components/GamePlayer.tsx`                                      |
| `skin-designer` | Aplica los 3 skins canónicos (`classic`, `retro`, `neon`) a **un** juego siguiendo el patrón de `TetrisGame`. Exige juego objetivo explícito.                          | `app/components/games/<Juego>.tsx`, `references/game-with-themes.md` |

`mobile-porter` y `skin-designer` trabajan **un juego por invocación** y no auditan ni
modifican los demás.

## Seguridad

Spec [`11-seguridad`](specs/11-seguridad.md) aplica RLS en `games`/`scores`, restricciones
de contraseña en Supabase Auth y security headers en `next.config.ts`.
**Pendiente:** no hay Content-Security-Policy (fuera de alcance del spec 11).
