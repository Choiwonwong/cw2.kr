# Engineering Notes

App version: `1.0.0`

This project is also a learning project. Engineering choices should remain explicit, small, and easy to explain.

## Learning Policy

- Prefer beginner-readable TypeScript over clever abstractions.
- Explain new TypeScript/Node.js patterns as they are introduced.
- Keep SQL visible before introducing higher-level database abstractions.
- Add tests when introducing behavior, especially data-access behavior.
- Favor small commits that each teach or prove one idea.

## Current Style Decisions

### Factory functions over classes for now

Repository modules currently use factory functions such as:

```ts
createHousingPostRepository(database)
```

This is intentional.

Benefits for v1:

- avoids `this` while the project is small
- makes dependencies explicit through function arguments
- keeps tests simple with in-memory SQLite
- uses closures to hide prepared statements
- fits module-based Node.js/TypeScript code well

This is not strict functional programming. Repository methods still perform database side effects.

A more precise description is:

```text
factory function pattern + module-based design + closure-based encapsulation
```

### When to reconsider OOP/classes

Class-based repositories/services can be reconsidered later if:

- repository state becomes more complex
- multiple implementations are needed, such as SQLite and in-memory repositories
- service objects need lifecycle management
- a DI container or class-oriented framework is introduced
- class-based mocks become clearer than factory-based test doubles

Until then, class usage is optional rather than required.

## Service Layer Policy

Service modules coordinate repositories and business rules.

For v1, the scrape service owns:

- creating a scrape run before scraper execution
- storing newly discovered housing posts
- counting found, new, and duplicate posts for runtime results
- marking scrape runs as success or failed
- calculating source health from recent run history

Route handlers and future CLI commands should call services instead of coordinating repositories directly.

## Notification Adapter Policy

Outbound alerts go through a small adapter boundary.

For Discord, the app uses:

```ts
createDiscordWebhookAdapter({ webhookUrl })
```

Services depend on the generic notification adapter shape instead of `fetch`
directly. Tests can pass an in-memory adapter that records messages, while
runtime scripts can use the real Discord webhook adapter.

## Headless Scraper Operations

v1 source management is CLI-first rather than web-UI-first.

Current commands:

```bash
npm run sources:seed:thepodium
npm run sources:list
npm run scrape
```

`npm run scrape` reads enabled sources from SQLite, maps supported sources to
scraper implementations, stores new posts through `ScrapeService`, and sends
Discord alerts when `DISCORD_WEBHOOK_URL` is present.

## Test Placement

Unit and small integration-style tests may live next to the implementation file:

```text
src/repositories/housing-post-repository.ts
src/repositories/housing-post-repository.test.ts
```

This is called co-located testing.

Benefits:

- implementation and tests are easy to read together
- refactors can move code and tests together
- TDD feedback stays local

Future end-to-end tests may live under a separate `tests/e2e/` directory.

## Related Documents

- [Product scope v1](product-v1.md)
- [Database driver decision](database-driver.md)
- [package.json guide](package-json.md)
