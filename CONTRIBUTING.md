# Contributing to Cronko

Thanks for your interest in contributing! This document outlines the process
for getting your changes merged.

## Getting Started

1. Fork the repository and clone it locally.
2. Install dependencies: `pnpm install`
3. Copy `.env.example` to `.env` — defaults work for development.
4. Start the dev servers: `pnpm dev`

API runs on `:3001`, web on `:3000`.

## Development Workflow

- Create a feature branch from `main`: `git checkout -b feat/my-feature`
- Make your changes
- Run `pnpm typecheck` across all workspaces
- Commit using conventional commits: `feat:`, `fix:`, `docs:`, `chore:`
- Push and open a Pull Request

## Code Style

- TypeScript strict mode across all packages
- Use `useT()` hook for all user-facing strings (i18n)
- Keep translations in `packages/shared/src/translations.ts`
- No unused comments — self-documenting code preferred
- Formatting is handled by the project's `tsconfig.json` settings

## Project Structure

```
cronko/
├── apps/
│   ├── api/          # Hono backend (port 3001)
│   └── web/          # Next.js frontend (port 3000)
├── packages/
│   ├── database/     # Drizzle ORM schema, migrations, queries
│   └── shared/       # Types, constants, utils, i18n
└── scripts/          # Dev utilities
```

## Testing

Before opening a PR:

```bash
pnpm --filter @cronko/database run typecheck
pnpm --filter @cronko/api run typecheck
pnpm --filter @cronko/shared run typecheck
```

## Need Help?

Open an issue with the `question` label or start a discussion.