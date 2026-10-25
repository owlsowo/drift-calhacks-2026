import { waitForGameConnection } from './browser-game-state.mjs';
import { chromium, webkit } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';

const origin = process.env.DRIFT_WEB_URL;
if (!origin || !process.env.DRIFT_TEST_DATABASE?.startsWith('drift-test-'))
  throw Error('Use npm run test:letters for an isolated local sandbox.');
const engine = process.env.DRIFT_TEST_ENGINE === 'webkit' ? 'WebKit' : 'Chrome';
const browser =
  engine === 'WebKit'
    ? await webkit.launch({ headless: true })
    : await chromium.launch({ channel: 'chrome', headless: true });
const contexts = [];
const errors = [];
const checks = [];
const evidence = new URL('../docs/evidence/', import.meta.url);
await fs.mkdir(evidence, { recursive: true });
const pass = (name) => {
  checks.push(name);
  console.log('PASS', name);
};
const button = (page, name) => page.getByRole('button', { name, exact: true });
const releaseButton = (page) => page.getByRole('button', { name: /^Release a bottle/ });
const pickupButton = (page) => button(page, 'Pick up a bottle. Write an ending');
const shelfButton = (page) => page.getByRole('button', { name: /^My bottles/ });
const setupText = 'I challenged their shark to poker.';
const bReply = 'Our lawyers would like another hand.';
const cReply = 'The shark has requested legal counsel.';
const bSetup = 'I taught the octopus insider trading.';
const bDraftReply = 'Your account has been permanently frozen.';

async function makePage(width, cookies) {
  const context = await browser.newContext({
    viewport: { width, height: width === 360 ? 800 : 1000 },
    reducedMotion: 'reduce',
    ...(cookies ? { storageState: { cookies, origins: [] } } : {}),
  });
  contexts.push(context);
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  return { context, page };
}
async function state(page) {
  return page.evaluate(async () => {
    const snapshot = (await import('/src/game.ts')).game.snapshot();
    return {
      connected: snapshot.connected,
      identity: snapshot.identity,
      book: snapshot.book,
      rounds: snapshot.rounds.map((round) => ({
        id: round.id,
        stage: round.stage,
        setupId: round.setupId,
        assignmentId: round.assignmentId,
        cardId: round.cardId,
      })),
      assignments: snapshot.assignments.map((assignment) => ({
        id: assignment.id,
        roundId: assignment.roundId,
        seeded: assignment.seeded,
        text: assignment.text,
      })),
      cards: snapshot.cards.map((card) => ({
        id: card.id,
        beginningId: card.beginningId,
        setup: card.setup,
        reply: card.reply,
      })),
      outgoingIds: snapshot.outgoing.map((beginning) => beginning.id),
      ownershipIds: snapshot.ownership.map((item) => item.id),
    };
  });
}
async function ready(page, url = origin) {
  await page.goto(url);
  await waitForGameConnection(page);
}
async function home(page) {
  await button(page, 'Drift home').click();
  await page.locator('.shore-home').waitFor();
}
async function pickup(page) {
  await pickupButton(page).click();
  await button(page, 'Open bottle').click();
  await page.getByRole('textbox', { name: 'Your six-word ending', exact: true }).waitFor();
}
async function submitReply(page, text) {
  await page.getByRole('textbox', { name: 'Your six-word ending', exact: true }).fill(text);
  await button(page, 'Send reply').click();
  await page.getByRole('heading', { name: 'Saved reply', exact: true }).waitFor();
}
async function readBookFromCookies(page) {
  return page.evaluate(async () => {
    const { readBookCookies } = await import('/src/bottle-book.ts');
    const countCookie = document.cookie
      .split(';')
      .map((part) => part.trim().split('=')[0])
      .find((name) => /^drift_book_[a-z0-9]+_count$/.test(name));
    return countCookie
      ? readBookCookies(document.cookie, countCookie.slice(0, -'_count'.length))
      : { beginningIds: [], pairIds: [] };
  });
}

try {
  const { page: A } = await makePage(360);
  const { context: b, page: B } = await makePage(1440);
  const { page: C } = await makePage(360);
  await Promise.all([A, B, C].map((page) => ready(page)));

  await releaseButton(A).click();
  await A.getByRole('textbox', { name: 'Your six-word beginning', exact: true }).fill(setupText);
  await button(A, 'Release').click();
  await A.locator('.shore-home').waitFor();
  await A.waitForFunction(() => window.driftTestGame.snapshot().book.beginningIds.length === 1);
  const aState = await state(A);
  const beginningId = aState.book.beginningIds[0];
  assert.equal(aState.rounds[0].stage, 'done');
  assert.equal(aState.rounds[0].setupId, beginningId);
  assert.equal(aState.rounds[0].assignmentId, '');
  assert.equal(aState.rounds[0].cardId, '');
  assert.deepEqual(await readBookFromCookies(A), { beginningIds: [beginningId], pairIds: [] });
  pass(
    'Release publishes only a beginning, returns to the sea, and saves its ID in first-party cookies',
  );

  await Promise.all([pickup(B), pickup(C)]);
  const [bCaught, cCaught] = await Promise.all([state(B), state(C)]);
  assert.equal(bCaught.assignments[0].id, beginningId);
  assert.equal(cCaught.assignments[0].id, beginningId);
  assert.equal(bCaught.assignments[0].text, setupText);
  assert.equal(cCaught.assignments[0].text, setupText);
  assert.equal(bCaught.rounds[0].setupId, '');
  assert.equal(cCaught.rounds[0].setupId, '');
  pass('Two independent writers can pick up the same beginning without first releasing their own');

  await shelfButton(A).click();
  await A.locator('.beginning-preview').filter({ hasText: setupText }).click();
  await A.getByRole('heading', { name: '0 replies', exact: true }).waitFor();
  await submitReply(B, bReply);
  await A.getByRole('heading', { name: '1 reply', exact: true }).waitFor();
  await button(A, 'Dismiss returned bottle notice').click();
  await home(A);
  await releaseButton(A).click();
  const authorDraft = 'A beginning still in progress.';
  await A.getByRole('textbox', { name: 'Your six-word beginning', exact: true }).fill(authorDraft);
  await submitReply(C, cReply);
  await button(A, 'Open returned postcard').waitFor();
  assert.equal(
    await A.getByRole('textbox', { name: 'Your six-word beginning', exact: true }).inputValue(),
    authorDraft,
  );
  assert.equal(
    await A.getByRole('textbox', { name: 'Your six-word beginning', exact: true }).evaluate(
      (el) => el === document.activeElement,
    ),
    true,
  );
  await home(A);
  const returnGeometry = await A.evaluate(() => {
    const box = (selector) => {
      const r = document.querySelector(selector).getBoundingClientRect();
      return { top: r.top, bottom: r.bottom };
    };
    return {
      header: box('.site-header'),
      notice: box('.returned-notice'),
      dock: box('.shore-dock'),
      viewportHeight: innerHeight,
      pageHeight: document.documentElement.scrollHeight,
    };
  });
  const returnLabel = process.env.DRIFT_RETURN_BASELINE === 'before' ? 'before' : 'after';
  await A.screenshot({
    path: new URL(`return-shore-${engine.toLowerCase()}-${returnLabel}.png`, evidence).pathname,
    fullPage: true,
  });
  await fs.writeFile(
    new URL(`return-shore-${engine.toLowerCase()}-${returnLabel}.json`, evidence),
    JSON.stringify(returnGeometry, null, 2) + '\n',
  );
  assert.ok(
    returnGeometry.notice.top >= returnGeometry.header.bottom + 8,
    JSON.stringify(returnGeometry),
  );
  assert.ok(
    returnGeometry.dock.bottom <= returnGeometry.viewportHeight + 1 &&
      returnGeometry.pageHeight <= returnGeometry.viewportHeight + 1,
    JSON.stringify(returnGeometry),
  );
  for (const [width, height] of [
    [1440, 1000],
    [390, 844],
    [320, 740],
    [740, 360],
  ]) {
    await A.setViewportSize({ width, height });
    const boxes = await A.evaluate(() => {
      const r = (s) => {
        const b = document.querySelector(s).getBoundingClientRect();
        return { top: b.top, bottom: b.bottom, left: b.left, right: b.right };
      };
      return {
        notice: r('.returned-notice'),
        header: r('.site-header'),
        dock: r('.shore-dock'),
        height: innerHeight,
        width: innerWidth,
        pageHeight: document.documentElement.scrollHeight,
      };
    });
    assert.ok(
      boxes.notice.top >= boxes.header.bottom + 8 && boxes.notice.bottom <= boxes.dock.top,
      JSON.stringify(boxes),
    );
    assert.ok(boxes.notice.left >= 0 && boxes.notice.right <= width, JSON.stringify(boxes));
    assert.ok(
      boxes.dock.bottom <= height + 1 && boxes.pageHeight <= height + 1,
      JSON.stringify(boxes),
    );
    await A.screenshot({
      path: new URL(`return-shore-${engine.toLowerCase()}-${width}x${height}.png`, evidence)
        .pathname,
      fullPage: true,
    });
  }
  await A.setViewportSize({ width: 360, height: 800 });
  await button(A, 'Open returned postcard').click();
  await A.locator('.postcard-paper.paper-open').waitFor();
  assert.equal(await A.locator('.postcard .card-half').nth(1).innerText(), cReply);
  await home(A);
  await releaseButton(A).click();
  assert.equal(
    await A.getByRole('textbox', { name: 'Your six-word beginning', exact: true }).inputValue(),
    authorDraft,
  );
  await home(A);
  await shelfButton(A).click();
  await A.locator('.beginning-preview').filter({ hasText: setupText }).click();
  await A.getByRole('heading', { name: '2 replies', exact: true }).waitFor();
  pass(
    'A live return preserves the focused draft, keeps shore controls in view, opens the correct pair and restores writing afterward',
  );
  assert.equal(await A.locator('.ending-preview').count(), 2);
  await A.getByText(bReply, { exact: true }).waitFor();
  await A.getByText(cReply, { exact: true }).waitFor();
  const [aReturned, bFinished, cFinished] = await Promise.all([state(A), state(B), state(C)]);
  const bCardId = bFinished.rounds[0].cardId;
  const cCardId = cFinished.rounds[0].cardId;
  assert.ok(bCardId && cCardId && bCardId !== cCardId);
  assert.deepEqual(
    aReturned.cards
      .filter((card) => card.beginningId === beginningId)
      .map((card) => card.id)
      .sort(),
    [bCardId, cCardId].sort(),
  );
  assert.equal(bFinished.rounds[0].stage, 'done');
  assert.equal(cFinished.rounds[0].stage, 'done');
  assert.deepEqual(await readBookFromCookies(B), { beginningIds: [], pairIds: [bCardId] });
  pass(
    'Each ending creates its own pair, finishes its pick-up round, and appears live in the original author’s pool',
  );
  assert.equal(
    await B.locator('.contribution-note').innerText(),
    'Someone began it. You finished it.',
  );
  const [download] = await Promise.all([
    B.waitForEvent('download'),
    button(B, 'Save image').click(),
  ]);
  const exportFile = new URL(`contribution-${engine.toLowerCase()}-postcard.png`, evidence)
    .pathname;
  await download.saveAs(exportFile);
  const png = await fs.readFile(exportFile);
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  assert.equal(png.readUInt32BE(16), 1080);
  assert.equal(png.readUInt32BE(20), 1350);
  const copiedWords = await B.evaluate(async () => {
    const { game } = await import('/src/game.ts');
    const { cardText } = await import('/src/export.ts');
    const state = game.snapshot();
    const id = state.ownership.find((o) => o.role === 'reply').id;
    return cardText(state.cards.find((c) => c.id === id));
  });
  assert.equal(copiedWords, setupText + '\n' + bReply);
  pass(
    'The actual PNG export downloads at 1080×1350 while Copy text keeps only the two creative lines for a peer story',
  );
  await A.locator('.ending-preview').filter({ hasText: bReply }).click();
  await A.locator('.postcard-paper.paper-open').waitFor();
  assert.equal(
    await A.locator('.contribution-note').innerText(),
    'You began it. Someone finished it.',
  );
  await A.screenshot({
    path: new URL(`contribution-${engine.toLowerCase()}-author.png`, evidence).pathname,
    fullPage: true,
  });
  await button(A, 'Back to bottles').click();
  await A.locator('.beginning-preview').filter({ hasText: setupText }).click();
  for (const [index, page] of [A, B, C].entries()) {
    await page.screenshot({
      path: new URL(`letter-pools-${engine.toLowerCase()}-view-${index}.png`, evidence).pathname,
      fullPage: true,
    });
    const scan = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    assert.deepEqual(
      scan.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
      [],
    );
  }
  pass('Selected accessibility checks pass on the author pool and both completed-reply views');
  await A.screenshot({
    path: new URL(`letter-pools-${engine.toLowerCase()}-beginning-360.png`, evidence).pathname,
    fullPage: true,
  });

  await A.reload();
  await waitForGameConnection(A);
  assert.equal(new URL(A.url()).searchParams.get('bottle'), beginningId);
  await A.getByRole('heading', { name: '2 replies', exact: true }).waitFor();
  assert.deepEqual((await state(A)).book.beginningIds, [beginningId]);
  await B.reload();
  await waitForGameConnection(B);
  assert.equal(new URL(B.url()).searchParams.get('card'), bCardId);
  await button(B, 'Back to bottles').click();
  await B.getByRole('heading', { name: 'Your replies', exact: true }).waitFor();
  assert.equal(await B.locator('.collection-card').count(), 1);
  assert.deepEqual((await state(B)).book.pairIds, [bCardId]);
  pass('Reload restores the original beginning and the completed pair with their exact saved IDs');

  await home(B);
  await releaseButton(B).click();
  await B.getByRole('textbox', { name: 'Your six-word beginning', exact: true }).fill(bSetup);
  const writeRound = (await state(B)).rounds.find((round) => round.stage === 'write');
  await home(B);
  await pickup(B);
  const bIndependent = await state(B);
  const catchRound = bIndependent.rounds.find((round) => round.stage === 'reply');
  assert.equal(bIndependent.rounds.length, 3);
  assert.ok(writeRound && catchRound && writeRound.id !== catchRound.id);
  assert.notEqual(
    catchRound.assignmentId,
    beginningId,
    'A writer cannot answer the same beginning twice',
  );
  assert.equal(
    bIndependent.assignments.find((assignment) => assignment.roundId === catchRound.id)?.seeded,
    true,
  );
  await B.getByRole('textbox', { name: 'Your six-word ending', exact: true }).fill(bDraftReply);
  await home(B);
  await releaseButton(B).click();
  assert.equal(
    await B.getByRole('textbox', { name: 'Your six-word beginning', exact: true }).inputValue(),
    bSetup,
  );
  await B.reload();
  await waitForGameConnection(B);
  assert.equal(
    await B.getByRole('textbox', { name: 'Your six-word beginning', exact: true }).inputValue(),
    bSetup,
  );
  await home(B);
  await pickup(B);
  assert.equal(
    await B.getByRole('textbox', { name: 'Your six-word ending', exact: true }).inputValue(),
    bDraftReply,
  );
  const resumed = await state(B);
  assert.equal(resumed.rounds.length, 3);
  assert.equal(resumed.assignments[0].id, catchRound.assignmentId);
  assert.equal(resumed.rounds.find((round) => round.stage === 'write')?.id, writeRound.id);
  pass(
    'Release and Pick up keep separate drafts and resume the same rounds after reload within the three-action quota',
  );

  await home(B);
  await releaseButton(B).click();
  await button(B, 'Release').click();
  await B.locator('.shore-home').waitFor();
  await B.waitForFunction(() => window.driftTestGame.snapshot().book.beginningIds.length === 1);
  assert.equal(await releaseButton(B).isDisabled(), true);
  assert.equal(await pickupButton(B).isEnabled(), true);
  const bBook = await readBookFromCookies(B);
  assert.equal(bBook.beginningIds.length, 1);
  assert.deepEqual(bBook.pairIds, [bCardId]);
  pass(
    'Finishing the release preserves the independent pick-up draft and quota still allows that draft to resume',
  );

  // Only copy the public bookmark cookies. No localStorage identity or private draft is carried over.
  const savedCookies = (await b.cookies()).filter((cookie) => /^drift_book_/.test(cookie.name));
  assert.ok(savedCookies.length >= 2);
  assert.ok(savedCookies.every((cookie) => cookie.sameSite === 'Lax' && !cookie.httpOnly));
  const { page: D } = await makePage(1440, savedCookies);
  await ready(D);
  const recovered = await state(D);
  assert.notEqual(recovered.identity, (await state(B)).identity);
  assert.deepEqual(recovered.outgoingIds, []);
  assert.deepEqual(recovered.ownershipIds, []);
  assert.deepEqual(recovered.book, bBook);
  await shelfButton(D).click();
  await D.locator('.beginning-preview').filter({ hasText: bSetup }).waitFor();
  assert.equal(await D.locator('.collection-card').count(), 1);
  await D.locator('.collection-card').click();
  await D.getByRole('heading', { name: 'Saved reply', exact: true }).waitFor();
  assert.equal(await button(D, 'Hide').count(), 0);
  assert.equal(await D.locator('.contribution-note').innerText(), 'Two writers. One little story.');
  pass(
    'Contribution labels use private ownership for each author and stay neutral when only public bookmark cookies are recovered',
  );
  await D.goto(`${origin}?bottle=${encodeURIComponent(beginningId)}`);
  await D.getByRole('heading', { name: '2 replies', exact: true }).waitFor();
  assert.equal(await D.locator('.ending-preview').count(), 2);
  pass(
    'Cookies alone recover approved beginnings and pairs for a new identity without granting author controls; bottle-ID links retrieve all endings',
  );

  assert.deepEqual(errors, []);
  await fs.writeFile(
    new URL(`letter-pools-${engine.toLowerCase()}.json`, evidence),
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        engine,
        mode: 'Isolated local sandbox; synthetic writers; AI checks off; no paid model calls',
        beginningId,
        completedPairIds: [bCardId, cCardId],
        checks,
        errors,
      },
      null,
      2,
    ) + '\n',
  );
} finally {
  await Promise.all(contexts.map((context) => context.close()));
  await browser.close();
}
