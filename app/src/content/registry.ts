// Runtime item registry: adds Gemma-written items (FR-10) to the shared ITEMS / ITEM_BY_ID so
// sessions, grading and review can find them. Mutates in place so existing imports see them.
import type { Item } from '../domain/types';
import { ITEMS, ITEM_BY_ID } from './index';
import { setState } from '../domain/store';

export const MAX_GENERATED_ITEMS = 300;

/** Idempotent by id. Never replaces an existing item (a generated item can't shadow a curated one). */
export function registerItems(items: Item[]): number {
  let added = 0;
  for (const it of items) {
    if (!it || typeof it.id !== 'string' || !it.id || ITEM_BY_ID[it.id]) continue;
    ITEMS.push(it);
    ITEM_BY_ID[it.id] = it;
    added++;
  }
  return added;
}

/** Registers generated items persisted in app state. Only items marked origin 'generated' are accepted. */
export function loadGeneratedFromState(items?: Item[]): number {
  return registerItems((items ?? []).filter((i) => i && i.origin === 'generated' && i.response?.kind === 'mcq'));
}

/** Persists accepted generated items (cap 300, oldest dropped unless an unfinished attempt uses them) and registers them. */
export function saveGenerated(items: Item[]): void {
  const fresh = items.filter((i) => i && i.origin === 'generated');
  if (!fresh.length) return;
  registerItems(fresh);
  setState((s) => {
    const existing = s.generatedItems ?? [];
    const have = new Set(existing.map((i) => i.id));
    let merged = [...existing, ...fresh.filter((i) => !have.has(i.id))];
    if (merged.length > MAX_GENERATED_ITEMS) {
      const inUse = new Set<string>();
      for (const a of s.attempts) if (a.status !== 'completed') for (const m of a.testSnapshot.modules) for (const id of m.itemIds) inUse.add(id);
      let drop = merged.length - MAX_GENERATED_ITEMS;
      merged = merged.filter((i) => (drop > 0 && !inUse.has(i.id) ? (drop--, false) : true));
    }
    return { ...s, generatedItems: merged };
  });
}
