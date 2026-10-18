import { useAppState } from '../../domain/store';
import { TESTS, TEST_BY_ID } from '../../content';
import { FormBudget } from './FormBudget';
import { BluebookLog } from './BluebookLog';
// @ts-ignore -- CSS side-effect import; no '*.css' module shim yet (esbuild bundles it)
import './tests.css';

const PAPER_TESTS_URL = 'https://satsuite.collegeboard.org/practice/practice-tests/paper';

export interface TestsPageProps {
  onStartTest(testId: string): void;
  onResume(attemptId: string): void;
}

function minutes(sec: number): number { return Math.round(sec / 60); }

export function TestsPage({ onStartTest, onResume }: TestsPageProps) {
  const profileId = useAppState((s) => s.activeProfileId);
  const profiles = useAppState((s) => s.profiles);
  const attempts = useAppState((s) => s.attempts);
  const profile = profiles.find((p) => p.id === profileId) ?? null;

  if (!profile) {
    return (
      <main className="th-page">
        <h1>Tests</h1>
        <p className="muted th-empty">Create or choose a profile to see your tests.</p>
      </main>
    );
  }

  const inProgress = attempts
    .filter((a) => a.profileId === profile.id && a.mode !== 'practice' && (a.status === 'in_progress' || a.status === 'on_break'))
    .sort((a, b) => b.createdAt - a.createdAt);

  return (
    <main className="th-page">
      <h1>Tests</h1>

      {inProgress.length > 0 && (
        <section aria-labelledby="th-continue-h" className="th-section">
          <h2 id="th-continue-h">Continue</h2>
          <ul className="th-list">
            {inProgress.map((a) => {
              const title = a.testSnapshot?.title ?? TEST_BY_ID[a.testId]?.title ?? 'Test';
              return (
                <li key={a.id} className="card th-continue">
                  <div>
                    <strong>{title}</strong>
                    <div className="muted">
                      Started {new Date(a.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                      {a.status === 'on_break' ? ' · on break' : ''}
                    </div>
                  </div>
                  <button type="button" className="btn btn-primary" onClick={() => onResume(a.id)} aria-label={`Resume ${title}`}>Resume</button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section aria-labelledby="th-orig-h" className="th-section">
        <h2 id="th-orig-h">Original tests</h2>
        <div className="th-cards">
          {TESTS.map((t) => {
            const items = t.modules.reduce((n, m) => n + m.itemIds.length, 0);
            const timed = t.modules.every((m) => m.durationSec !== null);
            const sec = t.modules.reduce((n, m) => n + (m.durationSec ?? 0), 0);
            return (
              <article key={t.id} className="card th-test">
                <h3>{t.title}</h3>
                <span className="badge">{t.label}</span>
                <p>{t.description}</p>
                <p className="muted th-meta">
                  {items} questions · {timed ? `${minutes(sec)} minutes` : sec > 0 ? `about ${minutes(sec)} minutes timed, some parts untimed` : 'untimed'}
                </p>
                <div>
                  <button type="button" className="btn btn-primary" onClick={() => onStartTest(t.id)} aria-label={`Start ${t.title}`}>Start</button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="th-official-h" className="th-section">
        <h2 id="th-official-h">Official practice tests</h2>
        <div className="card th-explain">
          <p>
            College Board's free paper practice tests 4–11 are the same tests as Bluebook practice tests 4–11. The paper
            versions are nonadaptive, so scores from them are shown as ranges, while Bluebook gives an official adaptive
            practice score. Importing the College Board ZIP files happens in the desktop app; it is not available in this web build.
          </p>
          <a className="btn" href={PAPER_TESTS_URL} target="_blank" rel="noopener noreferrer">Get the free official tests</a>
        </div>
        <FormBudget />
        <BluebookLog />
      </section>
    </main>
  );
}

export default TestsPage;
