---
name: spec-game
description: Designs a spec for porting/creating a new playable game (canvas engine, catalog entry, GamePlayer integration and real Supabase leaderboard) and integrating it into Arcade Vault. Use it before /spec-impl when adding a new game to the catalog.
disable-model-invocation: true
argument-hint: '[game-id or short description], e.g. "tetris" or "caida (from references/started-games/03-tetris)"'
---

# /spec-game — Spec designer for new playable games

This is a specialized variant of `/spec` for one recurring kind of feature in this project: **turning one entry of the games catalog into a real, playable game with a real leaderboard**. It follows the same four-phase, section-by-section method as `/spec` and produces a spec file in `specs/` ready for `/spec-impl`. **You don't write code here.**

The canonical precedent is the pair of specs that did this for Asteroides:

- `specs/05-asteroides.md` — ports the engine to a React/canvas component and wires it into `GamePlayer`.
- `specs/06-leaderboard-asteroides-supabase.md` — adds the Supabase `games`/`scores` tables and real leaderboard.

A spec produced by this skill should cover **both** halves (engine port + real leaderboard) for one game, generalized so it does not assume "asteroides" — read both files in full before starting, they are your shape reference for sections, plan granularity and acceptance-criteria style.

Your replies must be in the same language as the initial prompt (this project's specs are written in Spanish).

## Phase 1 — Understand the context

Before asking anything, gather state:

1. Read `CLAUDE.md` / `AGENTS.md`.
2. List `specs/` and read `specs/05-asteroides.md` and `specs/06-leaderboard-asteroides-supabase.md` in full.
3. List `references/started-games/*` — these are candidate source engines (currently `02-asteroids`, `03-tetris`, `04-arkanoid`). Cross-check against `lib/data.ts` `GAMES` (`cover`, `id`) to see which ones are already ported (asteroides ← `02-asteroids`). The user may also choose "from scratch" / a different reference, not necessarily from this folder.
4. Read `lib/data.ts`: the `Game` interface, the full `GAMES` array (existing `id`s, `cover` classes, `cat`/`color` values already used, tone of `short`/`long`), `PLAYERS`, and `seededScores`.
5. Read `lib/leaderboard.ts` and check its current state:
   - **Asteroides-specific** (`getAsteroidesScores` / `saveAsteroidesScore`, hardcoded `"asteroides"`): the spec's plan must include a step to **generalize** it to `getGameScores(supabase, gameId)` / `saveGameScore(supabase, gameId, name, score)`, updating the existing Asteroides caller.
   - **Already generalized**: the spec reuses the generic functions directly, no refactor step needed.
6. Read `app/juego/[id]/page.tsx` and `app/salon-fama/page.tsx` and check how the real-vs-mock leaderboard branch is implemented:
   - **Hardcoded** (`id === "asteroides"` / `tab === "asteroides"`): the spec's plan must include a step to make this **data-driven** — e.g. look up `id` in the `games` table; if present, use `getGameScores`, otherwise `seededScores`. This is what lets a second (and Nth) real game plug in without another hardcoded branch.
   - **Already data-driven**: no refactor step needed, the new game just needs its row in `games`.
7. Skim `app/components/games/Asteroides.tsx` and the relevant block of `app/components/GamePlayer.tsx` (the `isAsteroides` conditionals) as the reference shape for the new engine component and its `GamePlayer` integration (`*Props` interface with `paused`/`resetSignal`/`endSignal`/`onXChange`/`onGameOver`, conditional rendering inside `.game-arena`, extra HUD stats).

If `$ARGUMENTS` is empty, ask for a one-sentence description of which game to add (name + optional source).

## Phase 2 — Clarify through questions

Same rules as `/spec`: ask in blocks of 3–5, wait for answers, give concrete options with a recommendation.

Always resolve:

1. **Source engine.** Which `references/started-games/NN-*` folder (list the ones not yet ported), or "no reference, build the loop from scratch / from another source the user provides"? Confirm the entry-point file (e.g. `game.js`) to port.
2. **Catalog entry** (`lib/data.ts` → `GAMES`): `id`, `title`, `short`/`long` (same retro-gamer tone as existing entries — show 1–2 existing entries as style reference), `cat` (`ARCADE`/`PUZZLE`/`SHOOTER`/`VERSUS`), `color`, `cover` class name, `best`, `plays`. Flag if `id`/`cover` collide with an existing mock entry that covers similar ground (as `asteroides` vs `rocas` did) and confirm whether to reuse/replace or add a new entry.
3. **Engine → HUD contract.** Beyond `score`/`lives`/`level` (the baseline `*Props` shape from Asteroides), does this game report any extra transient state to the HUD (power-ups, combo, special meter, etc.)? Does `level` come from the engine or from the generic `Math.floor(score/2500)+1` formula used for mock games?
4. **Controls.** Keyboard mapping, and whether any keys need `preventDefault` to stop page scroll.
5. **Leaderboard seed.** How many seed rows for `scores` (10–12, matching the existing pattern), names drawn from `PLAYERS`, plausible score range/dates.
6. **Refactor steps from Phase 1.** Confirm explicitly whether this spec needs to (a) generalize `lib/leaderboard.ts` and/or (b) make `/juego/[id]` and `/salon-fama` data-driven, based on what you found — don't assume, state what you found and ask for confirmation to include or skip each.

Stop when you can answer, for this game: which files appear/change, what the first and last executable steps are, and how to verify it's done — same bar as `/spec`.

## Phase 3 — Develop the spec section by section

Use `template.md` from `.claude/skills/spec/` for section shape. Produce **one** spec covering both halves (engine port + real leaderboard), in this order, confirming each with the user before moving on:

1. **Header** — one-sentence objective (e.g. "Port `<engine>` to a playable React/canvas component, add it to the catalog and give it a real Supabase leaderboard"). Dependencies should reference `01-pantallas-visuales` (Reproductor/HUD/modal) and, if `games`/`scores` already exist, the spec that created them (`06-leaderboard-asteroides-supabase`) instead of recreating the tables.
2. **Scope** — In/Out. Mirror the structure of 05+06's "Incluye"/"No incluye": catalog entry + cover CSS, engine component, `GamePlayer` integration (HUD wiring, pause/end/restart/exit), `games`/`scores` row + seed for this game, real leaderboard in `/juego/[id]` and `/salon-fama`, "GUARDAR PUNTUACIÓN" wired to `saveGameScore`. Explicitly exclude touch controls, audio, auth, other catalog entries, automated tests — unless the user asked for them.
3. **Data model** — concrete, generalized:
   - New `GAMES` entry (full object literal).
   - New `.cover-<id>` CSS class (described, not full CSS).
   - `*Props` interface for the new engine component, following the Asteroides shape (`paused`, `resetSignal`, `endSignal`, `onScoreChange`, `onLivesChange`, `onLevelChange`, any extra `onXChange`, `onGameOver`).
   - SQL for the new row(s): `insert into games (id, title) values (...)` + seed `insert into scores (...)`. Only include `create table`/RLS SQL if Phase 1 found those tables don't exist yet (they should already exist after spec 06).
   - If applicable, the new signatures for `lib/leaderboard.ts` (`getGameScores`/`saveGameScore`) and how `/juego/[id]` / `/salon-fama` will look up `games` by `id`.
4. **Implementation plan** — numbered, each step leaves the system functional, mirroring 05+06's granularity:
   - Catalog entry + cover CSS (cosmetic only, system still works).
   - Engine component port (not wired anywhere yet).
   - `GamePlayer` integration (conditional render + HUD wiring + pause/end/restart/exit), generalizing the `isAsteroides`-style conditional to also branch on this game's `id` without breaking the existing branch.
   - `lib/leaderboard.ts` generalization — **only if** Phase 1 found it asteroides-specific.
   - Migration: insert `games` row + seed `scores` for this game (via `apply_migration`).
   - `/juego/[id]` and `/salon-fama` — generalize to data-driven lookup **only if** Phase 1 found them hardcoded; otherwise just confirm the new game's id flows through the existing generic path.
   - "GUARDAR PUNTUACIÓN" → `saveGameScore` for this game's id.
   - Final verification (`npm run lint`, `npm run build`, manual playthrough).
5. **Acceptance criteria** — boolean checklist covering: catalog card renders, `/juego/<id>` shows real leaderboard with seed rows, `/jugar` renders the playable canvas with working controls and HUD, pause/end/restart/exit behave per the established pattern, saving a score inserts into `scores` and appears after reload, other catalog entries/games are unaffected, lint/build pass.
6. **Decisions taken and discarded** — at minimum: why this `id`/`cover` vs reusing an existing mock entry; whether `lib/leaderboard.ts`/page-level branching were generalized now or deferred (and what "deferred" implies for the _next_ game); same exclusions as 05/06 (no persistence beyond scores, no touch/audio/auth) unless the user changed them.
7. **Identified risks** — only if non-obvious. Reuse 05/06's categories where relevant (Strict Mode double-mount, per-frame callback re-renders, canvas resize/coordinate scaling) adapted to this engine, plus any risk specific to generalizing shared code (e.g. regressing the Asteroides leaderboard while refactoring `lib/leaderboard.ts`).

## Phase 4 — Save the spec

Same as `/spec`:

1. Determine the next sequential number from `specs/`.
2. Propose `specs/NN-<slug>.md` (slug from the game's `id`, e.g. `07-tetris-leaderboard`), confirm with the user.
3. Write the file with state `Draft`.
4. Confirm path, remind the user to mark it `Aprobado`/`Approved` after re-reading, and that `/spec-impl NN-slug` is the next step. **Stop here** — no implementation, no further proposals.

## Hard rules

- Never write code or touch `lib/`, `app/`, or Supabase during this command — only the spec `.md` file at the end.
- Never assume which `references/started-games` folder to use, or whether `lib/leaderboard.ts` / the page-level branching need generalizing — verify in Phase 1, confirm in Phase 2.
- Never silently reproduce asteroides-specific names (`getAsteroidesScores`, `isAsteroides`, `"asteroides"` literals) in the new spec — generalize per Phase 1 findings.
- Section by section, with confirmation, exactly like `/spec`.
