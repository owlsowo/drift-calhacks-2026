# Beginning pools and real ocean review

Local work on `codex/quiet-coast`, following the owner's October 24 brief and table-shape correction.

- Release creates a beginning and returns to the sea. Pick up independently opens a beginning and completes one ending. Independent drafts can coexist.
- Approved beginnings stay in the current daily pool; multiple identities may respond. Each completed postcard stores beginningId; a writer may not answer their own beginning or answer the same beginning twice.
- First-party SameSite=Lax cookies store beginning and completed-pair IDs in bounded chunks. HTTPS adds Secure. No story text or auth token is placed in these cookies. Anonymous auth remains separate and private.
- My bottles separates beginnings/all their endings from pairs completed by this browser. Bottle-ID lookup and a ?bottle= link retrieve the approved beginning and its endings. IDs alone never authorize hiding.
- The actual locally bundled Noniv WebGPU FFT engine provides the water. The separate headland overlaps its fixed horizon; the old analytic renderer is no longer included.
- The desk uses the original narrow trapezoid shape, flush with the bottom edge, with an original realistic wooden texture.

Validation:

- 55 server tests pass, including separate drafts, concurrent replies to one beginning, immutable requests, no duplicate response, withdrawal fanout and ownership boundaries.
- 24 unit tests pass, including large cookie-book chunk/recovery, malformed-cookie handling, and existing rules/contracts/pricing/drafts/gestures.
- Production TypeScript/Vite build, script typechecks, and diff checks pass.
- Manual CUA browser flow used three distinct local origins: A released “I challenged their shark to poker.”; B completed “Our lawyers would like another hand.”; C completed “Management regrets lending sharks marked cards.” The same beginning showed two endings.
- A's beginning and B's completed pair restored in My bottles after reload. Actual first-party drift_book cookies were present with SameSite=Lax; the saved beginning ID exactly matched the released beginning. Opening its ?bottle= URL retrieved both endings.
- B left “I loaned their octopus my skateboard.” unfinished in Release, opened a separate Pick up ending, then restored the original Release draft unchanged.
- The active canvas reported webgpu-fft and running after reload. Desktop scene/table/seam were visually inspected. At 390×844 the document was exactly 390×844, the canvas still used webgpu-fft, the wooden table computed bottom:0px, and its trapezoid shape was visually checked.

The focused `npm run test:letters` browser script is syntax checked but has not been executed. Older browser evidence describes the prior mechanics. These are synthetic local checks with model checks explicitly off; they do not establish attendee outcomes or new hosted deployment readiness.

The fresh local room is `drift-test-letter-pools-20261024`; earlier databases were left intact. `apps/web/.env.local` selects the preview and remains ignored by Git.

Current screenshots: `docs/evidence/real-ocean-desk-desktop.png`, `real-ocean-desk-mobile.png`, and `letter-pools-author.png`. A dev hot-reload root reuse fix avoids duplicate React roots and redundant ocean contexts while editing. Release publication also recovers from a late successful subscription update; blocked cookie writes retry on subsequent connected updates.
