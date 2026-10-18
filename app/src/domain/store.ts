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

export function getState(): AppState { return state; }

export function setState(update: (s: AppState) => AppState): void {
  state = update(state);
  try { globalThis.localStorage?.setItem(KEY, JSON.stringify(state)); } catch { /* memory only */ }
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
