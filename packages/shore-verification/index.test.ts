import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchesShoreHostname } from './index.ts';

const original = 'drift-game.drift-calhacks-2026-owlsowo.workers.dev';
const owned = 'driftbottle.ink';

test('the existing single-host setting and local gate fixture remain valid', () => {
  assert.equal(matchesShoreHostname(original, original), true);
  assert.equal(matchesShoreHostname('127.0.0.1', '127.0.0.1'), true);
  assert.equal(matchesShoreHostname(original, owned), false);
});

test('an explicit host list accepts each configured domain independently', () => {
  const configured = `${original}, ${owned}`;
  assert.equal(matchesShoreHostname(configured, original), true);
  assert.equal(matchesShoreHostname(configured, owned), true);
});

test('host lists deny subdomains, suffix impersonation and URL-shaped responses', () => {
  const configured = `${original}, ${owned}`;
  for (const actual of [
    'www.driftbottle.ink',
    'driftbottle.ink.attacker.example',
    'attacker-driftbottle.ink',
    'https://driftbottle.ink',
    'driftbottle.ink:443',
    `${owned}.`,
    null,
    ['driftbottle.ink'],
  ])
    assert.equal(matchesShoreHostname(configured, actual), false);
});

test('missing or malformed configuration fails closed even beside a valid entry', () => {
  for (const configured of [
    undefined,
    '',
    ' ',
    `${owned},`,
    `${owned},*.ink`,
    `${owned},https://example.com`,
    `${owned},-example.com`,
    `${owned},${'a'.repeat(64)}.ink`,
  ]) {
    assert.equal(matchesShoreHostname(configured, owned), false, configured);
  }
});
