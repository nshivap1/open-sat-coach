import { useMemo, useRef } from 'react';
import type { EvidenceLabel, SkillEvidence } from '../../domain/types';
import { DOMAINS, SKILLS, SKILL_BY_ID } from '../../content/ontology';
import './progress.css';

export const STATUS: Record<EvidenceLabel, { glyph: string; text: string; cls: string }> = {
  insufficient: { glyph: '○', text: 'Not enough evidence', cls: 'p-st-insufficient' },
  needs_practice: { glyph: '!', text: 'Needs practice', cls: 'p-st-needs' },
  developing: { glyph: '◐', text: 'Developing', cls: 'p-st-developing' },
  progressing: { glyph: '▲', text: 'Progressing', cls: 'p-st-progressing' },
  consistent: { glyph: '●', text: 'Consistent', cls: 'p-st-consistent' },
};
export const LABEL_ORDER: EvidenceLabel[] = ['insufficient', 'needs_practice', 'developing', 'progressing', 'consistent'];

const HALVES = [
  { section: 'rw' as const, title: 'Reading and Writing' },
  { section: 'math' as const, title: 'Math' },
];

/** Skill ids in map reading order (half → domain → skill); also the arrow-key order. */
export const MAP_ORDER: string[] = HALVES.flatMap((h) =>
  DOMAINS.filter((d) => d.section === h.section).flatMap((d) => SKILLS.filter((s) => s.domainId === d.id).map((s) => s.id)));

export interface SkillMapProps {
  evidence: Record<string, SkillEvidence>;
  selectedSkillId?: string;
  onSelect(skillId: string): void;
  overlay: 'evidence' | 'coverage';
  coverage: Record<string, number>;
}

export function SkillMap({ evidence, selectedSkillId, onSelect, overlay, coverage }: SkillMapProps) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const maxCov = useMemo(() => Math.max(1, ...Object.values(coverage)), [coverage]);
  const selected = selectedSkillId ? SKILL_BY_ID[selectedSkillId] : undefined;
  const prereqs = new Set(selected?.prerequisites ?? []);
  const dependents = new Set(selected ? SKILLS.filter((s) => s.prerequisites.includes(selected.id)).map((s) => s.id) : []);
  const focusId = selectedSkillId && MAP_ORDER.includes(selectedSkillId) ? selectedSkillId : MAP_ORDER[0];

  function onKey(e: KeyboardEvent, id: string) {
    const i = MAP_ORDER.indexOf(id);
    let next = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = Math.min(MAP_ORDER.length - 1, i + 1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = Math.max(0, i - 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = MAP_ORDER.length - 1;
    if (next >= 0) {
      e.preventDefault();
      const el = refs.current[MAP_ORDER[next]];
      if (el) { el.focus(); }
    }
  }

  return (
    <div className="p-map">
      <div className="p-halves">
        {HALVES.map((h) => (
          <section key={h.section} className="p-half" aria-label={h.title}>
            <h3 className="p-half-title">{h.title}</h3>
            {DOMAINS.filter((d) => d.section === h.section).map((d) => (
              <div key={d.id} className="p-domain" style={{ ['--p-share' as string]: d.share }}>
                <div className="p-domain-head">
                  <span className="p-domain-name">{d.name}</span>
                  <span className="p-domain-share">about {Math.round(d.share * 100)}% of {h.title}</span>
                </div>
                <div className="p-tiles" role="group" aria-label={d.name}>
                  {SKILLS.filter((s) => s.domainId === d.id).map((s) => {
                    const ev = evidence[s.id];
                    const st = STATUS[ev?.label ?? 'insufficient'];
                    const cov = coverage[s.id] ?? 0;
                    const rel = prereqs.has(s.id) ? 'prereq' : dependents.has(s.id) ? 'dependent' : '';
                    const isSel = s.id === selectedSkillId;
                    const cls = ['p-tile', overlay === 'evidence' ? st.cls : 'p-cov', isSel ? 'p-selected' : '', rel ? `p-rel-${rel}` : '',
                      selected && !isSel && !rel ? 'p-dim' : ''].filter(Boolean).join(' ');
                    const style = overlay === 'coverage' ? { ['--p-cov' as string]: `${Math.round((cov / maxCov) * 60)}%` } : undefined;
                    const detail = overlay === 'evidence' ? `${st.text}, ${ev?.eligible ?? 0} fresh answers` : `${cov} questions available`;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        ref={(el: HTMLButtonElement | null) => { refs.current[s.id] = el; }}
                        className={cls}
                        style={style}
                        tabIndex={s.id === focusId ? 0 : -1}
                        aria-pressed={isSel}
                        aria-label={`${s.studentName}: ${detail}${rel === 'prereq' ? '. Prerequisite of selected skill' : rel === 'dependent' ? '. Builds on selected skill' : ''}`}
                        onClick={() => onSelect(s.id)}
                        onKeyDown={(e: KeyboardEvent) => onKey(e, s.id)}
                      >
                        <span className="p-tile-name">{s.studentName}</span>
                        {overlay === 'evidence' ? (
                          <span className="p-tile-status"><span className="p-glyph" aria-hidden="true">{st.glyph}</span>{st.text}</span>
                        ) : (
                          <span className="p-tile-status">{cov} question{cov === 1 ? '' : 's'}</span>
                        )}
                        <span className="p-tile-n">n={ev?.eligible ?? 0}</span>
                        {rel === 'prereq' && <span className="p-tag">prereq</span>}
                        {rel === 'dependent' && <span className="p-tag">builds on this</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </section>
        ))}
      </div>
      <div className="p-legend" aria-label="Legend">
        {overlay === 'evidence' ? LABEL_ORDER.map((l) => (
          <span key={l} className="p-legend-item">
            <span className={`p-swatch ${STATUS[l].cls}`} aria-hidden="true">{STATUS[l].glyph}</span>{STATUS[l].text}
          </span>
        )) : (
          <span className="p-legend-item"><span className="p-swatch p-cov" style={{ ['--p-cov' as string]: '10%' }} aria-hidden="true" />fewer
            <span className="p-swatch p-cov" style={{ ['--p-cov' as string]: '60%' }} aria-hidden="true" />more questions available</span>
        )}
        {selected && <span className="p-legend-item muted"><span className="p-tag">prereq</span> needed first · <span className="p-tag">builds on this</span> comes next</span>}
        <span className="p-legend-item muted">n = fresh, unassisted first answers</span>
      </div>
    </div>
  );
}

export default SkillMap;
