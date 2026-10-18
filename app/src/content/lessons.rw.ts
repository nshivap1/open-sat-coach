import type { Lesson } from '../domain/types';

// One short lesson per Reading and Writing skill. Worked examples are original and fictional.

export const RW_LESSONS: Lesson[] = [
  {
    skillId: 'rw.ii.central',
    title: 'Find the main idea and the stated details',
    objective: 'State what a short text is mainly about and locate details it says directly.',
    cues: ['"Which choice best states the main idea"', '"According to the text"', 'A text with a turn word such as "but" or "however"'],
    steps: [
      'Read the whole text, then sum it up in under ten words before looking at the choices.',
      'Look for a turn ("But," "However," "Instead"); the idea after the turn is usually the point.',
      'For detail questions, find the exact sentence and match the choice to it word by word.',
      'Eliminate choices that are true but cover only one sentence, or that add ideas the text never states.',
    ],
    workedExample: {
      problem:
        'Text: "Many people think the fictional town of Dunmore was founded by miners. Records from the town church, however, show that farming families lived there twenty years before the mine opened." What is the main idea?',
      solution: [
        'Summary: records show farmers, not miners, settled Dunmore first.',
        'The turn word "however" points to the main idea: the common belief is challenged.',
        'A choice like "Church records exist in Dunmore" is true but too narrow.',
        'Best answer: records suggest Dunmore was settled by farmers before miners arrived.',
      ],
    },
    trap: 'Picking a choice that is true but describes only one detail instead of the whole text.',
    check: {
      question: 'A choice repeats a fact from the second sentence exactly. Why might it still be wrong for a main idea question?',
      answer: 'It may be accurate but too narrow; the main idea must cover the whole text, not one supporting detail.',
    },
    minutes: 3,
  },
  {
    skillId: 'rw.ii.evidence',
    title: 'Match the evidence to the exact claim',
    objective: 'Choose the quotation, finding, or data point that directly supports or weakens a specific claim.',
    cues: ['"most directly support" or "would most weaken"', '"Which quotation most effectively illustrates"', 'A table or graph paired with a claim'],
    steps: [
      'Restate the claim in your own words, and note every part of it (who, what, compared with what).',
      'For each choice, ask: if this were true, would the claim be more believable (or less, for "weaken")?',
      'For tables, first check that the numbers in a choice are accurate, then check that they prove the specific claim.',
      'Eliminate choices that are on topic but do not address the claim\'s exact point.',
    ],
    workedExample: {
      problem:
        'Claim: students at the fictional Lark Academy who take music classes miss fewer school days than students who do not. Which finding supports it? (A) Music classes are popular. (B) Music students averaged 3 absences; other students averaged 7.',
      solution: [
        'The claim compares two groups (music vs. non-music) on one outcome (absences).',
        'A is on topic but says nothing about absences.',
        'B compares the same two groups on absences and shows the predicted difference.',
        'Answer: B.',
      ],
    },
    trap: 'Choosing a true data point that matches the topic but does not show the specific pattern the claim describes.',
    check: {
      question: 'A claim says a change happened "sharply after 2010." What must the supporting data compare?',
      answer: 'The amount of change before 2010 with the amount of change after 2010, showing a much bigger change after.',
    },
    minutes: 3,
  },
  {
    skillId: 'rw.ii.inference',
    title: 'Complete the logic, not a guess',
    objective: 'Finish a text with the conclusion that its own reasoning requires.',
    cues: ['The text ends with a blank', '"Which choice most logically completes the text?"'],
    steps: [
      'List the facts the text gives, in order.',
      'Ask what must be true if all of those facts are true.',
      'In experiments, focus on the one thing that was different between groups.',
      'Eliminate choices that need outside information or ignore limiting words like "some," "only," or "most."',
    ],
    workedExample: {
      problem:
        'Text: "Two groups of fictional river snails were kept in identical tanks. One group was given extra calcium. After a month, that group had noticeably thicker shells. This suggests that shell thickness in the snails ______"',
      solution: [
        'Facts: identical tanks; only calcium differed; shell thickness differed.',
        'So the difference in shells is linked to calcium.',
        'Best completion: "is influenced, at least in part, by the amount of calcium available."',
        'A choice about water temperature fails because the tanks were identical.',
      ],
    },
    trap: 'Choosing a conclusion that sounds smart or likely in real life but is not required by the facts in the text.',
    check: {
      question: 'A text says total sales stayed the same while morning sales fell. What must be true about the rest of the day?',
      answer: 'Sales at other times of day must have risen by about the same amount that morning sales fell.',
    },
    minutes: 3,
  },
  {
    skillId: 'rw.cs.words',
    title: 'Predict the word from context clues',
    objective: 'Choose the most precise word for a blank, or the meaning of a word as it is used in a text.',
    cues: ['A blank inside a sentence', '"most logical and precise word or phrase"', '"As used in the text, what does the word ... most nearly mean?"'],
    steps: [
      'Cover the choices and find the clues: a definition, an example, or a contrast word ("although," "rather than").',
      'Predict your own simple word for the blank.',
      'Pick the choice closest to your prediction, even if another choice sounds more impressive.',
      'For "most nearly means," plug each choice into the sentence and check that it fits what is being described.',
    ],
    workedExample: {
      problem:
        'Text: "The fictional painter Iris Moll worked so ______ that she often finished three canvases in a single afternoon." Choices: meticulously, rapidly, reluctantly, rarely.',
      solution: [
        'Clue: "finished three canvases in a single afternoon."',
        'Prediction: "fast."',
        '"Rapidly" matches. "Meticulously" means very carefully, which does not explain the speed.',
        'Answer: rapidly.',
      ],
    },
    trap: 'Picking a word because it is familiar or sounds advanced, without checking it against the clue in the text.',
    check: {
      question: 'In "His patience wore thin," does "thin" mean narrow or weak?',
      answer: 'Weak. Patience is not a physical object, so "narrow" does not fit; the patience is running out.',
    },
    minutes: 2,
  },
  {
    skillId: 'rw.cs.structure',
    title: 'Say what the text does, not just what it says',
    objective: 'Identify the purpose of a text, the role of an underlined sentence, or how a text is organized.',
    cues: ['"main purpose"', '"overall structure"', '"function of the underlined sentence"'],
    steps: [
      'Label each sentence with a verb: introduces, claims, gives evidence, contrasts, concludes.',
      'For purpose, combine the labels into one action ("challenges a belief with evidence").',
      'For an underlined sentence, compare it with the sentence before and after it.',
      'Eliminate choices that fit only one part of the text or describe something the text never does.',
    ],
    workedExample: {
      problem:
        'Text: "Scientists believed the fictional Gray Tern nested only on cliffs. __In 2021, a researcher found a large colony nesting on a sandy beach.__ The finding has led to new surveys of coastal beaches." What does the underlined sentence do?',
      solution: [
        'Sentence 1: states a belief (cliffs only).',
        'Underlined sentence: reports a beach colony, which goes against that belief.',
        'Sentence 3: describes the result of the finding.',
        'Answer: it presents a finding that contradicts an earlier belief.',
      ],
    },
    trap: 'Choosing a choice that restates the content of the text instead of describing its job, or that fits only one sentence.',
    check: {
      question: 'A text describes a plan, then explains why it failed. Which describes its structure better: "describes a problem and its solution" or "describes a plan and why it did not work"?',
      answer: '"Describes a plan and why it did not work," because the text shows the plan failing, not solving a problem.',
    },
    minutes: 3,
  },
  {
    skillId: 'rw.cs.crosstext',
    title: 'Compare two texts claim to claim',
    objective: 'Predict how the author of one text would respond to a claim or finding in another.',
    cues: ['"Text 1" and "Text 2"', '"How would the author of Text 2 most likely respond"'],
    steps: [
      'Write one line summarizing the main claim of Text 1.',
      'Write one line summarizing the main claim of Text 2.',
      'Decide the relationship: agree, disagree, or partly agree (accepts the data, questions the conclusion).',
      'Pick the choice that matches that relationship and uses only what the responding text actually says.',
    ],
    workedExample: {
      problem:
        'Text 1: "Longer recess does not improve students\' math scores." Text 2: "In the fictional Pine Hill schools, longer recess did not change math scores, but students reported fewer conflicts with classmates." How would the author of Text 2 respond to Text 1?',
      solution: [
        'Text 1: longer recess does not raise math scores.',
        'Text 2: agrees about math scores but finds a different benefit.',
        'Relationship: partly agrees.',
        'Answer: accept the math finding but argue that longer recess may still have social benefits.',
      ],
    },
    trap: 'Assuming the two authors disagree about everything, or choosing a response that goes further than the text supports.',
    check: {
      question: 'If Text 2 never mentions how Text 1\'s data was collected, can Text 2\'s author be said to reject that data?',
      answer: 'No. Without evidence in Text 2 about the data, the author can only be said to respond to what Text 2 discusses.',
    },
    minutes: 3,
  },
  {
    skillId: 'rw.eoi.synthesis',
    title: 'Let the goal pick the sentence',
    objective: 'Use bulleted notes to choose the sentence that meets a specific stated goal.',
    cues: ['Bulleted student notes', '"The student wants to emphasize..." or "The student wants to explain..."'],
    steps: [
      'Read the goal first and underline its key words (for example, "difference," "change," "explanation").',
      'Turn the goal into a checklist: what must the sentence include?',
      'Test each choice against the checklist only; most choices will be accurate to the notes.',
      'Pick the one choice that meets every part of the goal.',
    ],
    workedExample: {
      problem:
        'Notes: the fictional Ridge Trail is 4 miles long; the fictional Creek Trail is 9 miles long; both are in Sable Park. Goal: emphasize a similarity between the trails.',
      solution: [
        'Checklist: mention both trails; show something they share.',
        '"Ridge Trail is 4 miles long, while Creek Trail is 9 miles long" shows a difference, so it fails.',
        '"Both Ridge Trail and Creek Trail are located in Sable Park" shows a similarity.',
        'Answer: the sentence about both trails being in Sable Park.',
      ],
    },
    trap: 'Choosing a sentence that is accurate and well written but does not do what the goal asks.',
    check: {
      question: 'The goal is to show how an author\'s style changed. Why is a sentence about only her second book wrong?',
      answer: 'A change requires a comparison of at least two points in time, so both books must be described.',
    },
    minutes: 2,
  },
  {
    skillId: 'rw.eoi.transitions',
    title: 'Name the relationship, then pick the transition',
    objective: 'Choose the transition word or phrase that matches the logical link between ideas.',
    cues: ['A blank at the start of a sentence followed by a comma', 'A blank between commas in the middle of a sentence', '"most logical transition"'],
    steps: [
      'Read the sentence before the blank and the full sentence containing the blank.',
      'Name the relationship: contrast, cause and effect, example, addition, or sequence.',
      'Sort the choices into those same groups and keep only the group that matches.',
      'If the blank is mid-sentence, still compare the whole sentence with the one before it.',
    ],
    workedExample: {
      problem:
        'Text: "The fictional Orla River floods almost every spring. ______ farmers along its banks plant their crops in early summer, after the water recedes." Choices: However, / As a result, / For example, / Similarly,',
      solution: [
        'Sentence 1: the river floods each spring (cause).',
        'Sentence 2: farmers plant after the floods (response).',
        'Relationship: cause and effect.',
        'Answer: "As a result,".',
      ],
    },
    trap: 'Choosing a transition because it sounds formal, or reacting to a contrast inside the sentence instead of the link between sentences.',
    check: {
      question: 'Sentence 1 makes a general claim; sentence 2 describes one specific case that fits it. Which kind of transition fits?',
      answer: 'An example transition, such as "for instance" or "for example."',
    },
    minutes: 2,
  },
  {
    skillId: 'rw.sec.boundaries',
    title: 'Punctuate by clause, not by pause',
    objective: 'Use periods, semicolons, commas, colons, and dashes correctly between and around groups of words.',
    cues: ['Choices differ only in punctuation', 'A blank between two groups of words'],
    steps: [
      'Find each subject and verb. Decide whether the words on each side of the blank could stand alone as a sentence.',
      'Two independent clauses: join with a period, a semicolon, or a comma + and/but/so (FANBOYS). A comma alone is a comma splice.',
      'A colon or dash must follow a complete clause; it introduces an explanation, example, or list.',
      'Nonessential information takes matching punctuation on both sides: two commas, two dashes, or two parentheses.',
      'Never put a single comma or semicolon between a subject and its verb.',
    ],
    workedExample: {
      problem:
        'Text: "The fictional Calder Bridge, which opened in 1931 ______ still carries more than 20,000 cars a day." Choices: 1931; / 1931 / 1931, / 1931—',
      solution: [
        'The nonessential clause "which opened in 1931" starts with a comma after "Bridge."',
        'It must close with matching punctuation: a comma.',
        'Check: removing the clause leaves "The fictional Calder Bridge still carries..." which is a complete sentence.',
        'Answer: "1931,".',
      ],
    },
    trap: 'Adding a comma wherever you would pause when speaking; punctuation follows sentence structure, not sound.',
    check: {
      question: 'Is "The rain stopped, the game resumed." correct? Why or why not?',
      answer: 'No. It is a comma splice: two independent clauses joined by only a comma. Use a period, a semicolon, or ", and".',
    },
    minutes: 4,
  },
  {
    skillId: 'rw.sec.form',
    title: 'Agreement, tense, pronouns, and modifiers by rule',
    objective: 'Choose verb forms, pronouns, and modifier placements that follow Standard English rules.',
    cues: ['Choices are different forms of the same word', 'Verb tenses or pronouns vary across choices', 'A sentence starts with an introductory phrase and a comma'],
    steps: [
      'Subject-verb agreement: cross out phrases between the subject and verb (especially "of..." phrases), then match the verb to the true subject.',
      'Verb tense: match the time frame set by other verbs and time words ("in 1902," "currently").',
      'Pronouns: find the noun the pronoun replaces and match its number; "its" is possessive, "it\'s" means "it is."',
      'Modifiers: the noun right after an introductory phrase must be the one the phrase describes; a possessive (like "Ana\'s") does not count.',
    ],
    workedExample: {
      problem:
        'Text: "The box of old photographs found in the attic ______ dated pictures from the 1920s." Choices: contain / contains / have contained / are containing',
      solution: [
        'Cross out "of old photographs found in the attic."',
        'The true subject is "box," which is singular.',
        'Rule: a singular subject takes a singular verb.',
        'Answer: "contains".',
      ],
    },
    trap: 'Matching the verb or pronoun to the nearest noun instead of to the word it actually goes with.',
    check: {
      question: 'What is wrong with "Walking to school, the rain soaked Mia\'s backpack"?',
      answer: 'It is a dangling modifier: it says the rain was walking. Fix: "Walking to school, Mia got her backpack soaked by the rain."',
    },
    minutes: 4,
  },
];
