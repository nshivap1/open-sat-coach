import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error' && !/ERR_CONNECTION_REFUSED/.test(m.text())) errors.push(m.text()); });
await page.goto(pathToFileURL(resolve('dist/index.html')).href);
await page.getByLabel('Nickname').fill('Sam');
await page.getByText('Test 7').click();
await page.getByRole('button', { name: 'Get started' }).click();
await page.getByRole('button', { name: 'Skip for now' }).click();
for (const tab of ['Practice', 'Tests', 'Progress', 'Home']) {
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: tab, exact: true }).click();
  await page.waitForTimeout(200);
  await page.screenshot({ path: `dist/nav-${tab}.png`, fullPage: false });
}
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
