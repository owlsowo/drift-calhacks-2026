import { chromium, webkit, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { waitForGameConnection } from './browser-game-state.mjs';

const origin = process.env.DRIFT_WEB_URL;
if (
  !/^http:\/\/127\.0\.0\.1:\d+$/.test(origin || '') ||
  !/^drift-test-[a-z0-9-]+$/.test(process.env.DRIFT_TEST_DATABASE || '')
)
  throw Error('Use the disposable, keyless local test room.');

const isWebKit = process.env.DRIFT_TEST_ENGINE === 'webkit';
const browser = await (isWebKit ? webkit : chromium).launch({
  headless: true,
  ...(!isWebKit && process.env.DRIFT_CHROMIUM_PATH
    ? { executablePath: process.env.DRIFT_CHROMIUM_PATH }
    : !isWebKit
      ? { channel: 'chrome' }
      : {}),
});
const contexts = [];
const checks = [];
const errors = [];
const out = new URL(
  `../test-results/response-context/${isWebKit ? 'webkit' : 'chrome'}/`,
  import.meta.url,
);
const button = (page, name) => page.getByRole('button', { name, exact: true });
const pass = (name) => {
  checks.push(name);
  console.log('PASS', name);
};
async function makePage() {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  });
  contexts.push(context);
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(origin);
  await waitForGameConnection(page);
  assert.equal(await page.evaluate(() => window.driftTestGame.snapshot().service?.sandbox), true);
  return page;
}
async function home(page) {
  await button(page, 'Drift home').click();
  await page.locator('.shore-home').waitFor();
}
async function pickup(page) {
  await button(page, 'Pick up a bottle. Write an ending').click();
  await page.locator('.bottle-ritual--arrived').waitFor();
  if (await page.locator('.bottle-ritual[data-pickup-step="choose"]').count())
    await page.locator('[data-bottle-choice]').first().click();
  await page.locator('.bottle-ritual[data-pickup-step="open"]').waitFor();
  await button(page, 'Open bottle').click();
  await page.getByRole('textbox', { name: 'Your six-word ending', exact: true }).waitFor();
}
async function noOverflow(page) {
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    false,
    `No horizontal overflow at ${page.viewportSize().width}px`,
  );
}
async function assertCard(page, prompt, beginning, ending, role) {
  const postcard = page.locator('.postcard-paper.paper-open .postcard');
  await postcard.waitFor();
  const setup = postcard.locator('.setup-half');
  const reply = postcard.locator('.card-half:not(.setup-half)');
  await expect(setup.locator('.story-context')).toHaveText(
    `Beginning${role === 'setup' ? ' · You wrote this' : ''} — ${prompt.setup}`,
  );
  await expect(reply.locator('.story-context')).toHaveText(
    `Ending${role === 'reply' ? ' · You wrote this' : ''} — ${prompt.reply}`,
  );
  await expect(setup.locator('p')).toHaveText(beginning);
  await expect(reply.locator('p')).toHaveText(ending);
  assert.equal(await postcard.getByText(/You wrote this/).count(), 1);
}

try {
  await fs.mkdir(out, { recursive: true });
  const author = await makePage();
  const responder = await makePage();
  const prompt = await author.evaluate(() =>
    JSON.parse(window.driftTestGame.snapshot().today.promptJson),
  );
  const beginning = prompt.exampleSetup;
  const ending = prompt.exampleReply;
  await author.getByRole('button', { name: /^Release a bottle/ }).click();
  await expect(author.getByRole('heading', { name: prompt.setup, exact: true })).toBeVisible();
  await expect(author.locator('.writing-context')).toContainText('How someone will respond');
  await expect(author.locator('.writing-context')).toContainText(prompt.reply);
  await author
    .getByRole('textbox', { name: 'Your six-word beginning', exact: true })
    .fill(beginning);
  await noOverflow(author);
  await author.screenshot({
    path: new URL('write-beginning-390.png', out).pathname,
    fullPage: true,
  });
  await button(author, 'Release').click();
  await author.locator('.shore-home').waitFor();
  await author.waitForFunction(() => window.driftTestGame.snapshot().outgoing.length === 1);
  const beginningId = await author.evaluate(() => window.driftTestGame.snapshot().outgoing[0].id);
  pass(
    'Beginning writing explains both the original question and how the next writer will respond',
  );

  await responder.goto(`${origin}/?bottle=${encodeURIComponent(beginningId)}`);
  await waitForGameConnection(responder);
  await expect(responder.locator('.writing-context').first()).toContainText(prompt.setup);
  await button(responder, 'Write an ending').click();
  await button(responder, 'Open bottle').click();
  await responder.getByRole('textbox', { name: 'Your six-word ending', exact: true }).waitFor();
  await expect(
    responder.locator('.writing-context').filter({
      has: responder.getByText('Original prompt', { exact: true }),
    }),
  ).toContainText(prompt.setup);
  await expect(responder.getByRole('heading', { name: prompt.reply, exact: true })).toBeVisible();
  await expect(responder.locator('.caught-note')).toContainText(beginning);
  await noOverflow(responder);
  await responder.screenshot({
    path: new URL('write-ending-390.png', out).pathname,
    fullPage: true,
  });
  await responder.getByRole('textbox', { name: 'Your six-word ending', exact: true }).fill(ending);
  await button(responder, 'Send reply').click();
  await responder.getByRole('heading', { name: 'Saved reply', exact: true }).waitFor();
  await assertCard(responder, prompt, beginning, ending, 'reply');
  const cardId = await responder.locator('.postcard-paper .postcard').getAttribute('data-card-id');
  assert.ok(cardId);
  const savedPrompt = await responder.evaluate(async (id) => {
    const card = window.driftTestGame.snapshot().cards.find((item) => item.id === id);
    if (!card) throw Error('Completed story missing from the live snapshot.');
    const { storyPrompt } = await import('/src/story-context.ts');
    return { id: card.promptId, prompt: storyPrompt(card.promptId) };
  }, cardId);
  assert.equal(savedPrompt.id, prompt.id);
  assert.equal(savedPrompt.prompt.setup, prompt.setup);
  assert.equal(savedPrompt.prompt.reply, prompt.reply);
  pass(
    'A real second writer sees the original question, beginning and response instruction before submitting',
  );

  // Capture the actual Copy text button's payload without claiming native clipboard coverage.
  await responder.evaluate(() => {
    window.responseContextCopiedText = undefined;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (text) => {
          window.responseContextCopiedText = text;
        },
      },
    });
  });
  await button(responder, 'Copy text').click();
  await responder.waitForFunction(() => typeof window.responseContextCopiedText === 'string');
  assert.equal(
    await responder.evaluate(() => window.responseContextCopiedText),
    `Original prompt: ${savedPrompt.prompt.setup}\nBeginning: ${beginning}\n\nHow to respond: ${savedPrompt.prompt.reply}\nEnding: ${ending}`,
  );
  await author.goto(`${origin}/?bottle=${encodeURIComponent(beginningId)}`);
  await waitForGameConnection(author);
  await author.locator('.ending-preview').filter({ hasText: ending }).click();
  await assertCard(author, prompt, beginning, ending, 'setup');
  for (const [label, page] of [
    ['author', author],
    ['responder', responder],
  ]) {
    for (const [width, height] of [
      [390, 844],
      [320, 740],
    ]) {
      await page.setViewportSize({ width, height });
      await noOverflow(page);
      await page.screenshot({
        path: new URL(`result-${label}-${width}.png`, out).pathname,
        fullPage: true,
      });
    }
  }
  pass(
    'Both real authors see their own contribution marked once, and copied text carries the story-specific prompts and both human lines without narrow-screen overflow',
  );

  // Skip removes the old assignment from the live view. Its local draft must retain enough
  // context to remain understandable without that assignment being available afterwards.
  // A fresh third writer keeps this check independent of the completed writer's daily turns.
  const draftWriter = await makePage();
  await draftWriter.setViewportSize({ width: 320, height: 740 });
  await pickup(draftWriter);
  const oldAssignment = await draftWriter.evaluate(() => {
    const state = window.driftTestGame.snapshot();
    const round = state.rounds.find((item) => item.stage === 'reply');
    const assignment = state.assignments.find(
      (item) => item.roundId === round.id && item.id === round.assignmentId,
    );
    return {
      roundId: round.id,
      id: assignment.id,
      text: assignment.text,
      day: round.day,
      prompt: JSON.parse(round.promptJson),
    };
  });
  const draft = 'Please return all borrowed ocean furniture.';
  await draftWriter.getByRole('textbox', { name: 'Your six-word ending', exact: true }).fill(draft);
  const stored = await draftWriter.evaluate(({ roundId, id }) => {
    const identity = window.driftTestGame.snapshot().identity;
    return JSON.parse(localStorage.getItem(`drift:draft:${identity}:${roundId}:${id}`));
  }, oldAssignment);
  assert.equal(stored.text, draft);
  assert.deepEqual(stored.context, {
    day: oldAssignment.day,
    setupPrompt: oldAssignment.prompt.setup,
    replyPrompt: oldAssignment.prompt.reply,
    kind: 'reply',
    beginning: oldAssignment.text,
  });
  await button(draftWriter, 'Skip this bottle').click();
  await draftWriter.locator('[data-bottle-choice]').first().click();
  await draftWriter.locator('.bottle-ritual[data-pickup-step="open"]').waitFor();
  await button(draftWriter, 'Open bottle').click();
  await draftWriter.getByRole('textbox', { name: 'Your six-word ending', exact: true }).waitFor();
  await draftWriter.waitForFunction(
    (id) => !window.driftTestGame.snapshot().assignments.some((item) => item.id === id),
    oldAssignment.id,
  );
  await home(draftWriter);
  await draftWriter.getByRole('button', { name: /^My bottles/ }).click();
  await draftWriter.locator('.earlier-drafts > summary').click();
  const recovered = draftWriter
    .locator('.earlier-draft')
    .filter({ has: draftWriter.getByText(draft, { exact: true }) });
  await expect(recovered).toContainText('Your ending');
  await expect(recovered).toContainText(oldAssignment.prompt.setup);
  await expect(recovered).toContainText(oldAssignment.prompt.reply);
  await expect(recovered).toContainText(oldAssignment.text);
  await expect(recovered.locator('blockquote')).toHaveText(draft);
  await noOverflow(draftWriter);
  await draftWriter.screenshot({
    path: new URL('skipped-draft-context-320.png', out).pathname,
    fullPage: true,
  });
  pass(
    'A skipped reply draft keeps its original question, response instruction and beginning after the live assignment disappears',
  );

  assert.deepEqual(errors, []);
  await fs.writeFile(
    new URL('checks.json', out),
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        checks,
        errors,
        beginningId,
        cardId,
        scope:
          'Disposable keyless local three-writer room; real release, invitation, reply and skip. Copy button payload captured with a clipboard stub. No provider calls, production stories, native clipboard, native sharing or physical-phone claim.',
      },
      null,
      2,
    ) + '\n',
  );
} finally {
  await Promise.all(contexts.map((context) => context.close()));
  await browser.close();
}
