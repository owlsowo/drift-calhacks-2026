# Approved coast artwork

The owner directly approved the existing PR lighthouse and landscape in Codex on October 24, superseding the earlier exclusion of these coast assets. The landscape, its portrait companion and transparent headland are restored byte-for-byte from PR commit `2b9626b`; no new images were generated for this update. Paper and wood proposals below remain historical and are not restored to the runtime. See `approved-coast.md` and `asset-sources.md`.

# Coast background artwork

Generated on 2026-10-24 with the built-in `image_gen` tool. These are original environmental backgrounds inspired by the quiet mood of the team's old WeChat bottle-game reference. No original WeChat screenshot pixels are included. There are no baked-in interface controls, bottles, words, or logos.

- `apps/web/public/assets/coast-night-wide.webp`: 1586 × 992, landscape.
- `apps/web/public/assets/coast-night-mobile.webp`: 948 × 1659, portrait. The landscape was supplied as a palette and scenery reference for this second generation.

Both assets were inspected after copying into the project. Keep the scene full bleed and leave its open water visible. The generated horizon is approximately one third down the landscape and 28% down the portrait, rather than the requested 40–41%; allow for this when positioning overlaid objects. A portrait asset prevents the moon and lighthouse from being cropped out by a narrow viewport.

## Landscape prompt

Use case: stylized-concept. Original production background for a minimal message-in-a-bottle web game, landscape composition, approximately 2560 × 1600 pixels. A quiet, peaceful coast at blue hour in the style of a restrained hand-painted early 2010s mobile game background. Full bleed environment artwork only, absolutely no interface.

Deep blue ocean extending to an almost flat horizon at 41% from the top. Clear dark cobalt sky gently fading into muted slate lavender close to the horizon. A small soft pale golden moon high in the upper left, approximately 17% from the left and 18% from the top. On the far right horizon, a small traditional red-and-cream lighthouse on a low dark rocky headland, with a tiny warm amber lantern, understated and distant. Subtle natural brushwork in the ocean, broad soft horizontal ripples, navy at the horizon and deeper muted blue in the foreground. A tranquil restrained surface without crashing waves. Below the horizon, almost entirely empty open water to hold unobtrusive game controls and floating bottles added by code. No foreground sand, pier, or ships.

Very wide calm visual breathing room; lower 55% open water. Scenic details confined to the far right horizon and small moon upper left. Clean level horizon. Lighthouse near 82% width, height only 9% of canvas. Moon 1.5% of canvas width. Nostalgic soft digital matte painting, subtly naturalistic seascape, simplified soft atmospheric textures, gently blurred distant rocks, painterly but not visibly oily. Contemplative and inviting, modest and sincere. Deep blue, ocean cobalt, quiet slate blue, sparse warm ivory and amber. Smooth atmospheric gradients with slight organic texture.

Original artwork. No text, logos, watermark, border, screens, app mockup, buttons, bottles, people, stars, sparkles, neon, dramatic beams, clouds, fantasy scenery, glossy 3D, geometric vector shapes, large waves, sunset orange sky, or artificial lighting except the tiny lighthouse lamp. No objects in the central and lower water.

## Portrait prompt

Use case: stylized-concept. Portrait mobile game background, vertical 1024 × 1792 composition. Create a matching portrait companion to the provided original wide background. The input image is a style, palette and scenery reference; create a new portrait composition, not a crop.

Quiet peaceful deep blue ocean at blue hour. Level horizon approximately 40% from top, with clear cobalt sky fading into muted lavender near horizon. Small pale warm moon at 22% width, 15% height. Small traditional red-and-cream lighthouse on low dark rocky headland entering from the far right horizon, near 80% width, total height 7% of image. Very restrained warm amber lantern. Lower 58% empty open deep blue sea with soft, gently layered horizontal ripples and subtle natural texture, suitable for sparse game objects overlaid in code. Softer larger calmer water texture than the reference, almost glassy far away, no choppy crests. Tiny soft gold moon reflection, modest and subdued.

Match the provided landscape's nostalgic early 2010s mobile game mood, blue palette and quiet hand-painted naturalism, with somewhat simplified soft matte painting texture. Flat full bleed scenic background. Calm, unpretentious, gently romantic.

Portrait composition filling entire image; no border, UI, words, labels, watermark, bottles, foreground beach, sand, piers, boats, people, stars, sparkles, neon, dramatic light beams, clouds, fantasy, glossy 3D, or geometric vector styling. Keep broad central and lower water visually simple. Avoid dramatic waves. Moon small, lighthouse distant and small.

## Transparent headland overlay

`apps/web/public/assets/coast-headland.webp` is a separate 2172 × 724 RGBA PNG (465,472 bytes), generated with built-in `image_gen` editing and `transparent_background: true`. The wide background above was the edit reference. Alpha extrema were verified as 0–255. This allows a code-rendered moving ocean behind a still headland instead of moving the whole background painting.

Prompt: Extract only the small distant lighthouse and connected low rocky headland on the right horizon of the supplied background. Remove all sky, sea, moon, reflections, and other background. Preserve the original dark navy/slate blue naturally painterly rocks and small traditional red-and-cream striped lighthouse with a tiny warm amber lamp. Do not restyle them. Wide horizontal isolated cutout, roughly 4:1 aspect ratio; lighthouse near the left third of the extracted headland. Headland starts as a low narrow point at left, rises gently under the lighthouse, and continues as broad low weathered rocks to the right edge. Low distant coastal promontory, not a steep island or cliff. Nearly level gently organic bottom waterline to align with an animated ocean horizon. Keep lighthouse modest, not a detailed hero object. Connected rocks and lighthouse opaque; surroundings genuinely transparent alpha. No solid background or painted checkerboard. No sky, water, reflection, moon, light beam, extra structures, people, plants, text, logo, watermark, border, or external shadow. Small subtle lantern glow allowed. Clean alpha edges without blue sky fringe.

## Runtime composition and size

The original generated PNGs are retained locally under ignored `.spacetime/art-sources/`.
The deployed files are quality-86 WebP copies: landscape 74,340 bytes, portrait 77,148 bytes,
and transparent headland 77,426 bytes. These are format conversions of the inspected originals.

`Ocean.tsx` now uses the actual MIT-licensed [Noniv/web-ocean](https://github.com/Noniv/web-ocean) WebGPU FFT engine. Drift adapts it to a fixed blue-hour camera, a small moon, quieter waves, and the generated headland. The separate transparent headland shares the renderer's exact 40% horizon and overlaps the waterline by 5 px to close the old gap. Pause, reduced motion, hidden tabs, disposal, and the static landscape/portrait fallback are handled by the React integration. The previous original WebGL shader is no longer imported. See [ocean-engine.md](ocean-engine.md) for source attribution, retained simulation details, art-direction changes, and verification.

## Historical paper proposal — not used in the runtime

`apps/web/public/assets/letter-paper.webp` is a full-bleed photographic paper texture for the writing and reading surfaces, generated on 2026-10-24 with the built-in `image_gen` tool. The generated 1122 × 1402 PNG was inspected, archived locally as ignored `.spacetime/art-sources/letter-paper.png`, resized to 1024 × 1280, and converted to quality-72 WebP (125,092 bytes). It has no lettering, visible sheet edges, stamps, or baked-in interface elements. Actual content and shadows remain in the interface.

Prompt: Use case: photorealistic-natural. Asset type: letter-writing paper texture for a realistic seaside browser interface. Generate a portrait 4:5 image showing only the continuous blank surface of ordinary thin writing paper, photographed square-on at macro distance so the paper fills every pixel edge-to-edge. Neutral pale gray-taupe off-white cellulose, slightly cooler than ivory, in soft diffuse cool moonlight. Real but very fine, restrained paper fibers and a very faint single horizontal fold-memory near the middle, like a once-folded personal letter. The surface must remain clean and light enough for dark blue-black text to be readable over it. Photographic material detail, matte, quiet, natural and understated. Even illumination, no vignette. No lettering, handwriting, lines, stamps, drawings, symbols, graphics, branding or watermarks. No visible sheet boundaries, torn edges, frame, desk, environment, objects or cast shadows. Not parchment: no yellow cream cast, no green cast, no tea stains, no antiquing, no pirate or RPG aesthetic, no heavy crumpling, no pronounced wrinkles. This is a full-bleed flat texture to use underneath actual HTML text.
