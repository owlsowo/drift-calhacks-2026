# Draft and deadline recovery

An expired catch already blocked submission, but its explanation lived inside the assignment panel. When the bottle was reassigned and that private panel disappeared, the writer could see a disabled action without the reason. At daily reset, the local draft stayed saved under its old round/assignment key but had no recovery control.

The writer now sees a separate expiry note and can copy the ending before catching again. A round with exhausted story checks points to closing the round rather than taking another unusable catch. “Your earlier words” in the collection and closed-round screen reads unexpired local drafts for this identity and known rounds. It includes words from skipped/released catches and finished stories, and excludes the active draft. Copying does not resubmit anything, call Claude or change Spacetime state. Blocked storage falls back to memory in the current tab, under the existing no-reload guarantee banner.

The closed-round screen now has the existing photographed paper behind its text, after an accessibility scan found low contrast over the sea. It hides obsolete progress steps and offers the catch-first action for the new day.

## Verification

`npm run test:recovery` runs Chrome and actual WebKit against an isolated local sandbox with AI off. Both engines exercise a real skip and recover those prior words without replacing the current ending. They also check a short 390×430 viewport, then inject the UI clock, lease and withheld-assignment projection to exercise expiry and daily reset. Copying uses an injected clipboard adapter. Another identity's fixture and an expired envelope never appear. The selected accessibility scans pass after the contrast repair. Screenshots and the eight-check report are in `docs/evidence/recovery/`.

This is not an actual ten-minute/overnight wait, physical keyboard, real phone or assistive-technology user test. The module suite separately advances its authoritative test clock: an expired real bottle is reassigned to a third identity, the old writer's assignment disappears, and that old reply cannot publish. All 57 module tests pass, including the existing cross-midnight lease check.

The 22-check Chrome two-writer flow also passes. The content-state runner passes twelve captured states across 360px/1440px, including a closed-round draft recovered from memory when storage reads/writes are blocked. No paid provider call, production test story or backend schema change is involved.

The first closed-round scan failed on paragraph contrast against the sea. The photographed-paper background repaired it and the final scans pass. A near-midnight run also exposed conditional test coverage: using the real deadline could jump directly to the next day. The final UI fixture anchors its injected lease near noon so both expiry and reset are exercised on every run; the unchanged server clock and separate module tests are stated in the report.
