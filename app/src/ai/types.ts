// AI layer contract. The model is NOT bundled: the app connects to a local installation
// (Ollama, LM Studio, llama.cpp server, Jan, any OpenAI-compatible server on this machine)
// or runs a local .gguf file with llama-server (desktop only). Loopback addresses only — never the cloud.

export type ProviderKind = 'ollama' | 'openai_compat' | 'gguf_file';
export type ProviderSource = 'ollama' | 'lmstudio' | 'llamacpp' | 'jan' | 'custom' | 'app_llama';

export interface ProviderConfig {
  kind: ProviderKind;
  source: ProviderSource;
  label: string;            // e.g. 'Ollama · gemma4:e4b'
  baseUrl: string;          // loopback only, e.g. 'http://127.0.0.1:11434'; '' for gguf_file before start
  model: string;            // model id/tag as the server names it (gguf_file: file name)
  filePath?: string;        // gguf_file: absolute path on disk (desktop)
  apiKey?: string;          // per-launch token for the app-managed llama-server; never persisted
}

export interface DetectedServer {
  source: ProviderSource;
  baseUrl: string;
  reachable: boolean;
  error?: string;
}

export interface DetectedModel {
  provider: ProviderConfig;
  isGemma: boolean;
  sizeBytes?: number;
  details?: string;         // quantization / parameter size if the server reports it
}

export interface GgufFile { path: string; name: string; sizeBytes: number }

export interface DetectionReport {
  at: number;
  environment: 'desktop' | 'web';
  servers: DetectedServer[];
  models: DetectedModel[];  // from reachable servers + gguf files (desktop), Gemma first
  ggufFiles: GgufFile[];    // desktop only
  llamaServerPath?: string; // desktop only: binary able to run gguf files
}

export interface ChatMessage { role: 'system' | 'user' | 'assistant'; content: string }

export interface ChatOptions {
  jsonSchema?: Record<string, unknown>; // constrain output to this JSON schema when the server supports it
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface ChatResult { text: string; json?: unknown; ms: number; tokens?: number }

export interface PingResult { ok: boolean; ms: number; model?: string; error?: string }

export interface CoachReply {
  text: string;             // short explanation in plain language
  steps?: string[];
  takeaway?: string;
  ms: number;
  status: 'unverified';     // FR-09: AI explanations are provisional until a verification pipeline exists
}

export interface CoachTurn { role: 'student' | 'coach'; text: string }

export interface BenchmarkRow {
  itemId: string; skillId: string; expected: string; answer: string | null;
  correct: boolean; ms: number; predictedSkillId?: string; error?: string;
}

export interface BenchmarkSummary {
  at: number;
  providerLabel: string;
  items: number;
  answered: number;          // valid parsed answers
  correct: number;
  accuracy: number;          // correct / answered
  coverage: number;          // answered / items
  p50Ms: number;
  p95Ms: number;
  classifyAccuracy?: number; // predicted skill == item skill
  explanationPassRate?: number; // share of model explanations the judge passed (when judged)
  device?: string;
}

export interface BenchmarkResult extends BenchmarkSummary { rows: BenchmarkRow[] }

export interface DownloadOption {
  id: 'ollama' | 'lmstudio' | 'gguf';
  title: string;
  summary: string;
  url: string;               // https page opened in the system browser
  command?: string;          // e.g. 'ollama pull gemma4:e4b'
  steps: string[];
  sizeNote?: string;
}

// ---- Gemma inside the app (desktop): one-click download + bundled llama.cpp runtime ----
export interface GemmaFile {
  id: 'e2b' | 'e4b' | '12b';
  label: string;             // 'Gemma 4 E4B'
  fileName: string;          // 'gemma-4-E4B-it-Q4_0.gguf'
  url: string;               // https://huggingface.co/ggml-org/.../resolve/main/<fileName>
  sizeBytes: number;
  sha256: string;
  minMemoryGiB: number;      // recommended minimum RAM
  note: string;              // one line for the picker
}

export interface DownloadProgress {
  fileName: string;
  receivedBytes: number;
  totalBytes: number;
  bytesPerSec: number;
  stage: 'downloading' | 'verifying' | 'done' | 'error' | 'cancelled';
  error?: string;
}

// ---- Gemma features ----
export interface PastedQuestionReply {
  skillId: string | null;    // one of SKILLS ids, or null if unsure
  answer: string | null;     // the coach's proposed answer (letter or value), provisional
  text: string;              // short explanation
  steps: string[];
  check?: string;
  takeaway?: string;
  ms: number;
  status: 'unverified';
}

export interface MissSuggestion { reason: import('../domain/types').MissReason; why: string; ms: number }

export interface GenerationProgress {
  index: number;             // 1-based question being produced
  total: number;
  stage: 'writing' | 'checking' | 'accepted' | 'rejected';
  note?: string;
}

// ---- AI judge: a separate, skeptical pass that checks answers and reasoning before the student sees them ----
export interface JudgeVerdict {
  verdict: 'pass' | 'fail' | 'uncertain';
  answerCorrect: boolean | null;   // final answer matches the key (or, without a key, the judge's own independent answer); null if unknown
  reasoningSound: boolean;         // every step follows; no contradictions with the key
  grounded: boolean;               // R&W: claims supported by quoted passage text, no outside facts; Math: computations check out
  judgeAnswer: string | null;      // the judge's own answer, worked out before reading the explanation
  issues: string[];                // specific problems in plain language (empty on pass)
  judgeLabel: string;              // e.g. 'Gemma 4 12B · separate judge' or 'Same model · second pass'
  sameModel: boolean;              // true when the judge is the coach model (a critique, not independent proof)
  ms: number;
}

export interface JudgedReply<T> {
  reply: T;
  verdict: JudgeVerdict | null;    // null when the judge is turned off or could not run
  attempts: number;                // producer calls made (1 + repairs)
  repaired: boolean;               // the shown reply is a revision prompted by the judge
  judgeError?: string;             // the judge failed to run (the reply is shown as unchecked)
}

export interface JudgeSettings {
  enabled: boolean;                // default true when a model is connected
  autoRepair: boolean;             // default true: one revision when the judge fails a reply
  provider?: ProviderConfig;       // a different local model to judge with; undefined = same as the coach
}

export interface AiSettings {
  enabled: boolean;
  provider?: ProviderConfig;     // apiKey stripped before persisting
  lastDetection?: DetectionReport;
  lastBenchmark?: BenchmarkSummary;
  judge?: JudgeSettings;
}

// ---- Desktop (Tauri) command contract — implemented in src-tauri/src/lib.rs ----
// JS calls use camelCase argument names; Rust receives snake_case.
//   invoke('load_state') -> string | null
//   invoke('save_state', { json: string }) -> void
//   invoke('http_local', { req: { method, url, headers: Record<string,string>, body?: string, timeoutMs: number } })
//        -> { status: number, body: string }        (rejects non-loopback hosts)
//   invoke('scan_models') -> { ggufFiles: GgufFile[], llamaServerPath: string | null }
//   invoke('start_llama', { modelPath: string, ctxSize?: number }) -> { port: number, token: string, pid: number }
//   invoke('stop_llama') -> void
//   invoke('llama_status') -> { running: boolean, port: number | null, modelPath: string | null }
//   invoke('device_info') -> { os: string, arch: string, totalMemoryBytes: number | null, cpu: string | null }
//   invoke('open_external', { url: string }) -> void  (https only)
//   invoke('download_model', { url: string, fileName: string, sha256: string, sizeBytes: number }) -> { path: string }
//        only https://huggingface.co/... URLs; saves to <app data>/models/<fileName>; resumable (.part); verifies size + SHA-256;
//        emits Tauri event 'model-download' with DownloadProgress about twice a second
//   invoke('cancel_download') -> void
//   invoke('list_app_models') -> GgufFile[]           (files in <app data>/models)
//   invoke('delete_model', { fileName: string }) -> void
