import { useSyncExternalStore } from 'react';
import type { AppState } from './types';

// Tiny persisted store. Web build: localStorage (wrapped; falls back to memory).
// Desktop build: replace load/save with the SQLite repository behind the same API.
const KEY = 'open-sat-coach/state/v1';

export function emptyState(): AppState {
  return {
    schemaVersion: 1,
    profiles: [],
    activeProfileId: null,
    attempts: [],
    observations: [],
    missReasons: {},
    remembered: {},
    reviews: [],
    bluebook: [],
    formRoles: {},
    problemReports: [],
    settings: { theme: 'system', textScale: 1, showTimer: true, reduceMotion: false },
  };
}

function load(): AppState {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (raw) return { ...emptyState(), ...JSON.parse(raw) } as AppState;
  } catch { /* storage unavailable */ }
  return emptyState();
}

let state: AppState = load();
const listeners = new Set<() => void>();

// Desktop (Tauri): state lives in SQLite behind the `load_state` / `save_state` commands.
type Invoke = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
function desktopInvoke(): Invoke | null {
  const inv = (globalThis as any).__TAURI__?.core?.invoke;
  return typeof inv === 'function' ? inv : null;
}

/** Call once before rendering. On desktop, loads the SQLite copy (migrating a localStorage copy if present). */
export async function initStore(): Promise<void> {
  const invoke = desktopInvoke();
  if (!invoke) return;
  try {
    const raw = (await invoke('load_state')) as string | null;
    if (raw) state = { ...emptyState(), ...JSON.parse(raw) } as AppState;
    else if (state.profiles.length) await invoke('save_state', { json: JSON.stringify(stripSecrets(state)) });
  } catch (e) {
    console.error('Could not load saved data', e);
  }
}

function stripSecrets(s: AppState): AppState {
  if (!s.ai?.provider?.apiKey) return s;
  const { apiKey: _drop, ...provider } = s.ai.provider;
  return { ...s, ai: { ...s.ai, provider } };
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function persist() {
  const invoke = desktopInvoke();
  if (invoke) {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      invoke('save_state', { json: JSON.stringify(stripSecrets(state)) }).catch((e) => console.error('Save failed', e));
    }, 150);
    return;
  }
  try { globalThis.localStorage?.setItem(KEY, JSON.stringify(stripSecrets(state))); } catch { /* memory only */ }
}

export function getState(): AppState { return state; }

export function setState(update: (s: AppState) => AppState): void {
  state = update(state);
  persist();
  listeners.forEach((l) => l());
}

export function subscribe(l: () => void): () => void { listeners.add(l); return () => { listeners.delete(l); }; }

export function useAppState<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state));
}

export function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function activeProfile(s: AppState = state) {
  return s.profiles.find((p) => p.id === s.activeProfileId) ?? null;
}

export function resetForTests(next: AppState = emptyState()) { state = next; }
