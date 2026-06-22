---
name: spec-impl-game
description: Implements an approved game spec by reusing the /spec-impl flow, then automatically runs skin-designer and mobile-porter (in that order) on the implemented game. Use it instead of /spec-impl when the approved spec adds a new playable game to the catalog.
disable-model-invocation: true
argument-hint: <NN-spec-name>
allowed-tools: Bash(git status:*), Bash(git branch:*), Bash(git checkout:*), Bash(cat:*), Bash(ls:*)
---

# /spec-impl-game — Implementer of approved game specs + automatic skin/mobile follow-up

This is a specialized variant of `/spec-impl` for specs that add a **new playable game** to the catalog. It runs the exact same four-phase implementation flow as `/spec-impl` (see `.claude/skills/spec-impl/SKILL.md`), and once the implementation is finished it automatically chains two agents on the implemented game, in strict order: **`skin-designer`** first, then **`mobile-porter`**.

## Session context

Current repository state:
!`git status --short`

Current branch:
!`git branch --show-current`

Specs available in this folder:
!`ls specs/ 2>/dev/null || echo "The specs/ folder does not exist"`

---

## Instructions

Follow these five phases in strict order. **Do not advance to the next phase if the previous one did not complete correctly.** Phases 1–4 are identical to `.claude/skills/spec-impl/SKILL.md` — apply them in full, without skipping or shortening any step. Phase 5 is the addition this skill makes.

---

### Phase 1 — Identify the spec

The received argument is: `$ARGUMENTS`

If `$ARGUMENTS` is empty:

- List the files available in `specs/` (you already have them above).
- Ask the user to specify the exact name of the spec.
- Stop and wait for an answer. Do not continue.

If `$ARGUMENTS` has a value:

- Look for the file in `specs/`. The user may have written the full name (`07-tetris-leaderboard`), only the number (`07`), or only the slug (`tetris-leaderboard`). Try to find the correct file in any of those cases.
- If you do not find the file, show the available specs and ask the user to correct the name.
- If you do find it, continue to Phase 2.

---

### Phase 2 — Validate the spec's state

Read the spec file you located in Phase 1 using the Read tool or `cat`.

In the file's contents, look for the line that contains the spec's state. The header label is typically `**Status:**` (English) or `**Estado:**` (Spanish), but it may use any language. Match by position (status line near the top of the spec) and by the surrounding state machine, not by the exact label.

**Absolute rule:** You can only continue if the state **means "Approved"** — regardless of the language used.

Treat any of the following (and their equivalents in other languages) as the **Approved** state and continue:

- English: `Approved`
- Spanish: `Aprobado`
- Portuguese: `Aprovado`
- French: `Approuvé`
- German: `Genehmigt`
- Italian: `Approvato`
- …or any other language's word that clearly means "approved"

Anything else (Draft / Borrador, In review / En revisión, Implemented / Implementado, Obsolete / Obsoleto, or any unrecognized value) means **stop** and show the error message below. **Do not run any agent in this case.**

| State category                            | Examples (any language)                           | Action                                                                     |
| ----------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------- |
| Approved                                  | `Approved`, `Aprobado`, `Aprovado`, `Approuvé`, … | Continue to Phase 3.                                                       |
| Draft                                     | `Draft`, `Borrador`, …                            | Stop. Show the error message below.                                        |
| In review                                 | `In review`, `En revisión`, …                     | Stop. Show the error message below.                                        |
| Implemented                               | `Implemented`, `Implementado`, …                  | Stop. Show the error message below.                                        |
| Obsolete                                  | `Obsolete`, `Obsoleto`, …                         | Stop. Show the error message below.                                        |
| State line not found / unrecognized value | —                                                 | Stop. The file does not follow the expected format. Tell this to the user. |

If you are unsure whether a value means "approved", **do not assume**. Stop and ask the user to clarify or to update the spec to the canonical wording.

**Standard error message when the state does not mean Approved:**

```
❌ I cannot implement this spec.

Current state: [STATE FOUND]
I only work with specs whose state means "Approved" (e.g. `Approved`, `Aprobado`,
or the equivalent in another language).

To continue you have two options:
  1. If the spec is ready to be implemented, open it and change the state
     to "Approved" (or the equivalent term your team uses) manually.
     That change is made by the human, not the agent.
  2. If the spec still needs work, use /spec [name] to resume it.
```

Do not offer alternatives, do not suggest "I can still start if you want". The block is intentional.

---

### Phase 3 — Create the git branch and switch to it

Once you have confirmed the state means `Approved`:

1. Derive the branch name from the spec file's full name, without the extension. Format: `spec-NN-slug`. Examples:

   - `07-tetris-leaderboard.md` → branch `spec-07-tetris-leaderboard`
   - `02-powerups.md` → branch `spec-02-powerups`

2. Check whether the branch already exists:

   - If it **does not exist**: create it with `git checkout -b spec-NN-slug`.
   - If it **already exists**: inform the user that the branch already existed (it may mean previous work is being resumed).
   - In both cases: switch to the branch with `git checkout spec-NN-slug` and confirm the change was successful before continuing.

3. Visually confirm to the user that the branch was created and that you are on it:

   ```
   ✅ Ready to implement.

   Spec:   specs/NN-slug.md
   Branch: spec-NN-slug  (active)
   State:  Approved   (← echo back the actual value found in the spec)
   ```

4. **Do not start implementing yet.** First show the spec summary to the user so they have it fresh. Extract and show:
   - The **objective** (the line after `**Objective:**` / `**Objetivo:**` / equivalent label).
   - The **scope** (the `## Scope` / `## Alcance` / equivalent section).
   - The **implementation plan** (the section with the numbered steps — `## Implementation plan` / `## Plan de implementación` / equivalent).
   - The **acceptance criteria** (the checklist — `## Acceptance criteria` / `## Criterios de aceptación` / equivalent).

   Also note, for use in Phase 5, the **game id** this spec introduces: look at the `GAMES` entry / `insert into games` SQL in the Data model section for an `id` field. Keep this candidate id in mind — it will be confirmed against the actual code in Phase 5.

Match section headings by meaning, not by exact wording — the spec may be authored in any language.

---

### Phase 4 — Implement step by step

After showing the spec summary, tell the user:

```
I am going to implement the spec following the implementation plan exactly.
I will pause after each step so you can review the diff.

Shall we start with Step 1?
```

Wait for explicit confirmation ("yes", "go ahead", "go", or equivalent). Do not start without it.

Once confirmed, follow these rules during the entire implementation:

**One rule above all:** implement what the spec says. If something in the spec looks suboptimal to you, mention it as an observation but implement what was agreed. Changes to the spec go into the spec, not into the code by surprise.

**Work rhythm:**

- Implement one step of the plan.
- Show a summary of which files you touched and what you did.
- Say: `Step N completed. Could you review the diff and let me know if I continue with Step N+1?`
- Wait for confirmation before continuing.

**If during the implementation you find an ambiguity** the spec does not resolve:

- Stop.
- Describe the ambiguity exactly.
- Present two or three concrete options.
- Wait for the user's decision.
- Do not improvise.

**If the user asks for something that is out of the spec's scope:**

- Remind them that it is out of this spec's scope.
- Suggest noting it down for the next spec.
- Do not implement it on this branch.

**When finishing the last step:**

```
✅ All steps of the plan are implemented.

Next step: verify the spec's acceptance criteria one by one.
```

Verify the acceptance criteria one by one with the user before moving to Phase 5. **Do not run any agent until this verification is done.**

---

### Phase 5 — Chain skin-designer → mobile-porter (this skill's addition)

This phase only runs if Phase 4 closed successfully (all plan steps implemented and acceptance criteria verified). If the implementation was blocked, paused indefinitely, or abandoned, **do not run this phase**.

1. **Derive the target game id.** Cross-check the candidate id noted in Phase 3 against the actual code:
   - `lib/data.ts` (`GAMES` array — does an entry with this `id` exist?)
   - `components/games/` (is there a `<Juego>.tsx` component matching this game, freshly created/modified by this implementation?)
   - The spec's slug itself (e.g. `07-tetris-leaderboard` → `tetris`).

   Resolve to a single concrete game id (lowercase, matching `lib/data.ts`/`app/games/<id>/`). Tell the user which game id you resolved to, e.g.:

   ```
   🎮 Juego objetivo para los agentes de seguimiento: tetris
   ```

   This is informational — do not pause for confirmation, the id comes directly from the spec just implemented.

2. **Run `skin-designer` first.** Launch it (subagent_type `skin-designer`) with a self-contained prompt telling it to apply the three canonical skins (classic/retro/neon) to the resolved game id, per its own rules in `.claude/agents/skin-designer.md`. Wait for it to finish. Relay its final summary to the user (game, skins added with key palettes, files edited, updated row in `references/game-with-themes.md`).

3. **Only after `skin-designer` has finished**, run `mobile-porter` (subagent_type `mobile-porter`) on the **same** game id, telling it to wire touch controls (spec 10) per `.claude/agents/mobile-porter.md`. Wait for it to finish. Relay its final summary (game ported, play-page file modified, applied `keyMap`).

   **Why this order is mandatory:** `mobile-porter` wires the `MobileGamepad` skin selector (`skin={skinKey}` / `onSkinChange={changeSkin}`) into the play-page. That selector only has something real to control once `skin-designer` has added the skin system (`SKINS`, `skinKey` prop, `skinRef`) to the game component. Running `mobile-porter` first would force it to fall back to the `skin="classic"` / `onSkinChange={() => {}}` placeholder, leaving a TODO that `skin-designer` would then make stale. Never run them in parallel or reverse this order.

4. **Final unified summary** to the user, covering:
   - Spec implemented + branch.
   - skin-designer result.
   - mobile-porter result.
   - Reminder: verify acceptance criteria end-to-end (already done in Phase 4, but now including the new skins + touch controls), then update the spec's state to "Implemented" (or the repo's equivalent term) and make the final commit before merging the branch.

---

## Hard rules

- Phases 1–4 must run exactly as in `/spec-impl` — no shortcuts, no skipped pauses.
- Phase 5 never runs if Phase 4 did not close successfully.
- `skin-designer` and `mobile-porter` run **sequentially, never in parallel**: mobile-porter only starts after skin-designer's agent run has returned.
- Both agents receive the **same** game id, derived from the just-implemented spec — never a different or user-chosen game.
- Each agent works on exactly **one** game per this skill's invocation, per their own one-game-per-run rules.

## Summary of expected behavior

```
/spec-impl-game 07-tetris-leaderboard

  Phase 1  →  Finds specs/07-tetris-leaderboard.md
  Phase 2  →  Reads the state → "Approved" (or "Aprobado", etc.) → ✅ continues
  Phase 3  →  git checkout -b spec-07-tetris-leaderboard → git checkout spec-07-tetris-leaderboard
              Shows objective, scope, plan, criteria; notes candidate game id "tetris"
  Phase 4  →  Implements step by step with pauses
              Ends by verifying acceptance criteria
  Phase 5  →  Resolves game id → "tetris"
              Runs skin-designer on tetris → reports result
              Runs mobile-porter on tetris (after skin-designer finishes) → reports result
              Final unified summary

/spec-impl-game 02-powerups  (state: Draft / Borrador)

  Phase 1  →  Finds specs/02-powerups.md
  Phase 2  →  Reads the state → "Draft" → ❌ stops
              Shows the standard error message
              Does not create branch, does not touch code, does not run any agent
```
