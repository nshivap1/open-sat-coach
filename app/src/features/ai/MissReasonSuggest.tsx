import { useEffect, useRef, useState } from 'react';
import { suggestMissReason } from '../../ai';
import type { MissSuggestion } from '../../ai/types';
import type { Item, MissReason } from '../../domain/types';
import { useAiProvider, readyProvider, errorText } from './aiState';
import './ai.css';

const REASON_LABEL: Record<MissReason, string> = {
  concept: 'Concept', misread: 'Misread', calculation: 'Calculation', strategy: 'Strategy',
  time: 'Time', guessed: 'Guessed', unsure: 'Unsure',
};

export interface MissReasonSuggestProps {
  item: Item;
  chosen: string | null;
  activeMs?: number;
  onAccept(reason: MissReason): void;
}

// Optional local-AI hypothesis for why a question was missed. Never sets a reason by itself.
export function MissReasonSuggest({ item, chosen, activeMs, onAccept }: MissReasonSuggestProps) {
  const provider = useAiProvider();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<MissSuggestion | null>(null);
  const ctrl = useRef<AbortController | null>(null);

  useEffect(() => {
    setSuggestion(null); setError(null); setLoading(false);
    return () => { ctrl.current?.abort(); ctrl.current = null; };
  }, [item.id]);

  if (!provider) return null;

  const run = async () => {
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    setLoading(true); setError(null); setSuggestion(null);
    try {
      const live = await readyProvider(provider);
      const r = await suggestMissReason(live, item, chosen, activeMs, c.signal);
      if (c.signal.aborted) return;
      setSuggestion(r);
    } catch (e) {
      if (c.signal.aborted) return;
      setError(errorText(e));
    } finally {
      if (ctrl.current === c) { ctrl.current = null; setLoading(false); }
    }
  };

  const cancel = () => { ctrl.current?.abort(); ctrl.current = null; setLoading(false); };

  return (
    <div className="ai-miss stack ai-gap-s" style={{ flexBasis: '100%' }} aria-live="polite">
      {!suggestion && !loading ? (
        <div className="row">
          <button type="button" className="btn ai-sm" onClick={run}>Suggest why I missed it (local AI)</button>
          {error ? <span className="ai-bad ai-small">✗ Couldn't get a suggestion: {error}</span> : null}
        </div>
      ) : null}
      {loading ? (
        <div className="row">
          <span className="ai-spin-row ai-small"><span className="ai-spinner" aria-hidden="true" /> The local model is thinking…</span>
          <button type="button" className="btn ai-sm" onClick={cancel}>Cancel</button>
        </div>
      ) : null}
      {suggestion && !loading ? (
        <div className="stack ai-gap-s">
          <p className="ai-m0 ai-small">
            <strong>Gemma suggests: {REASON_LABEL[suggestion.reason]}</strong> — {suggestion.why}{' '}
            <span className="muted">(AI guess, not verified)</span>
          </p>
          <div className="row">
            <button type="button" className="btn ai-sm" onClick={() => { onAccept(suggestion.reason); setSuggestion(null); }}>Use this reason</button>
            <button type="button" className="btn ai-sm" onClick={() => setSuggestion(null)}>Dismiss</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
