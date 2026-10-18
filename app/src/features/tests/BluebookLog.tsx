import { useId, useState } from 'react';
import type { BluebookResult } from '../../domain/types';
import { setState, uid, useAppState } from '../../domain/store';
import { DOMAINS, OFFICIAL_FORMS } from '../../content';
// @ts-ignore -- CSS side-effect import; no '*.css' module shim yet (esbuild bundles it)
import './tests.css';

type Band = { filled: string; total: string };
type Errors = Partial<Record<string, string>>;

const blankBands = (): Record<string, Band> => Object.fromEntries(DOMAINS.map((d) => [d.id, { filled: '', total: '7' }]));

function intOrNull(v: string): number | null | 'bad' {
  const t = v.trim();
  if (t === '') return null;
  if (!/^\d+$/.test(t)) return 'bad';
  return Number(t);
}

function checkScore(v: string, min: number, max: number, name: string, errors: Errors, key: string): number | undefined {
  const n = intOrNull(v);
  if (n === null) return undefined;
  if (n === 'bad' || n < min || n > max) { errors[key] = `${name} must be a whole number from ${min} to ${max}.`; return undefined; }
  if (n % 10 !== 0) { errors[key] = `${name} scores go up in steps of 10.`; return undefined; }
  return n;
}

export function BluebookLog() {
  const baseId = useId();
  const profileId = useAppState((s) => s.activeProfileId);
  const profiles = useAppState((s) => s.profiles);
  const bluebook = useAppState((s) => s.bluebook);
  const profile = profiles.find((p) => p.id === profileId) ?? null;

  const [testNumber, setTestNumber] = useState('');
  const [date, setDate] = useState('');
  const [total, setTotal] = useState('');
  const [rw, setRw] = useState('');
  const [math, setMath] = useState('');
  const [showBands, setShowBands] = useState(false);
  const [bands, setBands] = useState<Record<string, Band>>(blankBands);
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState('');

  if (!profile) return <p className="muted th-empty">Create or choose a profile to log Bluebook results.</p>;

  const mine = bluebook
    .filter((b) => b.profileId === profile.id)
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || b.enteredAt - a.enteredAt);

  const t = Number(total), r = Number(rw), m = Number(math);
  const sumWarning = total.trim() && rw.trim() && math.trim() && Number.isFinite(t + r + m) && r + m !== t
    ? `Reading and Writing (${r}) plus Math (${m}) is ${r + m}, not ${t}. Check the numbers in Bluebook; you can still save.`
    : '';

  const setBand = (id: string, key: keyof Band, value: string) => setBands((prev) => ({ ...prev, [id]: { ...prev[id], [key]: value } }));

  const save = (e: any) => {
    e.preventDefault();
    const errs: Errors = {};
    const num = Number(testNumber);
    if (!OFFICIAL_FORMS.some((f) => f.number === num)) errs.test = 'Choose which practice test you took (4–11).';
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) errs.date = 'Use a full date.';
    const totalN = checkScore(total, 400, 1600, 'Total', errs, 'total');
    const rwN = checkScore(rw, 200, 800, 'Reading and Writing', errs, 'rw');
    const mathN = checkScore(math, 200, 800, 'Math', errs, 'math');
    if (!errs.total && !errs.rw && !errs.math && totalN === undefined && rwN === undefined && mathN === undefined) {
      errs.total = 'Enter at least one score (total or a section score).';
    }
    let domainBands: BluebookResult['domainBands'];
    if (showBands) {
      for (const d of DOMAINS) {
        const b = bands[d.id];
        const f = intOrNull(b.filled);
        if (f === null) continue;
        const tot = intOrNull(b.total);
        if (tot === null || tot === 'bad' || tot < 1 || tot > 12) { errs[`band-${d.id}`] = 'Total segments must be 1–12.'; continue; }
        if (f === 'bad' || f < 0 || f > tot) { errs[`band-${d.id}`] = `Filled segments must be 0–${tot}.`; continue; }
        domainBands = { ...(domainBands ?? {}), [d.id]: { filled: f, total: tot } };
      }
    }
    setErrors(errs);
    if (Object.keys(errs).length > 0) { setStatus('Please fix the highlighted fields.'); return; }

    const result: BluebookResult = {
      id: uid('bb'),
      profileId: profile.id,
      testNumber: num,
      ...(date ? { date } : {}),
      ...(totalN !== undefined ? { total: totalN } : {}),
      ...(rwN !== undefined ? { rw: rwN } : {}),
      ...(mathN !== undefined ? { math: mathN } : {}),
      ...(domainBands ? { domainBands } : {}),
      enteredAt: Date.now(),
    };
    setState((s) => ({
      ...s,
      bluebook: [...s.bluebook, result],
      formRoles: { ...s.formRoles, [profile.id]: { ...(s.formRoles[profile.id] ?? {}), [num]: 'taken_in_bluebook' } },
    }));
    setTestNumber(''); setDate(''); setTotal(''); setRw(''); setMath(''); setBands(blankBands()); setShowBands(false);
    setStatus(`Saved Practice Test ${num}. It is now marked as taken in Bluebook.`);
  };

  const remove = (id: string) => {
    setState((s) => ({ ...s, bluebook: s.bluebook.filter((b) => b.id !== id) }));
    setStatus('Result deleted.');
  };

  const fid = (k: string) => `${baseId}-${k}`;
  const errProps = (k: string) => errors[k]
    ? { 'aria-invalid': true, 'aria-describedby': fid(`${k}-err`) }
    : {};
  const errMsg = (k: string) => errors[k] ? <span id={fid(`${k}-err`)} className="th-error">{errors[k]}</span> : null;

  return (
    <section className="card th-log" aria-labelledby={fid('h')}>
      <h3 id={fid('h')}>Bluebook results log</h3>
      <p className="muted">Took a practice test in the Bluebook app? Log its official score here. That form then counts as probably seen.</p>
      <form className="th-form" onSubmit={save} noValidate>
        <div className="th-grid">
          <div className="th-field">
            <label htmlFor={fid('test')}>Practice test</label>
            <select id={fid('test')} className="input" value={testNumber} onChange={(e: any) => setTestNumber(e.target.value)} {...errProps('test')}>
              <option value="">Choose…</option>
              {OFFICIAL_FORMS.map((f) => <option key={f.number} value={String(f.number)}>Practice Test {f.number}</option>)}
            </select>
            {errMsg('test')}
          </div>
          <div className="th-field">
            <label htmlFor={fid('date')}>Date taken</label>
            <input id={fid('date')} type="date" className="input" value={date} onChange={(e: any) => setDate(e.target.value)} {...errProps('date')} />
            {errMsg('date')}
          </div>
          <div className="th-field">
            <label htmlFor={fid('total')}>Total score (400–1600)</label>
            <input id={fid('total')} type="number" inputMode="numeric" min={400} max={1600} step={10} className="input" value={total} onChange={(e: any) => setTotal(e.target.value)} {...errProps('total')} />
            {errMsg('total')}
          </div>
          <div className="th-field">
            <label htmlFor={fid('rw')}>Reading and Writing (200–800)</label>
            <input id={fid('rw')} type="number" inputMode="numeric" min={200} max={800} step={10} className="input" value={rw} onChange={(e: any) => setRw(e.target.value)} {...errProps('rw')} />
            {errMsg('rw')}
          </div>
          <div className="th-field">
            <label htmlFor={fid('math')}>Math (200–800)</label>
            <input id={fid('math')} type="number" inputMode="numeric" min={200} max={800} step={10} className="input" value={math} onChange={(e: any) => setMath(e.target.value)} {...errProps('math')} />
            {errMsg('math')}
          </div>
        </div>
        {sumWarning && <p className="th-warn" role="status">{sumWarning}</p>}

        <div className="th-bands">
          <label className="th-check">
            <input type="checkbox" checked={showBands} onChange={(e: any) => setShowBands(e.target.checked)} />
            Add domain performance bands (optional)
          </label>
          {showBands && (
            <fieldset className="th-bands-set">
              <legend>Performance by domain: count the filled segments in each Bluebook bar</legend>
              {DOMAINS.map((d) => (
                <div key={d.id} className="th-band-row">
                  <span className="th-band-name" id={fid(`band-${d.id}-name`)}>{d.name}</span>
                  <label className="sr-only" htmlFor={fid(`band-${d.id}-f`)}>{d.name}: filled segments</label>
                  <input id={fid(`band-${d.id}-f`)} type="number" min={0} max={12} className="input th-num" value={bands[d.id].filled} onChange={(e: any) => setBand(d.id, 'filled', e.target.value)} {...errProps(`band-${d.id}`)} />
                  <span aria-hidden="true">of</span>
                  <label className="sr-only" htmlFor={fid(`band-${d.id}-t`)}>{d.name}: total segments</label>
                  <input id={fid(`band-${d.id}-t`)} type="number" min={1} max={12} className="input th-num" value={bands[d.id].total} onChange={(e: any) => setBand(d.id, 'total', e.target.value)} />
                  {errMsg(`band-${d.id}`)}
                </div>
              ))}
            </fieldset>
          )}
        </div>

        <div className="row">
          <button type="submit" className="btn btn-primary">Save result</button>
          <span className="muted" role="status" aria-live="polite">{status}</span>
        </div>
      </form>

      <h4>Saved results</h4>
      {mine.length === 0 ? (
        <p className="muted">No Bluebook results logged yet.</p>
      ) : (
        <ul className="th-results">
          {mine.map((b) => (
            <li key={b.id} className="th-result">
              <div className="th-result-main">
                <strong>Practice Test {b.testNumber}</strong>
                {b.date && <span className="muted"> · {b.date}</span>}
                <div className="th-scores">
                  <span className="th-total">{b.total ?? '—'}</span>
                  <span className="muted">Reading and Writing {b.rw ?? '—'} · Math {b.math ?? '—'}</span>
                </div>
                <span className="badge">Self-reported Bluebook practice score</span>
                {b.domainBands && (
                  <ul className="th-band-list">
                    {DOMAINS.filter((d) => b.domainBands?.[d.id]).map((d) => (
                      <li key={d.id}>{d.name}: {b.domainBands![d.id].filled} of {b.domainBands![d.id].total}</li>
                    ))}
                  </ul>
                )}
              </div>
              <button type="button" className="btn" onClick={() => remove(b.id)} aria-label={`Delete result for Practice Test ${b.testNumber}${b.date ? ` on ${b.date}` : ''}`}>Delete</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default BluebookLog;
