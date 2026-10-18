# ADR 0003 — AI runtime: connect to a local installation, don't bundle the model

Status: accepted (owner decision D-14) · Date: 2026-10-18

**Decision.** The app detects and connects to models the student already runs locally. Onboarding links to Gemma downloads for students who have none.
- Supported sources:
  - Ollama (`:11434`)
  - LM Studio (`:1234`)
  - llama.cpp server (`:8080`)
  - Jan (`:1337`)
  - any OpenAI-compatible server at a loopback URL
  - a `.gguf` file, run by an app-managed `llama-server` on 127.0.0.1 with a random port and per-launch token
- Default recommendation by memory:
  - Gemma 4 E2B under 12 GiB
  - E4B under 24 GiB
  - 12B above that

**Why.**
- Gemma 4 E4B Q4_0 is 4.59 GB, over GitHub's 2 GiB per-file release limit.
- Many students already have Ollama or LM Studio, so they keep one copy of the weights.
- Testing and practice must work without AI anyway.

**Guardrails.**
- Loopback hosts only. The desktop app enforces this in Rust (`http_local`) and the client enforces it in TypeScript.
- AI output is labeled "not verified" and never changes keys or grades.
- The coach only answers about the current question, with at most 6 follow-ups.

**Consequences.**
- Quality varies with the student's model, so the in-app benchmark shows accuracy and latency for the connected model.
- A bundled-model edition stays possible later, hosted outside GitHub Releases.
