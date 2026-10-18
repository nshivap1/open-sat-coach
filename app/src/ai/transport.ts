// Transport layer: loopback-only HTTP (Tauri command on desktop, fetch on web) and external links.

type TauriInvoke = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;

function tauriInvoke(): TauriInvoke | null {
  const t = (globalThis as { __TAURI__?: { core?: { invoke?: unknown } } }).__TAURI__;
  const fn = t?.core?.invoke;
  return typeof fn === 'function' ? (fn as TauriInvoke) : null;
}

export function isDesktop(): boolean {
  return tauriInvoke() !== null;
}

export async function invokeDesktop<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const inv = tauriInvoke();
  if (!inv) throw new Error('Desktop features are not available in the web build');
  return (await inv(cmd, args)) as T;
}

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export function isLoopbackUrl(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
  if (u.username || u.password) return false;
  return LOOPBACK_HOSTS.has(u.hostname.toLowerCase());
}

export async function localRequest(req: { method: 'GET' | 'POST'; url: string; headers?: Record<string, string>; body?: string; timeoutMs?: number }): Promise<{ status: number; body: string }> {
  if (!isLoopbackUrl(req.url)) throw new Error('Only local addresses are allowed');
  const timeoutMs = req.timeoutMs ?? 60_000;
  if (isDesktop()) {
    return invokeDesktop<{ status: number; body: string }>('http_local', {
      req: { method: req.method, url: req.url, headers: req.headers ?? {}, body: req.body, timeoutMs },
    });
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const origin = new URL(req.url).origin;
  try {
    let res: Response;
    try {
      res = await fetch(req.url, { method: req.method, headers: req.headers, body: req.body, signal: ctrl.signal });
    } catch (e) {
      if (ctrl.signal.aborted) throw new Error(`Timed out after ${Math.round(timeoutMs / 1000)} s waiting for ${origin}`);
      throw new Error(`Could not reach ${origin}`);
    }
    return { status: res.status, body: await res.text() };
  } finally {
    clearTimeout(timer);
  }
}

export async function openExternal(url: string): Promise<void> {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new Error('Invalid link');
  }
  if (u.protocol !== 'https:') throw new Error('Only https links can be opened');
  if (isDesktop()) {
    await invokeDesktop<void>('open_external', { url: u.toString() });
    return;
  }
  const w = (globalThis as { window?: { open?: (u: string, t: string, f: string) => unknown } }).window;
  w?.open?.(u.toString(), '_blank', 'noopener');
}
