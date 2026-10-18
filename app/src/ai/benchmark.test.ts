// @ts-ignore node typings are not installed in the offline image
import { test } from 'node:test';
// @ts-ignore
import assert from 'node:assert/strict';
import { percentile, runBenchmark } from './benchmark';
import { ITEMS } from '../content/index';
import type { Item } from '../domain/types';
import type { ProviderConfig } from './types';

const g = globalThis as any;
const P: ProviderConfig = { kind: 'openai_compat', source: 'llamacpp', baseUrl: 'http://127.0.0.1:8080', model: 'gemma', label: 'llama.cpp · gemma' };

test('percentile uses nearest rank', () => {
  assert.equal(percentile([], 50), 0);
  assert.equal(percentile([5], 95), 5);
  assert.equal(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 50), 5);
  assert.equal(percentile([10, 9, 8, 7, 6, 5, 4, 3, 2, 1], 95), 10);
  assert.equal(percentile([15, 20, 35, 40, 50], 30), 20);
  assert.equal(percentile([3, 1, 2], 0), 1);
});

// Fake server: answers correctly for even-indexed items, wrongly for odd ones; classifies every item correctly.
function fakeServer(items: Item[]) {
  let calls = 0;
  let idx = -1; // items are asked in order: one answer call, then (optionally) one classify call
  g.fetch = async (_u: string, init: any) => {
    calls++;
    const body = JSON.parse(init.body);
    const isClassify = !!body.response_format?.json_schema.schema.properties.skillId;
    if (!isClassify) idx++;
    const item = items[idx];
    assert.ok(body.messages[body.messages.length - 1].content.includes(item.prompt));
    let content: string;
    if (isClassify) content = JSON.stringify({ skillId: item.skillId });
    else if (item.response.kind === 'mcq') {
      const right = item.response.answer;
      content = JSON.stringify({ answer: idx % 2 === 0 ? right : (['A', 'B', 'C', 'D'] as const).find((c) => c !== right) });
    } else content = JSON.stringify({ answer: idx % 2 === 0 ? item.response.accepted[0] : '99999' });
    return new Response(JSON.stringify({ choices: [{ message: { content } }] }));
  };
  return () => calls;
}

test('benchmark scores half correct with classification', async () => {
  const mcq = ITEMS.filter((i) => i.response.kind === 'mcq').slice(0, 6);
  const spr = ITEMS.filter((i) => i.response.kind === 'spr').slice(0, 2);
  const items = [...mcq.slice(0, 3), spr[0], ...mcq.slice(3), spr[1]];
  const count = fakeServer(items);
  const progress: number[] = [];
  const r = await runBenchmark(P, items, { classify: true, device: 'test box', onProgress: (d) => progress.push(d) });
  assert.equal(count(), 16);
  assert.equal(r.items, 8);
  assert.equal(r.answered, 8);
  assert.equal(r.correct, 4);
  assert.equal(r.accuracy, 0.5);
  assert.equal(r.coverage, 1);
  assert.equal(r.classifyAccuracy, 1);
  assert.equal(r.device, 'test box');
  assert.equal(r.providerLabel, 'llama.cpp · gemma');
  assert.deepEqual(progress, [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(r.rows.map((x) => x.correct), [true, false, true, false, true, false, true, false]);
  assert.ok(r.p95Ms >= r.p50Ms);
});

test('unparseable or invalid answers count as not answered; limit and abort return partial results', async () => {
  const mcq = ITEMS.filter((i) => i.response.kind === 'mcq').slice(0, 2);
  const spr = ITEMS.find((i) => i.response.kind === 'spr')!;
  const replies = ['I am not sure.', '{"answer":"E"}', '{"answer":"1 1/2"}'];
  let n = 0;
  g.fetch = async () => new Response(JSON.stringify({ choices: [{ message: { content: replies[n++] } }] }));
  const r = await runBenchmark(P, [...mcq, spr]);
  assert.equal(r.items, 3);
  assert.equal(r.answered, 0);
  assert.equal(r.coverage, 0);
  assert.equal(r.accuracy, 0);
  assert.ok(r.rows.every((x) => x.answer === null && !x.correct && x.error));
  assert.equal(r.classifyAccuracy, undefined);

  const many = ITEMS.filter((i) => i.response.kind === 'mcq').slice(0, 10);
  fakeServer(many);
  assert.equal((await runBenchmark(P, many, { limit: 3 })).items, 3);
  const ctrl = new AbortController();
  fakeServer(many);
  const partial = await runBenchmark(P, many, { signal: ctrl.signal, onProgress: (d) => { if (d === 2) ctrl.abort(); } });
  assert.equal(partial.items, 2);
});
