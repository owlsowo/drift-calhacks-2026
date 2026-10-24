# Deployment handoff

The live checkpoint is documented in `docs/live-release.md`. Hosted Maincloud, Cloudflare HTTPS, real Claude calls and Turnstile rejection checks are now verified; physical-phone and attendee evidence remain pending. This runbook describes how to reproduce the deployment.

## 1. Connect the intended accounts

Use Node 22.12+ and SpacetimeDB CLI 2.13. Sign in with `spacetime login` to the account holding the event credits. Keep the private GitHub repository private. Put `ANTHROPIC_API_KEY` in the untracked root `.env`; never use a `VITE_` variable for a secret.

Run a small evaluation first: `npm run eval:models -- --limit 12`. Read every returned nudge and moderation disagreement. The current fixtures are synthetic development labels, awaiting human review. Do not call dry-run results model quality. Confirm available model IDs in the actual account; defaults are Haiku 5.5 for moderation and Sonnet 5.5 for nudges.

Set an account/project budget alert as a separate provider control. The application starts with a $10 estimated-USD reservation budget and a 1,000-dispatch cap. The evaluation runner has a separate 80-dispatch lifetime ledger. Review combined usage and the actual provider console before raising limits; application estimates are not an account balance. See `docs/ai-budget.md`.

## 2. Publish the backend

Choose a unique database name, then run:

```sh
npm run db:publish -- YOUR_DATABASE_NAME --server maincloud
```

The production wrapper requires a key and sets development mode false. It passes server environment values without putting the key in command arguments. Read the CLI migration plan before accepting breaking changes to a database that contains real data.

Keep mutual hello off initially. Keep `DRIFT_STARTERS_HUMAN_WRITTEN` false until a complete reviewed human-team bundle has been installed separately from development samples. Peer-to-peer play still works without starters; an empty pool offers writing/retry.

Record the actual database name, endpoint, deployed module version, CLI version and SDK version in the release notes. Check them against the account console rather than guessing an endpoint.

## 3. Build the frontend against that deployment

Create untracked `apps/web/.env.local` containing only:

```env
VITE_SPACETIMEDB_HOST=https://YOUR_VERIFIED_SPACETIME_ENDPOINT
VITE_SPACETIMEDB_DATABASE=YOUR_DATABASE_NAME
VITE_TURNSTILE_SITE_KEY=YOUR_PUBLIC_WIDGET_KEY
```

Then run `npm run db:generate` and `npm run build`. Use an existing familiar static host if available. `wrangler.jsonc` supports Cloudflare static assets; authenticate its CLI before deploying. Do not add a second host just for a track.

`apps/web/public/_headers` is copied into the output. A compatible host should apply the CSP, nosniff, referrer, permissions and cache headers. Inspect actual HTTPS responses after deployment; the file’s presence does not prove enforcement. The CSP allows the Spacetime subdomains, not arbitrary third-party endpoints. Adjust only if the verified deployment requires it.

## 4. Verify the real release

Use two independent browser identities, preferably two actual phones. Use fresh participant input. Confirm setup moderation, pair moderation and a contextual nudge through the server procedure, then verify live return and PNG sharing. Check real mobile keyboards and native-share cancellation. Verify that no sandbox notice appears on a live release and that no secret is present in browser requests or bundles.

Use a separate, clearly identified demo database for rehearsal. Do not run `test:ui` or `test:live` against the attendee database; their runner only uses disposable local databases. Verify the actual Turnstile hostname/action and negative-token rejection on the deployed release. The owner-only synthetic provider probe can check key/model/metering without creating a test bottle.

## 5. Operate during the event

Owner-only operations include `admin_status`, `admin_reports`, `resolve_report`, `set_pause`, `set_dispatch_cap`, `purge_old_data`, `retire_bottle` and the budget/health operations documented in `docs/ai-budget.md`. `npm run ops:usage -- --calls` is a read-only formatted cost/latency report. Use the authenticated database owner. Start with status and the report queue; never paste private report text or tokens into public submission material.

If provider checks fail, pause submissions and retain drafts. Do not turn the live database into an unannounced sandbox. Publicly shared downloads cannot be revoked by hiding a card. Retention cleanup runs hourly through a private schedule; the owner-run purge remains available.

Enable mutual hello only after physically verifying a public meeting spot and setting all three server flags described in the README. Do not use the synthetic test meeting point.

The release is verified only after the deployed two-device integration gate passes. Record actual evidence and remaining limitations in the submission.
