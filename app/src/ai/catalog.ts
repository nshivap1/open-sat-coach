import type { DownloadOption } from './types';

export const GEMMA_DOWNLOADS: DownloadOption[] = [
  {
    id: 'ollama',
    title: 'Ollama (easiest)',
    summary: 'A free app that downloads and runs Gemma 4 on this computer with one command.',
    url: 'https://ollama.com/download',
    command: 'ollama pull gemma4:e4b',
    steps: [
      'Install Ollama 0.22 or newer.',
      'Open Terminal and run the command: ollama pull gemma4:e4b',
      'Come back here and press "Check again".',
    ],
    sizeNote: 'About 5 GB of memory while running',
  },
  {
    id: 'lmstudio',
    title: 'LM Studio',
    summary: 'A free desktop app with a model browser and a built-in local server.',
    url: 'https://lmstudio.ai',
    steps: [
      'Install LM Studio.',
      'Search for "gemma-4-E4B" and download it.',
      'In the Developer tab, start the local server (port 1234).',
      'Web build only: turn on CORS in the server settings.',
    ],
  },
  {
    id: 'gguf',
    title: 'Model file (.gguf)',
    summary: 'Download the model file yourself; the desktop app runs it with llama.cpp.',
    url: 'https://huggingface.co/ggml-org/gemma-4-E4B-it-GGUF',
    steps: [
      'Download the Q4_0 .gguf file.',
      'Keep it in Downloads or a "models" folder in your home folder.',
      'The desktop app finds it and runs it with llama.cpp (macOS: brew install llama.cpp).',
    ],
    sizeNote: 'Q4_0 file · 4.59 GB',
  },
];

const GIB = 1024 ** 3;

/** Recommended Gemma 4 variant for the machine's memory (bytes); null if unknown. */
export function recommendedVariant(totalMemoryBytes: number | null): { ollamaTag: string; label: string; why: string } {
  if (totalMemoryBytes == null || !Number.isFinite(totalMemoryBytes) || totalMemoryBytes <= 0) {
    return { ollamaTag: 'gemma4:e4b', label: 'Gemma 4 E4B', why: 'We could not read this computer\'s memory, so we suggest the standard model (about 5 GB while running).' };
  }
  const gb = Math.round(totalMemoryBytes / GIB);
  if (totalMemoryBytes < 12 * GIB) {
    return { ollamaTag: 'gemma4:e2b', label: 'Gemma 4 E2B — lighter, for 8 GB machines', why: `This computer has about ${gb} GB of memory, so the lighter model will run more smoothly.` };
  }
  if (totalMemoryBytes < 24 * GIB) {
    return { ollamaTag: 'gemma4:e4b', label: 'Gemma 4 E4B', why: `This computer has about ${gb} GB of memory — enough for the standard model (about 5 GB while running).` };
  }
  return { ollamaTag: 'gemma4:12b', label: 'Gemma 4 12B — better quality if you have the memory', why: `This computer has about ${gb} GB of memory, so it can run the larger, higher-quality model.` };
}
