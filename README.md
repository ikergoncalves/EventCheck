# EventCheck

Event platform with QR Code attendee check-in.

EventCheck has three product surfaces:

- **Organizer area** — create events, issue and distribute tickets.
- **Scanner PWA** — reads the ticket QR Code at the door and validates entry in
  real time.
- **Live dashboard** — attendance statistics as people walk in.

## Repository layout

This is a monorepo with two independent applications.

| Path       | App      | Stack                                                                                      |
| ---------- | -------- | ------------------------------------------------------------------------------------------ |
| `apps/web` | Frontend | React, Vite, TypeScript, React Router, TanStack Query, React Hook Form + Zod, Tailwind, MSW |
| `apps/api` | Backend  | Python 3.12, FastAPI, SQLAlchemy, Alembic, PostgreSQL                                      |

Both exist and both are under active development. The API is **not deployed
anywhere yet**, which is why the frontend still serves its data from mocks — see
below.

### The contract comes first

- **API contract:** [`docs/api-contract/openapi.yaml`](docs/api-contract/openapi.yaml) (OpenAPI 3.1)

The two sides are built in parallel against that one file. It is the single
source of truth for every endpoint, schema and error code, and neither side
edits it alone — a change is its own pull request, reviewed by both.

That is what lets the frontend run without the backend. Its TypeScript types are
**generated** from the contract, and its mock layer (MSW) implements every
operation in it, including the error branches. So the frontend is not waiting on
the API: it is already running against the contract's shape, and pointing it at
the real service is a change of environment variables, not of code.

Authentication is the exception, and deliberately so. The organizer signs in
against a **real Supabase project** even while the data is mocked, because the
JWT the browser receives is the same one the backend will verify against
Supabase's public JWKS. There is no fake token in that path.

## Requirements

| To run     | You need                                    |
| ---------- | ------------------------------------------- |
| Frontend   | Node.js 20.19+ (or 22.12+) and npm 10+      |
| Backend    | Python 3.12, [uv](https://docs.astral.sh/uv/), Docker |
| Either one | A Supabase project (free tier is enough)    |

The two applications are independent. You can run the frontend on its own —
that is the default setup, and the one that needs the least.

## Running the frontend

```bash
npm install                                   # from the repo root
cp apps/web/.env.example apps/web/.env.local  # then fill in the Supabase values
npm run dev                                   # http://localhost:5173
```

Fill `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `apps/web/.env.local`
with the values from your Supabase project (Project Settings → API). Without
them the app still boots, but the sign-in screen replaces its form with a notice
saying what is missing — there is no way past it, since authentication is real.

Everything else is served from the mock layer while `VITE_USE_MOCKS=true`.
[`apps/web/README.md`](apps/web/README.md) documents the seeded events and the
fixed tokens for each check-in error path.

## Running the API

The API is a separate application with its own tooling; none of the npm scripts
reach it. Run these from `apps/api`.

```bash
cd apps/api

cp .env.example .env    # defaults match the docker-compose Postgres below
docker compose up -d    # Postgres 16, plus the eventcheck_test database
uv sync                 # create the virtualenv and install dependencies
uv run alembic upgrade head
uv run uvicorn app.main:app --reload
```

`http://localhost:8000/health` should answer once the server is up.

Authentication needs `SUPABASE_PROJECT_URL` to point at a real project: the API
issues no tokens of its own, it fetches that project's public JWKS and verifies
the signature, `exp`, `iss` and `aud` of the JWT the frontend sends.

### API tests

Tests run against the real `eventcheck_test` database that `docker compose`
creates — not SQLite, because later phases depend on `SELECT ... FOR UPDATE`.
Each test runs inside a transaction that is rolled back afterwards. The suite
fakes its own JWKS and never talks to Supabase or the network.

```bash
uv run pytest
```

### API quality gates

```bash
uv run ruff check .
uv run ruff format --check .
uv run mypy app
uv run pytest
```

See [`apps/api/README.md`](apps/api/README.md) for migrations and the
`requirements.txt` that Render's pip-based build consumes.

## Pointing the frontend at the API

With the API running locally, set this in `apps/web/.env.local`:

```
VITE_API_BASE_URL=http://localhost:8000
VITE_USE_MOCKS=false
```

No component changes are involved. `CORS_ORIGINS` in `apps/api/.env` already
allows `http://localhost:5173`.

## Environment variables

### `apps/web` — all public

Vite inlines every `VITE_*` variable into the JavaScript bundle. **Nothing
secret can go here**, and nothing here is secret:

| Variable                 | Meaning                                                            |
| ------------------------ | ------------------------------------------------------------------ |
| `VITE_API_BASE_URL`      | API base URL, no trailing slash. Defaults to `http://localhost:8000` |
| `VITE_USE_MOCKS`         | `'true'` serves data from MSW instead of the API                    |
| `VITE_SUPABASE_URL`      | Supabase project URL                                                |
| `VITE_SUPABASE_ANON_KEY` | Supabase publishable anon key, bounded by row-level security        |

The Supabase **service-role key** is not one of these and must never appear in
this repository or in any `VITE_*` variable.

### `apps/api` — one secret among them

| Variable                      | Secret? | Meaning                                          |
| ----------------------------- | ------- | ------------------------------------------------ |
| `DATABASE_URL`                | **Yes** | Postgres connection string                       |
| `TEST_DATABASE_URL`           | **Yes** | Connection string for the test database          |
| `SUPABASE_PROJECT_URL`        | No      | Identifies the project whose JWKS is fetched     |
| `SUPABASE_JWT_AUDIENCE`       | No      | Expected `aud` claim, `authenticated` by default |
| `SUPABASE_JWKS_CACHE_SECONDS` | No      | How long the fetched public keys are cached      |
| `CORS_ORIGINS`                | No      | Allowed browser origins                          |
| `ENVIRONMENT`, `APP_VERSION`  | No      | Reported by `/health`                            |

The connection string is the API's **only** secret. It holds no JWT signing key
by design: verifying with a shared HS256 secret would let the backend forge a
token for any user, since whoever can verify can also sign. It verifies against
Supabase's public keys instead.

### What is committed and what is not

`.gitignore` excludes every `.env*` except `.env.example` (placeholders only)
and `apps/web/.env.production` (which just pins `VITE_USE_MOCKS=false`). Your
real values live in `apps/web/.env.local` and `apps/api/.env`, and neither is
tracked. Keep it that way.

## Scripts

These are run from the repository root and every one of them delegates to the
`apps/web` workspace. **They do not touch the API** — it has its own commands,
listed under [Running the API](#running-the-api).

| Script                  | What it does (frontend only)                          |
| ----------------------- | ----------------------------------------------------- |
| `npm run dev`           | Start the Vite dev server with hot reload             |
| `npm run build`         | Type-check and build the production bundle            |
| `npm run preview`       | Serve the production build locally                    |
| `npm run lint`          | Run ESLint over the frontend sources                  |
| `npm run format`        | Format the frontend sources with Prettier             |
| `npm run format:check`  | Verify formatting without writing                     |
| `npm run test`          | Run the Vitest suite once                             |
| `npm run api:types`     | Regenerate TypeScript types from the OpenAPI contract |

`apps/web` additionally exposes `test:watch`. See
[`apps/web/README.md`](apps/web/README.md) for details.

## License

[MIT](LICENSE) © 2026 Iker Gonçalves
