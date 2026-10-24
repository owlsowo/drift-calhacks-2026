# Model checks

These are **synthetic policy examples authored for development**, not attendee data or a human-labeled safety benchmark. A human owner should review the expected labels. They do not measure population-wide safety, humor, friendship, or impact.

Run `npm run eval:models -- --limit 8` after adding a valid key to the untracked root `.env`. The runner uses exactly the request schema, instructions, and output validator used by the server. It runs sequentially, has its own bounded dispatch ledger, never automatically retries ambiguous calls, and records each dispatched request before sending. No key or request headers are written to results.

Use `--dry-run` to validate fixture shape and contracts without paid calls. The default live allowance is at most 80 total evaluation dispatches across runs; `--limit` further bounds a single run. This evaluation ledger is separate from the deployed application's dispatch cap. Keep their combined provider use within the project budget.

The moderation set includes harmless fictional absurdity, contact details, targeted abuse, pair-level meaning, and embedded instructions. Some component-level adversarial probes exceed game length; the live game rejects those in deterministic validation before calling a model.

The nudge set checks grounding inputs and mechanical constraints. Automated validation cannot establish that a hint is helpful or never effectively writes an ending. Read each output and record useful/not useful, grounded/not grounded, and answer-writing/not answer-writing in the result's manual-review fields. Compare candidate models on the same cases before changing defaults.

Never describe dry runs, mock HTTP tests, or unreviewed output as successful live model evaluation.
