import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bookCookiePrefix,
  bookCookieWrites,
  emptyBook,
  mergeBook,
  readBookCookies,
} from '../apps/web/src/bottle-book';
const prefix = bookCookiePrefix('http://localhost:3000:drift-test-a');
const cookieHeader = (cookies: string[]) =>
  cookies.map((cookie) => cookie.split(';')[0]).join('; ');
test('beginning and completed-pair IDs survive cookie round trip without story text or credentials', () => {
  const book = { beginningIds: ['beginning-1', 'beginning-2'], pairIds: ['pair-1'] };
  const cookies = bookCookieWrites(book, prefix, true);
  assert.deepEqual(readBookCookies(cookieHeader(cookies), prefix), book);
  assert.ok(
    cookies.every((cookie) => cookie.includes('SameSite=Lax') && cookie.includes('; Secure')),
  );
  assert.equal(
    readBookCookies(cookieHeader(cookies), bookCookiePrefix('different-db')).beginningIds.length,
    0,
  );
});
test('a large shelf is chunked below cookie limits and restores all IDs', () => {
  const book = {
    beginningIds: Array.from({ length: 90 }, (_, index) => `beginning-${index}-${'a'.repeat(40)}`),
    pairIds: Array.from({ length: 90 }, (_, index) => `pair-${index}-${'b'.repeat(40)}`),
  };
  const cookies = bookCookieWrites(book, prefix, false);
  assert.ok(cookies.length > 2);
  assert.ok(cookies.every((cookie) => cookie.length < 4096));
  assert.deepEqual(readBookCookies(cookieHeader(cookies), prefix), book);
  assert.deepEqual(readBookCookies(cookieHeader(cookies.slice(1)), prefix), emptyBook());
});
test('merge keeps both routes, deduplicates IDs, and ignores malformed cookie data', () => {
  assert.deepEqual(
    mergeBook(
      { beginningIds: ['a'], pairIds: ['b'] },
      { beginningIds: ['a', 'c'], pairIds: ['b', 'd', 'not an ID'] },
    ),
    { beginningIds: ['a', 'c'], pairIds: ['b', 'd'] },
  );
  assert.deepEqual(readBookCookies(`${prefix}_count=1; ${prefix}_0=%ZZ`, prefix), emptyBook());
  assert.deepEqual(readBookCookies(`${prefix}_count=99`, prefix), emptyBook());
});
