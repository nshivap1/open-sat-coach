import type { ChatMessage, ChatOptions, ChatResult, PingResult, ProviderConfig } from './types';
import { invokeDesktop, localRequest } from './transport';

const DEFAULT_CHAT_TIMEOUT_MS = 120_000;

// Per-launch token for the app-managed llama-server. Memory only — never persisted.
let llamaSession: { modelPath: string; port: number; token: string } | null = null;

/** Starts the app-managed llama-server for gguf_file providers (desktop) and returns a ready openai_compat config. */
export async function ensureRunning(p: ProviderConfig): Promise<ProviderConfig> {
  if (p.kind !== 'gguf_file') return p;
  if (!p.filePath) throw new Error('This model file has no path on disk');
  const toConfig = (port: number, token: string): ProviderConfig => ({
    kind: 'openai_compat',
    source: 'app_llama',
    baseUrl: `http://127.0.0.1:${port}`,
    model: p.model,
    apiKey: token,
    label: p.label,
    filePath: p.filePath,
  });
  const status = await invokeDesktop<{ running: boolean; port: number | null; modelPath: string | null }>('llama_status');
  if (status?.running && status.modelPath === p.filePath && llamaSession && llamaSession.modelPath === p.filePath && llamaSession.token) {
    return toConfig(status.port ?? llamaSession.port, llamaSession.token);
  }
  const started = await invokeDesktop<{ port: number; token: string; pid: number }>('start_llama', { modelPath: p.filePath });
  llamaSession = { modelPath: p.filePath, port: started.port, token: started.token };
  return toConfig(started.port, started.token);
}

function excerpt(body: string, max = 200): string {
  let msg = body;
  try {
    const j = JSON.parse(body) as { error?: unknown; message?: unknown };
    const e = j?.error;
    if (typeof e === 'string') msg = e;
    else if (e && typeof (e as { message?: unknown }).message === 'string') msg = (e as { message: string }).message;
    else if (typeof j?.message === 'string') msg = j.message;
  } catch {
    /* not JSON */
  }
  msg = msg.replace(/\s+/g, ' ').trim();
  return msg.length > max ? `${msg.slice(0, max)}…` : msg;
}

/** Robust JSON extraction: strips ``` fences, then tries the whole text, then the first balanced {...} block. */
function parseJsonLoose(text: string): unknown {
  let s = text.trim();
  const fence = /```(?:json|JSON)?\s*([\s\S]*?)```/.exec(s);
  if (fence) s = fence[1].trim();
  try {
    return JSON.parse(s);
  } catch {
    /* fall through */
  }
  const start = s.indexOf('{');
  if (start < 0) return undefined;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(s.slice(start, i + 1));
        } catch {
          return undefined;
        }
      }
    }
  }
  return undefined;
}

function abortError(): Error {
  const e = new Error('Cancelled');
  e.name = 'AbortError';
  return e;
}

function withSignal<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(abortError());
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(abortError());
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (v) => { signal.removeEventListener('abort', onAbort); resolve(v); },
      (e) => { signal.removeEventListener('abort', onAbort); reject(e); },
    );
  });
}

async function post(url: string, payload: unknown, headers: Record<string, string>, timeoutMs: number, signal?: AbortSignal) {
  return withSignal(
    localRequest({ method: 'POST', url, headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(payload), timeoutMs }),
    signal,
  );
}

function parseBody(body: string): Record<string, unknown> {
  try {
    return JSON.parse(body) as Record<string, unknown>;
  } catch {
    throw new Error(`The model server sent a response that is not JSON: ${excerpt(body, 120)}`);
  }
}

function withSchemaInstruction(messages: ChatMessage[], schema: Record<string, unknown>): ChatMessage[] {
  const note = `Respond with only a JSON object matching this schema: ${JSON.stringify(schema)}`;
  const out = messages.map((m) => ({ ...m }));
  for (let i = out.length - 1; i >= 0; i--) {
    if (out[i].role === 'user') {
      out[i].content = `${out[i].content}\n\n${note}`;
      return out;
    }
  }
  out.push({ role: 'user', content: note });
  return out;
}

export async function chat(p: ProviderConfig, messages: ChatMessage[], opts: ChatOptions = {}): Promise<ChatResult> {
  const provider = await withSignal(ensureRunning(p), opts.signal);
  const base = provider.baseUrl.replace(/\/+$/, '');
  const timeoutMs = opts.timeoutMs ?? DEFAULT_CHAT_TIMEOUT_MS;
  const t0 = performance.now();
  let text = '';
  let tokens: number | undefined;

  if (provider.kind === 'ollama') {
    const payload = {
      model: provider.model,
      messages,
      stream: false,
      format: opts.jsonSchema,
      options: { temperature: opts.temperature, num_predict: opts.maxTokens },
    };
    const res = await post(`${base}/api/chat`, payload, {}, timeoutMs, opts.signal);
    if (res.status < 200 || res.status >= 300) throw new Error(`Model server error ${res.status}: ${excerpt(res.body)}`);
    const j = parseBody(res.body) as { message?: { content?: unknown }; eval_count?: unknown };
    text = typeof j.message?.content === 'string' ? j.message.content : '';
    if (typeof j.eval_count === 'number') tokens = j.eval_count;
  } else {
    const headers: Record<string, string> = {};
    if (provider.apiKey) headers.Authorization = `Bearer ${provider.apiKey}`;
    const url = `${base}/v1/chat/completions`;
    const make = (msgs: ChatMessage[], useFormat: boolean) => ({
      model: provider.model,
      messages: msgs,
      temperature: opts.temperature,
      max_tokens: opts.maxTokens,
      response_format: useFormat && opts.jsonSchema
        ? { type: 'json_schema', json_schema: { name: 'response', strict: true, schema: opts.jsonSchema } }
        : undefined,
    });
    let res = await post(url, make(messages, true), headers, timeoutMs, opts.signal);
    if (opts.jsonSchema && res.status >= 400 && res.status < 500 && res.status !== 401 && res.status !== 403) {
      // Server rejected structured output: retry once with the schema as a plain instruction.
      res = await post(url, make(withSchemaInstruction(messages, opts.jsonSchema), false), headers, timeoutMs, opts.signal);
    }
    if (res.status < 200 || res.status >= 300) throw new Error(`Model server error ${res.status}: ${excerpt(res.body)}`);
    const j = parseBody(res.body) as { choices?: { message?: { content?: unknown } }[]; usage?: { completion_tokens?: unknown } };
    const content = j.choices?.[0]?.message?.content;
    text = typeof content === 'string' ? content : '';
    if (typeof j.usage?.completion_tokens === 'number') tokens = j.usage.completion_tokens;
  }

  const result: ChatResult = { text, ms: Math.round(performance.now() - t0) };
  if (tokens !== undefined) result.tokens = tokens;
  if (opts.jsonSchema) {
    const json = parseJsonLoose(text);
    if (json !== undefined) result.json = json;
  }
  return result;
}

export async function ping(p: ProviderConfig): Promise<PingResult> {
  const t0 = performance.now();
  try {
    const r = await chat(p, [{ role: 'user', content: 'Reply with the word OK.' }], { maxTokens: 8, temperature: 0 });
    return { ok: true, ms: r.ms, model: p.model };
  } catch (e) {
    return { ok: false, ms: Math.round(performance.now() - t0), error: e instanceof Error ? e.message : String(e) };
  }
}
