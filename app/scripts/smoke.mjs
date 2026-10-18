// End-to-end smoke test of the built single-file app (headless Chromium).
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.setDefaultTimeout(4000);
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error' && !/ERR_CONNECTION_REFUSED/.test(m.text())) errors.push(m.text()); });
await page.goto(pathToFileURL(resolve('dist/index.html')).href);
await page.getByLabel('Nickname').fill('Sam');
await page.getByRole('button', { name: 'Get started' }).click();
await page.getByRole('button', { name: 'Skip for now' }).click();
await page.getByRole('button', { name: /Start diagnostic/ }).click();
async function runModule(tag) {
  await page.getByRole('button', { name: 'Start module' }).click();
  for (let i = 0; i < 40; i++) {
    const choices = page.locator('button.t-choice');
    const spr = page.locator('.t-spr-input');
    if (await choices.count()) await choices.nth(i % 4).click().catch(() => {});
    else if (await spr.count()) await spr.first().fill('3').catch(() => {});
    if (i === 1) await page.screenshot({ path: `dist/shot-${tag}.png` });
    const next = page.getByRole('button', { name: 'Next', exact: true });
    if (await next.count() && await next.isEnabled()) { await next.click(); continue; }
    break;
  }
  const review = page.getByRole('button', { name: /Go to review|Check your work|Submit module/ }).first();
  if (await review.count()) await review.click();
  await page.screenshot({ path: `dist/shot-${tag}-review.png` });
  const submit = page.getByRole('button', { name: /Submit module/ }).first();
  if (await submit.count()) await submit.click();
  const yes = page.getByRole('button', { name: /Yes, submit/ }).first();
  if (await yes.count()) await yes.click();
}
await runModule('rw');
const resumeBtn = page.getByRole('button', { name: /Resume now/ });
if (await resumeBtn.count()) await resumeBtn.click();
await runModule('math');
await page.waitForTimeout(300);
await page.screenshot({ path: 'dist/shot-results.png', fullPage: true });
await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Progress' }).click().catch(() => {});
await page.waitForTimeout(200);
await page.screenshot({ path: 'dist/shot-progress.png' });
await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Home' }).click().catch(() => {});
await page.waitForTimeout(200);
await page.screenshot({ path: 'dist/shot-home.png' });
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
