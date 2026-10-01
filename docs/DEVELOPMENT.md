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
