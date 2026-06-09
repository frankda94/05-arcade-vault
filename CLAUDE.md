# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

Arcade Vault — an online gaming platform where users play and compete for high scores. Uses Spec Driven Design: features are designed via `/spec` before implementation with `/spec-impl`.

## Commands

```bash
npm run dev       # start dev server (Turbopack, default)
npm run build     # production build (does NOT lint — run lint separately)
npm run start     # start production server
npm run lint      # ESLint via eslint CLI (not next lint)
```

No test runner is configured yet.

## Key Next.js 16 changes (breaking from prior versions)

- **Turbopack** is the default bundler. Use `next dev --webpack` only if needed.
- **`next build` no longer runs the linter.** Run `npm run lint` explicitly.
- **`next lint` is removed** — use the `eslint` CLI directly (already configured in `package.json`).
- App Router is used (`app/` directory). Do not create a `pages/` directory.
- Always read `node_modules/next/dist/docs/` for the API before writing Next.js-specific code.

## Architecture

- `app/layout.tsx` — root layout with Geist fonts, sets `<html>` and `<body>` with Tailwind base classes.
- `app/page.tsx` — home page (currently default scaffold).
- `app/globals.css` — global styles (Tailwind CSS v4 via PostCSS).
- `@/*` path alias maps to the project root (configured in `tsconfig.json`).
- Tailwind CSS v4 is used — configured via `@tailwindcss/postcss`, not `tailwind.config.js`.
