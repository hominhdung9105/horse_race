# EquiRoute

Web application quản lý vận chuyển ngựa đua xuyên quốc gia.

## Run locally

```powershell
npm install
npm run dev
```

Open the Vite URL shown in the terminal, normally `http://localhost:5173`.
The Planning screens use the real backend API (no mock-data mode). Start the backend stack first so the Gateway is listening on `http://localhost:8080`.

Copy `.env.example` to `.env.local` if the Gateway uses another address. `VITE_API_PROXY_TARGET` configures the Vite development proxy; `VITE_API_BASE_URL` can be set when the API is exposed directly. The browser calls `/api` through Vite by default, so local development does not need a permissive CORS policy.

Sign in with a backend `CUSTOMER`, `TRANSPORT_SPECIALIST`, `LOGISTICS_MANAGER`, `COMPLIANCE_OFFICER`, or `ADMIN` account. Credentials are provisioned by the backend and are intentionally not stored in this repository. Refresh tokens are kept in session storage and the short-lived access token stays in memory.

## Production build

```powershell
npm run build
```

The production bundle is written to `dist/`.

## Product areas

- Customer profile, horse registry, and transport requests
- Manager transport-request review queue
- Compliance document upload/review and trip readiness evaluation
- Trips, route plans, and fleet master data (vehicles, locations, stalls, countries, airlines, flight bookings)

Planning currently has no trip-list or route-plan-by-trip GET endpoint. The UI looks up a trip by ID and creates a route plan, but cannot recover an existing plan after a page reload until the backend adds a read endpoint.

## Documentation

- [Frontend architecture](docs/ARCHITECTURE.md)
- [Development guide](docs/DEVELOPMENT.md)
