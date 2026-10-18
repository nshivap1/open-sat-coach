import { useId } from 'react';
import type { FormRole } from '../../domain/types';
import { setState, useAppState } from '../../domain/store';
import { OFFICIAL_FORMS } from '../../content';
import { FORM_ROLES, proposeFormBudget, roleHelp, roleLabel, suggestBluebookDates } from '../../domain/formBudget';
// @ts-ignore -- CSS side-effect import; no '*.css' module shim yet (esbuild bundles it)
import './tests.css';

function prettyDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

export function FormBudget() {
  const baseId = useId();
  const profileId = useAppState((s) => s.activeProfileId);
  const profiles = useAppState((s) => s.profiles);
  const formRoles = useAppState((s) => s.formRoles);
  const bluebook = useAppState((s) => s.bluebook);
  const profile = profiles.find((p) => p.id === profileId) ?? null;

  if (!profile) return <p className="muted th-empty">Create or choose a profile to plan your official tests.</p>;

  const roles: Record<number, FormRole> = formRoles[profile.id] ?? {};
  const forms = OFFICIAL_FORMS.map((f) => f.number);
  const roleOf = (n: number): FormRole => roles[n] ?? 'unassigned';

  const setRole = (n: number, role: FormRole) => {
    setState((s) => ({ ...s, formRoles: { ...s.formRoles, [profile.id]: { ...(s.formRoles[profile.id] ?? {}), [n]: role } } }));
  };

  const propose = () => {
    const taken = new Set<number>(bluebook.filter((b) => b.profileId === profile.id).map((b) => b.testNumber));
    // Forms already marked as taken stay taken, so a proposal never treats a seen form as fresh.
    for (const n of forms) if (roleOf(n) === 'taken_in_bluebook') taken.add(n);
    const plan = proposeFormBudget([...taken], forms);
    setState((s) => ({ ...s, formRoles: { ...s.formRoles, [profile.id]: { ...(s.formRoles[profile.id] ?? {}), ...plan } } }));
  };

  const saved = forms.filter((n) => roleOf(n) === 'save_for_bluebook').sort((a, b) => a - b);
  const dates = profile.targetDate ? suggestBluebookDates(profile.targetDate, saved.length, Date.now()) : [];

  return (
    <section className="card th-budget" aria-labelledby={`${baseId}-h`}>
      <div className="th-section-head">
        <h3 id={`${baseId}-h`}>Plan your official tests</h3>
        <button type="button" className="btn btn-primary" onClick={propose}>Propose a plan</button>
      </div>
      <p className="muted">
        Each official form can only be fresh once: after you see its questions, a later score on it says more about memory
        than about skill. Give every form one job before you use it, save two untouched forms for Bluebook so you get official
        adaptive scores near test day, and use the rest for diagnostics and practice.
      </p>
      <div className="th-table-wrap">
        <table className="th-table">
          <thead>
            <tr><th scope="col">Test</th><th scope="col">Role</th><th scope="col">What this means</th></tr>
          </thead>
          <tbody>
            {OFFICIAL_FORMS.map((f) => {
              const role = roleOf(f.number);
              const selId = `${baseId}-role-${f.number}`;
              return (
                <tr key={f.number} className={`th-role-${role}`}>
                  <th scope="row">
                    <label htmlFor={selId}>Practice Test {f.number}</label>
                  </th>
                  <td>
                    <select
                      id={selId}
                      className="input"
                      value={role}
                      aria-describedby={`${selId}-help`}
                      onChange={(e: any) => setRole(f.number, e.target.value as FormRole)}
                    >
                      {FORM_ROLES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
                    </select>
                  </td>
                  <td id={`${selId}-help`} className="muted th-help">{roleHelp(role)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {profile.targetDate && saved.length > 0 && (
        <div className="th-dates">
          <h4>Suggested Bluebook dates</h4>
          {dates.length === saved.length ? (
            <ul>
              {saved.map((n, i) => (
                <li key={n}>Practice Test {n}: <time dateTime={dates[i]}>{prettyDate(dates[i])}</time></li>
              ))}
            </ul>
          ) : (
            <p className="muted">There is not enough time before your test date ({profile.targetDate}) to space these out; take them when you can, at least a few days apart.</p>
          )}
        </div>
      )}
    </section>
  );
}

export default FormBudget;
