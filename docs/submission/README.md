# Drift submission package

Prepared from the implemented product on October 24, 2026. **Six words from you. Six from a stranger.** The submission leads with the postcard and the catch-first exchange, then explains the real-time state and AI boundaries that make it work.

This package supersedes the older local-only Devpost draft. It includes the deployed Cloudflare/Maincloud checkpoint, live Claude evidence, current catch-first behavior, and existing product captures. The submitted release still needs the final owner checks below. No video was created, uploaded, or included, and no Devpost entry or repository visibility was changed.

## Start here

| Material | Use |
| --- | --- |
| [Project fields](project-fields.md) | Name, tagline, elevator pitch, URLs, tags, and owner-supplied fields |
| [Devpost story](devpost-story.md) | Paste-ready public story |
| [Project brief](output/pdf/drift-project-brief.pdf) | Four-page visual PDF for review or sharing |
| [Gallery images](gallery/) | Thumbnail plus four supporting PNGs, ordered 01 through 05 |
| [Gallery captions](gallery-captions.md) | Copy-ready captions, alt text, and photographic attribution |
| [Postcard export](source/screenshots/hosted-postcard.png) | Actual hosted PNG export for an offline keepsake example |
| [Prize responses](prize-responses.md) | Spacetime, Claude, and conditional social-track answers |
| [Judging notes](judging-notes.md) | Two-minute pitch, short pitch, demo steps, Q&A, and fallback |
| [Owner checklist](owner-checklist.md) | Team, location, source access, final hosted check, and form handoff |
| [Evidence ledger](evidence-ledger.md) | What each technical claim establishes and its limits |

The team handoff archive is `../drift-submission-package.zip`. It contains this folder, including editable sources and evidence snapshots, and excludes videos, credentials, environment files, browser tokens, and the application source tree. The public-facing files are the story, gallery/captions, and project brief; other files support preparation.

## Product checkpoint

The main route is **catch → finish → reveal → optionally toss your own beginning**. A separate write-first route supplies a beginning when needed. People write both six-word lines; Claude checks context and offers optional direction. SpacetimeDB makes exclusive catches and publishes one shared card. The app supports up to three rounds daily and one completion stamp.

The full recorded hosted Claude exchange used synthetic writers before Turnstile activation and the catch-first revision. A later hosted negative check confirmed gate enforcement; the newer catch-first flow has local sandbox evidence. None of these is an attendee pilot or physical-phone verification. The owner checklist preserves that final-release testing gap.

## Editable sources

`source/gallery.html` is the finished gallery layout, with local screenshots and bundled fonts. `source/build-gallery.mjs` rebuilds the PNGs from existing evidence using Playwright. `source/build-brief.py` rebuilds the PDF with ReportLab. The scripts make no model calls and do not publish or submit anything. Fonts and photographic attribution are included with the sources.

From the repository root:

```sh
node docs/submission/source/build-gallery.mjs
python3 docs/submission/source/build-brief.py
```

Use an installed Playwright Chromium, or set `DRIFT_GALLERY_BROWSER` to a compatible executable. Python needs ReportLab, Pillow, and FontTools with WOFF2 support. The existing source captures are preserved; these scripts compose presentation assets and do not recapture the product.
