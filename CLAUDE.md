# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

Arcade Vault — an online gaming platform where users play and compete for high scores. Uses Spec Driven Design: features are designed via `/spec` before implementation with `/spec-impl`. Specs live in `specs/` (numbered, with status, dependencies, and date); see `specs/01-pantallas-visuales.md` through `specs/09-controles-tactiles.md`, plus the autonomous game-jam specs under `specs/agent-jam/` (written by the `game-jam` agent).

UI copy and spec language are in **Spanish**. No test runner is configured yet.

### Stack

- **Next.js 16.2** (App Router, Turbopack) + **React 19.2** + **TypeScript 5**.
- **Tailwind CSS v4** (PostCSS, no config file).
- **Supabase** (`@supabase/ssr` + `@supabase/supabase-js`) — game catalog + leaderboards.
- **Resend** — contact form email.

### Routes (`app/`)

- `/` (`page.tsx`) — home / catalog landing.
- `/biblioteca` — full game library.
- `/juego/[id]` — game detail page (description + leaderboard).
- `/juego/[id]/jugar` — game player (`GamePlayer`).
- `/salon-fama` — global hall of fame / leaderboards.
- `/about` — about page + contact form (posts to `/api/contact`, sends via Resend).
- `/login` — auth screen (currently a mock UI that just routes to `/`).
- `/api/contact` (`route.ts`) — POST handler; emails contact form via Resend (`RESEND_API_KEY`, `CONTACT_EMAIL_TO`).

### Games

The live catalog (Supabase `games` table) currently holds four games, each with a real canvas/JS engine wired into `GamePlayer` (selected by `game.id`): Asteroides, Tetris, Snake, Frogger. See [`JUEGOS.md`](JUEGOS.md) for the catalog table.

Each engine takes `paused`/`resetSignal`/`endSignal` props and emits score/level callbacks. Other entries in the mock `GAMES` array are placeholder cards (animated arena, auto-incrementing score). On game over, players can save their score to the Supabase leaderboard. Touch devices get on-screen controls (spec 09): `GamePlayer` defines a `<JUEGO>_TOUCH` config per engine and renders `TouchControls` when `lib/useIsTouchDevice.ts` detects a touch pointer.

### Data layer

- `lib/data.ts` — shared types (`Game`, `ScoreRow`, `GameColor`), category list `CATS`, and the original **mock** `GAMES` array + `PLAYERS`/`seededScores` for placeholder leaderboards.
- `lib/games.ts` — reads the live game catalog from the Supabase `games` table (`getGames`, `getGame`). NOTE: the catalog now lives in Supabase, not the mock `GAMES` array.
- `lib/leaderboard.ts` — real scores via the Supabase `scores` table (`getGameScores`, `saveGameScore`, `getRealGameIds`).
- `utils/supabase/{client,server,middleware}.ts` — SSR Supabase client factories (`createClient`).
- Supabase tables: `games` (catalog) and `scores` (`game_id`, `player_name`, `score`, `created_at`).

## Key Next.js 16 changes (breaking from prior versions)

- **Turbopack** is the default bundler. Use `next dev --webpack` only if needed.
- **`next build` no longer runs the linter.** Run `npm run lint` explicitly.
- **`next lint` is removed** — use the `eslint` CLI directly (already configured in `package.json`).
- App Router is used (`app/` directory). Do not create a `pages/` directory.
- Always read `node_modules/next/dist/docs/` for the API before writing Next.js-specific code.

## Skills

- Usa siempre **/frontend-design** para diseñar la interfaz de usuario.
- Diseña features con **/spec** antes de implementarlas con **/spec-impl**.
- Playwright screenshots → guardar en `.playwright-screenshots/`.

## Agents

Cada agente está definido en `.claude/agents/<nombre>.md` (ahí vive su prompt completo y sus reglas). Resumen:

- **game-planner** — decide qué juego añadir; analiza huecos del catálogo y registra sugerencias en `game-suggestions.md`. Solo propone; no escribe specs ni código.
- **game-jam** — dado un tema, diseña un juego de forma autónoma y escribe ≥2 specs (motor + leaderboard) en `specs/agent-jam/<game-id>/`. Escribe specs, nunca código.
- **mobile-porter** — cablea controles táctiles (spec 09) de un juego concreto añadiendo su `<JUEGO>_TOUCH` en `GamePlayer.tsx`. Un juego por invocación.
- **skin-designer** — aplica los skins canónicos (classic/retro/neon) a un juego concreto siguiendo el patrón de `TetrisGame`; registra progreso en `references/game-with-themes.md`.

## Architecture

- `app/layout.tsx` — root layout with Geist fonts, sets `<html>`/`<body>` with Tailwind base classes; renders `Nav`.
- `app/globals.css` — global styles + the neon/CRT arcade theme (Tailwind CSS v4 via PostCSS).
- `app/components/` — `Nav`, `GameCard`, `GamePlayer`, and `games/` (`Asteroides`, `Tetris`, `Snake`, `Frogger`, `TouchControls`).
- `@/*` path alias maps to the project root (configured in `tsconfig.json`).
- Tailwind CSS v4 is used — configured via `@tailwindcss/postcss`, not `tailwind.config.js`.
- `references/` — `started-games/` holds reference engines used as a starting point for new games; `game-with-themes.md` tracks skin (classic/retro/neon) progress per game, maintained by the `skin-designer` agent.
- `game-suggestions.md` (root) — memory of past game suggestions, maintained by the `game-planner` agent.

## Env vars

- `RESEND_API_KEY`, `CONTACT_EMAIL_TO` — contact form email.
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or publishable key) — Supabase client.
