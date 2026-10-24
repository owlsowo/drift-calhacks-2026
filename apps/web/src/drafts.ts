const WEEK_MS = 7 * 86400000;
export function encodeDraft(text: string, now = Date.now()) {
  return JSON.stringify({ driftDraft: 1, text, expiresAt: now + WEEK_MS });
}
export function decodeDraft(
  raw: string,
  now = Date.now(),
): { text: string; expired: boolean; legacy: boolean } {
  try {
    const item = JSON.parse(raw);
    if (item?.driftDraft === 1) {
      if (
        typeof item.text !== 'string' ||
        !Number.isFinite(item.expiresAt) ||
        item.expiresAt <= now
      )
        return { text: '', expired: true, legacy: false };
      return { text: item.text, expired: false, legacy: false };
    }
  } catch {
    /* Older versions stored the line directly. */
  }
  return { text: raw, expired: false, legacy: true };
}
