# EventCheck — Web

Organizer frontend for [EventCheck](../../README.md): React + Vite + TypeScript.

Phase 1 built the plumbing from the API contract to the screen — generated
types, a typed HTTP client, contract-derived mocks, and the event list and
detail screens. Phase 2 adds real authentication against Supabase, protected
routes, and the full event lifecycle: create, edit, publish and cancel. The live
dashboard, the QR scanner and the AI features land in later phases.

## Requirements

Node.js 20.19+ (or 22.12+) and npm 10+, plus a Supabase project — see
[Authentication](#authentication).

## Getting started

```bash
npm install                # from the repository root
cp apps/web/.env.example apps/web/.env.local
# fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
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

| Variable                 | Meaning                                                               |
| ------------------------ | --------------------------------------------------------------------- |
| `VITE_API_BASE_URL`      | API base URL, no trailing slash. Defaults to `http://localhost:8000`. |
| `VITE_USE_MOCKS`         | `'true'` serves **data** from MSW instead of a real backend.          |
| `VITE_SUPABASE_URL`      | Supabase project URL, e.g. `https://abcdefgh.supabase.co`.            |
| `VITE_SUPABASE_ANON_KEY` | Supabase publishable anon key.                                        |

All four are public by construction: Vite inlines every `VITE_*` variable into
the bundle it ships to the browser. The anon key is meant to be there — its
reach is bounded by Supabase's row-level security, not by secrecy. The
**service-role key is not on this list** and must never be.

Switching the data layer to the real backend is `VITE_API_BASE_URL` plus
`VITE_USE_MOCKS=false` — no component changes. `.env.production` pins
`VITE_USE_MOCKS=false` so a production build never picks up the mock layer from
a developer's `.env.local`; the MSW worker lives behind a dynamic import that is
dropped from the bundle entirely when the flag is off.

## Authentication

Authentication is **never mocked**. `VITE_USE_MOCKS` governs the data layer
only: the organizer signs in against a real Supabase project even when every
event on screen came from MSW.

That is deliberate. The JWT the browser receives is signed with Supabase's
asymmetric key (ES256), and it is the same token the backend will verify against
the project's public JWKS. Faking it would mean the one part of the system that
has to be genuine end to end is the only part never exercised.

### Running without a Supabase project

The app boots. `getSupabaseClient()` is lazy, so nothing fails at import time;
the failure surfaces where it belongs. `AuthProvider` catches the configuration
error, settles on `anonymous`, and publishes the message through `configError` —
so `/login` and `/signup` render that message **in place of their forms**, naming
the two variables that are missing and pointing at `.env.example`.

Every route is guarded, so there is no way past that screen. This is the
intended behaviour: a login form that cannot possibly succeed would be worse
than an honest explanation, and "wrong password" would be a lie.

### The token provider stops being a stub

Phase 1 shipped `shared/api/token-provider.ts` with a stub returning a fake
token, so the HTTP client could be exercised end to end before any identity
existed. Phase 2 replaces it with the real session, and the whole integration is
one line in `AuthProvider`:

```ts
setTokenProvider(() => session?.access_token ?? null)
```

**`http.ts` was not modified in this phase**, which was the point of building it
around an injectable provider. Supabase refreshes the access token on its own
and reports it through `onAuthStateChange`; that updates `session`, the effect
re-runs, and every subsequent request carries the new token. Nothing polls.

Signing out clears the TanStack Query cache (`queryClient.clear()`). The cache
is keyed by resource, not by organizer, so without that the next person to sign
in on the same browser would see the previous one's events rendered from cache
before their own request came back.

### Layout of `shared/auth/`

| File                 | Responsibility                                                                |
| -------------------- | ----------------------------------------------------------------------------- |
| `supabase-client.ts` | The single client, built lazily; throws `SupabaseConfigError` if unconfigured |
| `auth-client.ts`     | A five-method interface over the SDK, plus the injectable seam                |
| `auth-errors.ts`     | Supabase failures → the app's own closed union → a sentence                   |
| `auth-context.ts`    | The context object and its type                                               |
| `AuthProvider.tsx`   | Restores the session, follows changes, owns sign-in/up/out                    |
| `useAuth.ts`         | The hook                                                                      |

`auth-client.ts` is what keeps the test suite off the network. Tests call
`setAuthClient()` with a fake; MSW cannot help here, because the SDK is not a
handful of REST calls we would want to reimplement as handlers. Between tests
the suite installs a client whose every method throws, so a test that mounts
`AuthProvider` without asking for a fake fails loudly instead of quietly opening
a socket to a live project.

Supabase's own error text never reaches the screen. It is written for
developers, it changes without notice, and on a sign-up it can reveal whether an
address is already registered. `auth-client.ts` maps `error.code` onto a closed
union and `auth-errors.ts` switches over it exhaustively — the same discipline
`describe-error.ts` applies to the contract's error codes.

## Route protection

`app/route-guards.tsx` holds both guards, and the whole design turns on
`status === 'loading'` being a state of its own.

Restoring a persisted session is asynchronous, so on **every** page load the app
spends a tick not knowing who the user is. A guard that treats that tick as
"anonymous" redirects to `/login`, the session then arrives, and the organizer is
bounced back — the login screen flashing on every refresh of a page they are
perfectly entitled to see. So `loading` renders a loading state, and only a
settled `anonymous` redirects.

`RequireAuth` stashes the route it interrupted in navigation state, and the
login screen returns there afterwards instead of always landing on `/events`.
The stashed value is validated as a local absolute path before it is used —
navigation state is forgeable from the console, and an open redirect is not
worth the missing check.

`RedirectIfAuthenticated` mirrors it for `/login` and `/signup`.

## Event lifecycle

The detail page offers **Edit** on `draft` and `published`, **Publish** on
`draft`, and **Cancel** on `draft` and `published`. `features/events/event-actions.ts`
holds those predicates.

Hiding an impossible action is not the same as it being impossible. The status
on screen was read at some point in the past, and two things move it without
this page hearing about it: another tab, and the contract's lazy
`published` → `finished` promotion, which happens on the next read or write with
nobody clicking anything. So the `409`s (`EVENT_IMMUTABLE`, `EVENT_NOT_ACTIVE`)
are handled as ordinary outcomes. Every mutation invalidates on `onSettled`
rather than `onSuccess`, so a refusal re-reads the event and the buttons settle
on what is actually possible.

Cancelling asks first, through a real dialog rather than `window.confirm`, and
says what will happen: **every valid ticket is revoked**. `confirm()` cannot say
that in more than one unstyled line, cannot show the failure if the server then
refuses, and blocks the thread while it waits.

### Dates in the event form

The organizer types wall-clock times; the contract wants ISO 8601 in UTC. The
conversion is anchored on the **event's** `timezone` — the one selected in the
form — never on the browser's, via `zonedInputToUtcIso()` in
`shared/lib/datetime.ts`. Someone in Lisbon scheduling a São Paulo event types
the time the doors open in São Paulo; reading that as browser-local time would
shift the event silently, and would do it correctly on their machine and wrongly
on everyone else's.

The form's own validation mirrors the contract's bounds exactly — `title` 3–120,
`capacity` 1–100000, `ends_at` after `starts_at`, an IANA `timezone` defaulting
to the browser's. That saves a round trip; it does not replace the server, which
remains the authority.

### 422s land on the field they name

The contract's validation error carries `details.fields`, a list of
`{ field, message }`. `shared/api/field-errors.ts` reads it and `EventForm`
routes each entry to the matching control through `setError`, so the message
appears under the input it is about rather than as a banner at the top. Anything
that cannot be placed — a field the contract grew and the form does not render —
falls back to the form-level alert rather than being swallowed.

That parser is the one place in the app that reads a payload at runtime instead
of deriving a type from `schema.d.ts`, and the contract is the reason:
`details` is declared `additionalProperties: true`, so there is no type to
generate — only a documented convention to validate.

## Types come from the contract

`docs/api-contract/openapi.yaml` is the single source of truth. `npm run api:types`
regenerates `src/shared/api/schema.d.ts`, and `src/shared/api/types.ts` re-exports
readable aliases (`Event`, `Ticket`, `CheckIn`, `EventStats`, …) from it. **No
API payload type is written by hand — there is no exception.** Error codes
included: `ApiErrorCode` is `ApiErrorBody['error']['code']`, the contract's own
`enum`.

`schema.d.ts` is a declaration file, though, so that enum exists at type level
only. There is no value to iterate at runtime, and the `isApiErrorCode` type
guard needs one. So `types.ts` keeps an array as a **runtime mirror** of the
enum, watched by the compiler in both directions:

- `satisfies readonly ApiErrorCode[]` rejects a code the contract does not have;
- `Exclude<ApiErrorCode, (typeof API_ERROR_CODES)[number]>` has to stay `never`,
  which rejects a contract code the mirror left out.

Adding or dropping a code in the contract therefore breaks the build until the
mirror follows — one of the two guards always fires, so the list cannot drift
past the next `tsc`.

## Check-in window

An event accepts check-ins when its status is `published` **and** the current
instant sits between `starts_at − 12h` and `ends_at + 2h`. Anywhere outside
that window the API answers `409 EVENT_NOT_ACTIVE`, whatever the ticket looks
like.

`src/shared/lib/check-in-window.ts` holds the rule as pure functions. The two
constants are mirrored by the backend, so their names are part of the
cross-repo agreement:

| Constant                            | Value | Meaning                                       |
| ----------------------------------- | ----- | --------------------------------------------- |
| `CHECK_IN_OPENS_BEFORE_START_HOURS` | `12`  | The window opens this long before `starts_at` |
| `CHECK_IN_CLOSES_AFTER_END_HOURS`   | `2`   | The window closes this long after `ends_at`   |

- `isWithinCheckInWindow(event, now)` — whether a scan can be accepted;
- `resolveEventStatus(event, now)` — `'finished'` for a `published` event whose
  window has closed, the current status otherwise.

Both bounds are inclusive: the contract closes the window on "`ends_at + 2h`
already past", so at that exact instant the event is still open, and still
`published`. `now` is always an argument and never `Date.now()` read from
inside, which is what lets the tests pin both edges to the minute.

Nothing runs on a schedule in this project, so the `published` → `finished`
transition is **lazy** — it happens on the first read or write that touches the
event. The mock database applies it in `findEvent()` and `toEvent()` and
persists it on the record, so a `GET` and a later `PATCH` never disagree about
a status. The QR scanner will reuse the same module in a later phase to explain
a refused read before it even reaches the network.

## API mocks

`src/mocks/` implements every operation in the contract on top of an in-memory
database (`db.ts` + `fixtures.ts`) that stays consistent across calls: issuing
tickets moves `tickets_issued`, a check-in moves `checked_in_count` and flips
the ticket's status. Counters are always derived from the ticket table rather
than stored, so they cannot drift.

- `src/mocks/browser.ts` exports `worker` (dev server, dynamic import only)
- `src/mocks/server.ts` exports `server` (tests, started in `src/test/setup.ts`)

The browser worker runs with `onUnhandledRequest: 'bypass'`, which is what lets
Supabase's own traffic through untouched while the contract's routes are
intercepted. The Node server used by the tests runs with `'error'` instead:
there, anything unhandled is a bug.

### Event lifecycle rules

`PATCH` and `DELETE` enforce the rules the contract grew after Phase 1, reusing
`shared/lib/check-in-window.ts` rather than restating them:

| Request                                               | Answer                                   |
| ----------------------------------------------------- | ---------------------------------------- |
| `PATCH` a `finished` or `cancelled` event             | `409 EVENT_IMMUTABLE`                    |
| `PATCH` a `published` event's `ends_at` into the past | `422` with `ends_at` in `details.fields` |
| `DELETE` a `finished` or `cancelled` event            | `409 EVENT_IMMUTABLE`                    |

`findEvent()` applies the lazy `published` → `finished` promotion before any of
these run, so an event whose check-in window closed while a page sat open is
already terminal by the time the checks see it — which is exactly the case the
`DELETE` rule exists for. Ending a published event early is not a supported
operation: an event finishes when its window closes, and editing `ends_at` is
not the back door to that.

### Seeded events

| Event                                | Status      | Notes                                                      |
| ------------------------------------ | ----------- | ---------------------------------------------------------- |
| React Summit Brasil 2026             | `published` | In progress right now; 43 tickets, peak check-in window    |
| Sprint Review Aberta — Agosto        | `published` | Starts in 5 days: 11 tickets, but the window is still shut |
| Workshop: QR Code na portaria        | `draft`     | Capacity 30, one ticket issued                             |
| Meetup Frontend SP — Edição de Junho | `finished`  | Fully resolved attendance history                          |
| Hackathon EventCheck (adiado)        | `cancelled` | Tickets revoked along with the event                       |

Timestamps are generated relative to the moment the mock database is seeded, so
the published event is always live and its check-in timeline always meaningful.
The two published events are what make the window observable: same status,
opposite answers to a scan.

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
| `devFinishedEventTicketToken00000` | finished event  | `409 EVENT_NOT_ACTIVE` (the event is over)                            |
| `devBeforeWindowToken000000000000` | upcoming event  | `409 EVENT_NOT_ACTIVE` (published, but the window has not opened)     |

The happy-path token is single use: once scanned it becomes a
`TICKET_ALREADY_CHECKED_IN` case until the page is reloaded (browser) or the
next test resets the database.

MSW intercepts `fetch` from inside the page — it is not a standalone server, so
these routes are exercised through the app or the test suite, not `curl`.

The check-in error codes follow the contract's precedence, in this exact order:
`TICKET_NOT_FOUND` → `TICKET_WRONG_EVENT` → `EVENT_NOT_ACTIVE` →
`TICKET_REVOKED` → `TICKET_ALREADY_CHECKED_IN`. A revoked ticket on an event
outside its window answers `EVENT_NOT_ACTIVE`, not `TICKET_REVOKED`.

Event ids, for building URLs by hand:

- published (live): `22222222-2222-4222-8222-222222222222`
- upcoming (window shut): `55555555-5555-4555-8555-555555555555`

## Layout

```
src/
  app/            # bootstrap: providers, router, guards, layout, boundary, 404
  features/
    auth/         # login and sign-up screens
    events/       # list, detail, create, edit, lifecycle actions
    tickets/      # later phase
    check-in/     # later phase
    dashboard/    # later phase
  shared/
    api/          # HTTP client, generated types, query hooks, error mapping
    auth/         # Supabase client, injectable auth client, session provider
    ui/           # reusable presentational components
    lib/          # pure helpers (dates, formatting, check-in window)
    hooks/
  mocks/          # MSW handlers, fixtures, in-memory db, worker and server
  test/           # Vitest setup, render helpers, the fake auth client
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

Phase 1 shipped a stub token provider returning a fake token. **Phase 2 replaced
it with the real Supabase session, and this file did not change** — the swap is
one `setTokenProvider()` call in `AuthProvider`. See
[The token provider stops being a stub](#the-token-provider-stops-being-a-stub).

Query retries follow the same rule: a `4xx` is never retried, network failures
and `5xx` are.

## Dates

Every timestamp from the API is ISO 8601 in UTC; each event carries an IANA
`timezone` used for display only. `shared/lib/datetime.ts` formats all
user-facing timestamps in the **event's** timezone, never the browser's.
