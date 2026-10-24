# WebKit and mobile payoff checkpoint

The actual Playwright WebKit 27.2 engine passed the local two-writer flow at iPhone 13 and desktop viewports. This is desktop engine testing with mobile viewport/touch configuration, not a physical Safari/iPhone check. The disposable room used synthetic inputs with AI off and left the hosted game alone.

## Product issue found

Visual review found the optional “toss my own bottle” invitation above the completion title on mobile. The layout flattens `.reveal-copy` with `display: contents` and orders its children; the newly added invitation had no order, so it defaulted ahead of the title and postcard. A broad no-overflow/accessibility scan did not catch this semantic ordering problem.

The invitation now follows the postcard, sharing controls and return note. Its copy asks “Want to leave six words for the next person?” and both contribution and leave actions remain available. Added spacing makes it a separate optional step. Geometry checks in Chrome and WebKit verify that the heading precedes the card, the card precedes sharing, and sharing precedes the invitation.

## Verified scope

Nine WebKit checks cover:

- Connection and layout at 390px and 1440px.
- Actual moving sea pixels and stable paused pixels.
- A peer catch opened with touch taps, connected paper mesh over the sea, and catch/draft recovery after reload.
- A new returned-bottle notice offers the correct postcard without a refresh. Chrome additionally verifies current draft/focus preservation, resume after opening and no false new-arrival notice for historical cards after reload.
- Two identities receiving the same canonical postcard without refreshing; an actual downloadable 1080×1350 PNG, also visually inspected.
- Completion layout with the payoff before the optional next contribution.
- Share cancellation and denial using explicitly injected adapters; a copied canonical link opens for a third independent WebKit identity.
- Private owner counters observe the two author opens and export/share reports, exclude cancelled native shares and public visitors, and deduplicate repeat actions. A resolved native-share adapter verifies that separate outcome.
- Forced no-WebGL rendering with a photographed sea and readable CSS note fallback.

Six captured states have no reported violations in the selected Axe WCAG 2 A/AA, 2.1 AA and 2.2 AA rules. No horizontal overflow or uncaught browser errors were reported. These checks do not establish complete accessibility. The catch-first Chrome check also passes all five checks at 360px/1440px after the fix.

The iPhone descriptor configures touch and the coarse-pointer query is true; this desktop WebKit build still reports `navigator.maxTouchPoints` as zero. The test exercises actual Playwright touch taps rather than inferring hardware from that value. It does not validate a real mobile keyboard, physical motion sensors, native OS share sheets or attendee outcomes.

## Reproduce

With the local SpacetimeDB server running:

```sh
npx playwright install webkit
npm run test:webkit
npm run test:catch-first
```

Both commands create and clean their own local databases; they never run against the attendee database. The WebKit runner writes its report even on failure. It does not hide errors behind automatic retries or raise the model evaluation allowance.

Report: `docs/evidence/webkit/checks.json`. Screenshots and the actual PNG export are in that directory. Chrome's targeted flow is recorded separately in `docs/evidence/catch-first.json`.

The fix is deployed at the existing live URL. Cloudflare version `08aedf76-7afc-4798-8421-bc63599910fb` serves the JavaScript and CSS built from `c3610da`; read-only HTTPS comparisons matched both files byte for byte. `docs/evidence/mobile-layout-release.json` records their hashes. CI passed for that code commit. Backend schema/data were unchanged by this frontend deployment.
