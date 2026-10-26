# Deploy Drift

Use Node.js 22.12+ and SpacetimeDB CLI 2.13. Keep API keys in the untracked root `.env`; only public configuration belongs in `VITE_` variables.

## Backend

Sign in with `spacetime login`, then publish to your database:

```sh
npm run db:publish -- YOUR_DATABASE_NAME --server maincloud
```

The wrapper requires an Anthropic key for production and disables sandbox mode. Review the migration plan before accepting changes to an existing database. Configure the Turnstile secret and expected hostnames on the server. Leave starter content disabled until a reviewed bundle has been installed.

## Frontend

Set public connection values in untracked `apps/web/.env.local`:

```env
VITE_SPACETIMEDB_HOST=https://YOUR_SPACETIME_ENDPOINT
VITE_SPACETIMEDB_DATABASE=YOUR_DATABASE_NAME
VITE_TURNSTILE_SITE_KEY=YOUR_PUBLIC_WIDGET_KEY
```

Run `npm run db:generate` and `npm run build`. Authenticate Wrangler and deploy using `wrangler.jsonc`, updating its domains for your deployment. Configure matching hostnames in Turnstile and `DRIFT_TURNSTILE_HOSTNAME` on the backend.

Drift is served at [driftbottle.ink](https://driftbottle.ink/). The original workers.dev address remains available for existing players. Guest identity and saved history belong to each browser origin.

## Verification and operation

Check HTTPS headers, human verification, sending a beginning, catching it from an independent browser, writing an ending, live return and image export. Use disposable local databases for automated tests.

The owner can pause submissions, review reports, purge expired data and inspect model usage. See [security and privacy](security-boundaries.md) and [AI budget controls](ai-budget.md). Provider failures should preserve drafts; do not switch a live database into sandbox mode to work around them.
