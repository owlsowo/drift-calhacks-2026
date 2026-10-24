# Daily-game UI iteration — live working notes

Recorded October 24, 2026, starting at 23:17 UTC. This is a new iteration on the working game, not a reconstruction of initial ideation. The team is handling its submission writeup; this file captures technical workflow evidence as work happens.

## References and scope

The owner requested inspiration from Wordle and Krillion, a stronger UI and continued sponsor alignment. We inspected the actual `krillion.io` entry screen: a numbered daily identity, brief rules and a visually dominant start action. The NYT browser page was blocked by the browser's site-safety policy; no workaround was attempted. Wordle's familiar daily-game patterns inform the brief, but no current Wordle screenshot was inspected or copied. Drift keeps its bottle, real photographs, six-word collaboration and shared postcard reward.

## Prototype request

Figma Make received a new prompt in the existing shared prototype file: compact dated daily identity; catching primary, writing secondary; six word-slot marks; postcard before the optional next contribution. Existing prototype/sample labeling, licensed photos, keyboard/reduced-motion alternatives and honest empty states must remain. A fifth inspectable writing state was requested. No new backend, generated images, invented users or scores were requested.

The first long typing operation timed out with a partial unsent draft. We inspected the draft, replaced it using paste, then submitted once. The actual Make UI showed the submitted prompt and a running Thinking/Stop state. This browser friction is part of the workflow; it is not a failed game build.

## Implementation checkpoint

The React implementation now derives the edition and date from the authoritative server day, highlights catching as the primary dock action, and replaces tiny count dots with six numbered paper marks that fill as words are typed. The existing completed-round marker supplies the collected-stamp label. Production still allows over-six-word drafts with corrective feedback; it never truncates a writer's pasted text. Existing Spacetime transitions, Claude guidance, real photographs and paper opening remain in use.

Figma Make v3, “Refine Daily Bottle States”, reported 51 seconds of tool work. We actually entered five sample words (completion disabled), added a sixth (enabled), and completed the sample postcard. The postcard appeared before the optional next-beginning action. The handoff notes recommend daily identity, primary catching and 24–32px spacing. We adopted the identity/action hierarchy and word-count affordance; we did not copy synthetic autofill or the prototype's hard six-word input cap. The production paper animation stays at its existing duration.

Review found the sample Writing path incorrectly credited the viewer as the beginning's author. A focused follow-up requested path-aware attribution and corrected the production handoff recommendation about over-count drafts. That follow-up was submitted after inspecting the actual result; its outcome is recorded below when verified.

At 23:25 UTC the production build, eight WebKit checks, two empty-tide viewport flows and ten shore-interaction checks passed. Selected accessibility scans reported no violations. Screenshots at 390px and 1440px were inspected, including the six-mark writer. The first concurrent shore test could not create its disposable database (`File exists`); a sequential rerun created a fresh room and passed. No physical-phone, attendee or paid-model test is implied.

Approximate active-time estimates for this additional iteration at the checkpoint: ideation 1 minute (4/5), prototyping/review 3 minutes (3/5), handoff 1 minute (4/5), implementation/verification 4 minutes (4/5). These are Codex estimates and assessments; concurrent tool waits overlap and are not measured time savings.

## Verified follow-up and deployment

Make v4, “Correct Postcard Path Attribution”, reported 17 seconds of tool work. We re-entered six words and verified “Begun by another writer · finished by you”; the Returned path retained “Begun by you · finished by a stranger”. The sample label remained visible. After completing v4, Make displayed an exhausted daily-credit notice. We did not purchase an upgrade. The prototype's editing cap remains a sample limitation; the handoff recommendation and real app preserve over-count drafts.

Code commit `5043061ff2cb6bea1e586d46c7237c3d8de5bfbe` is pushed and deployed as Cloudflare version `fe60dd10-2525-4389-b2ff-bc15a4c5ef56`. Both hosted entry assets match the local tested build. The actual hosted dated bottle and primary action were inspected without creating game content. All 22 unit tests also pass. See `docs/evidence/daily-ui-release.json`, the refreshed browser evidence and the consolidated four-stage log. This is technical workflow evidence; the team retains final submission/writeup review.

## Code-only return-awareness refinement

The next product review found that real live returns changed the navigation count/bucket but could be missed while writing. Codex added a noninterrupting open/dismiss notice based on new author-owned cards after the initial complete subscription. It keeps the draft and its focus, opens the correct postcard, and treats historical cards on reload as a baseline rather than new arrivals. A persistent polite status region announces the change. The help dialog now explains the catch-first loop. No new Figma prompt, generated content or model calls were used for this refinement.

The production build, all 22 Chrome two-writer checks and nine WebKit checks pass. The new Chrome check verifies draft/focus preservation, opening the matching card, resuming the draft and silence for historical cards after reload; WebKit exercises the actual notice/open route. Mobile and desktop screenshots were inspected and selected accessibility scans reported no violations. This adds approximately five active minutes to code generation, estimated by Codex, with a 4/5 assessment. No physical assistive-technology or attendee result is claimed.

The native Figma Slides opening-slide notes were also updated in place with the evening Make versions, adoption/rejection decisions, consolidated estimates and later code-only refinement. The original audience hypothesis was preserved. Earlier slide 4–5 estimates are explicitly identified as the original iteration. The refreshed source pack is pinned to 86683ac; the video remains the earlier, labeled working-build edit.

## Deadline and local-word recovery

A subsequent code-only review found that expiry feedback depended on the old assignment panel, and daily reset made retained local words hard to retrieve. The app now offers expiry/copy feedback independently, and “Your earlier words” in the collection/closed-round view recovers this identity's unexpired local copies while excluding the active draft. A real skip, closure with blocked storage, copied-word isolation and reset rendering are covered. The closed-round scan first failed contrast over the sea; using the existing photographed paper fixed it. Obsolete progress steps are hidden and the next-day action catches first.

At the 23:54 UTC checkpoint, 57 module tests, 22 Chrome two-writer checks, twelve content-state captures and eight targeted Chrome/WebKit recovery checks pass, along with the production build. The recovery clocks, lease/withheld-assignment projections and clipboard are explicitly injected; there was no real overnight wait or physical-keyboard test. The real module test clock separately verifies expiry/reassignment. No paid calls, generated imagery, extra sponsor API or backend schema change was introduced. This additional code-only pass took approximately 15 active minutes by Codex's estimate (4/5 assessment); it is separate from the earlier Figma iteration's stage estimates.
