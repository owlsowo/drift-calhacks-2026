# Complete note opening under slow images

The note's animation clock previously started before its photograph loaded. In the controlled 650 ms delay case, the first mesh frame was already 35.5% unfolded, and the parent opened the controls before the mesh reached its final frame.

The note now holds its initial crumple for at most 200 ms while choosing a renderer. A ready mesh starts at zero and signals completion at its final sheet. Otherwise the existing CSS opening runs in full; a late image cannot switch into a partially completed mesh. Image failure, unavailable WebGL and context loss leave readable, editable content. A watchdog bounds an interrupted mesh, and changing reduced-motion preference opens the note immediately.

Controls no longer fade from low opacity when they become usable. Only the heading, received note and postcard have a small settling motion. This repaired the contrast failure observed when context loss caused an early reveal. The full-screen sea also stops requesting multisample antialiasing; the paper silhouette retains it. This is a requested GPU configuration reduction, not a measured phone battery claim.

## Controlled comparison

| Texture delay | Before: usable note | After: usable note | After renderer |
| --- | --- | --- | --- |
| 0 ms | 1,902 ms | 1,952 ms | Complete mesh, progress 0 → 1 |
| 650 ms | 1,903 ms; mesh began at 35.5% | 2,107 ms | Complete CSS opening |
| 2,500 ms | 1,902 ms | 2,109 ms | Complete CSS opening, no asset wait |

These are desktop Chrome touch-viewport diagnostics in the isolated Vite development harness, with injected asset delay, AI off and synthetic content. They are not production Web Vitals, field FPS, physical-phone or user-study results. Source hashes and raw measurements are in `.ecc/benchmarks/paper-before.json` and `paper-after.json`. The same gzip calculation adds 272 bytes of JavaScript and 33 bytes of CSS versus the deployed baseline; no images or dependencies were added.

Eight Chrome/WebKit fault cases pass: unavailable WebGL, failed image, context loss and mid-opening reduced motion. Inputs are editable and submission is enabled after opening, the temporary surface is disposed, and selected accessibility scans pass. The ten shore-interaction checks and nine WebKit game/export/privacy checks also pass.

Reproduce with the local Spacetime server running:

```sh
DRIFT_BENCHMARK_LABEL=after npm run benchmark:paper
npm run test:paper-fallbacks
npm run test:shore
npm run test:webkit
```

The saved before file is the original source baseline. Rerunning with `before` on later code would replace it, so use `after` for regression checks. The benchmark records source hashes to make that distinction reviewable.
