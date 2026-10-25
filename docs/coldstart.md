# An empty sea with a real beginning

The first writer could publish a beginning and find no other bottle to catch. The old note asked them to leave six words they had already written, and exposed only retry. The backend already supported closing a round without removing its published beginning, but that action was missing from this screen.

The note now distinguishes three situations: no personal beginning yet; a beginning still drifting; and a beginning that has already become a postcard. A waiting author can choose “Leave it drifting,” which closes the counted round while keeping that day's bottle available. If the postcard has arrived, “Keep my returned story” closes the round while retaining the shared card. Both the main shore and in-round catch screen provide this recovery. Retry remains available. Arrival updates the heading/copy and clears a stale drifting toast.

Closing does not refund a daily round, guarantee a reply, extend the bottle into another day, or remove another writer's postcard. No generated starter or simulated stranger fills the empty sea.

## Verification

`npm run test:coldstart` runs twelve checks across actual Chrome/WebKit engines at 390px touch/mobile configuration and 1440px desktop. Each flow uses two independent synthetic identities and real local Spacetime transitions with AI off and sample/team starters disabled. One writer closes first; a second later catches that genuine peer bottle and completes a canonical postcard that returns without refresh. A second round checks the case where a return arrives while the author still waits. Both cards and daily counts survive closing. Selected accessibility scans and geometry checks ensure the paper leaves the dock/phone controls usable.

The module suite passes 58 tests, including the no-starter/close/later-return transition. The existing 22-check Chrome flow passes separately. This is software verification, not an attendee pilot, physical-phone test, or hosted Claude run.

The optional `DRIFT_DEV_STARTERS=false` setting allows a genuinely empty local sandbox with moderation disabled for tests. It affects sample fallback only when `DRIFT_DEV_MODE=true`; production publishing forces development mode off, and the human-team content gate remains separate. The CLI test wrapper explicitly isolates this setting per test room. No database-table migration or new paid model role is needed.

Test setup initially omitted the new optional environment declaration, which the server typecheck caught. The first desktop geometry helper waited for a phone control that does not exist there; it now checks presence. A WebKit check also exposed an early test wait: the installed runner treated an async predicate's Promise as truthy before the subscription transition. Waiting for the actual post-close UI fixed that harness error. These failures are part of the working notes, not hidden behind automatic retries.
