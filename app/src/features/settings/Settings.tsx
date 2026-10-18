import { useState } from 'react';
import { useAppState, setState, emptyState } from '../../domain/store';
import { switchProfile, deleteProfile, exportProfileJson, updateProfile } from '../../domain/actions';

export function Settings({ onAddProfile }: { onAddProfile(): void }) {
  const s = useAppState((x) => x);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const active = s.profiles.find((p) => p.id === s.activeProfileId);
  const set = (patch: any) => setState((st) => ({ ...st, settings: { ...st.settings, ...patch } }));
  const download = (id: string) => {
    const blob = new Blob([exportProfileJson(id)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `sat-coach-profile-${id}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <div className="stack" style={{ maxWidth: 760 }}>
      <h1>Settings</h1>
      <section className="card stack">
        <h2 style={{ margin: 0 }}>Appearance</h2>
        <label className="row">Theme
          <select className="input" value={s.settings.theme} onChange={(e: any) => set({ theme: e.target.value })}>
            <option value="system">Match system</option><option value="light">Light</option><option value="dark">Dark</option>
          </select>
        </label>
        <label className="row">Text size
          <select className="input" value={String(s.settings.textScale)} onChange={(e: any) => set({ textScale: Number(e.target.value) })}>
            <option value="1">100%</option><option value="1.25">125%</option><option value="1.5">150%</option><option value="2">200%</option>
          </select>
        </label>
        <label className="row"><input type="checkbox" checked={s.settings.showTimer} onChange={(e: any) => set({ showTimer: e.target.checked })} /> Show timer by default during tests</label>
      </section>
      {active ? (
        <section className="card stack">
          <h2 style={{ margin: 0 }}>Study plan</h2>
          <label className="row">Test date<input className="input" type="date" value={active.targetDate ?? ''} onChange={(e: any) => updateProfile(active.id, { targetDate: e.target.value || undefined })} /></label>
          <label className="row">Score goal<input className="input" type="number" min={400} max={1600} step={10} value={active.scoreGoal ?? ''} onChange={(e: any) => updateProfile(active.id, { scoreGoal: Number(e.target.value) || undefined })} /></label>
          <p className="muted">Your goal is used for planning only. The app does not predict SAT scores.</p>
        </section>
      ) : null}
      <section className="card stack">
        <h2 style={{ margin: 0 }}>Profiles</h2>
        {s.profiles.map((p) => (
          <div key={p.id} className="row" style={{ justifyContent: 'space-between' }}>
            <span><strong>{p.nickname}</strong>{p.id === s.activeProfileId ? <span className="badge" style={{ marginLeft: 8 }}>active</span> : null}</span>
            <span className="row">
              {p.id !== s.activeProfileId ? <button className="btn" onClick={() => switchProfile(p.id)}>Switch</button> : null}
              <button className="btn" onClick={() => download(p.id)}>Export</button>
              {confirmId === p.id
                ? <><button className="btn" style={{ color: 'var(--bad)' }} onClick={() => { deleteProfile(p.id); setConfirmId(null); }}>Delete all of {p.nickname}'s data</button><button className="btn" onClick={() => setConfirmId(null)}>Cancel</button></>
                : <button className="btn" onClick={() => setConfirmId(p.id)}>Delete…</button>}
            </span>
          </div>
        ))}
        <button className="btn" style={{ alignSelf: 'flex-start' }} onClick={onAddProfile}>Add profile</button>
      </section>
      <section className="card stack">
        <h2 style={{ margin: 0 }}>Privacy and about</h2>
        <p>All data stays in this browser on this device. There is no account, telemetry, or network request.</p>
        <p className="muted">This is the web build of Open SAT Coach: original practice questions, test engine, grading, skill map, practice and planning. The desktop app adds importing your official College Board practice PDFs, the local AI coach, and an offline graphing calculator. Original questions and explanations were checked by automated review, not by a human teacher. SAT® is a trademark registered by the College Board, which is not affiliated with and does not endorse this product.</p>
        {confirmId === '__all__'
          ? <div className="row"><button className="btn" style={{ color: 'var(--bad)' }} onClick={() => { setState(() => emptyState()); setConfirmId(null); }}>Yes, erase every profile and all history</button><button className="btn" onClick={() => setConfirmId(null)}>Cancel</button></div>
          : <button className="btn" style={{ alignSelf: 'flex-start', color: 'var(--bad)' }} onClick={() => setConfirmId('__all__')}>Erase all data…</button>}
      </section>
    </div>
  );
}
