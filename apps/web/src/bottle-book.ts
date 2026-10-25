export type BottleBook = { beginningIds: string[]; pairIds: string[] };
export const emptyBook = (): BottleBook => ({ beginningIds: [], pairIds: [] });
const validIds = (value: unknown): string[] =>
  Array.isArray(value)
    ? [
        ...new Set(
          value.filter(
            (id): id is string => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(id),
          ),
        ),
      ]
    : [];
export function mergeBook(book: BottleBook, additions: Partial<BottleBook>): BottleBook {
  return {
    beginningIds: validIds([...book.beginningIds, ...(additions.beginningIds || [])]),
    pairIds: validIds([...book.pairIds, ...(additions.pairIds || [])]),
  };
}
export function bookCookiePrefix(scope: string): string {
  let hash = 2166136261;
  for (const character of scope) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return `drift_book_${(hash >>> 0).toString(36)}`;
}
export function readBookCookies(cookie: string, prefix: string): BottleBook {
  const values = new Map(
    cookie.split(';').map((part) => {
      const separator = part.indexOf('=');
      return [part.slice(0, separator).trim(), part.slice(separator + 1)] as const;
    }),
  );
  const count = Number(values.get(`${prefix}_count`));
  if (!Number.isInteger(count) || count < 1 || count > 32) return emptyBook();
  let encoded = '';
  for (let index = 0; index < count; index++) {
    const chunk = values.get(`${prefix}_${index}`);
    if (!chunk) return emptyBook();
    encoded += chunk;
  }
  try {
    const value = JSON.parse(decodeURIComponent(encoded));
    if (value.version !== 1) return emptyBook();
    return { beginningIds: validIds(value.beginningIds), pairIds: validIds(value.pairIds) };
  } catch {
    return emptyBook();
  }
}
// Split before the per-cookie size limit; these contain public IDs, never story text or credentials.
export function bookCookieWrites(book: BottleBook, prefix: string, secure: boolean): string[] {
  const encoded = encodeURIComponent(
    JSON.stringify({ version: 1, ...mergeBook(emptyBook(), book) }),
  );
  const chunks = encoded.match(/.{1,2800}/g) || [];
  if (chunks.length > 32) throw Error('Your bottle shelf is full. Save a copy of your bottle IDs.');
  const attributes = `; Path=/; Max-Age=2592000; SameSite=Lax${secure ? '; Secure' : ''}`;
  return [
    ...chunks.map((chunk, index) => `${prefix}_${index}=${chunk}${attributes}`),
    `${prefix}_count=${chunks.length}${attributes}`,
  ];
}
export function loadBottleBook(scope: string): BottleBook {
  try {
    return readBookCookies(document.cookie, bookCookiePrefix(scope));
  } catch {
    return emptyBook();
  }
}
export function saveBottleBook(scope: string, book: BottleBook): boolean {
  try {
    const prefix = bookCookiePrefix(scope);
    const merged = mergeBook(loadBottleBook(scope), book);
    for (const cookie of bookCookieWrites(merged, prefix, location.protocol === 'https:'))
      document.cookie = cookie;
    return JSON.stringify(readBookCookies(document.cookie, prefix)) === JSON.stringify(merged);
  } catch {
    return false;
  }
}
