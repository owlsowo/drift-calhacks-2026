# Live ocean renderer

Drift now bundles and adapts [Noniv/web-ocean](https://github.com/Noniv/web-ocean), by Maksymilian Dendura, rather than approximating it with a small analytic water shader. The vendored source is from commit `a07c7fd522ef0a897601c114f927a49d93d95520` and retains the upstream MIT license at `apps/web/src/ocean-engine/LICENSE`. The same notice is served at `/vendor/web-ocean/LICENSE`. No upstream screenshots or photographs are bundled.

## What is retained

The actual WebGPU simulation and surface renderer are in `apps/web/src/ocean-engine/`:

- Six 256 × 256 Tessendorf FFT cascades, from 1,103 m to 0.2617 m patches, including the JONSWAP wind spectrum, directional swell, and choppy displacement.
- A CDLOD quadtree surface, LEAN-filtered wave normals and anisotropic specular reflection, environment cube maps, foam clipmaps and foam texture generation.
- HDR rendering with 4× MSAA, bloom, and AgX tone mapping.
- The atmospheric lookup table computation and cloud implementation. Drift uses an art-directed blue-hour radiance palette over the computed atmosphere; its scene should not be described as an unmodified physically accurate night-sky model.

The old `ProceduralSea.tsx` is no longer imported or included in the production page.

## Drift changes

`Ocean.tsx` lazily loads the engine as a Vite module and owns its lifecycle. The upstream settings panel, free camera, keyboard and mouse listeners, pointer lock, HUD, screenshot server endpoint, and diagnostic network requests have been removed. All rendering dependencies are bundled locally.

The camera sits 4 m above the water with a fixed 58° vertical field of view. Its downward pitch is calculated to place the mean water horizon at exactly 40% of the viewport. Waves are tuned to a quieter sea: 3.4 m/s wind, 28 km fetch, 0.30 m significant swell, and gentler choppiness. The six-cascade simulation is intact. The simulation clock advances at 0.62× real time for a slower visual rhythm.

A small, softly textured warm moon occupies the left night sky. Its direction is also used for the engine's specular lighting, so the glints are calculated on the displaced water rather than drawn as a screen-space stripe. The moon direction is recomputed with the viewport to retain the composition on phones.

### Local day and night

`coast-time.ts` and `useCoastPeriod.ts` choose daylight from 06:00 inclusive to 18:00 exclusive using the viewer's device timezone. They recheck at each minute boundary and on focus/visibility changes. Prompt days, submission times and quotas still use their existing clocks.

`Ocean.tsx` passes the period into the renderer and updates `setTimeOfDay` on the existing controller. The camera, simulation clock, wave spectrum and GPU resources remain in place. Day mode uses a clear blue sky, a sun above the upper-left frame, softer silver glints, blue water scatter/fog and the generated sunlit headland. The atmospheric lookup tables and all six environment-map faces are refreshed before the new water frame, including while paused or under reduced motion. Night mode restores the original lighting values.

Day fallback artwork is provided in wide and portrait formats. The daytime transparent overlay retains its 2172×724 canvas; CSS crops y=239…539 and immerses its bottom five pixels into the same 40% horizon. The night overlay's original crop remains unchanged. Exact built-in image-generation prompts and source provenance are in [coast-day-art.md](coast-day-art.md).

The development-only `/coast-preview.html` entry compares Day/Night/Pause using the real renderer and shore controls without a database connection. It is excluded from the production build; the actual game selects its period automatically and has no added theme settings.

Day/night verification includes two unit tests for local boundaries and timezone independence; five read-only browser groups for wide/portrait fallback art, open-page transitions and focus/visibility recovery; and three actual Chromium Metal WebGPU groups for lighting changes while paused, a retained canvas and 390×844 headland alignment. The live WebGPU scene was also visually inspected in the Codex browser. `npm run test:coast-time` and `npm run test:coast-gpu` use an already-running local preview via `DRIFT_WEB_URL`; set `DRIFT_CHROMIUM_PATH` when the default Chrome executable is unavailable. Screenshots and reports are saved under ignored `test-results/coast-time/`. These checks submit no stories and do not call a model provider. The phone dimensions are emulated rather than a physical-device test.

The owner approved the original branch’s generated transparent headland and coast artwork after the initial integration. The approved cutout is restored with its original alignment. `ocean.css` crops the strong alpha content from approximately y=247…537 of the 2172 × 724 image, aligns its bottom with the same 40% horizon, and overlaps it into the water by 5 px. This removes the former strip of sky under the landscape. These more specific rules override the older general `.coast-headland` styles in `shore.css`.

The renderer uses the display's pixel ratio, up to 2×, and keeps the full upstream simulation resolution. It requests the high-performance WebGPU adapter. It is not the previous 30 fps, below-native-resolution background.

## Motion and fallback

- The app's **Pause sea motion** control freezes the simulated scene.
- `prefers-reduced-motion` also freezes the scene and responds to changes.
- Hidden tabs stop scheduling animation frames.
- React unmount, failed initialization, and GPU device loss stop the loop, disconnect the resize observer, unconfigure the context, and destroy the GPU device.
- Unsupported WebGPU, shader initialization failure, or GPU loss leaves the approved responsive coast artwork visible. The separate headland is only inserted after a successful renderer startup, so the fallback contains one lighthouse.

## Verification performed

On 2026-10-24, the Codex in-app browser on this Mac rendered the actual engine at a 1280 × 720 CSS viewport / 2560 × 1440 render target and at a 390 × 844 phone viewport. The canvas reported `data-renderer="webgpu-fft"`, and rendered waves, moon reflection, and the headland were visually inspected. No WebGPU validation or shader errors were reported in those checks. Pause and resume were exercised through the app's visible control and reported `paused` and `running` respectively. The temporary viewport override was reset.

`npm run build` passes with the vendored engine emitted as a separate lazy chunk (approximately 75 KB uncompressed / 25 KB gzip). No frame-rate benchmark or cross-browser/device support claim has been made. The approved landscape/portrait artwork is the fallback for browsers without WebGPU.
