# EventCheck API

Backend for EventCheck (Python 3.12, FastAPI). Implements Phase 1 of the
shared contract: authentication, `/health`, `/api/v1/me`, and event CRUD.
See the repository root README for the project overview and
[`docs/api-contract/openapi.yaml`](../../docs/api-contract/openapi.yaml) for
the contract this service implements.

## Requirements

- Python 3.12
- [uv](https://docs.astral.sh/uv/)
- Docker (for local Postgres)

## Setup

```bash
cp .env.example .env          # fill in SUPABASE_PROJECT_URL for a real project
docker compose up -d          # Postgres 16, plus an eventcheck_test database for tests
uv sync
uv run alembic upgrade head
uv run uvicorn app.main:app --reload
```

`/health` should now respond at `http://localhost:8000/health`.

Point `SUPABASE_PROJECT_URL` at a real Supabase project to exercise
authentication end-to-end; the test suite fakes its own JWKS and never talks
to Supabase or the network (see `tests/conftest.py`).

## Running tests

Tests run against the real `eventcheck_test` Postgres database created by
`docker-compose.yml` (not SQLite — later phases rely on `SELECT ... FOR
UPDATE`). Each test runs inside a transaction that's rolled back afterwards,
so the schema only needs to be created once per test session.

```bash
uv run pytest
```

## Quality gates

```bash
uv run ruff check .
uv run ruff format --check .
uv run mypy app
uv run pytest
```

## Migrations

```bash
uv run alembic revision --autogenerate -m "message"
uv run alembic upgrade head
```

## requirements.txt

Render's build uses `pip install -r requirements.txt`, so a plain
requirements file is kept alongside `pyproject.toml` / `uv.lock`. It is
**derived, not hand-edited** — regenerate it after any dependency change:

```bash
uv export --no-dev --no-hashes --format requirements-txt -o requirements.txt
```

## Configuration

All settings are read from the environment (see `.env.example`). The only
secret this service holds is `DATABASE_URL`; the Supabase project URL is
public, and signature verification uses the project's public JWKS
(`{SUPABASE_PROJECT_URL}/auth/v1/.well-known/jwks.json`) — no shared signing
secret is ever stored here.
