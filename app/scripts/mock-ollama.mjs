// Minimal stand-in for a local Ollama server (127.0.0.1:11434) used by automated tests.
// Answers /api/tags and /api/chat with schema-shaped JSON. Not a model.
import { createServer } from 'node:http';
const port = Number(process.env.PORT || 11434);
const send = (res, status, obj) => {
  res.writeHead(status, { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS' });
  res.end(JSON.stringify(obj));
};
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
      const props = b.format?.properties ?? {};
      let content = 'OK';
      if (props.answer?.enum) content = JSON.stringify({ answer: props.answer.enum[1] });
      else if (props.answer) content = JSON.stringify({ answer: '3' });
      else if (props.skillId?.enum) content = JSON.stringify({ skillId: props.skillId.enum[0] });
      else if (props.text) content = JSON.stringify({ text: 'Mock coach: look at what each side of the blank can do on its own.', steps: ['Find the subject and verb on each side.', 'Pick punctuation that can join two complete sentences.'], takeaway: 'Two complete sentences need a period, a semicolon, or a comma plus a conjunction.' });
      setTimeout(() => send(res, 200, { model: b.model, message: { role: 'assistant', content }, done: true, eval_count: 42 }), 60);
    });
    return;
  }
  send(res, 404, { error: 'not found' });
}).listen(port, '127.0.0.1', () => console.log(`mock ollama on http://127.0.0.1:${port}`));
