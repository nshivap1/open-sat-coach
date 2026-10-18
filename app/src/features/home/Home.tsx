import { useMemo } from 'react';
import { useAppState, activeProfile } from '../../domain/store';
import { computeSkillEvidence } from '../../domain/evidence';
import { rankSkills } from '../../domain/recommend';
import { SKILL_BY_ID, TESTS } from '../../content';

export function Home({ onPractice, onStartTest, onResume, onGo }: { onPractice(skillId: string): void; onStartTest(testId: string): void; onResume(attemptId: string): void; onGo(view: 'practice' | 'tests' | 'progress'): void }) {
  const s = useAppState((x) => x);
  const profile = activeProfile(s);
  const now = Date.now();
  const evidence = useMemo(() => (profile ? computeSkillEvidence(s.observations, profile.id, s.reviews, now) : {}), [s.observations, s.reviews, profile?.id]);
  const recs = useMemo(() => rankSkills(evidence, profile?.focusSkillIds ?? [], now), [evidence]);
  if (!profile) return null;
  const mine = s.observations.filter((o) => o.profileId === profile.id);
  const inProgress = s.attempts.filter((a) => a.profileId === profile.id && a.status !== 'completed' && a.mode !== 'practice');
  const nextReview = s.reviews.filter((r) => r.profileId === profile.id).sort((a, b) => a.dueAt - b.dueAt)[0];
  const top = recs.find((r) => r.kind === 'practice');
  const diag = TESTS[0];
  const daysToTest = profile.targetDate ? Math.ceil((new Date(profile.targetDate + 'T00:00:00').getTime() - now) / 86400000) : null;
  const tookDiagnostic = s.attempts.some((a) => a.profileId === profile.id && a.testId === diag.id && a.status === 'completed');

  return (
    <div className="stack">
      <div>
        <h1 style={{ marginBottom: '.25rem' }}>Hi, {profile.nickname}</h1>
        <p className="muted" style={{ marginTop: 0 }}>
          {daysToTest !== null && daysToTest >= 0 ? `${daysToTest} days until your test date. ` : ''}
          {nextReview ? `Next review: ${SKILL_BY_ID[nextReview.skillId]?.studentName} on ${new Date(nextReview.dueAt).toLocaleDateString()}.` : ''}
        </p>
      </div>

      {inProgress.map((a) => (
        <div key={a.id} className="card row" style={{ justifyContent: 'space-between' }}>
          <div><strong>Continue: {a.testSnapshot.title}</strong><div className="muted">Timed modules keep running while the app is closed.</div></div>
          <button className="btn btn-primary" onClick={() => onResume(a.id)}>Resume</button>
        </div>
      ))}

      <div className="card stack home-rec">
        <span className="badge" style={{ alignSelf: 'flex-start' }}>Recommended next</span>
        {!tookDiagnostic && mine.length === 0 ? (
          <>
            <h2 style={{ margin: 0 }}>Take the quick diagnostic</h2>
            <p>{diag.description}</p>
            <div className="row"><button className="btn btn-primary" onClick={() => onStartTest(diag.id)}>Start diagnostic</button><button className="btn" onClick={() => onGo('practice')}>Or pick a skill</button></div>
          </>
        ) : top ? (
          <>
            <h2 style={{ margin: 0 }}>Practice {SKILL_BY_ID[top.skillId]?.studentName}</h2>
            <p>{top.reason}</p>
            <div className="row"><button className="btn btn-primary" onClick={() => onPractice(top.skillId)}>Start 10-minute session</button><button className="btn" onClick={() => onGo('progress')}>Open skill map</button></div>
          </>
        ) : recs[0] ? (
          <>
            <h2 style={{ margin: 0 }}>Check {SKILL_BY_ID[recs[0].skillId]?.studentName}</h2>
            <p>{recs[0].reason}</p>
            <div className="row"><button className="btn btn-primary" onClick={() => onPractice(recs[0].skillId)}>Start session</button><button className="btn" onClick={() => onGo('progress')}>Open skill map</button></div>
          </>
        ) : null}
      </div>

      {recs.length > 1 ? (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Also worth your time</h3>
          <ul className="home-list">
            {recs.slice(1, 4).map((r) => (
              <li key={r.skillId} className="row" style={{ justifyContent: 'space-between' }}>
                <span><strong>{SKILL_BY_ID[r.skillId]?.studentName}</strong> <span className="muted">— {r.reason}</span></span>
                <button className="btn" onClick={() => onPractice(r.skillId)}>Practice</button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
