// Import once, then poll a synchronous boolean. Playwright's predicate loop treats
// a returned Promise as truthy, so an async import inside waitForFunction can
// resolve to false without polling again.
export async function waitForGameConnection(page) {
  await page.evaluate(async () => {
    window.driftTestGame = (await import('/src/game.ts')).game;
  });
  await page.waitForFunction(() => window.driftTestGame.snapshot().connected);
}
