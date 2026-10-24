import { PROMPTS, normalize, validateLine } from '../game-rules/index';
import { approvedStarterBundle } from './approved';

export type StarterBundle = {
  version: 1;
  provenance: 'human-team' | 'draft';
  prompts: { id: string; starters: string[] }[];
};
export const STARTERS_PER_PROMPT = 20;
const ids = new Set<string>(PROMPTS.map((p) => p.id));
const contact =
  /https?:|www\.|[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}|(?:^|\s)@[\p{L}\p{N}_]+|\b\d[\d ()+.-]{7,}\d\b/iu;
const key = (s: string) => normalize(s.normalize('NFKC')).toLowerCase();

// This checks structure and obvious contact patterns, not moderation or proof of authorship.
export function inspectStarterBundle(value: unknown) {
  const errors: string[] = [];
  const counts: Record<string, number> = Object.fromEntries([...ids].map((id) => [id, 0]));
  const invalid = () => ({ errors, counts, ready: false, bundle: null as StarterBundle | null });
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    errors.push('Expected a starter export object.');
    return invalid();
  }
  const v = value as Record<string, unknown>;
  if (v.version !== 1 || !['human-team', 'draft'].includes(String(v.provenance)))
    errors.push('Expected version 1 and human-team or draft provenance.');
  if (!Array.isArray(v.prompts) || v.prompts.length !== ids.size) {
    errors.push(`Include exactly ${ids.size} prompt groups, including empty groups in drafts.`);
    return invalid();
  }
  const seenIds = new Set<string>();
  const seenLines = new Map<string, string>();
  const prompts: StarterBundle['prompts'] = [];
  for (const raw of v.prompts) {
    if (!raw || typeof raw !== 'object' || !ids.has(raw.id) || seenIds.has(raw.id)) {
      errors.push('Prompt IDs must be known and unique.');
      continue;
    }
    const id: string = raw.id;
    seenIds.add(id);
    if (!Array.isArray(raw.starters) || raw.starters.length > 100) {
      errors.push(`${id}: expected at most 100 starter lines.`);
      continue;
    }
    const lines: string[] = [];
    for (const [index, text] of raw.starters.entries()) {
      const label = `${id} line ${index + 1}`;
      if (typeof text !== 'string') {
        errors.push(`${label}: expected text.`);
        continue;
      }
      const error = validateLine(text);
      if (error || /[\u0000-\u001F\u007F]/u.test(text) || contact.test(text)) {
        errors.push(`${label}: ${error || 'Remove control characters or contact details.'}`);
        continue;
      }
      const canonical = key(text);
      if (seenLines.has(canonical)) {
        errors.push(`${label}: duplicates ${seenLines.get(canonical)}.`);
        continue;
      }
      seenLines.set(canonical, label);
      lines.push(normalize(text));
    }
    counts[id] = lines.length;
    prompts.push({ id, starters: lines });
  }
  const ready =
    !errors.length &&
    v.provenance === 'human-team' &&
    [...ids].every((id) => counts[id] >= STARTERS_PER_PROMPT);
  const bundle: StarterBundle | null = errors.length
    ? null
    : { version: 1, provenance: v.provenance as StarterBundle['provenance'], prompts };
  return { errors, counts, ready, bundle };
}

const installed = inspectStarterBundle(approvedStarterBundle);
export function teamStartersFor(promptId: string): string[] {
  return installed.ready
    ? (installed.bundle!.prompts.find((p) => p.id === promptId)?.starters ?? [])
    : [];
}
