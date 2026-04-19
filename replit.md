# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + TailwindCSS + shadcn/ui

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Artifacts

### AI Proxy Portal (`artifacts/ai-proxy-portal`)
- **Preview Path**: `/`
- **Purpose**: Manages Vercel API keys with round-robin key rotation, usage tracking, and cost monitoring
- **Pages**: Dashboard, API Keys (management), Usage Logs
- **Features**: Key CRUD (add/toggle/delete), usage stats, cost estimation, proxy endpoint for AI model calls

### API Server (`artifacts/api-server`)
- **Preview Path**: `/api`
- **Routes**:
  - `GET/POST /api/keys` — list and create keys
  - `GET/PATCH/DELETE /api/keys/:id` — manage individual keys
  - `GET /api/keys/stats` — dashboard stats
  - `GET /api/usage` — usage logs
  - `GET /api/usage/summary` — per-key usage summary
  - `POST /api/v1/chat/completions` — proxy to Vercel AI (round-robin key rotation)
  - `GET /api/v1/models` — proxy to Vercel AI models list

## Database Schema

- **api_keys**: Stores Vercel API keys (name, encrypted key, preview, enabled state, usage counters)
- **usage_logs**: Logs every proxied AI request (tokens, cost, latency, status code, model)

## Important Notes

- After running codegen, `lib/api-zod/src/index.ts` must only export `"./generated/api"` (not both `api` and `types`) to avoid duplicate exports
- API keys are stored in the DB — the actual key value is stored in `api_key` column but never returned in responses (only `keyPreview` is returned)

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
