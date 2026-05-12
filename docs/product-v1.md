# Product Scope v1

This document defines the first product scope for `cw2.kr` before implementation begins.

App version: `1.0.0`

## Purpose

`cw2.kr` starts as a personal infrastructure and service dashboard.

The first practical use case is a housing announcement scraper:

- collect public housing-related posts
- store them locally
- notify new posts to Discord
- show the current state in a small internal dashboard

The dashboard is for internal personal use, not for public users.

## v1 Principles

- Keep the app small and understandable.
- Prefer one EC2 instance and one SQLite database file.
- Keep scraping execution outside the web UI.
- Use the web UI mainly for reading and lightweight tracking.
- Store facts in the database; calculate derived state in the service layer.
- Avoid adding a scheduler schema until the need is proven.
- Avoid exposing secrets, runtime data, or operational logs in Git.

## v1 Features

### Scraping

The system should:

- scrape enabled sources only
- create a `scrape_runs` row for each source execution
- store newly discovered housing posts in `scraped_housing_posts`
- avoid duplicate posts by `source_id` and `url`
- send Discord notifications for newly discovered posts

Scraping is triggered outside the dashboard in v1.

Recommended initial execution path:

```bash
npm run scrape
```

Scheduled execution should initially be handled outside the database schema, such as with EC2 cron, systemd timer, or container-level scheduling.

### Dashboard

The internal dashboard should show:

- source status derived from recent scrape runs
- recent scrape run results
- recent housing posts
- unchecked housing posts
- submitted/unsubmitted tracking state
- notification state through `notified_at`

### Tracking

The user should be able to mark a housing post as:

- checked
- submitted

The dashboard does not need to support direct real-world response workflows. Actual response/submission happens outside this app.

## v1 Non-goals

The first version does not include:

- public user accounts
- app-managed login system
- dashboard-triggered scraping
- source creation/editing UI
- schedule management UI
- `cron_expression` on `scrape_sources`
- `scrape_schedules` table
- RDS or managed database
- multi-server architecture
- Kubernetes
- complex CI/CD
- large-scale crawling

## Source Health

Source health is not stored in `scrape_sources`.

It is calculated in the service layer from recent `scrape_runs` rows.

Recommended v1 rule:

```text
no run history                 -> unknown
latest run is success          -> healthy
latest run is failed           -> degraded
latest 3 runs are all failed   -> unhealthy
```

## Scheduling Decision

Do not add `cron_expression` to `scrape_sources` in v1.

Reason:

- source metadata and scheduling rules are different concerns
- a source may eventually need multiple schedules
- schedules may be managed externally through cron/systemd/container orchestration
- adding a schedule table later is cleaner than overloading `scrape_sources`

If app-managed scheduling becomes necessary later, add a separate table such as:

```sql
CREATE TABLE scrape_schedules (
  id INTEGER PRIMARY KEY,
  source_id INTEGER NOT NULL,
  cron_expression TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  timezone TEXT NOT NULL DEFAULT 'Asia/Seoul',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT,

  FOREIGN KEY (source_id) REFERENCES scrape_sources(id)
);
```

## Routes

### Page Routes

These routes render internal HTML pages.

```text
GET /
GET /housing-posts
GET /runs
```

### Health Route

```text
GET /health
```

Expected v1 response:

```json
{
  "ok": true
}
```

### API Routes

Use `/api` for state-changing routes.

```text
POST /api/housing-posts/:id/mark-checked
POST /api/housing-posts/:id/mark-submitted
```

Do not use `/scrape` as a page route prefix in v1. The page is about the user's housing posts and run state, not about exposing scraper internals.

If dashboard-triggered scraping is added later, use explicit API routes such as:

```text
POST /api/scrape-runs
GET /api/scrape-runs
```

## Related Documents

- [Database schema](schema.md)
