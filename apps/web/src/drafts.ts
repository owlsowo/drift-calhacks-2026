import type { DraftContext } from './story-context';
const WEEK_MS = 7 * 86400000;
export function encodeDraft(text: string, now = Date.now(), context?: DraftContext) {
  return JSON.stringify({
    driftDraft: 1,
    text,
    expiresAt: now + WEEK_MS,
    ...(context ? { context } : {}),
  });
}
export function decodeDraft(
  raw: string,
  now = Date.now(),
): { text: string; expired: boolean; legacy: boolean; context?: DraftContext } {
  try {
    const item = JSON.parse(raw);
    if (item?.driftDraft === 1) {
      if (
        typeof item.text !== 'string' ||
        !Number.isFinite(item.expiresAt) ||
        item.expiresAt <= now
      )
        return { text: '', expired: true, legacy: false };
      const c = item.context;
      const context =
        c &&
        Number.isFinite(c.day) &&
        typeof c.setupPrompt === 'string' &&
        typeof c.replyPrompt === 'string' &&
        (c.kind === 'setup' || c.kind === 'reply') &&
        (c.beginning === undefined || typeof c.beginning === 'string')
          ? (c as DraftContext)
          : undefined;
      return { text: item.text, expired: false, legacy: false, ...(context ? { context } : {}) };
    }
  } catch {
    /* Older versions stored the line directly. */
  }
  return { text: raw, expired: false, legacy: true };
}
