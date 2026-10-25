# A keepsake that finishes

The previous PNG path awaited the paper image, an explicit handwriting font and the entire document's font readiness without deadlines. A controlled stalled-paper reproduction was still pending after four seconds. Native Share also awaited that PNG before opening the platform sheet, risking expiration of the original click's user activation.

Image/font preparation now has bounded waits and a readable cream-paper/system-serif fallback. Unrelated page fonts do not block export. A fallback that draws no photo does not claim to contain the photograph; normal exports retain photo attribution. PNG encoding has its own bounded error path. The current image is 1080×1650 with both creative lines, original prompt/response context, date and neutral contribution caption. The original deadline checks used the earlier 1080×1350 layout; current export/fallback regressions are recorded with the prompt-context release.

Opening a full postcard prepares its image in a small memory-only cache (at most six entries, usable for five minutes). Save image reuses that work. Native Share invokes the platform immediately: a prepared PNG when supported, or the exact public story URL while the image is not ready. Cancellation remains cancellation; denial/unsupported sharing uses the existing copy-link path. No hint, draft or credential is included in a share payload.

Twelve controlled Chrome/WebKit cases cover stalled/failed paper, a stalled requested font, an unrelated stalled global font set, actual encoded/decoded PNG dimensions and text, active user activation at native-share invocation, prepared image sharing, cancellation and denial. The normal Chrome letter flow retains an actual downloaded PNG and selected accessibility checks. Resource/OS adapters are injected, so these do not establish a physical phone's native share sheet. Production build and typechecks pass.

The owner additionally requested lower website lag. This export correction removes a reproduced wait and repeated image work; it is not a claim of improved ocean FPS or field startup performance. Rendering/startup measurements remain separate.
