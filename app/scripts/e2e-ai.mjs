// End-to-end test of local-model detection, the coach and the benchmark against scripts/mock-ollama.mjs.
// Usage: node scripts/e2e-ai.mjs   (builds must exist: npm run build)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const mock = spawn(process.execPath, ['scripts/mock-ollama.mjs'], { stdio: 'inherit' });
await new Promise((r) => setTimeout(r, 400));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.setDefaultTimeout(8000);
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error' && !/ERR_CONNECTION_REFUSED|Failed to load resource/.test(m.text())) errors.push(m.text()); });
let ok = true;
const step = async (name, fn) => { try { await fn(); console.log('✓', name); } catch (e) { ok = false; console.log('✗', name, '\n ', String(e).split('\n')[0]); await page.screenshot({ path: `dist/e2e-fail-${name.replace(/\W+/g, '-')}.png` }); } };
try {
  await page.goto(pathToFileURL(resolve('dist/index.html')).href);
  await step('onboarding profile', async () => {
    await page.getByLabel('Nickname').fill('Ava');
    await page.getByRole('button', { name: 'Get started' }).click();
  });
  await step('detects local Gemma via Ollama', async () => {
    await page.getByText('gemma4:e4b').first().waitFor();
    await page.screenshot({ path: 'dist/e2e-ai-detect.png' });
  });
  await step('connects the model', async () => {
    await page.getByRole('button', { name: /Use this model/ }).click();
    await page.getByRole('navigation', { name: 'Main' }).waitFor();
  });
  await step('coach explains a practice question', async () => {
    await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Practice', exact: true }).click();
    await page.getByRole('button', { name: /Sentence boundaries/ }).click();
    await page.getByRole('button', { name: 'Start practice' }).click();
    await page.locator('button.t-choice').first().click();
    await page.getByRole('button', { name: /Check answer/ }).click();
    await page.getByRole('button', { name: /Explain it another way/ }).click();
    await page.getByText(/Mock coach/).waitFor();
    await page.getByText(/Judge: answer and reasoning check out/).first().waitFor();
    await page.screenshot({ path: 'dist/e2e-ai-coach.png', fullPage: true });
  });
  await step('follow-up question', async () => {
    const box = page.getByLabel(/follow-up/i).first();
    await box.fill('Why not a comma?');
    await page.getByRole('button', { name: 'Ask', exact: true }).click();
    await page.getByText(/Why not a comma\?/).waitFor();
  });
  await step('Gemma writes checked practice questions', async () => {
    await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Practice', exact: true }).click();
    await page.getByRole('button', { name: /Transitions/ }).first().click();
    const box = page.getByLabel(/written by Gemma/i).first();
    if (!(await box.isChecked())) await box.check();
    await page.getByRole('button', { name: 'Start practice' }).click();
    await page.getByText(/Written by Gemma/).first().waitFor({ timeout: 30000 });
    await page.screenshot({ path: 'dist/e2e-ai-generated.png', fullPage: true });
  });
  await step('benchmark in settings', async () => {
    await page.getByRole('button', { name: /Settings/ }).click();
    await page.getByRole('button', { name: /Run the check/ }).click();
    await page.getByText(/Accuracy/).first().waitFor({ timeout: 30000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'dist/e2e-ai-bench.png', fullPage: true });
  });
  await step('ask the coach about a pasted question', async () => {
    await page.getByRole('button', { name: 'Ask the coach' }).first().click();
    await page.getByLabel(/Paste the question/).fill('Researchers tracked otters for three seasons ______ the data showed a clear pattern. Which choice completes the text? A) seasons, the B) seasons, and the C) seasons the D) seasons and, the');
    await page.getByRole('button', { name: 'Ask', exact: true }).first().click();
    await page.getByText(/Judge: answer and reasoning check out/).first().waitFor();
    await page.screenshot({ path: 'dist/e2e-ai-ask.png', fullPage: true });
  });
  await step('miss-reason suggestion on results', async () => {
    await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Tests', exact: true }).click();
    await page.getByRole('button', { name: /^Start Quick diagnostic/ }).first().click();
    for (let m = 0; m < 2; m++) {
      await page.getByRole('button', { name: 'Start module' }).click();
      await page.getByRole('button', { name: /Question 1 of/ }).click();
      await page.getByRole('button', { name: /Go to review|Check your work/ }).first().click().catch(() => {});
      await page.getByRole('button', { name: /Submit module/ }).first().click();
      const yes = page.getByRole('button', { name: /Yes, submit/ }).first();
      if (await yes.count()) await yes.click();
      const resume = page.getByRole('button', { name: /Resume now/ });
      if (m === 0 && await resume.count()) await resume.click();
    }
    await page.locator('button.t-res-toggle').first().click();
    await page.getByRole('button', { name: /Suggest why I missed it/ }).first().click();
    await page.getByRole('button', { name: /Use this reason/ }).first().click();
    await page.screenshot({ path: 'dist/e2e-ai-miss.png', fullPage: true });
  });
} finally {
  console.log('page errors:', errors.length ? errors : 'none');
  await browser.close();
  mock.kill();
  process.exit(ok && !errors.length ? 0 : 1);
}
