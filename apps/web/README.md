# EventCheck — Web

Organizer frontend for [EventCheck](../../README.md): React + Vite + TypeScript.

Phase 1 covers the plumbing from the API contract all the way to the screen —
generated types, a typed HTTP client, contract-derived mocks, and the event list
and detail screens. Authentication, event creation, the live dashboard, the QR
scanner and the AI features land in later phases.

## Requirements

Node.js 20.19+ (or 22.12+) and npm 10+.

## Getting started

```bash
npm install                # from the repository root
cp apps/web/.env.example apps/web/.env.local
npm run dev                # http://localhost:5173
```

## Scripts

| Script                 | What it does                                                      |
| ---------------------- | ----------------------------------------------------------------- |
| `npm run dev`          | Vite dev server with hot reload                                   |
| `npm run build`        | Type-check (`tsc -b`) and build the production bundle             |
| `npm run preview`      | Serve the production build locally                                |
| `npm run lint`         | ESLint over the whole workspace                                   |
| `npm run format`       | Rewrite sources with Prettier                                     |
| `npm run format:check` | Verify formatting without writing                                 |
| `npm run test`         | Vitest, single run                                                |
| `npm run test:watch`   | Vitest in watch mode                                              |
| `npm run api:types`    | Regenerate `src/shared/api/schema.d.ts` from the OpenAPI contract |

## Environment

| Variable            | Meaning                                                               |
| ------------------- | --------------------------------------------------------------------- |
| `VITE_API_BASE_URL` | API base URL, no trailing slash. Defaults to `http://localhost:8000`. |
| `VITE_USE_MOCKS`    | `'true'` serves everything from MSW instead of a real backend.        |

Switching to the real backend is only these two variables — no component
changes. `.env.production` pins `VITE_USE_MOCKS=false` so a production build
never picks up the mock layer from a developer's `.env.local`; the MSW worker
lives behind a dynamic import that is dropped from the bundle entirely when the
flag is off.

## Types come from the contract

`docs/api-contract/openapi.yaml` is the single source of truth. `npm run api:types`
regenerates `src/shared/api/schema.d.ts`, and `src/shared/api/types.ts` re-exports
readable aliases (`Event`, `Ticket`, `CheckIn`, `EventStats`, …) from it. **No
API payload type is written by hand.**

The one exception is documented in `types.ts`: the contract declares
`error.code` as a plain `string` and lists the valid values only in the field
description, so `API_ERROR_CODES` cannot be generated. It is declared once, with
a compile-time assertion keeping it assignable to the generated type. If the
contract is ever revised to model that field as an `enum`, delete the list and
derive it instead.

## API mocks

`src/mocks/` implements every operation in the contract on top of an in-memory
database (`db.ts` + `fixtures.ts`) that stays consistent across calls: issuing
tickets moves `tickets_issued`, a check-in moves `checked_in_count` and flips
the ticket's status. Counters are always derived from the ticket table rather
than stored, so they cannot drift.

- `src/mocks/browser.ts` exports `worker` (dev server, dynamic import only)
- `src/mocks/server.ts` exports `server` (tests, started in `src/test/setup.ts`)

### Seeded events

| Event                                | Status      | Notes                                                   |
| ------------------------------------ | ----------- | ------------------------------------------------------- |
| React Summit Brasil 2026             | `published` | In progress right now; 43 tickets, peak check-in window |
| Workshop: QR Code na portaria        | `draft`     | Capacity 30, one ticket issued                          |
| Meetup Frontend SP — Edição de Junho | `finished`  | Fully resolved attendance history                       |
| Hackathon EventCheck (adiado)        | `cancelled` | Tickets revoked along with the event                    |

Timestamps are generated relative to the moment the mock database is seeded, so
the published event is always live and its check-in timeline always meaningful.

### Fixed tokens for the check-in error paths

Every check-in branch of the contract can be triggered on purpose. Tokens are
32 characters, the contract's minimum for `qr_token`. They are defined in
`src/mocks/fixtures.ts` as `DEV_TOKENS`.

| Token                              | Scanned against | Result                                                                |
| ---------------------------------- | --------------- | --------------------------------------------------------------------- |
| `devValidTicketToken0000000000000` | published event | `201` — check-in registered                                           |
| `devUnknownTicketToken00000000000` | any event       | `404 TICKET_NOT_FOUND`                                                |
| `devAlreadyCheckedInToken00000000` | published event | `409 TICKET_ALREADY_CHECKED_IN`, original check-in in `error.details` |
| `devRevokedTicketToken00000000000` | published event | `409 TICKET_REVOKED`                                                  |
| `devWrongEventTicketToken00000000` | published event | `409 TICKET_WRONG_EVENT` (the ticket belongs to the draft event)      |
| `devFinishedEventTicketToken00000` | finished event  | `409 EVENT_NOT_ACTIVE`                                                |

The happy-path token is single use: once scanned it becomes a
`TICKET_ALREADY_CHECKED_IN` case until the page is reloaded (browser) or the
next test resets the database.

MSW intercepts `fetch` from inside the page — it is not a standalone server, so
these routes are exercised through the app or the test suite, not `curl`.

Published event id, for building URLs by hand:
`22222222-2222-4222-8222-222222222222`.

## Layout

```
src/
  app/            # bootstrap: providers, router, layout, error boundary, 404
  features/
    events/       # list and detail (this phase)
    tickets/      # later phase
    check-in/     # later phase
    dashboard/    # later phase
  shared/
    api/          # HTTP client, generated types, query hooks, error mapping
    ui/           # reusable presentational components
    lib/          # pure helpers (dates, formatting)
    hooks/
  mocks/          # MSW handlers, fixtures, in-memory db, worker and server
  test/           # Vitest setup and render helpers
```

## Notes on the HTTP layer

`src/shared/api/http.ts` is a thin `fetch` wrapper that resolves the base URL
from the environment, attaches `Authorization: Bearer <token>` from an
**injectable token provider**, parses the contract's error envelope into a typed
`ApiError`, and handles `204` and empty bodies.

`ApiError['code']` is a union of the contract's literal codes, so the UI can
`switch` over it with exhaustiveness checked by the compiler — see
`describe-error.ts`. A code the client does not recognize is normalized to a
known one and kept verbatim in `rawCode`, so the union never widens to `string`.

Phase 1 ships a stub token provider returning a fake token. Phase 2 replaces it
with the real Supabase session via `setTokenProvider()` — nothing else changes.

Query retries follow the same rule: a `4xx` is never retried, network failures
and `5xx` are.

## Dates

Every timestamp from the API is ISO 8601 in UTC; each event carries an IANA
`timezone` used for display only. `shared/lib/datetime.ts` formats all
user-facing timestamps in the **event's** timezone, never the browser's.
