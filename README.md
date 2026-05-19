# cw2.kr

Personal infrastructure project for [`cw2.kr`](https://cw2.kr).

This repository starts as a small internal dashboard and scraper for tracking public housing subscription announcements. It is built as a learning-oriented Node.js/TypeScript project with a focus on simplicity, clean structure, and maintainable operations.

## Version

Current planned app version: `1.0.0`

## Goals

- Scrape public housing announcement pages on a regular schedule
- Store announcement results locally
- Send new announcement alerts to Discord
- Provide a small internal dashboard for tracking scrape results and runs
- Run on a single EC2 instance with minimal operational overhead

## Tech Stack

Planned first version:

- Node.js
- TypeScript
- Fastify
- SQLite
- Node `fetch` + Cheerio
- Discord webhook
- Docker Compose
- Caddy or Nginx as a reverse proxy

## Non-goals

The first version intentionally avoids:

- Public user-facing accounts
- Large-scale crawling
- Multi-server architecture
- RDS or other managed databases
- Complex CI/CD
- Kubernetes

## Architecture

```text
EC2
├─ reverse proxy
│  └─ HTTPS / internal access control
│
├─ Node.js / Fastify app
│  ├─ internal dashboard
│  ├─ scraper runner
│  ├─ Discord notifier
│  └─ SQLite access
│
└─ SQLite runtime database
   └─ data/cw2.db
```

## Documentation

- [Product scope v1](docs/product-v1.md)
- [Database schema](docs/schema.md)
- [Database driver decision](docs/database-driver.md)
- [Engineering notes](docs/engineering-notes.md)
- [package.json guide](docs/package-json.md)

## Local Development

> This project is in the initial setup phase. The commands below will be updated as the application structure is added.

```bash
npm install
npm run dev
```

Send a standalone Discord alert to verify webhook configuration:

```bash
DISCORD_WEBHOOK_URL=... npm run alert:test
```

## Environment Variables

Create `.env` from `.env.example` when the application scaffold is ready.

```bash
cp .env.example .env
```

Expected values:

```env
PORT=3000
DATABASE_PATH=./data/cw2.db
DISCORD_WEBHOOK_URL=
```

## Security

This repository is public. Runtime secrets and operational data are intentionally excluded from version control.

Do not commit:

- `.env` files
- Discord webhook URLs
- SQLite database files
- AWS credentials
- SSH keys
- private logs
- production backups
- scraped data that may contain private or sensitive information

SQLite is used as a local runtime database. The database file is created under `data/` and is ignored by Git.

## Status

Early development.
