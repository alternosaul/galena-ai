# Galena AI — VoxGuard

Web dashboard that analyzes call data and detects whether the voice is **AI-generated or human**, showing the model's verdict, confidence and performance metrics.

## Features

- **Detector** — submit a call as JSON or upload audio; shows the Human / AI result and a confidence gauge (0–1).
- **History** — log-style table of recent requests with search, filters, export and detail view.
- **API** — model connection settings, app endpoints and request/response examples.
- **Model** — interactive metrics: ROC and precision-recall curves, confusion matrix, score distribution, monthly trend and model comparison.
- **Account** — login (email, Google, GitHub), user profile, preferences and password change.
- Spanish / English interface and light / dark themes.

> Model predictions, metrics, history and authentication are currently **mocked** in the frontend.
> Look for `TODO` comments (e.g. `src/routes/api/public/detect.ts`, `src/lib/auth.tsx`, `src/lib/tigerdata.ts`) to connect the real backend.

## Tech stack

TanStack Start (React 19, SSR) · Vite · Tailwind CSS v4 · shadcn/ui (Radix) · TanStack Query · Recharts · Zod · Nitro (Node server build)

## Development

Requires Node.js 22+.

```sh
npm install
npm run dev        # http://localhost:8080
```

Other scripts:

```sh
npm run build      # production build → .output/server/index.mjs
npm run lint
npm run format
```

## Production

The build outputs a standalone Node server:

```sh
npm run build
PORT=3000 node .output/server/index.mjs
```

It is deployed behind nginx as a systemd service. Server-side secrets (`MODEL_API_URL`, `MODEL_API_KEY`, `TIGERDATA_URL`) are read from the environment.

## Project structure

```
src/
  routes/          file-based routes (pages and /api/public/* endpoints)
  components/      app components (charts, sidebar, login hero, …)
  components/ui/   shadcn/ui primitives
  lib/             i18n, theme, auth, metrics, data helpers
public/            static assets
```
