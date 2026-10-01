# Frontend architecture

## Source layout

```text
src/
  app/
    App.tsx       Application shell and dashboard composition
    styles.css    Responsive visual system
  main.tsx        React bootstrap
```

The current prototype keeps UI data in `App.tsx` so it can be demonstrated without a running backend. When Gateway contracts are available, split each business area into `features/<area>/api`, `hooks`, `screens`, `components`, and `types`.

## Intended API boundary

All network calls should be routed through one API client and use `/api/v1` Gateway endpoints. The client should own authentication headers, request IDs, timeout, response-envelope parsing and the refresh-token retry flow.

## Product navigation

The sidebar maps to user-facing workspaces: Overview, Horses, Transport Requests, Compliance, Fleet and Routes, and Trips. API implementation tasks must not appear in the product UI.
