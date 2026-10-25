# Preserve the hosted database while enabling independent letters

SpacetimeDB supports appending defaulted columns, but not deleting/reordering populated columns through automatic migration ([official migration reference](https://spacetimedb.com/docs/databases/automatic-migrations/)). The PR's direct table rewrite is replaced by an additive schema: the three old bottle-lock columns remain at their original positions; `createdMs` and beginning IDs are appended with defaults. A private migration marker and the new public beginning table are added. The unused lock columns are retained for compatibility, not used as exclusive claims.

Schema expansion and the owner-only `admin_upgrade_letters` data backfill are separate. The backfill requires paused submissions and no active reserved request. It copies approved beginnings, binds existing pair/author IDs, and completes legacy release-to-catch stages without changing reply leases, optional write drafts, ownership, action flags, quotas, request receipts, costs or IDs. Hidden pairs are never recreated. If a private bottle was already purged under the old policy, only the existing approved public setup is reconstructed; ownership still comes from the existing private author mapping. The browser shelf also discovers those archived beginnings through owned setup pairs.

Legacy bottles had no creation timestamp. Their day boundary is used explicitly as an approximate timestamp, including during cleanup before the backfill. This avoids treating default-zero legacy rows as expired. No approximate timestamp is presented as a measured publication time.

`npm run test:migration` publishes the actual previous hosted code (`f68baf4`) to an isolated local database, creates eleven rounds/four beginnings with synthetic writers, a visible pair, a hidden pair and a held reply, then republishes the new module with `--delete-data=never`. It checks every old stored field except the documented completed-release transition, runs the backfill twice, and opens the new browser UI with the original identity tokens. The resulting `docs/evidence/letter-migration.json` records counts and limits. Private synthetic snapshots stay under ignored `.spacetime/`; no real provider key/call is used. The fixture matches the observed hosted row-count scale, not a large-scale benchmark.

Five additional module tests verify owner/pause/in-flight gates, hidden content, orphaned archive recovery, immutable old data and idempotency. All 66 module tests, 25 unit tests, eight current Chrome letter-flow checks, production build and server/scripts typechecks pass.

## Hosted sequence

1. Push verified code and wait for its CI result.
2. Pause submissions, wait for reserved work, then run `node scripts/letter-upgrade-check.mjs backup`. This saves an owner snapshot locally with restricted file permissions; it is excluded from Git.
3. Publish the tested module to the existing identity with `--delete-data=never` and the explicit non-destructive client-break confirmation. Never pass a destructive delete-data option.
4. Call `admin_upgrade_letters`, then `node scripts/letter-upgrade-check.mjs verify`. The public report contains counts/hashes, never stories or identities. Maintenance scheduling and expiring shore passes are backed up but excluded from immutable comparisons.
5. Deploy the matching tested frontend, inspect the connected hosted interface and headers, then restore the prior pause setting. Existing tabs may require a reload for the expanded public-row bindings.

The schema expansion is intentionally forward-only: newly populated tables/columns are retained. A failure leaves submissions paused for a forward fix; deleting/resetting the database or reverting to incompatible old bindings is not a rollback plan. The raw backup is evidence/recovery material, not a promise that a one-command restore has been tested.
