// @ts-ignore node typings are not installed in the offline image
import { test } from 'node:test';
// @ts-ignore
import assert from 'node:assert/strict';
import { downloadGemma, cancelGemmaDownload, listAppModels, deleteAppModel } from './download';
import { GEMMA_FILES } from './catalog';
import type { DownloadProgress } from './types';

const g = globalThis as any;
const FILE = GEMMA_FILES[1];

function prog(fileName: string, receivedBytes: number, stage: DownloadProgress['stage'] = 'downloading'): DownloadProgress {
  return { fileName, receivedBytes, totalBytes: FILE.sizeBytes, bytesPerSec: 1000, stage };
}

/** Fake Tauri: invoke emits the given events to listeners, then resolves/rejects. */
function fakeTauri(opts: { events?: DownloadProgress[]; fail?: string; path?: string }) {
  const calls: { cmd: string; args?: any }[] = [];
  const listeners = new Map<string, ((e: { payload: unknown }) => void)[]>();
  let unlistened = 0;
  g.__TAURI__ = {
    core: {
      invoke: async (cmd: string, args?: any) => {
        calls.push({ cmd, args });
        if (cmd === 'download_model') {
          for (const p of opts.events ?? []) for (const h of listeners.get('model-download') ?? []) h({ payload: p });
          if (opts.fail) throw new Error(opts.fail);
          return { path: opts.path ?? `/models/${args.fileName}` };
        }
        if (cmd === 'list_app_models') return [{ path: '/models/a.gguf', name: 'a.gguf', sizeBytes: 1 }];
        return undefined;
      },
    },
    event: {
      listen: async (name: string, h: (e: { payload: unknown }) => void) => {
        listeners.set(name, [...(listeners.get(name) ?? []), h]);
        return () => {
          unlistened++;
          listeners.set(name, (listeners.get(name) ?? []).filter((x) => x !== h));
        };
      },
    },
  };
  return { calls, listeners, unlistened: () => unlistened };
}

test('downloadGemma forwards progress for its file, passes the contract args and returns the path', async () => {
  const t = fakeTauri({ events: [prog(FILE.fileName, 10), prog(FILE.fileName, FILE.sizeBytes, 'verifying'), prog(FILE.fileName, FILE.sizeBytes, 'done')], path: '/data/models/x.gguf' });
  const seen: DownloadProgress[] = [];
  const path = await downloadGemma(FILE, (p) => seen.push(p));
  assert.equal(path, '/data/models/x.gguf');
  assert.deepEqual(seen.map((p) => p.stage), ['downloading', 'verifying', 'done']);
  const call = t.calls.find((c) => c.cmd === 'download_model')!;
  assert.deepEqual(call.args, { url: FILE.url, fileName: FILE.fileName, sha256: FILE.sha256, sizeBytes: FILE.sizeBytes });
});

test('downloadGemma ignores progress events for other files', async () => {
  fakeTauri({ events: [prog('other.gguf', 5), prog(FILE.fileName, 7), prog('gemma-4-12B-it-Q4_0.gguf', 9)] });
  const seen: DownloadProgress[] = [];
  await downloadGemma(FILE, (p) => seen.push(p));
  assert.deepEqual(seen.map((p) => [p.fileName, p.receivedBytes]), [[FILE.fileName, 7]]);
});

test('downloadGemma unlistens after success', async () => {
  const t = fakeTauri({ events: [prog(FILE.fileName, 1)] });
  await downloadGemma(FILE, () => {});
  assert.equal(t.unlistened(), 1);
  assert.equal(t.listeners.get('model-download')!.length, 0);
});

test('downloadGemma unlistens and rethrows on error', async () => {
  const t = fakeTauri({ events: [prog(FILE.fileName, 1)], fail: 'SHA-256 mismatch' });
  await assert.rejects(downloadGemma(FILE, () => {}), /SHA-256 mismatch/);
  assert.equal(t.unlistened(), 1);
  assert.equal(t.listeners.get('model-download')!.length, 0);
});

test('downloadGemma keeps going when the progress callback throws', async () => {
  fakeTauri({ events: [prog(FILE.fileName, 1)] });
  assert.equal(await downloadGemma(FILE, () => { throw new Error('ui'); }), `/models/${FILE.fileName}`);
});

test('cancel, list and delete call the desktop commands', async () => {
  const t = fakeTauri({});
  await cancelGemmaDownload();
  assert.deepEqual(await listAppModels(), [{ path: '/models/a.gguf', name: 'a.gguf', sizeBytes: 1 }]);
  await deleteAppModel('a.gguf');
  assert.deepEqual(t.calls.map((c) => [c.cmd, c.args]), [['cancel_download', undefined], ['list_app_models', undefined], ['delete_model', { fileName: 'a.gguf' }]]);
});

test('web build: downloadGemma throws a clear error and desktop commands reject', async () => {
  delete g.__TAURI__;
  await assert.rejects(downloadGemma(FILE, () => {}), /Downloading Gemma needs the desktop app/);
  await assert.rejects(listAppModels(), /not available in the web build/);
});
