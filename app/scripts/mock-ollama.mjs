// Stand-in for a local Ollama server (127.0.0.1:11434) used by automated tests. Not a model.
// It answers /api/tags and /api/chat; for JSON-schema requests it builds a schema-valid reply,
// with a few deterministic choices so validation flows (generation → independent solve) agree.
import { createServer } from 'node:http';
const port = Number(process.env.PORT || 11434);
const send = (res, status, obj) => {
  res.writeHead(status, { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS' });
  res.end(JSON.stringify(obj));
};
let counter = 0;
const VOCAB = 'river otter canyon lantern harvest glacier pottery orchard violin archive meteor coral bridge pigment ledger falcon prairie quartz tide compass mural sapling ember harbor thistle beacon cobalt fossil meadow saffron tundra loom kelp basalt marigold sextant juniper reef atlas cinder willow ferry granite plume alder opal summit delta moss cedar flint aurora lichen rapids sable vineyard ridge comet quill bramble estuary canopy'.split(' ');
const salad = (n) => Array.from({ length: n }, () => VOCAB[Math.floor(Math.random() * VOCAB.length)]).join(' ');
function fake(schema, key = '') {
  if (!schema || typeof schema !== 'object') return 'ok';
  if (schema.anyOf || schema.oneOf) return fake((schema.anyOf || schema.oneOf).find((s) => s.type !== 'null') || {}, key);
  if (schema.enum) {
    const vals = schema.enum.filter((v) => v !== null);
    if (key === 'answer' && vals.includes('B')) return 'B';
    if (key === 'reason' && vals.includes('misread')) return 'misread';
    return vals[0];
  }
  const t = Array.isArray(schema.type) ? schema.type.find((x) => x !== 'null') : schema.type;
  if (t === 'object' || schema.properties) {
    const out = {};
    for (const [k, v] of Object.entries(schema.properties || {})) out[k] = fake(v, k);
    return out;
  }
  if (t === 'array') {
    if (key === 'issues') return [];
    const n = Math.max(schema.minItems || 0, Math.min(schema.maxItems || 3, 3));
    return Array.from({ length: n }, (_, i) => fake(schema.items || { type: 'string' }, `${key}${i}`));
  }
  if (t === 'boolean') return true; // exactlyOne, answerCorrect, reasoningSound, grounded: the mock judge approves
  if (t === 'number' || t === 'integer') return 1;
  // strings
  counter += 1;
  const words = {
    text: 'Mock coach: look at what each side of the blank can do on its own.',
    takeaway: 'Two complete sentences need a period, a semicolon, or a comma plus a conjunction.',
    why: 'Possibly you read the question quickly and missed a key word.',
    answer: 'B', A: `Mock choice alpha ${counter}`, B: `Mock choice bravo ${counter}`, C: `Mock choice charlie ${counter}`, D: `Mock choice delta ${counter}`,
    prompt: `Mock question ${counter} about ${salad(4)}: which choice completes the text most logically?`,
    passage: `Mock passage ${counter}. Researchers at the fictional Harlow Institute studied ${salad(30)} and reported a clear pattern.`,
    skillId: 'rw.sec.boundaries', alternative: null, judgeAnswer: 'B',
    independentWork: 'Both sides of the blank are complete sentences, so a comma alone is not enough; a comma plus "and" works.',
  };
  return words[key] ?? `Mock ${key || 'text'} ${counter}`;
}
createServer((req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (req.url === '/api/tags') return send(res, 200, { models: [
    { name: 'gemma4:e4b', size: 9_600_000_000, details: { parameter_size: '8B', quantization_level: 'Q4_K_M' } },
    { name: 'nomic-embed-text:latest', size: 270_000_000, details: {} },
  ] });
  if (req.url === '/api/chat' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const b = JSON.parse(body || '{}');
      const content = b.format ? JSON.stringify(fake(b.format)) : 'OK';
      setTimeout(() => send(res, 200, { model: b.model, message: { role: 'assistant', content }, done: true, eval_count: 42 }), 40);
    });
    return;
  }
  send(res, 404, { error: 'not found' });
}).listen(port, '127.0.0.1', () => console.log(`mock ollama on http://127.0.0.1:${port}`));
