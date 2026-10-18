// @ts-ignore node typings are not installed in the offline image
import { test } from 'node:test';
// @ts-ignore
import assert from 'node:assert/strict';
import { detectLocalModels } from './detect';

const g = globalThis as any;
const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status });

function fakeFetch(routes: Record<string, () => Response>) {
  const seen: string[] = [];
  g.fetch = async (url: string) => {
    seen.push(url);
    const h = routes[url];
    if (!h) throw new TypeError('fetch failed');
    return h();
  };
  return seen;
}

test('parses Ollama and OpenAI-compatible servers, skips embeddings, records unreachable servers', async () => {
  const seen = fakeFetch({
    'http://127.0.0.1:11434/api/tags': () => json({ models: [
      { name: 'llama3.2:3b', size: 2_000_000_000, details: { parameter_size: '3.2B', quantization_level: 'Q4_K_M' } },
      { name: 'nomic-embed-text:latest', size: 1 },
      { name: 'gemma4:e4b', size: 9_600_000_000, details: { parameter_size: '8B', quantization_level: 'Q4_K_M' } },
    ] }),
    'http://127.0.0.1:1234/v1/models': () => json({ data: [{ id: 'qwen3-8b' }, { id: 'google/gemma-4-e2b' }, { id: 'text-embedding-nomic' }] }),
    'http://127.0.0.1:8080/v1/models': () => json({ error: 'nope' }, 500),
  });
  const r = await detectLocalModels();
  assert.equal(r.environment, 'web');
  assert.equal(seen.length, 4);
  const by = Object.fromEntries(r.servers.map((s) => [s.source, s]));
  assert.equal(by.ollama.reachable, true);
  assert.equal(by.lmstudio.reachable, true);
  assert.equal(by.llamacpp.reachable, false);
  assert.match(by.llamacpp.error!, /500/);
  assert.equal(by.jan.reachable, false);
  assert.match(by.jan.error!, /Could not reach/);
  const labels = r.models.map((m) => m.provider.label);
  assert.deepEqual(labels, ['Ollama · gemma4:e4b', 'LM Studio · google/gemma-4-e2b', 'Ollama · llama3.2:3b', 'LM Studio · qwen3-8b']);
  const gem = r.models[0];
  assert.deepEqual(gem.provider, { kind: 'ollama', source: 'ollama', baseUrl: 'http://127.0.0.1:11434', model: 'gemma4:e4b', label: 'Ollama · gemma4:e4b' });
  assert.equal(gem.isGemma, true);
  assert.equal(gem.sizeBytes, 9_600_000_000);
  assert.equal(gem.details, '8B · Q4_K_M');
  assert.equal(r.models[1].provider.kind, 'openai_compat');
});

test('everything unreachable never throws', async () => {
  fakeFetch({});
  const r = await detectLocalModels({ customUrl: 'http://example.com:9000' });
  assert.equal(r.models.length, 0);
  assert.equal(r.servers.length, 5);
  assert.ok(r.servers.every((s) => !s.reachable && s.error));
  assert.match(r.servers[4].error!, /Only local addresses/);
});

test('custom URL falls back to Ollama shape; e4b ranks after Gemma; gguf files on desktop', async () => {
  fakeFetch({
    'http://localhost:5000/api/tags': () => json({ models: [{ name: 'phi4-e4b-mini' }, { name: 'gemma4:e2b' }] }),
    'http://127.0.0.1:1337/v1/models': () => json({ data: [{ id: 'gemma-4-e4b-it' }] }),
  });
  g.__TAURI__ = { core: { invoke: async (cmd: string, args: any) => {
    if (cmd === 'http_local') {
      const res = await g.fetch(args.req.url).catch(() => null);
      if (!res) throw new Error(`Could not reach ${new URL(args.req.url).origin}`);
      return { status: res.status, body: await res.text() };
    }
    if (cmd === 'scan_models') return { ggufFiles: [{ path: '/home/u/models/gemma-4-E4B-it-Q4_0.gguf', name: 'gemma-4-E4B-it-Q4_0.gguf', sizeBytes: 4_590_000_000 }], llamaServerPath: '/opt/homebrew/bin/llama-server' };
    throw new Error('unexpected ' + cmd);
  } } };
  try {
    const r = await detectLocalModels({ customUrl: 'http://localhost:5000/v1/' });
    assert.equal(r.environment, 'desktop');
    assert.equal(r.llamaServerPath, '/opt/homebrew/bin/llama-server');
    assert.equal(r.ggufFiles.length, 1);
    assert.deepEqual(r.models.map((m) => m.provider.label), [
      'Jan · gemma-4-e4b-it',
      'Model file · gemma-4-E4B-it-Q4_0.gguf',
      'Custom server · gemma4:e2b',
      'Custom server · phi4-e4b-mini',
    ]);
    const gguf = r.models[1].provider;
    assert.deepEqual(gguf, { kind: 'gguf_file', source: 'app_llama', baseUrl: '', model: 'gemma-4-E4B-it-Q4_0.gguf', filePath: '/home/u/models/gemma-4-E4B-it-Q4_0.gguf', label: 'Model file · gemma-4-E4B-it-Q4_0.gguf' });
    assert.equal(r.models[2].provider.kind, 'ollama');
    assert.equal(r.models[2].provider.baseUrl, 'http://localhost:5000');
  } finally {
    delete g.__TAURI__;
  }
});
