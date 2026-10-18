// Renders the small markup used in item text: blank lines = paragraphs, __underline__, **bold**, *italic*.
function inline(text: string, keyBase: string): any[] {
  const out: any[] = [];
  const re = /(__[^_]+__|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith('__')) out.push(<u key={`${keyBase}-${k++}`}>{tok.slice(2, -2)}</u>);
    else if (tok.startsWith('**')) out.push(<strong key={`${keyBase}-${k++}`}>{tok.slice(2, -2)}</strong>);
    else out.push(<em key={`${keyBase}-${k++}`}>{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function RichText({ text, className }: { text: string; className?: string }) {
  const paras = text.split(/\n\s*\n/);
  return (
    <div className={className}>
      {paras.map((p, i) => (
        <p key={i}>{p.split('\n').map((line, j) => (
          <span key={j}>{j > 0 ? <br /> : null}{inline(line, `${i}-${j}`)}</span>
        ))}</p>
      ))}
    </div>
  );
}
