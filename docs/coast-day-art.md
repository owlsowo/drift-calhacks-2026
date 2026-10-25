# Daytime coast artwork

The owner requested matching daytime counterparts to the approved coast artwork. Generated with the built-in `image_gen` tool using the existing local night assets as edit targets. No external API key or CLI generation was used. The originals and WebP derivatives were visually inspected. No existing night assets or application code were changed by this artwork task.

## Files

| Runtime asset | Dimensions | Bytes | Original PNG archive |
| --- | --- | ---: | --- |
| `apps/web/public/assets/coast-day-wide.webp` | 1586 × 992 | 149,904 | `.spacetime/art-sources/coast-day-wide.png` |
| `apps/web/public/assets/coast-day-mobile.webp` | 948 × 1660 | 165,440 | `.spacetime/art-sources/coast-day-mobile.png` |
| `apps/web/public/assets/coast-headland-day.webp` | 2172 × 724 RGBA | 101,656 | `.spacetime/art-sources/coast-headland-day.png` |

PNG originals remain in the established ignored source archive. Runtime copies use Pillow WebP format conversion at quality 86, method 6, without cropping, resizing, or programmatic painting. The headland's alpha channel is byte-identical between its PNG original and WebP derivative, with extrema 0–255.

The edit preserves the location, low right-side headland, small striped lighthouse and broad open sea. It changes the illumination to soft clear daylight, removes the moon and golden night reflection, and switches off the lighthouse lantern. The portrait uses the landscape day image as its lighting reference. The generated edits retain the broad composition but are not pixel-for-pixel registered to the night scenes.

## Overlay alignment

The day headland retains the night overlay's 2172 × 724 canvas. Strong alpha at threshold 128 spans approximately `x37…2135, y242…538`; threshold 8 spans `x37…2136, y239…539`. Very faint alpha extends to the bottom of the canvas, as in the generated night source. The runtime uses a `y239…539` crop for the daytime lighthouse's slightly taller silhouette, while preserving the night overlay's original crop. Both align to the rendered 40% horizon with five pixels of water immersion. This document does not claim the generated overlay has an exactly identical silhouette to the night version.

## Landscape edit prompt

Use case: lighting-weather
Asset type: daytime counterpart of an approved landscape coast background for a quiet message-in-a-bottle game.
Input image 1 is the EDIT TARGET. Change ONLY time of day and natural lighting from blue hour night to peaceful soft daylight. Preserve the exact original composition, image dimensions/aspect ratio, camera, level horizon position, lighthouse size and position, coastline silhouette, rocks, water-surface geography and brushwork. This is the same place and viewpoint photographed/painted at another time of day, not a redesigned scene.
Lighting/weather: Calm clear late-morning daylight, soft and natural. Pale clean sky blue above fading into a very light blue haze at the horizon. Sea becomes a peaceful muted natural medium blue with soft silver-blue highlights and subdued aqua undertones, still blue and not tropical turquoise. Dark rocky headland becomes naturally lit slate-gray stone with gentle blue shadows. The lighthouse remains red and warm white with a dark roof, sunlit but small and distant. Turn OFF its lantern: no amber lamp or glow.
Remove the moon entirely and remove the narrow golden moon-reflection path from the water. Do not add a visible sun; illumination comes from outside frame high left. Replace the former moon area with uninterrupted blue sky. Soft modest daylight reflection over the sea, no blinding glare or glittering path.
Style/medium: Keep original softly naturalistic early mobile-game matte painting style, restrained fine natural textures, peaceful simple visual breathing room. Preserve all broad empty water and sky. The original level horizon remains at the exact same height. Low rocks remain at the far right only.
Constraints: Change lighting/color only apart from removing moon and night light/reflections. No new land, islands, buildings, plants, boats, bottles, people, clouds, stars, text, logos, interface, frames or watermark. No sunset or orange cast, no saturated turquoise resort water, no harsh cinematic contrast, no dramatic waves, no glossy 3D, no geometric vector restyle.

## Portrait edit prompt

Use case: lighting-weather
Asset type: daytime portrait fallback coast background for a quiet bottle game.
Input image 1 is the EDIT TARGET: approved portrait night scene. Input image 2 is ONLY the daylight color and lighting reference: the matching landscape daytime scene just created.
Change ONLY time of day and natural lighting in image 1 to match image 2. Preserve image 1's exact portrait aspect ratio and dimensions, camera and framing, horizon height around 28 percent down, coastline silhouette, lighthouse size and position near the right horizon, and water texture and broad empty-water composition. This is the same location and viewpoint in soft daylight.
Clear peaceful late morning: soft clean sky blue fading into pale blue-white atmospheric haze at horizon. Calm natural medium blue sea with soft silver-blue daylight highlights, subdued aqua undertones, not turquoise or tropical. Slate-gray sunlit rocks with gentle blue shadow. Red-and-warm-white small distant lighthouse with dark roof, lantern OFF and no night glow.
Remove the moon completely, filling it with plain clear sky; remove golden moon-reflection stripe. No visible sun. Match the landscape reference's restrained daylight blue palette and modest natural lighting, retaining original soft naturalistic early mobile-game matte painting style. No dramatic change to sea conditions.
Constraints: preserve original composition/geography and existing horizon exactly. No added objects, land, clouds, boats, bottles, people, plants, stars, text, logos, UI, border, watermark. No orange sunset, no harsh glare, no saturated turquoise resort water, no neon, no vector or glossy 3D restyling.

## Transparent headland edit prompt

Use case: lighting-weather
Asset type: transparent daytime rocky headland and lighthouse overlay, matching an existing approved nighttime overlay exactly.
Input image 1 is the EDIT TARGET: a transparent 2172 x 724 PNG-like image of low coastal rocks and a small striped lighthouse. The black-looking empty area in its preview is TRANSPARENCY, and must remain genuine transparent alpha, not black or blue pixels. Input image 2 is a DAYLIGHT LIGHTING/COLOR reference only. Do not include any of image 2's sky or ocean.
Change ONLY the lighting/colors of the visible lighthouse and rocks in input 1 from night to calm soft clear late-morning daylight matching image 2. The lighthouse stays red and warm-white striped with the exact same profile/size/placement and dark roof. Switch OFF the lantern: remove the yellow illuminated bulb, amber window glow and orange cast light. Instead show an ordinary unlit muted glass lantern room in daylight. Relight the dark blue rocks as natural neutral slate-gray stone with modest sunlit warm-gray upper surfaces and cool blue-gray shadow, softly naturalistic and restrained.
STRICT GEOMETRY AND ALPHA INVARIANTS: preserve input 1's exact full 2172 x 724 canvas dimensions/aspect ratio, empty padding, rock silhouette, bottom waterline, all spatial positions, lighthouse scale and location, and transparent alpha outside the existing cutout. Do not zoom, crop, recenter, stretch, move or redesign. Existing strong alpha is approximately x60..2127,y247..537 on that canvas, lighthouse near x650,y250, waterline y535; retain these positions so day/night switching will not jump. Preserve edge transparency, only relight opaque content. Low rocky headland starts narrow on left and runs to right edge.
Constraints: truly transparent background. No sky, sea, water, reflections, moon, sun, clouds, boats, birds, plants, people, text, logos, interface or watermark. No black/white solid background or painted checkerboard. No light beam or glow. No blue nighttime cast. No dramatic texture or geography changes; same soft painterly naturalism as original.
