// @ts-ignore node typings are not installed in the offline image
import { test } from 'node:test';
// @ts-ignore
import assert from 'node:assert/strict';
import { chat, ensureRunning, ping } from './client';
import type { ProviderConfig } from './types';

const g = globalThis as any;
const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status });
const OLLAMA: ProviderConfig = { kind: 'ollama', source: 'ollama', baseUrl: 'http://127.0.0.1:11434', model: 'gemma4:e4b', label: 'Ollama · gemma4:e4b' };
const OAI: ProviderConfig = { kind: 'openai_compat', source: 'lmstudio', baseUrl: 'http://127.0.0.1:1234', model: 'gemma-4-e4b', label: 'LM Studio · gemma-4-e4b', apiKey: 'k1' };

function capture(handler: (url: string, body: any, headers: any) => Response) {
  const calls: { url: string; body: any; headers: any }[] = [];
  g.fetch = async (url: string, init: any) => {
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ url, body, headers: init.headers });
    return handler(url, body, init.headers);
  };
  return calls;
}

test('chat via Ollama shape', async () => {
  const calls = capture(() => json({ message: { role: 'assistant', content: '{"text":"hi"}' }, eval_count: 7 }));
  const schema = { type: 'object', properties: { text: { type: 'string' } } };
  const r = await chat(OLLAMA, [{ role: 'user', content: 'x' }], { jsonSchema: schema, temperature: 0.2, maxTokens: 50 });
  assert.equal(calls[0].url, 'http://127.0.0.1:11434/api/chat');
  assert.deepEqual(calls[0].body, { model: 'gemma4:e4b', messages: [{ role: 'user', content: 'x' }], stream: false, format: schema, options: { temperature: 0.2, num_predict: 50 } });
  assert.equal(r.text, '{"text":"hi"}');
  assert.deepEqual(r.json, { text: 'hi' });
  assert.equal(r.tokens, 7);
  assert.ok(r.ms >= 0);
});

test('chat via OpenAI-compatible shape with bearer token', async () => {
  const calls = capture(() => json({ choices: [{ message: { content: 'OK' } }], usage: { completion_tokens: 2 } }));
  const r = await chat(OAI, [{ role: 'user', content: 'hello' }], { temperature: 0, maxTokens: 8 });
  assert.equal(calls[0].url, 'http://127.0.0.1:1234/v1/chat/completions');
  assert.equal(calls[0].headers.Authorization, 'Bearer k1');
  assert.deepEqual(calls[0].body, { model: 'gemma-4-e4b', messages: [{ role: 'user', content: 'hello' }], temperature: 0, max_tokens: 8 });
  assert.equal(r.text, 'OK');
  assert.equal(r.tokens, 2);
  assert.equal(r.json, undefined);
});

test('response_format 4xx triggers one retry with the schema as an instruction; fenced JSON is parsed', async () => {
  const schema = { type: 'object', properties: { answer: { type: 'string' } }, required: ['answer'] };
  const calls = capture((_u, body) =>
    body.response_format
      ? json({ error: { message: "'response_format.type' must be 'json_schema' or 'text'" } }, 400)
      : json({ choices: [{ message: { content: 'Sure!\n```json\n{"answer": "B", "note": "brace } in string"}\n```' } }] }),
  );
  const r = await chat(OAI, [{ role: 'system', content: 's' }, { role: 'user', content: 'Q?' }], { jsonSchema: schema });
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0].body.response_format, { type: 'json_schema', json_schema: { name: 'response', strict: true, schema } });
  assert.equal(calls[1].body.response_format, undefined);
  assert.match(calls[1].body.messages[1].content, /^Q\?\n\nRespond with only a JSON object matching this schema: \{/);
  assert.equal(calls[1].body.messages[0].content, 's');
  assert.deepEqual(r.json, { answer: 'B', note: 'brace } in string' });
});

test('JSON embedded in prose and unparseable output', async () => {
  capture(() => json({ choices: [{ message: { content: 'The answer is {"answer":"C"} because...' } }] }));
  assert.deepEqual((await chat(OAI, [{ role: 'user', content: 'q' }], { jsonSchema: {} })).json, { answer: 'C' });
  capture(() => json({ choices: [{ message: { content: 'I think C.' } }] }));
  const r = await chat(OAI, [{ role: 'user', content: 'q' }], { jsonSchema: {} });
  assert.equal(r.json, undefined);
  assert.equal(r.text, 'I think C.');
});

test('non-2xx errors carry status and excerpt; ping reports failures; abort is honoured', async () => {
  capture(() => json({ error: 'model "gemma4:e4b" not found, try pulling it first' }, 404));
  await assert.rejects(chat(OLLAMA, [{ role: 'user', content: 'q' }]), /404: model "gemma4:e4b" not found/);
  const bad = await ping(OLLAMA);
  assert.equal(bad.ok, false);
  assert.match(bad.error!, /404/);
  const calls = capture(() => json({ message: { content: 'OK' } }));
  const good = await ping(OLLAMA);
  assert.deepEqual({ ok: good.ok, model: good.model }, { ok: true, model: 'gemma4:e4b' });
  assert.deepEqual(calls[0].body.options, { temperature: 0, num_predict: 8 });
  assert.equal(calls[0].body.messages[0].content, 'Reply with the word OK.');
  g.fetch = () => new Promise(() => {});
  const ctrl = new AbortController();
  const p = chat(OLLAMA, [{ role: 'user', content: 'q' }], { signal: ctrl.signal, timeoutMs: 50 });
  ctrl.abort();
  await assert.rejects(p, (e: any) => e.name === 'AbortError');
});

test('ensureRunning starts llama-server for gguf files and reuses the in-memory token', async () => {
  const invoked: any[] = [];
  let status: any = { running: false, port: null, modelPath: null };
  g.__TAURI__ = { core: { invoke: async (cmd: string, args: any) => {
    invoked.push([cmd, args]);
    if (cmd === 'llama_status') return status;
    if (cmd === 'start_llama') { status = { running: true, port: 41234, modelPath: args.modelPath }; return { port: 41234, token: 'tok', pid: 9 }; }
    if (cmd === 'http_local') return { status: 200, body: JSON.stringify({ choices: [{ message: { content: 'OK' } }] }) };
    throw new Error(cmd);
  } } };
  try {
    const file: ProviderConfig = { kind: 'gguf_file', source: 'app_llama', baseUrl: '', model: 'g.gguf', filePath: '/m/g.gguf', label: 'Model file · g.gguf' };
    assert.equal(await ensureRunning(OLLAMA), OLLAMA);
    const a = await ensureRunning(file);
    assert.deepEqual(a, { kind: 'openai_compat', source: 'app_llama', baseUrl: 'http://127.0.0.1:41234', model: 'g.gguf', apiKey: 'tok', label: 'Model file · g.gguf', filePath: '/m/g.gguf' });
    const b = await ensureRunning(file);
    assert.deepEqual(b, a);
    assert.equal(invoked.filter((c) => c[0] === 'start_llama').length, 1);
    assert.deepEqual(invoked.find((c) => c[0] === 'start_llama')[1], { modelPath: '/m/g.gguf' });
    await chat(file, [{ role: 'user', content: 'q' }]);
    const req = invoked.find((c) => c[0] === 'http_local')[1].req;
    assert.equal(req.url, 'http://127.0.0.1:41234/v1/chat/completions');
    assert.equal(req.headers.Authorization, 'Bearer tok');
  } finally {
    delete g.__TAURI__;
  }
});
