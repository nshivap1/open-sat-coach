// @ts-ignore node typings are not installed in the offline image
import { test } from 'node:test';
// @ts-ignore
import assert from 'node:assert/strict';
import { isDesktop, isLoopbackUrl, localRequest, openExternal } from './transport';
import { GEMMA_DOWNLOADS, recommendedVariant } from './catalog';

const g = globalThis as any;

test('isLoopbackUrl accepts only loopback http(s) hosts', () => {
  for (const u of ['http://localhost:11434', 'http://127.0.0.1:1234/v1', 'http://[::1]:8080/', 'https://localhost']) assert.equal(isLoopbackUrl(u), true, u);
  for (const u of ['http://example.com', 'http://127.0.0.2', 'http://10.0.0.5:11434', 'ftp://localhost', 'file:///etc/passwd', 'http://localhost.evil.com', 'http://user:pw@localhost', 'nonsense'])
    assert.equal(isLoopbackUrl(u), false, u);
});

test('localRequest rejects non-loopback addresses without calling fetch', async () => {
  let called = false;
  g.fetch = async () => { called = true; return new Response('{}'); };
  await assert.rejects(localRequest({ method: 'GET', url: 'https://api.example.com/v1/models' }), /Only local addresses are allowed/);
  assert.equal(called, false);
});

test('localRequest web path uses fetch and maps network errors', async () => {
  g.fetch = async (url: string, init: any) => new Response(`${init.method} ${url}`, { status: 201 });
  assert.deepEqual(await localRequest({ method: 'POST', url: 'http://127.0.0.1:11434/api/chat', body: '{}' }), { status: 201, body: 'POST http://127.0.0.1:11434/api/chat' });
  g.fetch = async () => { throw new TypeError('fetch failed'); };
  await assert.rejects(localRequest({ method: 'GET', url: 'http://127.0.0.1:1234/v1/models' }), /Could not reach http:\/\/127\.0\.0\.1:1234/);
});

test('desktop path routes through http_local and open_external', async () => {
  const calls: any[] = [];
  g.__TAURI__ = { core: { invoke: async (cmd: string, args: any) => { calls.push([cmd, args]); return { status: 200, body: 'ok' }; } } };
  try {
    assert.equal(isDesktop(), true);
    const r = await localRequest({ method: 'GET', url: 'http://localhost:1337/v1/models', timeoutMs: 1500 });
    assert.deepEqual(r, { status: 200, body: 'ok' });
    assert.deepEqual(calls[0], ['http_local', { req: { method: 'GET', url: 'http://localhost:1337/v1/models', headers: {}, body: undefined, timeoutMs: 1500 } }]);
    await openExternal('https://ollama.com/download');
    assert.deepEqual(calls[1], ['open_external', { url: 'https://ollama.com/download' }]);
    await assert.rejects(openExternal('http://ollama.com'), /https/);
  } finally {
    delete g.__TAURI__;
  }
  assert.equal(isDesktop(), false);
});

test('catalog: three download options and memory-based variant', () => {
  assert.deepEqual(GEMMA_DOWNLOADS.map((d) => d.id), ['ollama', 'lmstudio', 'gguf']);
  assert.equal(GEMMA_DOWNLOADS[0].command, 'ollama pull gemma4:e4b');
  assert.ok(GEMMA_DOWNLOADS.every((d) => d.url.startsWith('https://')));
  const GiB = 1024 ** 3;
  assert.equal(recommendedVariant(null).ollamaTag, 'gemma4:e4b');
  assert.equal(recommendedVariant(8 * GiB).ollamaTag, 'gemma4:e2b');
  assert.equal(recommendedVariant(16 * GiB).ollamaTag, 'gemma4:e4b');
  assert.equal(recommendedVariant(32 * GiB).ollamaTag, 'gemma4:12b');
  assert.ok(recommendedVariant(32 * GiB).why.length > 0);
});
