# package.json Guide

`package.json` is the Node.js project manifest. It tells npm what this project is, how to run it, and which packages it depends on.

> Note: JSON does not support comments, so comments are documented here instead of inside `package.json`.

## Annotated package.json

```jsonc
{
  // Package name. This matches the public project/repo identity.
  "name": "cw2.kr",

  // App version. This should stay aligned with README and docs/product-v1.md.
  "version": "1.0.0",

  // Short package description shown by npm/GitHub tooling.
  "description": "Personal infrastructure and service dashboard for cw2.kr",

  // Use modern ECMAScript modules instead of CommonJS.
  // This allows `import ... from ...` syntax and requires `.js` extensions in compiled TS imports.
  "type": "module",

  // This repo is public, but this package is a personal app and should not be published to npm.
  // `private: true` blocks accidental npm publish.
  "private": true,

  // CLI commands runnable with `npm run <name>`.
  "scripts": {
    // Start the dev server with tsx and restart when source files change.
    "dev": "tsx watch src/server.ts",

    // Compile TypeScript from src/ to dist/ using tsconfig.json.
    "build": "tsc -p tsconfig.json",

    // Run the compiled production build.
    // This expects `npm run build` to have created dist/server.js first.
    "start": "node dist/server.js",

    // Check TypeScript types without generating dist/ output.
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },

  // Search/discovery labels. These are mostly documentation metadata.
  "keywords": [
    "personal-infrastructure",
    "dashboard",
    "scraper",
    "fastify",
    "sqlite"
  ],

  // Author is currently empty. Fill later if desired.
  "author": "",

  // License is intentionally not open-source yet.
  // The GitHub repository is public, but this does not grant reuse rights by default.
  "license": "UNLICENSED",

  // Runtime dependencies required when the app runs.
  "dependencies": {
    // Fastify is the web framework used for routes like GET /health.
    "fastify": "^5.6.2"
  },

  // Development-only dependencies used for local development/build/type checking.
  "devDependencies": {
    // Node.js type definitions for TypeScript, e.g. process.env.
    "@types/node": "^25.0.0",

    // Runs TypeScript files directly in development without manual compilation.
    "tsx": "^4.20.6",

    // The TypeScript compiler.
    "typescript": "^5.9.3"
  }
}
```

## Important Notes

### `type: "module"`

This project uses ESM. In TypeScript source files, local imports use `.js` extensions:

```ts
import { loadConfig } from "./config.js";
```

That looks strange at first because the source file is `config.ts`, but TypeScript compiles it to `config.js` in `dist/`.

### `private: true` vs `license: "UNLICENSED"`

- `private: true` blocks accidental publishing to npm.
- `license: "UNLICENSED"` means the code is publicly visible but not explicitly licensed for reuse.

This is appropriate for a public GitHub repository that is still a personal app rather than a reusable npm package.

### Scripts

Most common commands:

```bash
npm run dev
npm run typecheck
npm run build
npm start
```
