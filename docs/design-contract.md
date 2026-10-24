# Drift interaction contract

Audience: event attendees taking a two-minute creative break. Primary action: write a six-word setup, then finish somebody else's. Both roles appear before starting.

Direction: the intimate night sea of classic WeChat Drift Bottle and QQ Mail bottle. The supplied Bilibili video shows a small moon, distant lighthouse, a bottle in the water and a three-object bottom dock. Use a real moonlit-sea photograph with native bottle, beam and bucket controls. Open notes over the same sea instead of switching to a blank page. Warm photographed paper, deep coastal ink, Fraunces text and readable DM Sans controls keep the existing writing flow. Do not use AI-generated imagery. Tencent screenshots and video are reference material only, never bundled assets. Asset sources and licenses are in public/credits.html.

Memorable detail: grab and shake the bottle left/right to begin or catch. A caught note starts as a photographed crumpled ball and unfolds into a textured sheet; reduced motion opens immediately. Desktop requires four deliberate reversals, not simple cursor travel. Phone motion requires an explicit opt-in, with denial and unavailable-device fallbacks. Buttons and keyboard remain full alternatives. Two separately written halves form a postmarked souvenir. No personality ratings or invented reactions.

Motion: the horizon, moon and lighthouse stay anchored while small swells and ripples distort the existing sea photograph below the horizon. A footer control pauses/resumes the sea; reduced motion and a hidden tab stop its animation loop. The opening uses one connected paper mesh, with uneven creases relaxing over 1.9 seconds before the text fades in. No disconnected tiles. WebGL is optional: static photography and the CSS opening preserve the flow if graphics acceleration is unavailable. Surface resolution is capped, resources are disposed on unmount, and there are no new animation dependencies.

Viewports: 360x800 and 1440x1000. Primary controls >=44px, visible keyboard focus, sufficient contrast, text labels, reduced-motion support. Fonts bundled; no remote font requests. Word-count feedback does not move controls. Drafts persist by identity and round. Never show successful publication before the authoritative backend confirms.

Additional motion viewport: simulated touch phone at 390x844. Synthetic browser motion verifies permission handling and callbacks; it does not verify a physical phone sensor. HTTP LAN previews offer drag/buttons because motion needs a secure context.

Loading: stable composition + named pending action. Empty: draft retained, retry catch. Error: saved draft + recoverable action. Partial: outgoing story may be waiting while completed incoming card remains usable. Permission: hide/report only authorized cards, private tables never client-readable. Success: postcard, export, next round/collection. Each state must be rendered and observed before claiming verification.

Software-only competition evidence: live two-browser demo, permission/race checks, model fixtures/evaluations, source labels and failure recovery. No attendee outcomes or friendship claims without a pilot.
