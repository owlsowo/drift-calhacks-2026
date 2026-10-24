# Deployment handoff

The local app and its isolated tests work. Hosted deployment remains pending account access and a real Claude key. This runbook is preparation, not proof of deployment.

## 1. Connect the intended accounts

Use Node 22.12+ and SpacetimeDB CLI 2.13. Sign in with `spacetime login` to the account holding the event credits. Keep the private GitHub repository private. Put `ANTHROPIC_API_KEY` in the untracked root `.env`; never use a `VITE_` variable for a secret.

Run a small evaluation first: `npm run eval:models -- --limit 12`. Read every returned nudge and moderation disagreement. The current fixtures are synthetic development labels, awaiting human review. Do not call dry-run results model quality. Confirm available model IDs in the actual account; defaults are Haiku 5.5 for moderation and Sonnet 5.5 for nudges.

Set an account/project budget alert, initially $10, as an alert. The application independently starts with a 1,000-dispatch cap. The evaluation runner has a separate 80-dispatch lifetime ledger. Review their combined use before raising either cap.

## 2. Publish the backend

Choose a unique database name, then run:

```sh
npm run db:publish -- YOUR_DATABASE_NAME --server maincloud
```

The production wrapper requires a key and sets development mode false. It passes server environment values without putting the key in command arguments. Read the CLI migration plan before accepting breaking changes to a database that contains real data.

Keep mutual hello off initially. Keep `DRIFT_STARTERS_HUMAN_WRITTEN` false until the fixture arrays have actually been replaced with human-written lines. Peer-to-peer play still works without starters; an empty pool offers retry.

Record the actual database name, endpoint, deployed module version, CLI version and SDK version in the release notes. Check them against the account console rather than guessing an endpoint.

## 3. Build the frontend against that deployment

Create untracked `apps/web/.env.local` containing only:

```env
VITE_SPACETIMEDB_HOST=https://YOUR_VERIFIED_SPACETIME_ENDPOINT
VITE_SPACETIMEDB_DATABASE=YOUR_DATABASE_NAME
```

Then run `npm run db:generate` and `npm run build`. Use an existing familiar static host if available. `wrangler.jsonc` supports Cloudflare static assets; authenticate its CLI before deploying. Do not add a second host just for a track.

`apps/web/public/_headers` is copied into the output. A compatible host should apply the CSP, nosniff, referrer, permissions and cache headers. Inspect actual HTTPS responses after deployment; the file’s presence does not prove enforcement. The CSP allows the Spacetime subdomains, not arbitrary third-party endpoints. Adjust only if the verified deployment requires it.

## 4. Verify the real release

Use two independent browser identities, preferably two actual phones. Use fresh participant input. Confirm setup moderation, pair moderation and a contextual nudge through the server procedure, then verify live return and PNG sharing. Check real mobile keyboards and native-share cancellation. Verify that no sandbox notice appears on a live release and that no secret is present in browser requests or bundles.

Use a separate, clearly identified demo database for rehearsal. Do not run `test:ui` or `test:live` against the attendee database; their runner only uses disposable local databases. Start with controlled distribution while broad-link bot controls remain absent.

## 5. Operate during the event

Owner-only operations are `admin_status`, `admin_reports`, `resolve_report`, `set_pause`, `set_dispatch_cap` and `purge_old_data`. Use the authenticated database owner. Start with status and the report queue; never paste private report text or tokens into public submission material.

If provider checks fail, pause submissions and retain drafts. Do not turn the live database into an unannounced sandbox. Publicly shared downloads cannot be revoked by hiding a card. Retention cleanup is owner-run, not automatically scheduled.

Enable mutual hello only after physically verifying a public meeting spot and setting all three server flags described in the README. Do not use the synthetic test meeting point.

The release is verified only after the deployed two-device integration gate passes. Record actual evidence and remaining limitations in the submission.
