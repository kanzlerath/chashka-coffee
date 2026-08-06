# Webapp

The CSR browser client provides the baseline auth flow for future app features. It lives behind authentication and needs no SEO, so it stays client-side rendered; the public, SEO-facing surfaces live in the `website` workspace instead. It consumes the same API contracts as mobile and should keep server-state, form-state, and auth behavior centralized.

## Project Surface Status

This section may be updated during first-run bootstrap. If the root `README.md` marks webapp as deferred, add a short note here explaining that browser work is intentionally paused. When the user activates webapp, remove or rewrite that note before starting browser development.

## Stack

- React
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui
- Radix UI
- TanStack Query
- TanStack Form
- TanStack Router
- Zod contracts from `@chashka-coffee/contracts`
- shadcn CLI
- Playwright
- ESLint

## Commands

```bash
bun run dev
bun run build
bun run typecheck
bun run lint
bun run test
bun run e2e
bun run e2e:ui
bun run ui:info
```

From the repository root, use `bun run dev:webapp`, `bun run build:webapp`, `bun run typecheck:webapp`, `bun run test:webapp`, and `bun run e2e:webapp`.

## Env

Create `webapp/.env` when needed:

```bash
VITE_API_URL=http://localhost:3000
VITE_PUBLIC_SITE_URL=http://localhost:4321
```

`VITE_API_URL` and `VITE_PUBLIC_SITE_URL` are build-time config. In production they must point to the backend and public website origins; if either changes, redeploy the App Platform Static Site so API calls and previews of site-relative images keep using the correct hosts.

## Admin information architecture

The sidebar links to concrete work areas instead of hiding them behind tabs. Coffee, cakes, promotions, events, and journal entries have direct routes. Lists, creation, and editing are separate screens (`/...`, `/.../new`, and `/.../:id`) so a content manager never has to scroll past a long list to find a form. Technical fields such as slug and manual ordering stay in collapsed advanced sections; ordinary forms use product language, examples, and field hints.

The material builder stores sanitized rich HTML inside the existing JSON block fields, so old plain-text entries remain compatible and no database migration is required. Text-bearing blocks support inline formatting, links, heading levels, lists, tables, and per-block text sizes. Blocks use a single-open accordion with a sticky add-block footer, while the draft preview opens in a separate dialog instead of extending the editing form. The API contract strips unknown tags and unsafe link protocols before content reaches either the admin preview or the public Astro renderer.

Only administrators can manage staff and view website statistics. Staff changes are enforced by the backend: the current account cannot delete itself, and the last administrator cannot be deleted or demoted. Anonymous statistics behavior is documented in [../docs/ANALYTICS.md](../docs/ANALYTICS.md).

## Deployment

Production deployment for the browser app uses DigitalOcean App Platform Static Sites from the full Git monorepo branch with `bun install --frozen-lockfile && bun run build:webapp`, `webapp/dist`, and `index.html` as the SPA catch-all by default. Generate the concrete spec with `bun run deploy:do:specs webapp`; App Platform builds from Git, not from local `dist`. Follow the shared runbook in [../docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md). If the user explicitly chooses Yandex Cloud, deploy the built `webapp/dist` output through Yandex Object Storage static website hosting plus Cloud CDN by following [../docs/YANDEX_CLOUD.md](../docs/YANDEX_CLOUD.md).

## Practice

Use TanStack Query for server state, TanStack Mutation for API writes, TanStack Form for forms, and shared Zod schemas from `packages/contracts` for validation. The access token lives only in browser memory; refresh uses the HttpOnly cookie set by the backend. `src/features/auth` is the golden path: its public index exposes the provider, user context, and auth UI; its API adapter owns auth paths and refresh/retry; and its split register/login forms validate submissions with shared contracts without putting product logic in pages.

Keep raw fetch, base URL handling, and shared error parsing in the endpoint-agnostic `src/platform/api`. Each `src/features/<context>` owns its paths, schemas, queries, and provider. Pages import features only through public `index.ts`; features use platform and UI primitives; platform and `src/components/ui` never import product features. Run `bun run architecture:check` after changing boundaries.

Use shadcn/ui for web interface primitives. Treat `src/components/ui` as the shared UI primitive layer: most files are shadcn registry output, plus project-wide primitives such as `Typography`. Import those primitives through `@/components/ui/*`. Put app-specific wrappers and composed product components in `src/components` so normal lint rules keep applying. Avoid adding new one-off global CSS classes for product UI; compose screens with Tailwind utilities and shadcn theme tokens from `src/index.css`.

All web typography must go through `src/components/ui/typography.tsx`. Use `Typography` for page copy, headings `h1` through `h6`, labels, controls, captions, emphasis, shortcuts, code/kbd text, and screen-reader-only text. Do not add raw heading/paragraph/emphasis elements or Tailwind text-size/font/leading/tracking utilities in pages or UI components; the local ESLint typography policy enforces this.

The current shadcn configuration is `radix-maia` with the `hugeicons` icon library and CSS variables, as recorded in `components.json`. This template intentionally includes the full official shadcn component registry from `bunx shadcn@latest add --all -c webapp` so future projects can start from a complete local UI foundation. Do not add community registries, blocks, or custom UI generator output unless the product asks for them.

When adding or refreshing shadcn components:

```bash
bun run --cwd webapp ui:info
bun run --cwd webapp ui:add -- <component>
```

Use the local `shadcn` devDependency pinned in `webapp/package.json` and `bun.lock`; do not use `shadcn@latest` for routine refreshes because it can produce registry output that no longer matches this template. If generated files need compatibility fixes for current package versions, keep the edits small and leave app-specific composition outside `src/components/ui`.

## E2E

The Playwright smoke test lives in `e2e/specs/auth.spec.ts` and verifies client-side auth validation visibility, register/login mode switching, register, refresh after reload, protected UI, logout, invalid login error rendering, and a successful login after logout.

The run starts Docker Compose `postgres_test`, applies migrations to `chashka_coffee_test`, starts the backend with `TEST_DATABASE_URL` as its `DATABASE_URL`, starts Vite, and removes the test database volume after the run by default.

First run:

```bash
docker compose version
docker info
bun run e2e:install
bun run e2e
```

Detailed runbook: [../docs/TESTING.md](../docs/TESTING.md).

## Current Upstream Documentation

For browser framework, routing, forms, server-state, build, lint, or E2E questions, consult the current upstream documentation linked here first. This README describes this app's conventions; upstream docs are authoritative for library behavior.

- [React docs](https://react.dev/reference/react)
- [Vite guide](https://vite.dev/guide/)
- [Tailwind CSS docs](https://tailwindcss.com/docs)
- [shadcn/ui docs](https://ui.shadcn.com/docs)
- [Radix UI docs](https://www.radix-ui.com/primitives/docs/overview/introduction)
- [TanStack Query React docs](https://tanstack.com/query/latest/docs/framework/react/overview)
- [TanStack Form React docs](https://tanstack.com/form/latest/docs/framework/react/quick-start)
- [TanStack Router docs](https://tanstack.com/router/latest/docs/overview)
- [Zod docs](https://zod.dev/)
- [Playwright docs](https://playwright.dev/docs/intro)
- [ESLint docs](https://eslint.org/docs/latest/)
