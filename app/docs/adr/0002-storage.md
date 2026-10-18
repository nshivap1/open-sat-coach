# ADR 0002 — Storage: SQLite behind a document snapshot (M1), relational tables next

Status: accepted for M1 · Date: 2026-10-18

**Decision.** For M1, the app state is one JSON document. It lives in `coach.sqlite` (WAL, `user_version` migrations) in the OS app-data folder.
- Writes are transactional.
- An hourly backup row is kept, up to the latest 20 backups.
- The web build keeps localStorage.
- `store.ts` hides which backend is in use.

**Why.** It keeps M1 small: the UI ships unchanged on a durable, crash-safe store. The PRD's relational schema (§9: attempts, response events, grading revisions, exposure, evidence) arrives with official-form import (M2) and learning records (M4), migrating from this snapshot.

**Consequences.**
- Analytics are recomputed from the snapshot.
- Two app instances writing at once is not supported.
- The model's API token is stripped before every save.
