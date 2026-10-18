import './test.css';

const ROWS: [string, string][] = [
  ['Circle', 'Area A = πr² · Circumference C = 2πr (r = radius)'],
  ['Rectangle', 'Area A = ℓw (length × width)'],
  ['Triangle', 'Area A = ½bh (base × height ÷ 2)'],
  ['Pythagorean theorem', 'For a right triangle with legs a, b and hypotenuse c: c² = a² + b²'],
  ['30°-60°-90° triangle', 'Sides are in the ratio x : x√3 : 2x (short leg : long leg : hypotenuse)'],
  ['45°-45°-90° triangle', 'Sides are in the ratio s : s : s√2 (leg : leg : hypotenuse)'],
  ['Rectangular box', 'Volume V = ℓwh'],
  ['Cylinder', 'Volume V = πr²h'],
  ['Sphere', 'Volume V = (4/3)πr³'],
  ['Cone', 'Volume V = (1/3)πr²h'],
  ['Pyramid', 'Volume V = (1/3)ℓwh (one third of base area × height)'],
  ['Circle measure', 'A full circle has 360 degrees, which equals 2π radians.'],
  ['Triangle angles', 'The interior angles of any triangle add to 180°.'],
];

export function ReferenceSheet({ onClose }: { onClose: () => void }) {
  return (
    <aside className="t-float t-ref" role="dialog" aria-label="Math reference sheet">
      <div className="t-float-head">
        <h2>Reference</h2>
        <button type="button" className="t-btn" onClick={onClose} aria-label="Close reference sheet">Close</button>
      </div>
      <dl className="t-ref-list">
        {ROWS.map(([k, v]) => (
          <div key={k} className="t-ref-row"><dt>{k}</dt><dd>{v}</dd></div>
        ))}
      </dl>
    </aside>
  );
}
