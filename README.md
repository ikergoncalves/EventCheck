# EventCheck

Event platform with QR Code attendee check-in.

EventCheck has three product surfaces:

- **Organizer area** — create events, issue and distribute tickets.
- **Scanner PWA** — reads the ticket QR Code at the door and validates entry in
  real time.
- **Live dashboard** — attendance statistics as people walk in.

## Repository layout

This is a monorepo with two independent applications.

| Path        | App      | Stack                                                                                              |
| ----------- | -------- | -------------------------------------------------------------------------------------------------- |
| `apps/web`  | Frontend | React, Vite, TypeScript, React Router, TanStack Query, React Hook Form + Zod, Tailwind CSS, MSW      |
| `apps/api`  | Backend  | Python, FastAPI                                                                                     |

The two sides are developed in parallel against a shared API contract:

- **API contract:** [`docs/api-contract/openapi.yaml`](docs/api-contract/openapi.yaml) (OpenAPI 3.1)

The contract is the single source of truth for endpoints, schemas and error
codes. It is never edited by one side alone — any change requires agreement
between frontend and backend.

## Running the frontend

Requires Node.js 20.19+ (or 22.12+) and npm 10+.

```bash
npm install                 # install workspace dependencies from the repo root
cp apps/web/.env.example apps/web/.env.local
npm run dev                 # http://localhost:5173
```

The backend does not exist yet, so the frontend runs against API mocks derived
from the contract. Mocks are toggled by `VITE_USE_MOCKS` — see
[`apps/web/README.md`](apps/web/README.md) for the mock scenarios and their
fixed tokens. Pointing the app at a real backend is a matter of changing
`VITE_API_BASE_URL` and setting `VITE_USE_MOCKS=false`; no component changes.

## Scripts

Run from the repository root. Each one delegates to the `apps/web` workspace.

| Script              | What it does                                              |
| ------------------- | --------------------------------------------------------- |
| `npm run dev`       | Start the Vite dev server with hot reload                  |
| `npm run build`     | Type-check and build the production bundle                 |
| `npm run preview`   | Serve the production build locally                         |
| `npm run lint`      | Run ESLint over the frontend sources                       |
| `npm run format`    | Format the frontend sources with Prettier                  |
| `npm run test`      | Run the Vitest suite once                                  |
| `npm run api:types` | Regenerate TypeScript types from the OpenAPI contract      |

`apps/web` additionally exposes `test:watch`. See
[`apps/web/README.md`](apps/web/README.md) for details.

## License

[MIT](LICENSE) © 2026 Iker Gonçalves
