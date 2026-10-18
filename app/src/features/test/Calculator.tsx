import { useState } from 'react';
import './test.css';

type Tok = { t: 'num'; v: number } | { t: 'op'; v: string } | { t: 'id'; v: string };

function tokenize(src: string): Tok[] {
  const s = src.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/π/g, 'pi').replace(/√/g, 'sqrt');
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    const num = /^(\d+\.?\d*|\.\d+)/.exec(s.slice(i));
    if (num) { out.push({ t: 'num', v: parseFloat(num[0]) }); i += num[0].length; continue; }
    const id = /^[a-z]+/i.exec(s.slice(i));
    if (id) { out.push({ t: 'id', v: id[0].toLowerCase() }); i += id[0].length; continue; }
    if ('+-*/^()'.includes(c)) { out.push({ t: 'op', v: c }); i++; continue; }
    throw new Error(`Unexpected "${c}"`);
  }
  return out;
}

/** Safe recursive-descent evaluator (no eval). */
export function evaluate(src: string, degrees: boolean): number {
  const toks = tokenize(src);
  let p = 0;
  const peek = () => toks[p];
  const isOp = (v: string) => peek()?.t === 'op' && peek()!.v === v;
  const startsPrimary = () => { const k = peek(); return !!k && (k.t === 'num' || k.t === 'id' || (k.t === 'op' && k.v === '(')); };
  const ang = (x: number) => (degrees ? (x * Math.PI) / 180 : x);
  function expr(): number {
    let v = term();
    while (isOp('+') || isOp('-')) { const o = toks[p++].v; const r = term(); v = o === '+' ? v + r : v - r; }
    return v;
  }
  function term(): number {
    let v = unary();
    for (;;) {
      if (isOp('*') || isOp('/')) { const o = toks[p++].v; const r = unary(); v = o === '*' ? v * r : v / r; }
      else if (startsPrimary()) v *= unary(); // implicit multiplication: 2pi, 3(4)
      else return v;
    }
  }
  function unary(): number {
    if (isOp('-')) { p++; return -unary(); }
    if (isOp('+')) { p++; return unary(); }
    return power();
  }
  function power(): number {
    const b = primary();
    if (isOp('^')) { p++; return Math.pow(b, unary()); }
    return b;
  }
  function primary(): number {
    const k = toks[p++];
    if (!k) throw new Error('Incomplete expression');
    if (k.t === 'num') return k.v;
    if (k.t === 'op' && k.v === '(') { const v = expr(); if (!isOp(')')) throw new Error('Missing )'); p++; return v; }
    if (k.t === 'id') {
      if (k.v === 'pi') return Math.PI;
      if (k.v === 'e') return Math.E;
      const arg = () => power();
      if (k.v === 'sqrt') { const a = arg(); if (a < 0) throw new Error('Square root of a negative'); return Math.sqrt(a); }
      if (k.v === 'sin') return Math.sin(ang(arg()));
      if (k.v === 'cos') return Math.cos(ang(arg()));
      if (k.v === 'tan') return Math.tan(ang(arg()));
      throw new Error(`Unknown name "${k.v}"`);
    }
    throw new Error(`Unexpected "${k.v}"`);
  }
  const v = expr();
  if (p < toks.length) throw new Error('Unexpected input');
  if (!Number.isFinite(v)) throw new Error('Undefined result');
  return v;
}

function fmt(n: number): string {
  if (Math.abs(n) < 1e-12) return '0';
  return String(Number(n.toPrecision(12)));
}

const KEYS = ['7', '8', '9', '÷', 'sqrt(', '4', '5', '6', '×', '^', '1', '2', '3', '−', '(', '0', '.', 'π', '+', ')', 'sin(', 'cos(', 'tan(', '⌫', 'C'];

export function Calculator({ onClose }: { onClose: () => void }) {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState('');
  const [deg, setDeg] = useState(true);
  const run = () => {
    if (!input.trim()) return;
    try { const v = fmt(evaluate(input, deg)); setHistory(`${input} = ${v}`); setInput(v); }
    catch (e: any) { setHistory(`${input} → Error: ${e?.message ?? 'invalid'}`); }
  };
  const press = (k: string) => {
    if (k === 'C') { setInput(''); return; }
    if (k === '⌫') { setInput((s) => s.slice(0, -1)); return; }
    setInput((s) => s + k);
  };
  return (
    <aside className="t-float t-calc" role="dialog" aria-label="Scientific calculator">
      <div className="t-float-head">
        <h2>Scientific calculator (offline — not Desmos)</h2>
        <button type="button" className="t-btn" onClick={onClose} aria-label="Close calculator">Close</button>
      </div>
      <p className="t-calc-hist" aria-live="polite">{history || ' '}</p>
      <input className="t-calc-input" aria-label="Expression" value={input}
        onChange={(e: any) => setInput(e.target.value)}
        onKeyDown={(e: any) => { e.stopPropagation(); if (e.key === 'Enter') run(); }} />
      <div className="t-calc-row">
        <button type="button" className="t-btn" aria-pressed={deg} onClick={() => setDeg((d) => !d)}>
          {deg ? 'Mode: Degrees' : 'Mode: Radians'}
        </button>
        <button type="button" className="t-btn t-primary" onClick={run}>=</button>
      </div>
      <div className="t-calc-keys">
        {KEYS.map((k) => (
          <button key={k} type="button" className="t-key" onClick={() => press(k)}
            aria-label={k === '⌫' ? 'Backspace' : k === 'C' ? 'Clear' : undefined}>{k.length > 1 && k.endsWith('(') ? k.slice(0, -1) : k}</button>
        ))}
      </div>
    </aside>
  );
}
