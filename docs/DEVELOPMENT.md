# Development guide

## Prerequisites

- Node.js 20 or later
- npm

## Commands

| Command | Purpose |
|---|---|
| `npm install` | Install dependencies |
| `npm run dev` | Start the local Vite server |
| `npm run build` | Run TypeScript validation and create a production bundle |

## Styling rules

Use the design tokens in `src/app/styles.css`. Preserve the application shell: fixed desktop sidebar, concise workspace header, status badges, tables for dense operational lists and responsive behavior for smaller screens.

## Backend integration

Replace prototype data only after the corresponding Gateway contract is agreed. Follow the project API standard: `/api/v1`, camelCase JSON, standard response envelope, UUID identifiers and command endpoints for state transitions.
# Connecting to the backend

The frontend calls the backend through `/api/v1`. For local development, start the backend Docker Compose stack (including the Gateway) and run Vite. The Vite proxy forwards `/api` to `VITE_API_PROXY_TARGET`, defaulting to `http://localhost:8080`.

Use `.env.local` only for local overrides. `VITE_API_BASE_URL` is normally blank so browser requests stay same-origin with Vite; set it only when deliberately using a directly reachable API URL. The client supports customer, transport specialist, logistics manager, compliance officer, and admin workspaces. It refreshes expired sessions and does not persist access tokens.

Customers can maintain their profile and horse registry and submit transport requests. Logistics managers have a request-review queue; compliance users can upload/review documents and evaluate trip readiness. Planning route leg locations and resource/staff IDs are still entered manually.

The current Planning API has no trip-list endpoint and no route-plan lookup by trip. The UI searches by trip UUID and can only load a route plan in the session that created it. Add a backend `GET /api/v1/trips` and/or `GET /api/v1/trips/{id}/route-plan` before promising trip browsing or recovery of existing plans.
