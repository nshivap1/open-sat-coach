# Open SAT Coach

An early web prototype of a local-first SAT study coach: test, diagnose, learn, practice, and reassess.

The current build includes original practice questions and lessons, timed diagnostics, deterministic grading, local profiles, a skill map, targeted practice, a Bluebook results log, and light/dark themes. It stores progress in browser localStorage; use Settings → Export to keep a backup.

**Status:** M0 prototype. Desktop packaging, local AI, official PDF import, SQLite persistence, and a graphing calculator are not implemented yet. Content has automated checks but has not been reviewed by a human teacher.

## Try the current build

Download [`app/dist/index.html`](app/dist/index.html) and open it in a browser. It is a self-contained build of the prototype.

## Develop

Requires Node.js and npm.

```sh
cd app
npm install
npm run build
npm test
npm run typecheck
```

See [the app README](app/README.md) for feature details and limitations.

## Project documents

- [Current product requirements](PRD.md)
- [Previous PRD](PRD.v1.0.md)
- [Source review and question-taxonomy examples](SOURCE_REVIEW.md)

The repository contains original prototype content and planning documents. Private teaching files and official test PDFs are not bundled.

SAT® is a trademark of the College Board, which is not affiliated with and does not endorse this project.
