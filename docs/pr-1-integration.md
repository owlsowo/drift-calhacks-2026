# Quiet-coast PR integration

PR #1 by riptideiv introduces independent Release and Pick up actions, several endings per beginning, the bottle-arrival/release ritual, a cookie-based public bookmark shelf, handwritten letters and a bundled MIT WebGPU ocean. The integration combines its original head `2b9626b` with current main `f68baf4` rather than overwriting either branch.

Current main's private activity/cost controls, new-return notice, earlier-draft recovery and bounded connected note opening are retained. Completion timing now uses the individual round deadline instead of the removed exclusive bottle lock. An old reassignment test now verifies the intended independent-pool behavior: expired context stays private, a different writer can catch the beginning, and the expired ending still cannot publish. The server view API does not expose a clock.

The five generated runtime images proposed by the PR were removed to honor the owner's explicit no-AI-images instruction. The existing credited sea/paper photographs, original SVG lighthouse and CSS desk grain replace them. The WebGPU simulation, bottle ritual and new typography remain. Historical branch documentation/screenshots are not evidence that generated assets ship in the integrated runtime.

The browser review exposed and fixed low-contrast navigation, a returned-notice/header overlap, the dismiss control's reachable size, and a WebKit draft-switch race. Draft restoration happens before paint. The photographed paper is tinted for readable writing and exports.

## Checks

- 25 unit tests, 61 server tests, frontend production build, and server/scripts typechecks pass.
- The new letter-pool browser flow passes eight checks in Chrome and eight in WebKit: independent publication, simultaneous recipients, separate live returns, cookies/reload, independent drafts, quota/resume and public-ID recovery without author permissions. Selected accessibility scans cover the author's pool and two completed-reply views.
- Eight Chrome/WebKit note fault cases pass for unavailable graphics, image failure, context loss and reduced-motion changes. No paid provider calls are made by these local checks.
- The older `test:shore` script failed at its generated-coast-image expectation. Its later release-to-catch and gesture assumptions also describe the previous sequential mechanics; it is not claimed as passing for this integration. Older UI/recovery/cold-start scripts and their saved evidence likewise require review against the new independent mechanics before reuse. The new `test:letters` flow is the current multi-writer integration check.

These are desktop browser engines with synthetic inputs and local SpacetimeDB, not attendee, physical-phone, new hosted-Claude or field-performance results. New integration evidence is in `letter-pools-chrome.json`, `letter-pools-webkit.json` and `paper-perf/fallbacks.json` under `docs/evidence`.

## Deployment boundary

This merge does not deploy the new schema or replace the live database. Bottle fields are removed and beginning/pair fields are added, so a data-preserving migration must be prepared before updating the hosted backend and frontend together. The existing hosted release stays available. No hosted data was deleted or reset to complete this integration.
