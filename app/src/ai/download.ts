// One-click Gemma download for the desktop app. The Rust side (download_model) streams the file from
// Hugging Face into <app data>/models, resumes from a .part file, verifies size + SHA-256 and emits
// 'model-download' progress events. Signatures are part of the contract.
import type { DownloadProgress, GemmaFile, GgufFile } from './types';
import { invokeDesktop, isDesktop } from './transport';

type Unlisten = () => void;
type TauriListen = (event: string, handler: (e: { payload: unknown }) => void) => Promise<Unlisten>;

function tauriListen(): TauriListen | null {
  const t = (globalThis as { __TAURI__?: { event?: { listen?: unknown } } }).__TAURI__;
  const fn = t?.event?.listen;
  return typeof fn === 'function' ? (fn as TauriListen) : null;
}

/** Desktop only. Downloads (or resumes) the Gemma file into the app's models folder; resolves to the absolute path. */
export async function downloadGemma(file: GemmaFile, onProgress: (p: DownloadProgress) => void): Promise<string> {
  if (!isDesktop()) throw new Error('Downloading Gemma needs the desktop app');
  const listen = tauriListen();
  let unlisten: Unlisten | null = null;
  if (listen) {
    unlisten = await listen('model-download', (e) => {
      const p = e?.payload as DownloadProgress | undefined;
      if (!p || p.fileName !== file.fileName) return;
      try { onProgress(p); } catch { /* a UI error must not break the download */ }
    });
  }
  try {
    const res = await invokeDesktop<{ path: string }>('download_model', {
      url: file.url, fileName: file.fileName, sha256: file.sha256, sizeBytes: file.sizeBytes,
    });
    if (!res || typeof res.path !== 'string' || !res.path) throw new Error('The download finished but the app did not report where the file was saved');
    return res.path;
  } finally {
    try { unlisten?.(); } catch { /* already gone */ }
  }
}

export async function cancelGemmaDownload(): Promise<void> {
  await invokeDesktop<void>('cancel_download');
}

export async function listAppModels(): Promise<GgufFile[]> {
  const list = await invokeDesktop<GgufFile[] | null>('list_app_models');
  return Array.isArray(list) ? list : [];
}

export async function deleteAppModel(fileName: string): Promise<void> {
  await invokeDesktop<void>('delete_model', { fileName });
}
