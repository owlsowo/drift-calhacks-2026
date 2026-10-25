export function bottleLink(id: string, base = location.href): string {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) throw Error('Invalid bottle identifier.');
  const url = new URL(base);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
    throw Error('A bottle needs a web address.');
  // Invitations carry the public beginning ID only, never private history or a draft.
  url.search = '';
  url.hash = '';
  url.searchParams.set('bottle', id);
  return url.href;
}
