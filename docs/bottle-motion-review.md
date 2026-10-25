# Bottle motion review

The supplied WeChat video was inspected from the local MP4. At roughly 0.8 s the scene dims and the desk disappears; a cone ends in an ellipse centered at 50% across and 62% down. The bottle appears around 2.7 s and opens after a tap around 4.7 s. The returning throw around 7.7–8.7 s flips from the lower-right foreground, shrinking and fading into the lit water. Reference frames remain under `/private/tmp/drift-reference`, not in the app assets.

`BottleRitual.tsx` and `bottle-ritual.css` stage the same interaction over the existing ocean. Pickup arrival lasts 750 ms, then waits for Open bottle. Opening lifts/fades over 350 ms and goes straight to the paper editor. Release lasts 1,450 ms and only starts its throw after the server confirms publication. The water rings finish before the throw overlay ends. No cartoon droplet sprites or reference video pixels are used.

The dialog hides and makes the underlying header/main inert, traps keyboard focus, locks page scrolling, and restores focus/scroll behavior when closed. Pickup cancellation preserves the claim. The assignment and its unexpired lease are checked again before opening. Missing assignments, expired bottles, and Skip all use the same pickup sequence; a version guard prevents a skipped bottle’s old cached assignment from appearing. Requests have bounded waits, and late confirmed releases recover with one throw. Reduced motion replaces the rotations/lift with 110 ms fades and stops bobbing.

Verified in the running local sandbox on 2026-10-24:

- Normal-motion pickup arrival, one Open bottle action, and direct transition into the ending editor.
- Escape cancellation and resuming the same beginning with its saved draft.
- Skip produces a different beginning and does not transfer the old draft.
- A real local beginning submission produces one rotating/shrinking throw, returns to the shore, and appears in My bottles.
- At 390 × 844, reduced-motion pickup/open completes; the arrived bottle has no bobbing animation and no horizontal overflow. Emulated media and viewport overrides were restored afterward.
- Production build and script type checking, plus the existing 24 unit checks. No backend schema changes.

Evidence: `docs/evidence/bottle-pickup-spotlight.png`, `bottle-pickup-phone.png`, `bottle-release-throw.png`, and `bottle-release-preview.mp4`. The short MP4 is assembled from timestamped screenshots of the actual browser run; it is visual QA, not a submitted-message simulation or an attendee pilot.
