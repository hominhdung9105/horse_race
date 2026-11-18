# Frontend development

## Prerequisites

- Node.js 20 or later
- npm
- Backend Docker Compose stack running, including the Gateway, for end-to-end UI flows

## Commands

Run from `FE/horse_race`:

| Command | Purpose |
|---|---|
| `npm ci` | Install the exact dependency versions in `package-lock.json` |
| `npm run dev` | Start the Vite development server (normally `http://localhost:5173`) |
| `npm run build` | Run TypeScript project checks and produce the production bundle in `dist/` |

## API configuration

Vite proxies `/api` to `VITE_API_PROXY_TARGET`, defaulting to `http://localhost:8080`. Set overrides in `.env.local`, based on `.env.example`. Leave `VITE_API_BASE_URL` blank to make same-origin requests through Vite. Set it only when intentionally calling a directly reachable API URL. `VITE_OSRM_ROUTING_URL` controls the route-geometry service used by the map view.

All product API calls should use the shared functions in `src/core/api.ts` and the endpoint modules under `src/features`. Keep API response envelope handling, refresh behavior, field errors, and authenticated downloads in the shared client. Follow `/api/v1`, camelCase JSON, UUID identifiers, and command endpoints for business state transitions.

## UI conventions

- Use the existing design tokens and application shell in `src/app/styles.css`.
- Keep navigation and action visibility aligned with backend role policies. The service remains the authorization authority.
- Preserve loading, empty, validation, permission, network, and server-error states. Do not turn failed requests into empty lists.
- Use server-side pagination and filtering for large lists.
- Keep local component state for forms and dialogs; fetch business data through feature APIs.
- Display date/time values in the user’s local time while sending ISO 8601 UTC values to the API.

## Current integration notes

- The frontend uses real Gateway APIs and has no mock-data mode.
- Roles supported by the shell: `CUSTOMER`, `TRANSPORT_SPECIALIST`, `LOGISTICS_MANAGER`, `COMPLIANCE_OFFICER`, `ADMIN`, `DRIVER`, `ESCORT`, `DRIVER_ESCORT`, and `FLEET_ROUTE_COORDINATOR`.
- Planning exposes trip listing and route-plan-by-trip reads; the UI can reopen an existing route plan after reload.
- Configured route duration ranges are internal estimates. OSRM route geometry is a separate map visualization and does not confirm a carrier or flight booking.
