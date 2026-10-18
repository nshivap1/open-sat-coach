import { useState } from 'react';
import { createProfile } from '../../domain/actions';
import { proposeFormBudget } from '../../domain/formBudget';
import { setState } from '../../domain/store';
import type { ThemePref } from '../../domain/types';
import { ModelSetup } from '../ai/ModelSetup';

export function Onboarding({ onDone }: { onDone(): void }) {
  const [nickname, setNickname] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [goal, setGoal] = useState('');
  const [taken, setTaken] = useState<number[]>([]);
  const [theme, setTheme] = useState<ThemePref>('system');
  const [step, setStep] = useState<'profile' | 'ai'>('profile');
  const toggle = (n: number) => setTaken((t) => (t.includes(n) ? t.filter((x) => x !== n) : [...t, n]));
  const submit = (e: any) => {
    e.preventDefault();
    const g = Number(goal);
    createProfile({ nickname, targetDate: targetDate || undefined, scoreGoal: g >= 400 && g <= 1600 ? g : undefined }, proposeFormBudget(taken));
    setState((s) => ({ ...s, settings: { ...s.settings, theme } }));
    setStep('ai');
  };
  if (step === 'ai') {
    return (
      <section className="card stack onb ai-onb-step" aria-labelledby="onb-ai-h">
        <h1 id="onb-ai-h" style={{ margin: 0 }}>Optional: connect an AI coach</h1>
        <p className="muted" style={{ margin: 0 }}>A local AI model can explain questions another way. It runs on this computer, and you can skip this.</p>
        <ModelSetup variant="onboarding" onDone={onDone} />
      </section>
    );
  }
  return (
    <form className="card stack onb" onSubmit={submit}>
      <h1 style={{ margin: 0 }}>Welcome</h1>
      <p className="muted" style={{ margin: 0 }}>Everything stays on this device. No account, no email.</p>
      <label className="stack" style={{ gap: '.25rem' }}>Nickname<input className="input" required value={nickname} onChange={(e: any) => setNickname(e.target.value)} autoFocus /></label>
      <div className="row">
        <label className="stack" style={{ gap: '.25rem' }}>Test date (optional)<input className="input" type="date" value={targetDate} onChange={(e: any) => setTargetDate(e.target.value)} /></label>
        <label className="stack" style={{ gap: '.25rem' }}>Score goal (optional)<input className="input" type="number" min={400} max={1600} step={10} value={goal} onChange={(e: any) => setGoal(e.target.value)} /></label>
      </div>
      <fieldset className="onb-fs">
        <legend>Which official practice tests have you already taken in Bluebook?</legend>
        <p className="muted" style={{ marginTop: 0 }}>The paper practice tests 4–11 are the same tests as Bluebook's. We won't treat ones you've taken as fresh.</p>
        <div className="row">
          {[4, 5, 6, 7, 8, 9, 10, 11].map((n) => (
            <label key={n} className="onb-chip"><input type="checkbox" checked={taken.includes(n)} onChange={() => toggle(n)} /> Test {n}</label>
          ))}
        </div>
      </fieldset>
      <label className="stack" style={{ gap: '.25rem' }}>Theme
        <select className="input" value={theme} onChange={(e: any) => setTheme(e.target.value)}>
          <option value="system">Match system</option><option value="light">Light</option><option value="dark">Dark</option>
        </select>
      </label>
      <button className="btn btn-primary" type="submit">Get started</button>
    </form>
  );
}
