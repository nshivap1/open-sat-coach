import { useEffect, useMemo, useState } from 'react';
import { useAppState, activeProfile } from './domain/store';
import { startTest, resume, saveAttempt, gradedFor, setMissReason } from './domain/actions';
import { Home } from './features/home/Home';
import { PracticePage } from './features/practice/PracticePage';
import { TestsPage } from './features/tests/TestsPage';
import { ProgressPage } from './features/progress/ProgressPage';
import { Settings } from './features/settings/Settings';
import { Onboarding } from './features/onboarding/Onboarding';
import { TestRunner } from './features/test/TestRunner';
import { Results } from './features/test/Results';
import './app.css';

type View =
  | { name: 'home' } | { name: 'practice'; skillId?: string; key: number } | { name: 'tests' } | { name: 'progress' }
  | { name: 'settings' } | { name: 'onboarding' } | { name: 'test'; attemptId: string } | { name: 'results'; attemptId: string };

const NAV: { name: 'home' | 'practice' | 'tests' | 'progress'; label: string }[] = [
  { name: 'home', label: 'Home' }, { name: 'practice', label: 'Practice' }, { name: 'tests', label: 'Tests' }, { name: 'progress', label: 'Progress' },
];

function useTheme() {
  const settings = useAppState((s) => s.settings);
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'system') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', settings.theme);
    root.style.setProperty('--text-scale', String(settings.textScale || 1));
  }, [settings.theme, settings.textScale]);
}

export function App() {
  useTheme();
  const profile = useAppState((s) => activeProfile(s));
  const [view, setView] = useState<View>({ name: 'home' });
  const go = (name: 'home' | 'practice' | 'tests' | 'progress') => setView(name === 'practice' ? { name, key: Date.now() } : ({ name } as View));
  const practice = (skillId: string) => setView({ name: 'practice', skillId, key: Date.now() });
  const openTest = (testId: string) => { const id = startTest(testId); if (id) setView({ name: 'test', attemptId: id }); };
  const openResume = (attemptId: string) => { const a = resume(attemptId); if (!a) return; setView(a.status === 'completed' ? { name: 'results', attemptId } : { name: 'test', attemptId }); };

  if (!profile || view.name === 'onboarding') {
    return <main className="app-onboarding"><Onboarding onDone={() => setView({ name: 'home' })} /></main>;
  }
  if (view.name === 'test') {
    return <TestScreen attemptId={view.attemptId} onCompleted={() => setView({ name: 'results', attemptId: view.attemptId })} onExit={() => setView({ name: 'tests' })} />;
  }

  return (
    <div className="app">
      <header className="app-header">
        <a className="app-brand" href="#" onClick={(e: any) => { e.preventDefault(); go('home'); }}>Open SAT Coach</a>
        <nav aria-label="Main">
          {NAV.map((n) => (
            <button key={n.name} className={`app-nav ${view.name === n.name ? 'active' : ''}`} aria-current={view.name === n.name ? 'page' : undefined} onClick={() => go(n.name)}>{n.label}</button>
          ))}
        </nav>
        <span style={{ flex: 1 }} />
        <button className={`app-nav ${view.name === 'settings' ? 'active' : ''}`} onClick={() => setView({ name: 'settings' })} aria-label={`Settings — profile ${profile.nickname}`}>⚙ {profile.nickname}</button>
      </header>
      <main className="app-main">
        {view.name === 'home' && <Home onPractice={practice} onStartTest={openTest} onResume={openResume} onGo={go} />}
        {view.name === 'practice' && <PracticePage key={view.key} initialSkillId={view.skillId} onOpenProgress={() => go('progress')} />}
        {view.name === 'tests' && <TestsPage onStartTest={openTest} onResume={openResume} />}
        {view.name === 'progress' && <ProgressPage onPractice={practice} />}
        {view.name === 'settings' && <Settings onAddProfile={() => setView({ name: 'onboarding' })} />}
        {view.name === 'results' && <ResultsScreen attemptId={view.attemptId} onPractice={practice} onDone={() => go('progress')} />}
      </main>
      <footer className="app-footer muted">Offline web build · data stays in this browser · SAT® is a trademark of the College Board, which is not affiliated with this app.</footer>
    </div>
  );
}

function TestScreen({ attemptId, onCompleted, onExit }: { attemptId: string; onCompleted(): void; onExit(): void }) {
  const attempt = useAppState((s) => s.attempts.find((a) => a.id === attemptId));
  useEffect(() => { if (attempt?.status === 'completed') onCompleted(); }, [attempt?.status]);
  if (!attempt) return <p>Attempt not found.</p>;
  return <div className="app-test"><TestRunner attempt={attempt} onChange={(next) => saveAttempt(next)} onExit={onExit} /></div>;
}

function ResultsScreen({ attemptId, onPractice, onDone }: { attemptId: string; onPractice(skillId: string): void; onDone(): void }) {
  const attempt = useAppState((s) => s.attempts.find((a) => a.id === attemptId));
  const missReasons = useAppState((s) => s.missReasons);
  const graded = useMemo(() => (attempt ? gradedFor(attempt) : []), [attempt]);
  if (!attempt) return <p>Attempt not found.</p>;
  const reasons: Record<string, any> = {};
  for (const [k, v] of Object.entries(missReasons)) { const [aid, iid] = k.split(':'); if (aid === attemptId) reasons[iid] = v; }
  return <Results attempt={attempt} graded={graded} missReasons={reasons} onSetMissReason={(itemId, r) => setMissReason(attemptId, itemId, r)} onPracticeSkill={onPractice} onDone={onDone} />;
}
