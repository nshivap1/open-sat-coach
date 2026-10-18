import type { ChoiceId, Difficulty, Item } from '../domain/types';

// Original Digital-SAT-style math items. All answers verified numerically.

interface Spec {
  n: string; // `<skillId>.<nnn>`
  type: string; // type suffix within the skill
  d: Difficulty;
  prompt: string;
  table?: Item['table'];
  ctx?: boolean;
  choices?: [string, string, string, string];
  answer?: ChoiceId;
  accepted?: string[];
  sum: string;
  steps: string[];
  check: string;
  why?: Partial<Record<ChoiceId, string>>;
  take: string;
  hints: [string, string, string];
}

const LETTERS: ChoiceId[] = ['A', 'B', 'C', 'D'];

function mk(s: Spec): Item {
  const skillId = s.n.slice(0, s.n.lastIndexOf('.'));
  const isMcq = !!s.choices;
  const item: Item = {
    id: `orig.${s.n}`,
    version: 1,
    section: 'math',
    skillId,
    typeId: `${skillId}.${s.type}`,
    origin: 'original',
    difficulty: s.d,
    difficultySource: 'expert_estimate',
    prompt: s.prompt,
    response: isMcq
      ? { kind: 'mcq', choices: s.choices!.map((text, i) => ({ id: LETTERS[i], text })), answer: s.answer! }
      : { kind: 'spr', accepted: s.accepted! },
    explanation: {
      answerSummary: s.sum,
      steps: s.steps,
      check: s.check,
      ...(s.why ? { whyWrong: s.why } : {}),
      takeaway: s.take,
    },
    hints: s.hints,
    formatTags: [isMcq ? 'mcq' : 'spr', ...(s.table ? ['table'] : []), ...(s.ctx ? ['context'] : [])],
  };
  if (s.table) item.table = s.table;
  return item;
}

const SPECS: Spec[] = [
  // ---------------- Algebra: linear equations in one variable ----------------
  {
    n: 'math.alg.lin1.001', type: 'solve', d: 'easy',
    prompt: '3(x − 4) + 5 = 2x + 9\n\nWhat value of x is the solution to the equation above?',
    choices: ['2', '8', '16', '26'], answer: 'C',
    sum: 'x = 16: distribute, combine constants, then move the x-terms to one side.',
    steps: ['Distribute: 3x − 12 + 5 = 2x + 9', 'Combine constants: 3x − 7 = 2x + 9', 'Subtract 2x from both sides: x − 7 = 9', 'Add 7: x = 16'],
    check: 'Left: 3(16 − 4) + 5 = 36 + 5 = 41. Right: 2(16) + 9 = 41. Both sides match.',
    why: {
      A: 'Subtracting 7 from 9 instead of adding 7 to both sides gives x = 2.',
      B: 'Distributing the 3 only to x, writing 3x − 4 + 5, gives x = 8.',
      D: 'Combining −12 + 5 as −17 instead of −7 gives x = 26.',
    },
    take: 'Distribute to every term in the parentheses, and undo subtraction by adding the same amount to both sides.',
    hints: ['This tests solving a linear equation in one variable.', 'Distribute the 3 to both terms inside the parentheses first.', 'After distributing and combining, you should have 3x − 7 = 2x + 9.'],
  },
  {
    n: 'math.alg.lin1.002', type: 'solutions_count', d: 'medium',
    prompt: '5(x − 2) + kx = 9x − 10\n\nIn the equation above, k is a constant. For what value of k does the equation have infinitely many solutions?',
    choices: ['4', '5', '9', '14'], answer: 'A',
    sum: 'k = 4, because the x-coefficients must match (5 + k = 9) and the constants already match (−10 = −10).',
    steps: ['Distribute: 5x − 10 + kx = 9x − 10', 'Group the x-terms: (5 + k)x − 10 = 9x − 10', 'Infinitely many solutions means both sides are identical, so 5 + k = 9', 'k = 4'],
    check: 'With k = 4: 5x − 10 + 4x = 9x − 10, which is true for every x (try x = 0: −10 = −10; x = 1: −1 = −1).',
    why: {
      B: '5 is the coefficient already on the left side; it ignores the extra kx term.',
      C: '9 is the coefficient on the right; setting k = 9 ignores the 5x already on the left.',
      D: 'Adding 5 + 9 instead of solving 5 + k = 9 gives 14.',
    },
    take: 'An equation has infinitely many solutions when, after simplifying, both sides have the same x-coefficient and the same constant.',
    hints: ['This tests how many solutions a linear equation has.', 'Simplify the left side and compare it to the right side term by term.', 'The left side becomes (5 + k)x − 10.'],
  },

  // ---------------- Algebra: linear functions ----------------
  {
    n: 'math.alg.linfn.001', type: 'interpret', d: 'easy', ctx: true,
    prompt: 'A plumber uses the function C(h) = 85h + 60 to find the total charge, in dollars, for a job that lasts h hours. What is the best interpretation of 60 in this context?',
    choices: [
      'The charge for each hour of work',
      'The total charge for a 1-hour job',
      'The number of hours in an $85 job',
      'A fixed charge that does not depend on the number of hours',
    ],
    answer: 'D',
    sum: '60 is the y-intercept: the charge when h = 0, so it is a fixed fee added to every job.',
    steps: ['In C(h) = 85h + 60, the term 85h changes with h and 60 does not.', 'C(0) = 85(0) + 60 = 60, so $60 is charged even before any hours are counted.', 'So 60 is a fixed charge.'],
    check: 'Units: 85 is dollars per hour (multiplied by hours), while 60 is added alone, so it is plain dollars, a one-time fee.',
    why: {
      A: 'This describes the slope, 85, which multiplies the number of hours.',
      B: 'A 1-hour job costs C(1) = 85 + 60 = $145, not $60.',
      C: 'The function outputs dollars, not hours; 60 is not a number of hours.',
    },
    take: 'In a linear model, the constant term is the starting or fixed value; the coefficient of the variable is the rate.',
    hints: ['This tests interpreting the parts of a linear function.', 'Ask what happens to the cost when h = 0.', 'Compute C(0) and compare it to C(1).'],
  },
  {
    n: 'math.alg.linfn.002', type: 'evaluate', d: 'medium',
    prompt: 'The table shows two values of the linear function f. What is the value of f(10)?',
    table: { headers: ['x', 'f(x)'], rows: [['2', '11'], ['6', '23']] },
    accepted: ['35'],
    sum: 'f(10) = 35, because the slope is 3 and x = 10 is 4 more than x = 6.',
    steps: ['Slope m = (23 − 11)/(6 − 2) = 12/4 = 3', 'From x = 6 to x = 10, x increases by 4, so f increases by 4 · 3 = 12', 'f(10) = 23 + 12 = 35'],
    check: 'Equation: f(x) = 3x + 5. f(2) = 11 ✓, f(6) = 23 ✓, f(10) = 30 + 5 = 35 ✓.',
    take: 'For a linear function, find the slope from two points, then step from a known point to the new input.',
    hints: ['This tests evaluating a linear function from a table.', 'Find the rate of change between the two rows.', 'The slope is 12 ÷ 4.'],
  },

  // ---------------- Algebra: linear equations in two variables ----------------
  {
    n: 'math.alg.lin2.001', type: 'model', d: 'easy', ctx: true,
    prompt: 'A store sells notebooks for $3 each and pens for $1.50 each. Maya spent exactly $27 on n notebooks and p pens. Which equation represents this situation?',
    choices: ['3n + 1.5p = 27', '3p + 1.5n = 27', 'n + p = 27', '4.5(n + p) = 27'],
    answer: 'A',
    sum: '3n + 1.5p = 27: cost of notebooks plus cost of pens equals the total spent.',
    steps: ['Cost of notebooks: $3 each × n = 3n', 'Cost of pens: $1.50 each × p = 1.5p', 'Total: 3n + 1.5p = 27'],
    check: 'Try 5 notebooks and 8 pens: 3(5) + 1.5(8) = 15 + 12 = 27 dollars, a valid purchase, and each term is in dollars.',
    why: {
      B: 'Swaps the prices: it charges $3 per pen and $1.50 per notebook.',
      C: 'Adds the numbers of items and sets them equal to dollars; units do not match.',
      D: 'Adds the two prices and charges $4.50 for every item, as if each item were both a notebook and a pen.',
    },
    take: 'In a cost equation, each term is (price per item) × (number of items); check that every term has the same units.',
    hints: ['This tests writing a linear equation in two variables.', 'Write the cost of the notebooks and the cost of the pens separately.', 'The notebooks cost 3n dollars.'],
  },
  {
    n: 'math.alg.lin2.002', type: 'graph', d: 'hard',
    prompt: 'In the xy-plane, line ℓ passes through the point (−2, 5) and is perpendicular to the line with equation 3x + 4y = 8. What is the y-coordinate of the y-intercept of line ℓ?',
    accepted: ['23/3', '7.666', '7.667'],
    sum: '23/3: line ℓ has slope 4/3, and passing through (−2, 5) gives a y-intercept of 23/3.',
    steps: ['Rewrite 3x + 4y = 8 as y = −(3/4)x + 2, so its slope is −3/4', 'A perpendicular slope is the negative reciprocal: 4/3', 'Point-slope: y − 5 = (4/3)(x + 2)', 'At x = 0: y = 5 + (4/3)(2) = 5 + 8/3 = 23/3'],
    check: 'Slopes: (−3/4)(4/3) = −1 ✓ perpendicular. Point: (4/3)(−2) + 23/3 = −8/3 + 23/3 = 15/3 = 5 ✓.',
    take: 'Perpendicular slopes multiply to −1. Get slope from standard form by solving for y, not by reading the x-coefficient.',
    hints: ['This tests slopes of perpendicular lines and intercepts.', 'Solve 3x + 4y = 8 for y to find its slope, then take the negative reciprocal.', 'Line ℓ has slope 4/3; now use the point (−2, 5).'],
  },

  // ---------------- Algebra: systems ----------------
  {
    n: 'math.alg.systems.001', type: 'solve', d: 'easy',
    prompt: '2x + y = 11\nx − y = 4\n\nIf (x, y) is the solution to the system of equations above, what is the value of x + y?',
    choices: ['6', '9', '11', '15'], answer: 'A',
    sum: 'x + y = 6, since adding the equations gives x = 5 and then y = 1.',
    steps: ['Add the equations to eliminate y: 3x = 15', 'x = 5', 'Substitute into x − y = 4: 5 − y = 4, so y = 1', 'x + y = 5 + 1 = 6'],
    check: '2(5) + 1 = 11 ✓ and 5 − 1 = 4 ✓.',
    why: {
      B: 'Using the constant 4 as y (5 + 4) instead of solving for y gives 9.',
      C: '11 is the value of 2x + y, not x + y.',
      D: '15 is the value of 3x after adding the equations; the solver stopped before dividing.',
    },
    take: 'Answer the question asked: after solving, combine x and y the way the question requests.',
    hints: ['This tests solving a system of linear equations.', 'The y-terms have opposite signs, so add the two equations.', 'Adding gives 3x = 15.'],
  },
  {
    n: 'math.alg.systems.002', type: 'solutions_count', d: 'hard',
    prompt: '3x − 2y = 7\nkx − 8y = 20\n\nIn the system of equations above, k is a constant. For what value of k does the system have no solution?',
    choices: ['−12', '4', '12', '24'], answer: 'C',
    sum: 'k = 12, which makes the lines parallel (same slope) with different intercepts.',
    steps: ['No solution means parallel lines: the coefficients are proportional but the constants are not.', 'The y-coefficients give the ratio: −8 ÷ (−2) = 4', 'So k = 3 · 4 = 12', 'Constants: 7 · 4 = 28 ≠ 20, so the lines are distinct.'],
    check: 'Slopes: 3x − 2y = 7 → y = 1.5x − 3.5; 12x − 8y = 20 → y = 1.5x − 2.5. Same slope, different intercepts, so no intersection.',
    why: {
      A: 'A sign error in the ratio (−8 ÷ 2 = −4) gives k = −12; those lines are not parallel.',
      B: '4 is the scale factor between the equations, not the value of k.',
      D: 'Multiplying 3 by 8 instead of by the scale factor 4 gives 24.',
    },
    take: 'For no solution, scale one equation to match the other\'s x- and y-coefficients, then confirm the constants differ.',
    hints: ['This tests the number of solutions of a linear system.', 'Parallel lines have proportional x- and y-coefficients.', 'Find what the second equation\'s y-coefficient is multiplied by relative to the first.'],
  },

  // ---------------- Algebra: inequalities ----------------
  {
    n: 'math.alg.ineq.001', type: 'solve', d: 'easy',
    prompt: '−3x + 7 > 19\n\nWhich of the following describes all solutions to the inequality above?',
    choices: ['x > −4', 'x < −4', 'x > 4', 'x < 4'], answer: 'B',
    sum: 'x < −4: subtract 7, then divide by −3 and flip the inequality sign.',
    steps: ['Subtract 7: −3x > 12', 'Divide by −3 and reverse the sign: x < −4'],
    check: 'Test x = −5: −3(−5) + 7 = 22 > 19 ✓. Test x = 0: 7 > 19 is false ✓, so values above −4 are excluded.',
    why: {
      A: 'Forgets to reverse the inequality when dividing by a negative number.',
      C: 'Drops the negative sign of the quotient (12 ÷ −3 = −4) and also does not flip the sign.',
      D: 'Drops the negative sign of the quotient, though it does flip the inequality.',
    },
    take: 'Multiplying or dividing an inequality by a negative number reverses its direction.',
    hints: ['This tests solving a linear inequality.', 'Isolate the x-term first, then divide.', 'After subtracting 7 you have −3x > 12. What happens when you divide by a negative?'],
  },
  {
    n: 'math.alg.ineq.002', type: 'context', d: 'medium', ctx: true,
    prompt: 'A delivery van can safely carry at most 1,200 pounds. The driver weighs 180 pounds, and each box weighs 45 pounds. What is the greatest number of boxes the van can carry with the driver?',
    accepted: ['22'],
    sum: '22 boxes: 180 + 45b ≤ 1,200 gives b ≤ 22.67, and b must be a whole number.',
    steps: ['Inequality: 180 + 45b ≤ 1200', 'Subtract 180: 45b ≤ 1020', 'Divide: b ≤ 22.67', 'The number of boxes is a whole number, so b = 22'],
    check: '22 boxes: 180 + 990 = 1,170 ≤ 1,200 ✓. 23 boxes: 180 + 1,035 = 1,215 > 1,200 ✗.',
    take: 'When an inequality counts whole objects, round to the nearest whole number that still satisfies it; for "at most," round down.',
    hints: ['This tests writing and solving an inequality from a context.', 'Write an expression for the total weight with b boxes.', 'The total weight is 180 + 45b, which must be at most 1,200.'],
  },

  // ---------------- Advanced Math: equivalent expressions ----------------
  {
    n: 'math.adv.equiv.001', type: 'expand_factor', d: 'medium',
    prompt: 'Which expression is equivalent to (2x − 3)² − (x + 1)(x − 1)?',
    choices: ['3x² + 10', '5x² − 12x + 8', '3x² − 12x + 8', '3x² − 12x + 10'],
    answer: 'D',
    sum: '3x² − 12x + 10: expand both products, then subtract the whole second product.',
    steps: ['(2x − 3)² = 4x² − 12x + 9', '(x + 1)(x − 1) = x² − 1', 'Subtract: 4x² − 12x + 9 − (x² − 1) = 4x² − 12x + 9 − x² + 1', 'Combine: 3x² − 12x + 10'],
    check: 'At x = 2: original (1)² − (3)(1) = −2; 3(4) − 24 + 10 = −2 ✓. At x = 0: 9 − (−1) = 10 ✓. (Two checks support the algebra; the expansion proves it.)',
    why: {
      A: 'Squares as 4x² + 9, dropping the middle term −12x.',
      B: 'Adds the second product instead of subtracting it.',
      C: 'Subtracts x² but not the −1: forgets that −(−1) = +1.',
    },
    take: '(a − b)² has a middle term −2ab, and a minus sign in front of parentheses changes the sign of every term inside.',
    hints: ['This tests expanding and combining polynomial expressions.', 'Expand (2x − 3)² and (x + 1)(x − 1) separately.', 'The second product is x² − 1; put it in parentheses before subtracting.'],
  },
  {
    n: 'math.adv.equiv.002', type: 'exponents_radicals', d: 'hard',
    prompt: 'For x > 0, which expression is equivalent to (x⁵ · √x) / x² ?',
    choices: ['x^(1/2)', 'x^(11/4)', 'x³', 'x^(7/2)'],
    answer: 'D',
    sum: 'x^(7/2): √x = x^(1/2), so the exponent is 5 + 1/2 − 2 = 7/2.',
    steps: ['Write √x as x^(1/2)', 'Multiply by adding exponents: x⁵ · x^(1/2) = x^(11/2)', 'Divide by subtracting exponents: x^(11/2 − 2) = x^(7/2)'],
    check: 'At x = 4: (1024 · 2)/16 = 128, and 4^(7/2) = (√4)⁷ = 2⁷ = 128 ✓.',
    why: {
      A: 'Multiplies exponents (5 · 1/2) instead of adding them, then subtracts 2.',
      B: 'Divides the exponent 11/2 by 2 instead of subtracting 2.',
      C: 'Divides 5 by 2 instead of subtracting, then adds 1/2: 5/2 + 1/2 = 3.',
    },
    take: 'Same base: multiply → add exponents, divide → subtract exponents, and √x = x^(1/2).',
    hints: ['This tests exponent rules with radicals.', 'Rewrite the square root as a fractional exponent.', 'The numerator is x^(5 + 1/2).'],
  },

  // ---------------- Advanced Math: nonlinear equations and systems ----------------
  {
    n: 'math.adv.nleq.001', type: 'quadratic', d: 'medium',
    prompt: '2x² − 10x − 28 = 0\n\nWhat is the sum of the solutions to the equation above?',
    accepted: ['5'],
    sum: '5: dividing by 2 gives x² − 5x − 14 = 0, which factors as (x − 7)(x + 2) = 0, so the solutions 7 and −2 sum to 5.',
    steps: ['Divide every term by 2: x² − 5x − 14 = 0', 'Factor: (x − 7)(x + 2) = 0', 'Solutions: x = 7 and x = −2', 'Sum: 7 + (−2) = 5'],
    check: 'x = 7: 98 − 70 − 28 = 0 ✓. x = −2: 8 + 20 − 28 = 0 ✓. Also −b/a = 10/2 = 5 ✓.',
    take: 'For ax² + bx + c = 0, the solutions add to −b/a; factoring is a good way to confirm.',
    hints: ['This tests solving a quadratic equation.', 'Divide out the common factor of 2 first.', 'Look for two numbers that multiply to −14 and add to −5.'],
  },
  {
    n: 'math.adv.nleq.002', type: 'system', d: 'hard',
    prompt: 'y = x² − 4x + 7\ny = 2x − 2\n\nThe system of equations above has exactly one solution, (a, b). What is the value of b?',
    choices: ['3', '4', '7', '9'], answer: 'B',
    sum: 'b = 4: setting the expressions equal gives (x − 3)² = 0, so a = 3 and b = 2(3) − 2 = 4.',
    steps: ['Set equal: x² − 4x + 7 = 2x − 2', 'Rearrange: x² − 6x + 9 = 0', 'Factor: (x − 3)² = 0, so a = 3', 'b = 2(3) − 2 = 4'],
    check: 'Parabola at x = 3: 9 − 12 + 7 = 4 ✓. Line at x = 3: 6 − 2 = 4 ✓.',
    why: {
      A: '3 is the x-coordinate a, not the y-coordinate b.',
      C: '7 is the parabola\'s y-intercept (its value at x = 0), not at the intersection.',
      D: '9 is the constant term of x² − 6x + 9, not a coordinate.',
    },
    take: 'After solving for x in a system, substitute back to get y, and check which coordinate the question asks for.',
    hints: ['This tests solving a system with a quadratic and a line.', 'Set the two expressions for y equal to each other.', 'You should get x² − 6x + 9 = 0.'],
  },

  // ---------------- Advanced Math: nonlinear functions ----------------
  {
    n: 'math.adv.nlfn.001', type: 'quadratic_fn', d: 'medium',
    prompt: 'The function f is defined by f(x) = −2(x − 3)² + 5. Which statement about f is true?',
    choices: [
      'f has a maximum value of 5 at x = 3.',
      'f has a minimum value of 5 at x = 3.',
      'f has a maximum value of 5 at x = −3.',
      'f has a maximum value of 3 at x = 5.',
    ],
    answer: 'A',
    sum: 'In vertex form a(x − h)² + k, the vertex is (3, 5), and a = −2 < 0 makes it a maximum.',
    steps: ['Vertex form a(x − h)² + k has vertex (h, k) = (3, 5)', 'a = −2 is negative, so the parabola opens downward', 'So the vertex is a maximum: f(3) = 5'],
    check: 'f(3) = 5, while f(2) = −2(1) + 5 = 3 and f(4) = 3, both smaller, so 5 is a maximum ✓.',
    why: {
      B: 'Ignores the negative leading coefficient; a downward parabola has a maximum, not a minimum.',
      C: 'Reads (x − 3) as x = −3; the vertex is at x = +3.',
      D: 'Swaps h and k in the vertex.',
    },
    take: 'In f(x) = a(x − h)² + k, the vertex is (h, k): note the sign flip on h, and use the sign of a for max vs. min.',
    hints: ['This tests reading the vertex form of a quadratic.', 'Identify h, k, and the sign of a.', 'The vertex is at x = h, where (x − h) = 0.'],
  },
  {
    n: 'math.adv.nlfn.002', type: 'exponential', d: 'hard', ctx: true,
    prompt: 'A lab culture starts with 400 bacteria, and the population triples every 5 hours. Which expression gives the population m minutes after the start?',
    choices: ['400 · 3^(12m)', '400 · 3^(m/12)', '400 · 3^(m/5)', '400 · 3^(m/300)'],
    answer: 'D',
    sum: '400 · 3^(m/300): one tripling period is 5 hours = 300 minutes, so the number of triplings is m/300.',
    steps: ['In hours t: P = 400 · 3^(t/5)', 'Convert: t = m/60 hours', 'Exponent: (m/60)/5 = m/300', 'P = 400 · 3^(m/300)'],
    check: 'At m = 300 (5 hours): 400 · 3¹ = 1,200, exactly one tripling ✓. At m = 0: 400 ✓.',
    why: {
      A: 'Converts in the wrong direction (multiplies by 60 and divides by 5), giving 12m.',
      B: 'Divides 60 by 5 to get 12, mixing up the units in the exponent.',
      C: 'Uses minutes in a formula built for hours; it triples every 5 minutes.',
    },
    take: 'In a·b^(t/k), k is the time for one growth period, written in the same units as t.',
    hints: ['This tests building an exponential model with unit conversion.', 'First write the model in hours, then rewrite hours in terms of minutes.', 'How many minutes is one tripling period?'],
  },

  // ---------------- PSDA: ratios, rates, units ----------------
  {
    n: 'math.psda.ratios.001', type: 'proportion', d: 'easy', ctx: true,
    prompt: 'A pancake recipe uses 3 cups of flour for every 2 cups of milk. At this rate, how many cups of flour are needed for 7 cups of milk?',
    choices: ['4.2', '14/3', '8', '10.5'], answer: 'D',
    sum: '10.5 cups: flour/milk = 3/2, so flour = (3/2)(7) = 10.5.',
    steps: ['Set up a proportion: 3/2 = f/7', 'Cross-multiply: 2f = 21', 'f = 10.5'],
    check: 'Ratio check: 10.5/7 = 1.5 = 3/2 ✓. More milk than 2 cups should need more than 3 cups of flour ✓.',
    why: {
      A: 'Uses the part-to-whole fraction 3/5 of 7 instead of the flour-to-milk ratio.',
      B: 'Inverts the ratio, computing (2/3)(7).',
      C: 'Adds instead of scaling: milk went up by 5, so it adds 5 to the flour.',
    },
    take: 'Keep the same quantity on top on both sides of a proportion, and scale by multiplying, not adding.',
    hints: ['This tests proportional reasoning.', 'Write flour/milk on both sides of an equation.', '3/2 = f/7.'],
  },
  {
    n: 'math.psda.ratios.002', type: 'units', d: 'medium', ctx: true,
    prompt: 'A car travels at a constant speed of 72 kilometers per hour. What is this speed in meters per second? (1 kilometer = 1,000 meters)',
    choices: ['1.2', '20', '259.2', '1,200'], answer: 'B',
    sum: '20 m/s: 72 km/h × 1,000 m/km ÷ 3,600 s/h = 20 m/s.',
    steps: ['72 km/h × 1,000 m/km = 72,000 m/h', '1 hour = 60 × 60 = 3,600 seconds', '72,000 ÷ 3,600 = 20 m/s'],
    check: 'Units cancel: (km/h)(m/km)(h/s) = m/s ✓. Reverse: 20 m/s × 3,600 = 72,000 m/h = 72 km/h ✓.',
    why: {
      A: 'Divides 72 by 60 only (km per minute) and never converts kilometers to meters.',
      C: 'Multiplies by 3.6 instead of dividing; that converts m/s to km/h.',
      D: 'Converts hours only to minutes (÷ 60), not to seconds.',
    },
    take: 'Write conversion factors as fractions and check that the unwanted units cancel.',
    hints: ['This tests converting a rate between units.', 'Convert kilometers to meters, then hours to seconds.', 'One hour has 3,600 seconds.'],
  },

  // ---------------- PSDA: percentages ----------------
  {
    n: 'math.psda.percent.001', type: 'percent_change', d: 'medium', ctx: true,
    prompt: 'The price of a jacket was increased by 20%. Later, the new price was decreased by 20%. The final price was $96. What was the original price, in dollars?',
    choices: ['96', '100', '115.20', '120'], answer: 'B',
    sum: '$100: the two changes multiply to 1.2 × 0.8 = 0.96, so 0.96P = 96.',
    steps: ['After +20%: 1.20P', 'After −20%: 0.80(1.20P) = 0.96P', '0.96P = 96, so P = 100'],
    check: '$100 × 1.2 = $120; $120 × 0.8 = $96 ✓.',
    why: {
      A: 'Assumes a 20% increase and a 20% decrease cancel out.',
      C: 'Applies a 20% increase to $96 instead of undoing both changes.',
      D: 'Undoes only the 20% decrease (96 ÷ 0.8) and forgets the increase.',
    },
    take: 'Successive percent changes multiply; a percent increase followed by the same percent decrease gives a net decrease.',
    hints: ['This tests successive percent changes.', 'Write each change as a multiplier on the original price P.', 'The multipliers are 1.20 and 0.80.'],
  },
  {
    n: 'math.psda.percent.002', type: 'percent_of', d: 'hard', ctx: true,
    prompt: 'At a high school, 40% of the students are in the band. Of the students in the band, 25% are also in the choir. If 36 students are in both the band and the choir, how many students attend the school?',
    accepted: ['360'],
    sum: '360: students in both = 0.25 × 0.40 × N = 0.10N, and 0.10N = 36.',
    steps: ['Band: 0.40N', 'Band and choir: 0.25 × 0.40N = 0.10N', '0.10N = 36, so N = 360'],
    check: '40% of 360 = 144 band students; 25% of 144 = 36 ✓.',
    take: 'A "percent of a percent" multiplies: 25% of 40% is 10% of the whole.',
    hints: ['This tests finding a whole from nested percents.', 'Write the number of band students in terms of N first.', 'Students in both = 0.25 × (0.40N).'],
  },

  // ---------------- PSDA: one-variable data ----------------
  {
    n: 'math.psda.onevar.001', type: 'center', d: 'medium',
    prompt: 'The frequency table shows the number of books each of 20 students read over the summer. What is the median number of books read?',
    table: { headers: ['Books read', 'Number of students'], rows: [['0', '3'], ['1', '5'], ['2', '6'], ['3', '4'], ['4', '2']] },
    choices: ['1.85', '2', '4', '6'], answer: 'B',
    sum: 'The median is 2: with 20 values, it is the average of the 10th and 11th values, and both are 2.',
    steps: ['Total students: 3 + 5 + 6 + 4 + 2 = 20, so the median is the mean of the 10th and 11th values', 'Cumulative counts: 0 books → 3, 1 book → 8, 2 books → 14', 'Values 9 through 14 are all 2, so the 10th and 11th values are both 2', 'Median = 2'],
    check: '8 students read fewer than 2 books and 6 read more than 2, so 2 sits in the middle of the ordered list ✓.',
    why: {
      A: '1.85 is the mean (37 ÷ 20), not the median.',
      C: '4 is the median of the frequency column (2, 3, 4, 5, 6), not of the data values.',
      D: '6 is the largest frequency (how many students read 2 books), not a number of books.',
    },
    take: 'In a frequency table, the data values are in the first column; the frequencies only tell how many times each value appears.',
    hints: ['This tests finding the median from a frequency table.', 'Count the total number of students to find which positions are in the middle.', 'Add up frequencies until you reach the 10th and 11th students.'],
  },
  {
    n: 'math.psda.onevar.002', type: 'spread', d: 'hard',
    prompt: 'A data set consists of these seven values:\n\n12, 15, 15, 18, 20, 22, 60\n\nIf the value 60 is removed from the data set, which statement describes the effect on the mean, the median, and the standard deviation?',
    choices: [
      'All three decrease.',
      'The mean and standard deviation decrease; the median stays the same.',
      'The mean and median decrease; the standard deviation increases.',
      'The median and standard deviation decrease; the mean stays the same.',
    ],
    answer: 'A',
    sum: 'All three decrease: the mean drops from about 23.1 to 17, the median from 18 to 16.5, and the spread shrinks a lot without the outlier.',
    steps: ['Mean before: 162 ÷ 7 ≈ 23.1; after: 102 ÷ 6 = 17', 'Median before: 4th value = 18; after: (15 + 18) ÷ 2 = 16.5', 'Removing a value far from the rest reduces the typical distance from the mean, so the standard deviation decreases (about 15.4 → 3.4).'],
    check: 'Range also confirms the spread change: 60 − 12 = 48 before, 22 − 12 = 10 after.',
    why: {
      B: 'Assumes the median cannot change, but removing any value shifts which value is in the middle.',
      C: 'Removing an outlier makes the data less spread out, not more.',
      D: 'The mean is very sensitive to outliers; removing 60 lowers it a lot.',
    },
    take: 'An outlier pulls the mean and inflates the standard deviation; the median is resistant but can still shift slightly when a value is removed.',
    hints: ['This tests how an outlier affects center and spread.', 'Compute the mean and median with and without 60.', 'With six values left, the median is the average of the 3rd and 4th values.'],
  },

  // ---------------- PSDA: two-variable data ----------------
  {
    n: 'math.psda.twovar.001', type: 'best_fit', d: 'medium', ctx: true,
    prompt: 'A scatterplot shows the number of hours, x, that each of 12 students studied and each student\'s test score, y. The points show a positive linear association, and the line of best fit is ŷ = 2.4x + 31. One student studied 10 hours and scored 61. What is this student\'s actual score minus the score predicted by the line of best fit?',
    accepted: ['6'],
    sum: '6: the line predicts 2.4(10) + 31 = 55, and 61 − 55 = 6.',
    steps: ['Predicted score: ŷ = 2.4(10) + 31 = 24 + 31 = 55', 'Actual minus predicted: 61 − 55 = 6'],
    check: 'The point (10, 61) is above the line, so the residual should be positive ✓.',
    take: 'Residual = actual − predicted; a positive residual means the point lies above the line.',
    hints: ['This tests using a line of best fit to make a prediction.', 'Substitute x = 10 into the equation of the line.', 'The predicted score is 2.4(10) + 31.'],
  },
  {
    n: 'math.psda.twovar.002', type: 'model_type', d: 'medium',
    prompt: 'The table shows values of x and y. Which equation models the relationship exactly?',
    table: { headers: ['x', '0', '1', '2', '3', '4'], rows: [['y', '5', '10', '20', '40', '80']] },
    choices: ['y = 5(2)ˣ', 'y = 5 + 5x', 'y = 5x² + 5', 'y = 80(1/2)ˣ'],
    answer: 'A',
    sum: 'y = 5(2)ˣ: each time x increases by 1, y doubles, which is exponential growth starting at 5.',
    steps: ['Differences 5, 10, 20, 40 are not constant, so the model is not linear', 'Ratios 10/5 = 20/10 = 40/20 = 80/40 = 2 are constant, so it is exponential', 'Initial value at x = 0 is 5: y = 5(2)ˣ'],
    check: 'x = 3: 5 · 8 = 40 ✓. x = 4: 5 · 16 = 80 ✓.',
    why: {
      B: 'Uses only the first difference (5); it gives y = 15 at x = 2, not 20.',
      C: 'Fits the first two points but gives y = 25 at x = 2, not 20.',
      D: 'Reads the table backward; this decays from 80 and gives y = 80 at x = 0.',
    },
    take: 'Constant differences → linear; constant ratios → exponential. Check every row, not just the first two.',
    hints: ['This tests identifying linear vs. exponential relationships.', 'Compare consecutive y-values by subtracting and by dividing.', 'What do you multiply each y-value by to get the next one?'],
  },

  // ---------------- PSDA: probability ----------------
  {
    n: 'math.psda.prob.001', type: 'basic', d: 'easy',
    prompt: 'A bag contains 4 red marbles, 6 blue marbles, and 5 green marbles. One marble is chosen at random. What is the probability that the marble is not blue?',
    choices: ['4/15', '2/5', '3/5', '2/3'], answer: 'C',
    sum: '3/5: 9 of the 15 marbles are not blue, and 9/15 = 3/5.',
    steps: ['Total marbles: 4 + 6 + 5 = 15', 'Not blue: 4 + 5 = 9', 'P(not blue) = 9/15 = 3/5'],
    check: 'P(blue) + P(not blue) = 6/15 + 9/15 = 1 ✓.',
    why: {
      A: 'Counts only red marbles as "not blue."',
      B: '2/5 = 6/15 is the probability that the marble IS blue.',
      D: '6/9 compares blue to non-blue marbles; a probability must divide by the total, 15.',
    },
    take: 'Probability = favorable outcomes ÷ total outcomes, and P(not A) = 1 − P(A).',
    hints: ['This tests basic probability.', 'Find the total number of marbles and the number that are not blue.', 'There are 15 marbles in all.'],
  },
  {
    n: 'math.psda.prob.002', type: 'conditional', d: 'hard',
    prompt: 'The two-way table summarizes a survey of 200 students about whether they prefer online or in-person classes. If a student who prefers online classes is selected at random, what is the probability that the student is in grade 11?',
    table: {
      headers: ['', 'Online', 'In person', 'Total'],
      rows: [['Grade 10', '36', '54', '90'], ['Grade 11', '66', '44', '110'], ['Total', '102', '98', '200']],
    },
    accepted: ['11/17', '.6470', '.6471', '0.647'],
    sum: '11/17: of the 102 students who prefer online, 66 are in grade 11, and 66/102 = 11/17.',
    steps: ['The condition "prefers online" limits the group to the Online column: 102 students', 'Grade 11 within that column: 66', 'P = 66/102 = 11/17 ≈ 0.647'],
    check: 'Column check: 36 + 66 = 102 ✓. The answer is between 0 and 1 and above 1/2, matching that most online-preferring students are in grade 11 ✓.',
    take: 'For "given" or "selected from those who…" questions, the denominator is the total of the condition group, not the grand total.',
    hints: ['This tests conditional probability from a two-way table.', 'Identify which group the student is chosen from; that total is your denominator.', 'Use only the Online column.'],
  },

  // ---------------- PSDA: inference ----------------
  {
    n: 'math.psda.inference.001', type: 'margin', d: 'medium', ctx: true,
    prompt: 'A random sample of 500 voters in a city was surveyed. Of those surveyed, 54% said they support a new park proposal. The margin of error for this estimate is 4 percentage points. Which conclusion is most appropriate?',
    choices: [
      'It is plausible that between 50% and 58% of all voters in the city support the proposal.',
      'Exactly 54% of all voters in the city support the proposal.',
      'Between 50% and 58% of the 500 surveyed voters support the proposal.',
      'The proposal will certainly be supported by a majority of the city\'s voters.',
    ],
    answer: 'A',
    sum: 'The margin of error gives a plausible range for the whole population: 54% ± 4% = 50% to 58%.',
    steps: ['Sample estimate: 54%', 'Interval: 54 − 4 = 50 to 54 + 4 = 58 percent', 'This interval estimates the support among all city voters, the population sampled.'],
    check: 'The interval\'s lower end is 50%, so a majority is plausible but not guaranteed, which rules out "certainly."',
    why: {
      B: 'A sample estimate is not exact for the population; the margin of error shows the uncertainty.',
      C: 'The sample percent is known exactly (54%); the interval describes the population, not the sample.',
      D: 'The plausible range reaches 50%, so a majority is not certain.',
    },
    take: 'A margin of error describes the population value, not the sample, and it never makes a conclusion certain.',
    hints: ['This tests interpreting a margin of error.', 'Add and subtract 4 from the sample percent.', 'Ask whether the interval describes the 500 surveyed voters or all voters.'],
  },
  {
    n: 'math.psda.inference.002', type: 'generalize', d: 'medium', ctx: true,
    prompt: 'A researcher randomly selected 300 people from the membership list of Peak Fitness, a gym in one city, and asked how many hours they exercise per week. The mean was 5.2 hours. To which group can the researcher most appropriately generalize this result?',
    choices: [
      'All adults in the city',
      'All gym members in the country',
      'All members of Peak Fitness',
      'Only the 300 people surveyed',
    ],
    answer: 'C',
    sum: 'The sample was randomly drawn from Peak Fitness members, so it represents that population.',
    steps: ['Identify the population that was randomly sampled: Peak Fitness members', 'Random selection makes the sample representative of that population', 'Generalize only to Peak Fitness members'],
    check: 'Every Peak Fitness member had a chance to be selected; no adult outside the gym did, so the result cannot reach beyond the gym.',
    why: {
      A: 'Gym members likely exercise more than typical adults; non-members were never sampled.',
      B: 'Only one gym was sampled; other gyms\' members had no chance to be selected.',
      D: 'Too narrow: random sampling is exactly what allows generalizing to the population sampled.',
    },
    take: 'A random sample supports conclusions about the population it was drawn from, and no larger group.',
    hints: ['This tests generalizing from a sample.', 'Find the list the 300 people were randomly chosen from.', 'Who had a chance to be in the sample?'],
  },

  // ---------------- PSDA: claims ----------------
  {
    n: 'math.psda.claims.001', type: 'design', d: 'medium', ctx: true,
    prompt: 'Researchers recruited 120 volunteers and randomly assigned half to use a new sleep app for a month and half to use no app. The app group averaged significantly more sleep per night. Which conclusion is best supported?',
    choices: [
      'The app causes more sleep for adults in general.',
      'The app likely causes more sleep for people similar to these volunteers.',
      'No conclusion about cause is possible because the volunteers were not a random sample.',
      'The study shows only an association because it is observational.',
    ],
    answer: 'B',
    sum: 'Random assignment supports a cause-and-effect conclusion, but volunteers are not a random sample, so it applies to people like them.',
    steps: ['Random assignment to groups → a causal conclusion is reasonable', 'Volunteers, not a random sample of a population → generalize only to similar people', 'So: the app likely causes more sleep for people like the volunteers'],
    check: 'Two questions: Was there random assignment? Yes (cause OK). Was there random sampling? No (no broad generalization).',
    why: {
      A: 'Generalizes too far; volunteers were not randomly sampled from all adults.',
      C: 'Confuses random sampling with random assignment; random assignment is what supports causation.',
      D: 'Researchers assigned the treatment, so this is an experiment, not an observational study.',
    },
    take: 'Random assignment → cause; random sampling → generalize. Check each separately.',
    hints: ['This tests what conclusions a study design supports.', 'Ask whether there was random assignment and whether there was random sampling.', 'Random assignment was used, but the participants were volunteers.'],
  },
  {
    n: 'math.psda.claims.002', type: 'design', d: 'hard', ctx: true,
    prompt: 'A survey of 2,000 randomly selected adults in a country found that adults who drink more coffee report fewer headaches, on average. Which conclusion is appropriate?',
    choices: [
      'Drinking more coffee causes adults in the country to have fewer headaches.',
      'The result applies only to the 2,000 adults surveyed.',
      'No conclusion about the country\'s adults is possible because 2,000 is too small a sample.',
      'There is an association between coffee and fewer headaches among adults in the country, but cause is not shown.',
    ],
    answer: 'D',
    sum: 'Random sampling lets the association generalize to the country\'s adults, but with no random assignment it does not show cause.',
    steps: ['Random sample from the country → generalize to adults in the country', 'Observational (people chose how much coffee to drink) → association only', 'Conclusion: an association among the country\'s adults, cause not established'],
    check: 'Other factors (like sleep or stress) could affect both coffee drinking and headaches, so causation cannot be claimed without an experiment.',
    why: {
      A: 'Claims cause from an observational study with no random assignment.',
      B: 'Too narrow; the random sample supports generalizing to the population of adults in the country.',
      C: 'A random sample of 2,000 is large enough to describe a population; sample size is not the issue.',
    },
    take: 'Observational data can show an association in the sampled population but cannot establish cause.',
    hints: ['This tests drawing conclusions from an observational study.', 'Check for random sampling and for random assignment.', 'The adults chose their own coffee habits; nobody assigned them.'],
  },

  // ---------------- Geometry: area and volume ----------------
  {
    n: 'math.geo.area.001', type: 'area', d: 'medium',
    prompt: 'The length of a rectangle is 3 times its width. The perimeter of the rectangle is 64 centimeters. What is the area of the rectangle, in square centimeters?',
    choices: ['24', '192', '256', '768'], answer: 'B',
    sum: '192 cm²: the perimeter is 2(3w + w) = 8w = 64, so w = 8, ℓ = 24, and area = 8 · 24.',
    steps: ['Let width = w and length = 3w', 'Perimeter: 2(3w + w) = 8w = 64, so w = 8', 'Length = 24', 'Area = 24 · 8 = 192'],
    check: 'Perimeter: 2(24 + 8) = 64 ✓. Length is 3 × width: 24 = 3 · 8 ✓.',
    why: {
      A: '24 is the length, not the area.',
      C: 'Treats the rectangle as a square with side 64 ÷ 4 = 16.',
      D: 'Uses ℓ + w = 64 (half the perimeter forgotten), giving w = 16 and ℓ = 48.',
    },
    take: 'Perimeter counts each side twice: P = 2(ℓ + w). Answer with the quantity asked for: area, not a side.',
    hints: ['This tests perimeter and area of a rectangle.', 'Write the length and width in terms of one variable.', 'The perimeter is 2(3w + w).'],
  },
  {
    n: 'math.geo.area.002', type: 'volume', d: 'hard', ctx: true,
    prompt: 'A rectangular box with inside dimensions 10 centimeters by 8 centimeters by 9 centimeters is completely filled with water. All of the water is poured into an empty right circular cylinder with an inside radius of 4 centimeters. What is the height of the water in the cylinder, in centimeters, rounded to the nearest tenth?',
    accepted: ['14.3'],
    sum: '14.3 cm: the water volume is 720 cm³, and π(4²)h = 720 gives h = 45/π ≈ 14.3.',
    steps: ['Box volume: 10 · 8 · 9 = 720 cm³', 'Cylinder volume: πr²h = 16πh', '16πh = 720, so h = 45/π ≈ 14.32', 'Rounded to the nearest tenth: 14.3'],
    check: 'π · 16 · 14.3 ≈ 718.8 cm³, close to 720 (difference from rounding) ✓. Units: cm³ ÷ cm² = cm ✓.',
    take: 'When liquid moves between containers, the volume stays the same; set the two volume formulas equal.',
    hints: ['This tests volume of a box and a cylinder.', 'Find the volume of water first; it does not change when poured.', 'Set 16πh equal to the box\'s volume.'],
  },

  // ---------------- Geometry: lines, angles, triangles ----------------
  {
    n: 'math.geo.lines.001', type: 'angles', d: 'medium',
    prompt: 'Lines p and q are parallel, and both are crossed by line t. Two angles lie on the same side of line t and both lie between lines p and q (same-side interior angles). Their measures are (3x + 15)° and (2x + 5)°. What is the measure, in degrees, of the larger angle?',
    choices: ['32', '69', '111', '135'], answer: 'C',
    sum: '111°: same-side interior angles are supplementary, so 5x + 20 = 180, x = 32, and 3(32) + 15 = 111.',
    steps: ['Same-side interior angles add to 180°: (3x + 15) + (2x + 5) = 180', '5x + 20 = 180, so x = 32', 'Angles: 3(32) + 15 = 111° and 2(32) + 5 = 69°', 'The larger angle is 111°'],
    check: '111 + 69 = 180 ✓.',
    why: {
      A: '32 is the value of x, not an angle measure.',
      B: '69° is the smaller angle.',
      D: 'Adds 20 instead of subtracting it (5x = 200, x = 40), giving 3(40) + 15 = 135.',
    },
    take: 'With parallel lines, same-side interior angles are supplementary; alternate interior angles are equal.',
    hints: ['This tests angle relationships with parallel lines.', 'Decide whether these angles are equal or supplementary.', 'Same-side interior angles add to 180°.'],
  },
  {
    n: 'math.geo.lines.002', type: 'similar', d: 'medium',
    prompt: 'In triangle ABC, point D lies on side AB and point E lies on side AC so that segment DE is parallel to side BC. If AD = 6, DB = 4, and DE = 9, what is the length of BC?',
    accepted: ['15'],
    sum: 'BC = 15: triangle ADE is similar to triangle ABC with ratio AD/AB = 6/10, so 9/BC = 6/10.',
    steps: ['DE ∥ BC, so triangle ADE ~ triangle ABC (AA similarity)', 'AB = AD + DB = 6 + 4 = 10', 'AD/AB = DE/BC: 6/10 = 9/BC', 'BC = 90/6 = 15'],
    check: 'Ratio check: 9/15 = 0.6 = 6/10 ✓. BC is longer than DE, as it should be for the larger triangle ✓.',
    take: 'In similar triangles, compare matching sides of the whole triangles: use AB = AD + DB, not DB.',
    hints: ['This tests similar triangles formed by a parallel segment.', 'Name the two similar triangles and match corresponding sides.', 'The full side AB is 6 + 4 = 10.'],
  },

  // ---------------- Geometry: right triangles and trig ----------------
  {
    n: 'math.geo.trig.001', type: 'trig_ratios', d: 'medium',
    prompt: 'In right triangle PQR, angle R is the right angle and sin P = 5/13. What is the value of tan Q?',
    choices: ['5/12', '12/13', '13/12', '12/5'], answer: 'D',
    sum: 'tan Q = 12/5: with QR = 5 and PQ = 13, PR = 12, and tan Q = PR/QR.',
    steps: ['sin P = opposite/hypotenuse = QR/PQ, so take QR = 5 and PQ = 13', 'Pythagorean theorem: PR = √(13² − 5²) = √144 = 12', 'For angle Q: opposite side is PR = 12, adjacent side is QR = 5', 'tan Q = 12/5'],
    check: 'tan P · tan Q = (5/12)(12/5) = 1, as expected for the two acute angles of a right triangle ✓.',
    why: {
      A: '5/12 is tan P; it uses angle P\'s opposite and adjacent sides.',
      B: '12/13 is cos P (= sin Q), not tan Q.',
      C: '13/12 is hypotenuse ÷ adjacent for angle P, which is not a tangent.',
    },
    take: 'Label opposite and adjacent from the angle you are asked about; the two acute angles swap them.',
    hints: ['This tests trig ratios in a right triangle.', 'Use sin P to label two sides, then find the third with the Pythagorean theorem.', 'The missing side is √(169 − 25).'],
  },
  {
    n: 'math.geo.trig.002', type: 'pythagorean', d: 'hard', ctx: true,
    prompt: 'A 25-foot ladder leans against a vertical wall on level ground. The bottom of the ladder is 7 feet from the base of the wall. The top of the ladder then slides 4 feet down the wall, and the ladder stays straight against the wall. How many feet farther from the wall is the bottom of the ladder now?',
    accepted: ['8'],
    sum: '8 feet: the top starts at 24 ft high and drops to 20 ft, so the bottom moves from 7 ft to 15 ft.',
    steps: ['Initial height: √(25² − 7²) = √576 = 24 ft', 'New height: 24 − 4 = 20 ft', 'New distance: √(25² − 20²) = √225 = 15 ft', 'Change: 15 − 7 = 8 ft'],
    check: '15² + 20² = 225 + 400 = 625 = 25² ✓, and 7² + 24² = 49 + 576 = 625 ✓.',
    take: 'The ladder (hypotenuse) stays the same; recompute the legs with the Pythagorean theorem instead of assuming they change equally.',
    hints: ['This tests the Pythagorean theorem in context.', 'Find how high the ladder reaches before it slides.', 'Before sliding, the top is √(625 − 49) feet high.'],
  },

  // ---------------- Geometry: circles ----------------
  {
    n: 'math.geo.circles.001', type: 'equation', d: 'hard',
    prompt: 'x² + y² − 6x + 10y − 2 = 0\n\nThe equation above defines a circle in the xy-plane. What are the center and radius of the circle?',
    choices: [
      'Center (−3, 5), radius 6',
      'Center (3, −5), radius 36',
      'Center (3, −5), radius 6',
      'Center (3, −5), radius √32',
    ],
    answer: 'C',
    sum: 'Completing the square gives (x − 3)² + (y + 5)² = 36, so the center is (3, −5) and the radius is 6.',
    steps: ['Group: (x² − 6x) + (y² + 10y) = 2', 'Complete the squares: add 9 and 25 to both sides', '(x − 3)² + (y + 5)² = 2 + 9 + 25 = 36', 'Center (3, −5), radius √36 = 6'],
    check: 'The point (9, −5) is 6 units right of the center: 81 + 25 − 54 − 50 − 2 = 0 ✓.',
    why: {
      A: 'Takes the center coordinates with the wrong signs: (x − 3)² + (y + 5)² has center (3, −5).',
      B: '36 is r², not the radius.',
      D: 'Subtracts the 2 instead of moving it to the right side as +2: 9 + 25 − 2 = 32.',
    },
    take: 'Complete the square for x and y, add the same amounts to both sides, then take the square root of the right side for r.',
    hints: ['This tests the equation of a circle.', 'Move the constant to the right side and complete the square in x and in y.', 'Half of −6 is −3 and half of 10 is 5; square those.'],
  },
  {
    n: 'math.geo.circles.002', type: 'arcs_sectors', d: 'medium',
    prompt: 'A circle has a radius of 12 inches. A central angle of the circle measures 5π/6 radians. The length of the arc intercepted by this angle is kπ inches. What is the value of k?',
    accepted: ['10'],
    sum: 'k = 10: arc length = rθ = 12 · 5π/6 = 10π.',
    steps: ['For an angle in radians, arc length s = rθ', 's = 12 · (5π/6) = 60π/6 = 10π', 'So k = 10'],
    check: 'Degrees check: 5π/6 = 150°, and (150/360) · 2π(12) = (5/12) · 24π = 10π ✓.',
    take: 'Arc length is rθ only when θ is in radians; in degrees use (θ/360) · 2πr.',
    hints: ['This tests arc length with a radian angle.', 'Use the arc-length formula for radians.', 'Multiply the radius by the angle measure.'],
  },
];

export const MATH_ITEMS: Item[] = SPECS.map(mk);
