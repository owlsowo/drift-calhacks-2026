export const WORDS = 6;
export const MAX_CHARS = 160;
export const LEASE_MS = 10 * 60 * 1000;
export const ROUNDS_PER_DAY = 3;
export function words(text: string): string[] {
  return text
    .trim()
    .split(/\s+/u)
    .filter((w) => /[\p{L}\p{N}]/u.test(w));
}
export function validateLine(text: string): string | null {
  if ([...text].length > MAX_CHARS) return 'Keep your line under 160 characters.';
  if (words(text).length !== WORDS) return 'Your little story needs exactly six words.';
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(text))
    return 'Use plain text for your story.';
  return null;
}
export const normalize = (s: string) => s.trim().replace(/\s+/gu, ' ');
export const dayOf = (timeMs: number) => Math.floor(timeMs / 86400000);
export const PROMPTS = [
  {
    id: 'aquarium',
    title: 'Banned from the aquarium',
    scene: 'A very fishy situation.',
    setup: 'Why were you banned from the aquarium?',
    reply: 'Write the aquarium’s official response.',
    exampleSetup: 'I taught the octopus insider trading.',
    exampleReply: 'Our accountants have questions for you.',
    starters: [
      'I challenged their shark to poker.',
      'I sold the jellyfish tiny sweaters.',
      'The penguins elected me their king.',
      'I gave every lobster a kazoo.',
      'I replaced the water with lemonade.',
      'I taught their dolphins tax evasion.',
      'Their stingray borrowed my credit card.',
      'I organized a very suspicious sleepover.',
    ],
  },
  {
    id: 'spaceship',
    title: 'One very suspicious spaceship',
    scene: 'Houston, we have some explaining.',
    setup: 'Why did your spaceship fail inspection?',
    reply: 'Write the captain’s six-word defense.',
    exampleSetup: 'Our captain replaced gravity with glitter.',
    exampleReply: 'The glitter was an emergency feature.',
    starters: [
      'Our captain replaced gravity with glitter.',
      'We trained raccoons as flight attendants.',
      'The engine runs entirely on gossip.',
      'Our alien chef ate the inspector.',
      'Someone installed a very emotional autopilot.',
      'The escape pods became karaoke booths.',
      'We accidentally packed seventeen extra moons.',
      'Our navigation system only speaks poetry.',
    ],
  },
] as const;
export function promptForDay(day: number) {
  return PROMPTS[((day % 2) + 2) % 2];
}
export type Prompt = (typeof PROMPTS)[number];
export type Card = {
  id: string;
  promptId: string;
  setup: string;
  reply: string;
  seeded: boolean;
  starterKind?: string;
  createdMs: number;
};
