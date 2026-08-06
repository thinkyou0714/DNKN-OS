# CLAUDE.md

## 1. Repository Role

- This repository is DENKEN-OS, an offline-first study OS for 電験 learners.
- The core promise is deterministic problem generation plus spaced repetition.
- Current status in README.md is pre-alpha.
- The app can run without an LLM because the default narrator is deterministic.
- Supabase integration exists in store adapters and migrations.
- The web app is a static offline PWA under `web/`.
- Shared domain code lives under `lib/`.
- Tests live under `tests/`.
- CI workflows live under `.github/workflows/`.

## 2. Quick Start

- Install dependencies:

```sh
npm install
```

- Run the full local verification pipeline:

```sh
npm run verify
```

- Run unit tests:

```sh
npm test
```

- Generate sample problems from the engine CLI:

```sh
npm run gen
```

- Build the offline web app:

```sh
npm run build:web
```

## 3. Architecture Map

- `README.md` gives the product overview, status, quick start, and release checklist.
- `docs/architecture.md` is the main architecture note.
- `lib/README.md` documents the shared TypeScript domain layer.
- `lib/engine/` owns problem schemas, templates, validation, narration, and generation.
- `lib/scheduler/` owns review scheduling and diagnosis.
- `lib/curriculum/` owns the systematic learning pipeline: prerequisite concept graph, principle cards, learning-path generation, foundation-gap diagnosis, why-check spaced repetition, explanation-gap detection, and coefficient reasoning (`coefficients.ts`: contrastive drills on when √3, 1/2, √2, 2, symmetrical-component, and per-unit coefficients apply — the 三種→二種 bridge). `web/src/concept-graph.ts` is a backward-compat re-export of `lib/curriculum/graph.ts`.
- `web/src/why-store.ts` persists why-check review state under `denken:whyCards`, separate from the practice cards in `web/src/store.ts` so that accuracy, XP, and weakness diagnosis stay unaffected.
- `web/src/coeff-store.ts` persists coefficient-drill review state under `denken:coeffCards` with the same isolation rationale as `why-store.ts`. Drill IDs are stable `family#index` keys; never reorder or insert mid-array in `lib/curriculum/coefficients.ts` (golden test in `tests/curriculum/coefficients.test.ts`).
- `lib/curriculum/rubric.ts` derives a weighted marking rubric from a problem's `solution` steps alone (no schema change): role classification (approach/formula/substitution/calculation/conclusion/note) with per-role weights, plus required-keyword and unit extraction for self-grading assistance. `note` steps (「ポイント:」「（補足…）」) weigh 0 — checking every scoring item must yield a perfect score on every descriptive problem (enforced against real data in `tests/curriculum/rubric.test.ts`).
- `lib/curriculum/misconceptions.ts` identifies what a wrong answer got wrong from the chosen/correct ratio (√3, 1/2, 2π, ×1000, sign…) and maps it to a coefficient family so the UI can send the learner straight to the matching drill. Classification happens at read time from `WebAnswerLog.chosen`, so extending the pattern table retroactively improves past logs.
- `lib/store/` owns persistence interfaces and implementations.
- `lib/audit/` owns repository quality status and supervision helpers.
- `web/` owns the offline PWA.
- `supabase/migrations/` owns database schema and RLS policy changes.
- `data/problems/` and `web/problems.json` are generated or curated problem data.
- `docs/x-strategy/templates/problem-schema.json` is the JSON Schema mirror for problems.
- `.github/workflows/validate.yml` is the main CI quality gate.
- `.github/workflows/e2e.yml` runs Playwright smoke tests on demand and weekly.
- `.github/workflows/deploy-pages.yml` deploys `web/` after successful `validate`.
- `.github/workflows/release.yml` runs `npm run release:check` before release draft creation.
- `.github/workflows/codeql.yml`, `dependency-review.yml`, and `secrets-scan.yml` provide security checks.

## 4. Engine

- `lib/engine/schema.ts` defines the zod problem schema and TypeScript types.
- `lib/engine/validate.ts` enforces zod validation plus code-only invariants.
- `lib/engine/generate.ts` implements the deterministic generation pipeline.
- `lib/engine/narrate.ts` owns wording only.
- `lib/engine/templates/` contains problem templates.
- `lib/engine/cli.ts` is used by `npm run gen`.
- The generated answer is computed by code from template parameters.
- LLM output must not be trusted for numeric correctness.
- The LLM may only rewrite `statement` and `solution` wording.
- `generate.ts` checks that narration keeps the final answer consistent with the code answer.
- If narration changes the problem parameters or final numeric answer, generation falls back or rejects the problem.
- `StubNarrator` is the default safe path when no API key is configured.

## 5. Schema As Lingua Franca

- Problem shape is shared across engine, web, data, and validation.
- The zod schema is `lib/engine/schema.ts`.
- The JSON Schema mirror is `docs/x-strategy/templates/problem-schema.json`.
- `scripts/validate-problems.ts` validates problem data.
- `tests/engine/schema-drift.test.ts` detects drift between schemas and real data.
- `tests/engine/schema-consistency.test.ts` checks representative zod and JSON Schema parity.
- When the problem shape changes, update both schemas in the same change.
- Do not update one schema without running the schema drift tests.
- `validateProblem` in `lib/engine/validate.ts` is the code path for draft-07 gaps such as `answer` in `choices`.

## 6. Scheduler

- `lib/scheduler/types.ts` defines the common `Scheduler` interface.
- `lib/scheduler/index.ts` exports `getScheduler`.
- `getScheduler("fsrs")` returns `FsrsScheduler`.
- `getScheduler("sm2")` returns `Sm2Scheduler`.
- The default scheduler kind is `fsrs`.
- `lib/scheduler/fsrs.ts` wraps `ts-fsrs`.
- `lib/scheduler/sm2.ts` implements the classic SM-2 algorithm.
- Keep scheduler callers behind exported APIs instead of hard-coding one implementation.
- Tests include `tests/scheduler/fsrs.test.ts`, `tests/scheduler/sm2.test.ts`, and `tests/scheduler/getScheduler.test.ts`.

## 7. Store Layer

- `lib/store/index.ts` defines `ProblemStore`, `AnswerLogStore`, and `ReviewStateStore`.
- `InMemoryProblemStore`, `InMemoryAnswerLogStore`, and `InMemoryReviewStateStore` are in-memory implementations.
- `lib/store/file-store.ts` contains JSON file implementations.
- `lib/store/supabase-store.ts` contains Supabase implementations.
- Store callers should depend on interfaces, not concrete implementations.
- `ProblemStore` persists validated problem records.
- `AnswerLogStore` persists user answer events.
- `ReviewStateStore` persists scheduler state per user and topic.
- Supabase row mapping and error propagation are covered by `tests/store/supabase-store.test.ts`.
- Store interface behavior is covered by `tests/store/store.test.ts` and `tests/store/file-store.test.ts`.

## 8. Supabase And RLS

- SQL migrations live in `supabase/migrations/`.
- `supabase/migrations/0001_init.sql` creates `problems`, `answer_logs`, and `review_states`.
- `answer_logs` and `review_states` are user-owned tables.
- The RLS ownership invariant is `auth.uid() = user_id`.
- Public problem reads are limited by status policy in migrations.
- `tests/infra/migrations.test.ts` statically checks migration order, RLS coverage, constraints, and policy shape.
- `tests/supabase/rls-mock.test.ts` models RLS policy behavior without a live Supabase database.
- When adding a migration, preserve existing policy names carefully because permissive policies are OR-evaluated.
- Never loosen ownership checks while adding column checks or new write policies.

## 9. Web PWA

- `web/src/` contains the browser app TypeScript.
- `web/index.html` is the static entrypoint.
- `web/sw.js` is the service worker.
- `web/manifest.webmanifest` is the PWA manifest.
- `web/problems.json` is the combined web problem bundle (kept for backward-compat and as a load fallback).
- `web/problems/<slug>.json` are per-subject shards and `web/problems/manifest.json` is their index (split-load).
- `lib/shared/problem-shards.ts` is the single source of truth for the subject→slug map, manifest type, and shard paths (shared by build, web, and tests).
- `web/src/app-init.ts` loads via the manifest+shards first and falls back to `web/problems.json`.
- `scripts/build-problems.ts` emits both the combined bundle and the shards+manifest deterministically.
- `scripts/build-web.ts` builds `web/dist/app.js` with esbuild.
- `npm run typecheck:web` typechecks `web/src` through `web/tsconfig.json`.
- `npm run build:web` builds the web bundle and updates deterministic build artifacts.
- `web/sw.js` cache versioning is owned by `scripts/build-web.ts`.
- Do not hand-edit the service worker cache version.
- The current build script replaces `__SW_VERSION__` or an existing `v<major>-<hash>` token from cached asset content.
- If cache versioning changes, keep it deterministic and covered by tests before relying on it in CI.

## 10. Audit And Supervision

- `lib/audit/status.ts` backs `npm run audit:status`.
- `scripts/audit-status.ts` is the audit command entrypoint.
- `npm run audit:status` is advisory.
- `npm run audit:status:strict` fails on warning-level audit items.
- `scripts/supervision-status.ts`, `scripts/supervision-packet.ts`, and `scripts/supervision-mark.ts` support per-problem supervision of `data/problems/` (52 curated problems).
- `lib/audit/template-supervision.ts` + `scripts/supervision-templates.ts` support per-template supervision, which covers the ~9,802 shipped problems generated from 158 templates (one template ≈ 62 problems). The ledger is `data/supervision/templates.json`.
- Template supervision records a behavioral fingerprint (a hash of deterministically generated samples plus declared metadata), so editing a template's formula, `realistic_range`, difficulty, solution text, or choices automatically invalidates its supervision and surfaces it as 要再監修 (stale). Comment/identifier-only edits do not. Never weaken this — it is what stops the ledger from carrying false "supervised" claims.
- Stale supervision and ledger orphans (entries whose topic no longer exists) are reported by `npm run audit:status` and fail `npm run audit:status:strict`, so they cannot sit unnoticed without running the dedicated command.
- `scripts/build-problems.ts` reads the ledger and stamps `validation.supervisor_checked: true` on problems generated from supervised templates only. Editing a template therefore drops the flag on its generated problems at the next build. With an empty ledger the generated artifacts are byte-identical to before.
- `scripts/supervision-io.ts` is the single owner of the ledger path and its read/write conventions (used by the supervision CLI, the audit script, and the problem build).
- Tests include `tests/audit/status.test.ts`, `tests/audit/supervision.test.ts`, and `tests/audit/template-supervision.test.ts`.
- The runbook for both layers is `docs/strategy/supervision-workflow.md`.

## 11. Commands

- `npm run gen`: run `tsx lib/engine/cli.ts`.
- `npm run export:vault`: export selected problem data to vault markdown.
- `npm run build:problems`: rebuild `web/problems.json`.
- `npm run seed:data`: seed generated problem data under `data/problems/`.
- `npm run build:web`: build the offline web app.
- `npm run typecheck:web`: typecheck the web app.
- `npm run validate:data`: validate problem data.
- `npm test`: run Vitest once.
- `npm run test:watch`: run Vitest in watch mode.
- `npm run test:coverage`: run Vitest with coverage.
- `npm run test:e2e`: run Playwright E2E tests.
- `npm run test:e2e:install`: install the Playwright Chromium browser.
- `npm run typecheck`: typecheck lib, scripts, and tests.
- `npm run lint`: run `biome check`.
- `npm run format`: run `biome check --write`.
- `npm run verify`: run lint, typecheck, web typecheck, data validation, tests, and web build.
- `npm run audit:status`: show repository quality audit.
- `npm run audit:status:strict`: run strict repository quality audit.
- `npm run supervision:status`: show per-problem supervision status.
- `npm run supervision:packet`: create a per-problem supervision packet.
- `npm run supervision:mark`: mark a problem as supervised.
- `npm run supervision:templates`: show per-template supervision coverage (leverage-ordered queue).
- `npm run supervision:templates:packet`: create a per-template review packet.
- `npm run supervision:templates:mark`: record a template as supervised (`-- --supervisor "name" <topic>`).
- `npm run coverage:pastexam`: check past-exam template coverage.
- `npm run release:check`: run release validation.
- `npm run release:semver`: validate release version semantics.

## 12. Testing

- Vitest is the primary unit test runner.
- Playwright E2E tests live under `tests/infra/e2e/`.
- Playwright config is `tests/infra/playwright.config.ts`.
- Schema drift tests live under `tests/engine/schema-drift.test.ts`.
- Schema consistency tests live under `tests/engine/schema-consistency.test.ts`.
- RLS mock tests live under `tests/supabase/rls-mock.test.ts`.
- Migration static checks live under `tests/infra/migrations.test.ts`.
- Store tests live under `tests/store/`.
- Scheduler tests live under `tests/scheduler/`.
- Curriculum tests live under `tests/curriculum/`.
- Web behavior tests live under `tests/web/`.
- The main local gate is `npm run verify`.
- `.claude/settings.json` is outside Biome's `files.includes`, so `biome check` on it is a no-op; validate it with the JSON parse one-liner below instead.
- JSON validity can be checked with:

```sh
node -e "JSON.parse(require('fs').readFileSync('.claude/settings.json','utf8'))"
```

## 13. Core Invariants

- Correct answers are computed by code, not by an LLM.
- LLM narration is wording only and must preserve numbers, units, symbols, and final answer.
- `Problem` schema parity must be maintained between zod and JSON Schema.
- Schema drift is a release-blocking quality risk.
- Store abstractions are the boundary between app logic and persistence.
- Supabase RLS must keep user-owned rows scoped by `auth.uid() = user_id`.
- Scheduler implementation is replaceable through exported scheduler APIs.
- FSRS is the default scheduler, SM-2 remains available for comparison and compatibility.
- Service worker cache stamping must remain deterministic and script-owned.
- Generated artifacts must be reproducible by their scripts.
- Secrets must not be committed or documented with real values.
- Existing workflows are quality gates; do not weaken them for convenience.

## 14. Extending The System

- For a new problem template, add code under `lib/engine/templates/`.
- Use deterministic parameter generation and pure answer calculation.
- Add or update tests under `tests/engine/`.
- Run `npm run gen`, `npm run validate:data`, and `npm test` after template changes.
- If the problem shape changes, update `lib/engine/schema.ts` and `docs/x-strategy/templates/problem-schema.json`.
- If persistence needs new behavior, extend store interfaces first.
- Then update in-memory, file, and Supabase store implementations together.
- For Supabase schema changes, add a new file under `supabase/migrations/`.
- For migration changes, run tests that cover `tests/infra/migrations.test.ts` and `tests/supabase/rls-mock.test.ts`.
- For web changes, run `npm run typecheck:web`, `npm run build:web`, and relevant `tests/web/` tests.
- For CI changes, inspect `.github/workflows/validate.yml` before editing other workflows.
- For release changes, use `npm run release:check`.

## 15. Agent Working Rules

- Read files before changing them.
- Do not infer paths that are not tracked or present in the worktree.
- Do not read `.env`, `.env.local`, API keys, tokens, or secret files.
- Keep behavior changes separate from docs/config additions.
- Prefer small changes that preserve existing public behavior.
- Use existing commands from `package.json`.
- Before reporting complete, inspect `git diff` and `git status --porcelain`.
- If a requested invariant conflicts with repository reality, document the conflict instead of inventing files.
