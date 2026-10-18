import type { ChoiceId, Item, ResponseRecord } from '../../domain/types';
import { RichText } from '../../components/RichText';
import { gradeItem, validateSprFormat } from '../../domain/grading';
import './test.css';

export interface ItemViewProps {
  item: Item;
  response?: ResponseRecord | null;
  onChange: (patch: Partial<ResponseRecord>) => void;
  disabled?: boolean;
  reveal?: boolean;
  allowEliminate?: boolean;
}

export function ItemView({ item, response, onChange, disabled, reveal, allowEliminate }: ItemViewProps) {
  const raw = response?.raw ?? null;
  const eliminated = response?.eliminated ?? [];
  const r = item.response;
  const toggleElim = (id: ChoiceId) => {
    const next = eliminated.includes(id) ? eliminated.filter((x) => x !== id) : [...eliminated, id];
    onChange({ eliminated: next });
  };
  const sprMsg = r.kind === 'spr' && raw ? validateSprFormat(raw) : null;
  const outcome = reveal ? gradeItem(item, raw).outcome : null;
  return (
    <div className="t-item">
      {(item.passage || item.passage2 || item.table) && (
        <div className="t-passages">
          {item.passage && (
            <section className="t-passage">
              {item.passage2 && <h3 className="t-passage-h">Text 1</h3>}
              <RichText text={item.passage} />
            </section>
          )}
          {item.passage2 && (
            <section className="t-passage">
              <h3 className="t-passage-h">Text 2</h3>
              <RichText text={item.passage2} />
            </section>
          )}
          {item.table && (
            <table className="t-table">
              {item.table.caption && <caption>{item.table.caption}</caption>}
              <thead><tr>{item.table.headers.map((h, i) => <th key={i} scope="col">{h}</th>)}</tr></thead>
              <tbody>{item.table.rows.map((row, i) => (
                <tr key={i}>{row.map((c, j) => (j === 0 ? <th key={j} scope="row">{c}</th> : <td key={j}>{c}</td>))}</tr>
              ))}</tbody>
            </table>
          )}
        </div>
      )}
      <div className="t-question">
        <RichText className="t-prompt" text={item.prompt} />
        {r.kind === 'mcq' ? (
          <ul className="t-choices" role="list">
            {r.choices.map((c) => {
              const selected = raw === c.id;
              const elim = eliminated.includes(c.id);
              const isAns = r.answer === c.id;
              let mark: any = null;
              if (reveal && isAns) mark = <span className="t-mark t-mark-ok">✓ {selected ? 'Your answer — correct' : 'Correct answer'}</span>;
              else if (reveal && selected) mark = <span className="t-mark t-mark-bad">✗ Your answer — incorrect</span>;
              return (
                <li key={c.id} className={`t-choice-row${elim ? ' t-elim' : ''}${reveal && isAns ? ' t-is-ans' : ''}${reveal && selected && !isAns ? ' t-is-wrong' : ''}`}>
                  <button type="button" className={`t-choice${selected ? ' t-selected' : ''}`} aria-pressed={selected}
                    disabled={disabled} onClick={() => onChange({ raw: selected ? null : c.id })}>
                    <span className="t-letter" aria-hidden="true">{c.id}</span>
                    <span className="t-choice-text"><span className="t-sr">Choice {c.id}: </span>{c.text}</span>
                    {mark}
                  </button>
                  {allowEliminate && !disabled && (
                    <button type="button" className="t-elim-btn" aria-pressed={elim}
                      aria-label={`${elim ? 'Undo eliminate' : 'Eliminate'} choice ${c.id}`} onClick={() => toggleElim(c.id)}>
                      {elim ? 'Undo' : <s>{c.id}</s>}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="t-spr">
            <label className="t-spr-label" htmlFor={`spr-${item.id}`}>Your answer</label>
            <input id={`spr-${item.id}`} className="t-spr-input" type="text" inputMode="text" autoComplete="off"
              maxLength={6} value={raw ?? ''} disabled={disabled}
              aria-describedby={`spr-msg-${item.id}`}
              onChange={(e: any) => onChange({ raw: e.target.value === '' ? null : e.target.value })} />
            <p id={`spr-msg-${item.id}`} className={`t-spr-msg${sprMsg ? ' t-warn' : ''}`} aria-live="polite">
              {sprMsg ? `⚠ ${sprMsg}` : 'Enter a number, decimal, or fraction (e.g. 3/2). Up to 5 characters, 6 with a minus sign.'}
            </p>
            {reveal && (
              <p className={`t-mark ${outcome === 'correct' ? 't-mark-ok' : 't-mark-bad'}`}>
                {outcome === 'correct' ? '✓ Correct' : outcome === 'omitted' ? '○ Not answered' : outcome === 'invalid_format' ? '✗ Invalid format' : '✗ Incorrect'}
                {' — accepted: '}{r.accepted.join(', ')}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
