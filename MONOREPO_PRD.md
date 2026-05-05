# Game Catalog — Monorepo & Type-Safety Migration PRD

## Goal

Restructure the repo as a Yarn workspaces monorepo, share types between frontend and backend, add CI, migrate the backend to TypeScript, introduce runtime validation at the API boundary, and ship a one-command local dev setup via Docker.

This work is intentionally scoped as a learning task: it touches build tooling, type systems, CI, runtime validation, and containerization — a broad cross-section of skills.

## Why

Today the frontend and backend are two unrelated npm projects. Types describing API payloads (games, users, comments, favorites, filters) are duplicated or absent on the backend, and there is nothing preventing the two sides from drifting. There is no CI, no pinned Node version, the root `package.json` has accumulated ~150 stray transitive dependencies, and onboarding requires reading `commands.txt` and running commands in two terminals. This migration fixes all of that.

## Scope

### 1. Yarn workspaces monorepo

- Convert the repo to a Yarn (v4, Berry) workspaces monorepo with packages under `packages/`:
  - `packages/frontend` (moved from `frontend/`)
  - `packages/backend` (moved from `backend/`)
  - `packages/shared` (new)
- Move all per-package devDependencies down into the package that uses them.
- Root `package.json` should only contain workspace tooling (prettier, eslint config, husky if added later) and orchestration scripts.
- Remove all stray transitive dependencies from the current root `package.json`.
- Single root `yarn.lock`. Delete the per-package `package-lock.json` files.

### 2. Shared package for types

- `packages/shared` exports the domain types currently living (or implicitly used) in the frontend: `Game`, `User`, `Comment`, `Favorite`, `Filter`, plus request/response shapes for each REST endpoint.
- Frontend imports them via `@game-catalog/shared`.
- Backend imports them via `@game-catalog/shared` (after backend is on TypeScript — see #5).

### 3. `typecheck` script across all packages

- Each package exposes `yarn typecheck` (`tsc --noEmit`).
- Root exposes `yarn typecheck` that runs typecheck across all workspaces in parallel.
- Use TypeScript project references so incremental typecheck is fast and `shared` is rebuilt automatically when it changes.
- **No package may import `.ts`/`.tsx` source from another package.** All cross-package imports must resolve to compiled output (`dist/*.js` + `dist/*.d.ts`).

### 4. GitHub Actions CI

- Workflow runs on every push and PR to any branch.
- Jobs: install (cached), `typecheck`, `lint`, `build` (frontend + shared; backend if a build step exists)

### 5. Migrate backend to TypeScript

- Convert `packages/backend` from `.js` to `.ts`. Use `tsx` (or `ts-node`) for `dev`, and `tsc` for `build`.
- Add `tsconfig.json` extending a shared base config at the repo root.
- All Express route handlers, controllers, and services typed against the shared package types.
- `nodemon` config updated to watch `.ts` files (or replaced with `tsx watch`).

### 6. Zod schemas in the shared package

- For each API endpoint, define a zod schema in `packages/shared` and derive the TypeScript type via `z.infer`. Schemas are the single source of truth.
- Backend uses the schemas as request validation middleware — invalid requests return `400` with a structured error before reaching the controller.
- Frontend uses the same schemas to validate API responses in development (optional in prod).
- Where a type is purely internal (DB row shapes that never cross the wire), it can stay as a plain TS interface.

### 7. Dockerize with docker-compose

- `Dockerfile` for backend (multi-stage: install → build → slim runtime).
- `Dockerfile` for frontend (multi-stage: install → build → static serve via nginx, or `vite preview`).
- `docker-compose.yml` at repo root that brings up:
  - `backend` (with SQLite volume mounted for persistence)
  - `frontend`
- `yarn docker:up` / `yarn docker:down` scripts at the root.
- A new contributor should be able to clone the repo and run `yarn docker:up` to get the app working end to end

## Acceptance criteria

- `yarn install` at the repo root installs everything.
- `yarn typecheck` at the root passes across all workspaces.
- `yarn lint` at the root passes across all workspaces.
- `yarn dev` (root) starts both frontend and backend.
- The frontend imports `Game`, `User`, etc. from `@game-catalog/shared` — no duplicate definitions remain in `packages/frontend/src/types`.
- The backend imports the same types from `@game-catalog/shared` and uses zod schemas from it for request validation.
- GitHub Actions runs on a feature branch PR and reports `typecheck`, `lint`, `build` statuses.
- Root `package.json` `dependencies` is empty or contains only true workspace-level tools.

## Notes & gotchas

- Use the `nodeLinker: node-modules` setting in `.yarnrc.yml`
- **Don't** introduce Turborepo or Nx for this task. Plain `yarn workspaces foreach` is enough at this scale and keeps the diff focused.
