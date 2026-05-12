# Database Driver Decision

App version: `1.0.0`

## Decision

Use `better-sqlite3` as the SQLite driver for v1.

The project will not use an ORM in v1. SQL should remain visible through `schema.sql`, small initialization scripts, and repository-layer methods.

## Drivers

- The app is small and runs on one EC2 instance.
- SQLite is local runtime data, not a network service.
- The developer wants to understand SQL and database access before adopting an ORM.
- The code should stay simple enough for a Node.js/TypeScript beginner to follow.
- The driver should be stable enough for a personal production service.

## Considered Options

### `better-sqlite3`

Chosen.

Pros:

- simple synchronous API
- widely used SQLite package in Node.js
- good fit for small local SQLite apps
- easy to wrap behind a repository layer
- supports transactions

Cons:

- native dependency
- may require platform-compatible prebuilt binaries or local build tooling

### Node built-in `node:sqlite`

Rejected for v1.

Pros:

- no external SQLite dependency
- very direct/native API
- good learning value

Cons:

- newer Node API with stronger Node-version coupling
- less conservative for a small personal production service right now
- EC2 deployment would need careful Node version alignment

### `sqlite3`

Rejected for v1.

Pros:

- mature package
- asynchronous API
- large install base

Cons:

- callback-oriented ergonomics are less clear for this project
- would likely require extra wrapper code for clean TypeScript usage
- not necessary for the current low-concurrency local SQLite use case

## Implementation Rule

Keep direct database calls behind `src/db` and repository/service modules.

Do not spread raw `better-sqlite3` calls throughout route handlers.

## Related Documents

- [Database schema](schema.md)
- [Product scope v1](product-v1.md)
