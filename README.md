# EquiRoute Web

React web application for cross-border racehorse transport operations. The client calls the .NET API Gateway; it has no mock-data mode.

## Stack

- React 19, TypeScript, Vite 6
- Feature-oriented API modules under `src/features`
- Shared fetch client in `src/core/api.ts`
- Responsive single-page application with role-based navigation (no React Router)

## Run locally

Prerequisites: Node.js 20+ and npm. Start the backend stack first so the Gateway is available at `http://localhost:8080`.

```powershell
npm ci
npm run dev
```

Open the URL printed by Vite, normally `http://localhost:5173`. The Vite proxy forwards `/api` to `VITE_API_PROXY_TARGET` (default `http://localhost:8080`). Copy `.env.example` to `.env.local` to change the Gateway target or OSRM routing URL. `VITE_API_BASE_URL` can be set when the browser should call a directly reachable API instead of using the Vite proxy.

Sign in with an account provisioned by Identity or register a customer account. Roles recognized by the UI are `CUSTOMER`, `TRANSPORT_SPECIALIST`, `LOGISTICS_MANAGER`, `COMPLIANCE_OFFICER`, `ADMIN`, `DRIVER`, `ESCORT`, `DRIVER_ESCORT`, and `FLEET_ROUTE_COORDINATOR`. Navigation is role-aware; every service still enforces authorization on its endpoints.

The refresh token is stored in `sessionStorage`; the short-lived access token is held in memory. Credentials are not stored in the repository.

## Production build

```powershell
npm run build
```

This runs TypeScript project checks and writes the production bundle to `dist/`.

## Current product areas

- Customer account, horse registry, transport request wizard, document upload and request history
- Manager request review, dispatch and operational dashboard
- Compliance document and rule administration, trip readiness and border clearance
- Trips, route plans and versions, resource/staff/horse assignments, fleet and route capabilities
- Trip execution, checkpoints, GPS/ETA, health logs, incidents, handover, notifications, audit and KPIs

Not every action is available to every role. The sidebar reflects the current UI role policy; the owning backend service remains authoritative.

## Booking lists

Customer and manager booking lists send `page`, `pageSize`, `search`, and `status` to the Gateway. Filtering occurs on the server before pagination. Changing search or status returns the list to page zero.

```http
GET /api/v1/transport-requests?page=0&pageSize=10&search=QUEUE&status=SUBMITTED
```

## Planning API coverage

The current UI uses the Planning trip-list endpoint and route-plan-by-trip read endpoint. Route legs, assignments, route versions, and capabilities are loaded through their corresponding read APIs; a route plan can be reopened after reloading the page.

## Documentation

- [Frontend architecture](../../docs/architecture/frontend.md)
- [Frontend development guide](docs/DEVELOPMENT.md)
- [Project documentation index](../../docs/README.md)
