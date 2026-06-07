# Cronko

**Know when your jobs stop running. · Saiba quando seus jobs param de rodar.**

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node](https://img.shields.io/badge/node-24-green.svg)](https://nodejs.org)
[![pnpm](https://img.shields.io/badge/pnpm-9-orange.svg)](https://pnpm.io)

```
$ docker compose up
✔ db        Started
✔ api       Started  (http://localhost:3001)
✔ web       Started  (http://localhost:3000)
```

---

## 📋 Features · Funcionalidades

- **Heartbeat monitoring** — cron jobs, scripts, ETLs send HTTP pings
- **Status detection** — `pending` → `healthy` → `missed` → `down` → `healthy`
- **Grace periods** — configurable tolerance before marking as missed
- **Incident tracking** — every status transition creates an incident with timestamps
- **Pulse (start/finish)** — precise duration measurement for long-running jobs
- **Max duration alerts** — alert if job exceeds configured max duration
- **Notifications** — Discord, Telegram, Email, Slack (webhooks / SMTP / bot)
- **Public status badge** — SVG badge without authentication (`/badge/:token`)
- **Dashboard** — donut chart, sparklines, animated counters, 24h uptime
- **Heartbeat retention** — automatic cleanup of old heartbeats (configurable)
- **Dark / Light / System theme** — with animated View Transition API
- **Compact mode** — dense UI for smaller screens
- **Custom favicon emoji** — change the tab icon via Settings
- **Cron expression parser** — convert cron expressions to intervals in the form
- **CSV export** — export heartbeats from any monitor
- **i18n** — Portuguese (Brazil) and English interface
- **Two database backends** — SQLite for dev/local, PostgreSQL for production
- **Docker & local dev** — `docker compose up` or `pnpm dev`

---

<details open>
<summary>📖 Português</summary>

### O que é

Cronko monitora cron jobs, scripts de backup, pipelines ETL e qualquer
automação que possa disparar uma requisição HTTP. Você configura um monitor
com um intervalo esperado, recebe uma URL de ping, e o sistema te alerta
quando um job deixa de executar dentro da janela.

Não é uma plataforma de observabilidade. Não coleta métricas, não faz parsing
de logs, não faz tracing distribuído. Se você precisa de Datadog, não é isso.
O Cronko faz uma coisa: avisa quando seus jobs param de rodar.

### Como funciona

Cada monitor recebe uma URL única de ping. Seu cron job acessa essa URL
quando executa. O scheduler verifica a cada poucos segundos se cada monitor
recebeu um heartbeat dentro da janela esperada. Heartbeats atrasados disparam
"missed", ausência prolongada dispara "down", e a recuperação restaura tudo.
Incidentes são registrados com timestamps de início/fim. Notificações são
disparadas a cada transição de estado via Discord, Telegram, Email ou Slack.

```bash
# no seu crontab
0 2 * * * /usr/local/bin/backup.sh && \
  curl -s https://cronko.exemplo.com/ping/seu-token > /dev/null
```

### Instalação

#### Docker

```bash
git clone https://github.com/seu-usuario/cronko
cd cronko
cp .env.example .env
# edite .env — defina JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
docker compose up -d
```

Acesse `http://localhost:3000` e faça login com `ADMIN_EMAIL` e `ADMIN_PASSWORD`.

#### Desenvolvimento local

```bash
pnpm install
cp .env.example .env
# DATABASE_URL padrão é SQLite — nenhuma configuração extra necessária
pnpm dev
```

API em `:3001`, web em `:3000`.

### Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `DATABASE_URL` | sim | `file:./data/cronko.db` (SQLite) ou `postgresql://...` |
| `API_PORT` | não | Porta da API (padrão: 3001) |
| `API_HOST` | não | Endereço de bind da API (padrão: 0.0.0.0) |
| `NEXT_PUBLIC_API_URL` | não | URL que o frontend usa para alcançar a API |
| `JWT_SECRET` | sim | Chave para assinar tokens JWT (mín 32 caracteres) |
| `ADMIN_EMAIL` | não | Email do admin criado automaticamente no primeiro boot |
| `ADMIN_PASSWORD` | não | Senha do admin (mín 8 caracteres) |
| `SMTP_HOST` | não | Servidor SMTP para notificações por email |
| `SMTP_PORT` | não | Porta SMTP (padrão: 587) |
| `SMTP_USER` | não | Usuário SMTP |
| `SMTP_PASS` | não | Senha SMTP |
| `SMTP_FROM` | não | Remetente dos emails de notificação |
| `TELEGRAM_BOT_TOKEN` | não | Token do bot para notificações Telegram |

### Integrações de notificação

#### Discord
Crie um webhook nas configurações do servidor Discord. Adicione um canal em
Cronko com tipo `discord` e cole a URL do webhook.
```json
{ "webhookUrl": "https://discord.com/api/webhooks/..." }
```

#### Telegram
Crie um bot via `@BotFather`, obtenha o token, encontre o chat ID. Configure
um canal com tipo `telegram`.
```json
{ "botToken": "123456:ABC-DEF...", "chatId": "-1001234567890" }
```

#### Email
Defina `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, e `SMTP_FROM` no
seu `.env`. Adicione um canal com tipo `email` e o endereço do destinatário.
```json
{ "to": "alertas@exemplo.com" }
```

#### Slack
Crie um webhook no Slack. Adicione um canal em Cronko com tipo `slack` e
cole a URL do webhook.
```json
{ "webhookUrl": "https://hooks.slack.com/services/..." }
```

### Funcionalidades avançadas

#### Pulse (start/finish)
Para jobs longos, use `/start` antes de começar e `/finish` ao terminar.
A duração é calculada automaticamente.
```bash
curl -X POST https://cronko.exemplo.com/ping/TOKEN/start
./meu-job-longo.sh
curl -X POST "https://cronko.exemplo.com/ping/TOKEN/finish?d=$SECONDS&exit=$?"
```

#### Badge de status público
Exiba o status do seu monitor em qualquer lugar com uma badge SVG pública.
```markdown
![Cronko](https://cronko.exemplo.com/badge/TOKEN)
```

#### Duração máxima (max duration)
Configure um limite de duração no formulário de criação. Se o ping reportar
uma duração acima desse limite, um incidente é gerado automaticamente.

#### Limpeza de heartbeats
Heartbeats com mais de 90 dias são removidos automaticamente (configurável
em Settings).

#### Exportação CSV
Exporte os heartbeats de qualquer monitor em formato CSV:
`/api/monitors/:id/heartbeats?format=csv`

### Stack

- Backend — Hono, Node.js, Drizzle ORM, SQLite / PostgreSQL
- Frontend — Next.js, React, Tailwind CSS
- Infra — Docker, pnpm workspaces, Turborepo

### Licença

MIT — veja [LICENSE](LICENSE) para detalhes.

</details>

<details>
<summary>📖 English</summary>

### What it is

Cronko monitors cron jobs, backup scripts, ETL pipelines, and any scheduled
automation that can fire an HTTP request. You configure a monitor with an
expected interval, give it a URL to ping, and the system alerts you when a job
misses its window.

It's not an observability platform. It doesn't collect metrics, doesn't parse
logs, and doesn't do distributed tracing. If you need Datadog, this isn't it.
It does one thing: tells you when your jobs stop running.

### How it works

Each monitor gets a unique ping URL. Your cron job hits that URL when it runs.
The scheduler checks every few seconds whether each monitor received a heartbeat
within its expected window. Late heartbeats trigger a miss, prolonged absence
triggers a down status, and recovery resets everything. Incidents are tracked
with start/end timestamps. Notifications fire on every state transition through
Discord, Telegram, Email, or Slack.

```bash
# in your crontab
0 2 * * * /usr/local/bin/backup.sh && \
  curl -s https://cronko.example.com/ping/your-token > /dev/null
```

### Installation

#### Docker

```bash
git clone https://github.com/your-username/cronko
cd cronko
cp .env.example .env
# edit .env — set JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
docker compose up -d
```

Open `http://localhost:3000` and log in with `ADMIN_EMAIL` and `ADMIN_PASSWORD`.

#### Local development

```bash
pnpm install
cp .env.example .env
# DATABASE_URL defaults to SQLite — no setup needed
pnpm dev
```

API runs on `:3001`, web on `:3000`.

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | yes | `file:./data/cronko.db` (SQLite) or `postgresql://...` |
| `API_PORT` | no | Port for the API server (default: 3001) |
| `API_HOST` | no | Bind address for the API (default: 0.0.0.0) |
| `NEXT_PUBLIC_API_URL` | no | URL the frontend uses to reach the API |
| `JWT_SECRET` | yes | Key for signing JWT tokens (min 32 chars) |
| `ADMIN_EMAIL` | no | Email for auto-created admin user on first boot |
| `ADMIN_PASSWORD` | no | Password for auto-created admin user (min 8 chars) |
| `SMTP_HOST` | no | SMTP server for email notifications |
| `SMTP_PORT` | no | SMTP port (default: 587) |
| `SMTP_USER` | no | SMTP username |
| `SMTP_PASS` | no | SMTP password |
| `SMTP_FROM` | no | From address for notification emails |
| `TELEGRAM_BOT_TOKEN` | no | Bot token for Telegram notifications |

### Notification integrations

#### Discord
Create a webhook in your Discord server settings. Add a notification channel in
Cronko with type `discord` and paste the webhook URL.
```json
{ "webhookUrl": "https://discord.com/api/webhooks/..." }
```

#### Telegram
Create a bot via `@BotFather`, get the token, find your chat ID. Configure a
channel with type `telegram` and fill in both fields.
```json
{ "botToken": "123456:ABC-DEF...", "chatId": "-1001234567890" }
```

#### Email
Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM` in
your `.env`. Add a channel with type `email` and the recipient address.
```json
{ "to": "alerts@example.com" }
```

#### Slack
Create a Slack webhook. Add a channel in Cronko with type `slack` and paste
the webhook URL.
```json
{ "webhookUrl": "https://hooks.slack.com/services/..." }
```

### Advanced features

#### Pulse (start/finish)
For long-running jobs, use `/start` before starting and `/finish` when done.
Duration is calculated automatically.
```bash
curl -X POST https://cronko.example.com/ping/TOKEN/start
./my-long-job.sh
curl -X POST "https://cronko.example.com/ping/TOKEN/finish?d=$SECONDS&exit=$?"
```

#### Public status badge
Display your monitor's status anywhere with a public SVG badge.
```markdown
![Cronko](https://cronko.example.com/badge/TOKEN)
```

#### Max duration
Set a max duration limit when creating a monitor. If the ping reports a
duration above this limit, an incident is automatically generated.

#### Heartbeat cleanup
Heartbeats older than 90 days are automatically removed (configurable in
Settings).

#### CSV export
Export any monitor's heartbeats as CSV:
`/api/monitors/:id/heartbeats?format=csv`

### Stack

- Backend — Hono, Node.js, Drizzle ORM, SQLite / PostgreSQL
- Frontend — Next.js, React, Tailwind CSS
- Infra — Docker, pnpm workspaces, Turborepo

### Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for local setup instructions and code
style guidelines.

Before opening a PR, make sure `pnpm typecheck` passes across all workspaces.
Report bugs using the issue templates and review our
[Security Policy](SECURITY.md) for vulnerability disclosures.

### License

MIT — see [LICENSE](LICENSE) for details.

</details>