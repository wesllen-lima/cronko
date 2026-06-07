# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Cronko, please **do not** open a
public issue.

Send an email to the maintainers. You should receive a response within 48 hours.
If the vulnerability is accepted, we will work on a fix and coordinate a
release timeline.

## Supported Versions

| Version | Supported          |
|---|---|
| latest  | :white_check_mark: |

## Security Model

- **Authentication**: JWT tokens signed with HS256. Tokens expire after 7 days.
- **Cookies**: httpOnly, SameSite=Lax, Secure in production.
- **Passwords**: bcrypt with 12 salt rounds.
- **Ping endpoints**: Rate-limited per token (60 req/min default).
- **Environment**: Secrets are loaded from `.env`, never committed to the repo.
- **Dependencies**: Managed by pnpm lockfile. Dependabot/renovate recommended.

## Best Practices for Deployments

1. Always set a strong `JWT_SECRET` (minimum 32 characters).
2. Use PostgreSQL in production (SQLite is for development only).
3. Run behind a reverse proxy (nginx, Caddy) with HTTPS.
4. Change `ADMIN_EMAIL` and `ADMIN_PASSWORD` from defaults.
5. Keep your Node.js and pnpm versions up to date.