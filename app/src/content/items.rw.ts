import type { Item, ChoiceId } from '../domain/types';

// Original Reading and Writing practice items. All people, places, works, and studies are fictional.

type Spec = Omit<Item, 'id' | 'version' | 'section' | 'origin' | 'difficultySource' | 'typeId' | 'response'> & {
  n: string;
  type: string;
  choices: [string, string, string, string];
  answer: ChoiceId;
};

const LETTERS: ChoiceId[] = ['A', 'B', 'C', 'D'];

function rw(s: Spec): Item {
  const { n, type, choices, answer, ...rest } = s;
  return {
    id: `orig.${s.skillId}.${n}`,
    version: 1,
    section: 'rw',
    typeId: `${s.skillId}.${type}`,
    origin: 'original',
    difficultySource: 'expert_estimate',
    response: { kind: 'mcq', choices: choices.map((text, i) => ({ id: LETTERS[i], text })), answer },
    ...rest,
  };
}

export const RW_ITEMS: Item[] = [
  // ---------------- Central Ideas and Details ----------------
  rw({
    skillId: 'rw.ii.central', n: '001', type: 'main_idea', difficulty: 'easy',
    passage:
      'Ecologist Mira Okafor spent three summers tracking the foraging of bumblebees in the meadows near the fictional town of Harlow Ridge. She expected the bees to visit whichever flowers were most abundant. Instead, she found that individual bees repeatedly returned to the same small patches, even when richer patches bloomed nearby. Okafor suggests that bees may rely on memorized routes, trading some efficiency for the reliability of locations they already know.',
    prompt: 'Which choice best states the main idea of the text?',
    choices: [
      'Bumblebees near Harlow Ridge prefer rare flowers to abundant ones.',
      "Okafor's research suggests that bumblebees may favor familiar foraging locations over richer, unfamiliar ones.",
      'The meadows near Harlow Ridge contain fewer flowers than they did three summers ago.',
      'Okafor concluded that bees forage most efficiently when they visit the most abundant flowers.',
    ],
    answer: 'B',
    explanation: {
      answerSummary: 'B: the text reports that bees kept returning to known patches and suggests they rely on memorized routes.',
      steps: [
        'Summarize the text: Okafor expected bees to chase abundance, but they returned to the same patches.',
        'Find the conclusion: bees may rely on memorized routes, trading efficiency for reliability.',
        'Pick the choice that matches both the finding and the conclusion.',
      ],
      check: '"individual bees repeatedly returned to the same small patches, even when richer patches bloomed nearby."',
      whyWrong: {
        A: 'The text never says the flowers the bees chose were rare.',
        C: 'The text says nothing about the meadows changing over time.',
        D: 'This was her expectation, and the findings went against it.',
      },
      takeaway: 'A main idea must cover the key finding and the conclusion drawn from it, not just one detail.',
    },
    hints: [
      'This is a main idea question: what is the whole text mostly about?',
      'Compare what Okafor expected with what she actually found.',
      'The last sentence explains the finding. Which choice matches that explanation?',
    ],
    formatTags: ['mcq', 'science'],
  }),
  rw({
    skillId: 'rw.ii.central', n: '002', type: 'detail', difficulty: 'medium',
    passage:
      "The following text is from a novel by the fictional writer Teodora Halsey. Anika has just arrived at her grandmother's farm.\n\nAnika had imagined the farm as a place of open sky and idle afternoons. But by the end of her first morning, she had hauled water to the goats, mended a gap in the fence, and learned that her grandmother woke before the roosters did. When Anika finally sat down on the porch steps, her grandmother handed her a cup of tea and said, without smiling, \"Tomorrow we start early.\"",
    prompt: 'According to the text, what had Anika done by the end of her first morning at the farm?',
    choices: [
      'She had spent the morning resting on the porch.',
      'She had woken up before her grandmother did.',
      'She had prepared tea for her grandmother.',
      'She had repaired part of a fence.',
    ],
    answer: 'D',
    explanation: {
      answerSummary: 'D: the text states that Anika "mended a gap in the fence."',
      steps: [
        'Find the sentence that lists what Anika did "by the end of her first morning."',
        'Match each choice to that list word by word.',
        '"Mended a gap in the fence" means she repaired part of a fence.',
      ],
      check: '"by the end of her first morning, she had hauled water to the goats, mended a gap in the fence..."',
      whyWrong: {
        A: 'She sat on the porch only after her work; the morning was not restful.',
        B: 'The text says her grandmother woke before the roosters, not that Anika woke before her grandmother.',
        C: 'Her grandmother handed the tea to Anika, not the other way around.',
      },
      takeaway: 'For "according to the text" questions, find the exact line and watch who does what.',
    },
    hints: [
      'This is a detail question: the answer is stated directly in the text.',
      'Find the sentence that begins "But by the end of her first morning."',
      'Check who made the tea and who woke early before you choose.',
    ],
    formatTags: ['mcq', 'literature'],
  }),
  rw({
    skillId: 'rw.ii.central', n: '003', type: 'main_idea', difficulty: 'hard',
    passage:
      "Historians have long described the canal towns of the fictional Verrin Valley as having grown because of the canal itself, which opened in 1834. But historian Paulo Restrepo's review of tax ledgers shows that several of these towns already had thriving markets and mills a decade before construction began. Restrepo argues that the canal's planners chose its route precisely because those towns were already prosperous: the canal followed growth rather than creating it.",
    prompt: 'Which choice best states the main idea of the text?',
    choices: [
      "Restrepo's research challenges the view that the Verrin Valley canal caused the growth of the towns along its route.",
      "Several towns in the Verrin Valley had markets and mills before the canal's construction began.",
      'Tax ledgers are the most reliable source for studying the history of the Verrin Valley.',
      'Restrepo argues that the canal towns declined after the canal opened in 1834.',
    ],
    answer: 'A',
    explanation: {
      answerSummary: "A: the text sets up a long-held view and presents Restrepo's evidence and argument against it.",
      steps: [
        'Notice the structure: an old view ("grown because of the canal"), then "But" and new evidence.',
        "Restrepo's conclusion: the canal followed growth rather than creating it.",
        'Choose the option that captures the challenge to the old view, not just one supporting fact.',
      ],
      check: '"the canal followed growth rather than creating it."',
      whyWrong: {
        B: 'This is a true detail used as evidence, but it is too narrow to be the main idea.',
        C: 'The text uses tax ledgers but never claims they are the most reliable source.',
        D: 'The text never discusses the towns declining.',
      },
      takeaway: 'When a text says "Historians have long said... But," the main idea is usually the challenge to that view.',
    },
    hints: [
      'This is a main idea question. Look for a turn in the text.',
      'What view do historians hold, and what does Restrepo argue instead?',
      'One choice is true but only a supporting detail. Look for the choice that covers the argument.',
    ],
    formatTags: ['mcq', 'history'],
  }),

  // ---------------- Command of Evidence ----------------
  rw({
    skillId: 'rw.ii.evidence', n: '001', type: 'textual', difficulty: 'medium',
    passage:
      "Sociologist Dana Whitcombe hypothesized that residents of the fictional city of Port Alder who use the public library regularly are more likely to know their neighbors' names than residents who rarely use it. She reasoned that library programs, such as book clubs and workshops, bring neighbors into repeated contact.",
    prompt: "Which finding, if true, would most directly support Whitcombe's hypothesis?",
    choices: [
      "Port Alder's library has expanded its hours twice in the past five years.",
      'Residents who rarely use the library report reading as many books per year as regular library users do.',
      'Regular library users in Port Alder could name, on average, more of their neighbors than residents who rarely used the library could.',
      'Most Port Alder residents say that they would like the library to offer more programs for children.',
    ],
    answer: 'C',
    explanation: {
      answerSummary: 'C: it compares the two groups on exactly what the hypothesis predicts, knowing neighbors\' names.',
      steps: [
        'Restate the claim: regular library users know more neighbors\' names than rare users.',
        'Look for a finding that compares those two groups on that measure.',
        'Only C compares regular and rare users on naming neighbors.',
      ],
      check: 'The hypothesis says regular users "are more likely to know their neighbors\' names"; C reports that regular users "could name, on average, more of their neighbors."',
      whyWrong: {
        A: 'Library hours say nothing about whether users know their neighbors.',
        B: 'This compares reading habits, not knowledge of neighbors.',
        D: 'Residents\' wishes for programs do not show any link to knowing neighbors.',
      },
      takeaway: 'Supporting evidence must match the specific claim, including the groups and the outcome being compared.',
    },
    hints: [
      'This asks for evidence that supports a hypothesis.',
      'State the hypothesis in your own words: which two groups, and what difference?',
      'Eliminate any choice that does not compare those two groups on knowing neighbors.',
    ],
    formatTags: ['mcq', 'social_science'],
  }),
  rw({
    skillId: 'rw.ii.evidence', n: '002', type: 'quantitative', difficulty: 'hard',
    passage:
      'A team led by marine biologist Hana Ishikawa measured the growth of a fictional coral species, *Acropora vellana*, at four reef sites with different average water temperatures over one year. The team concluded that the coral\'s growth slows sharply once average water temperature rises above about 28°C, rather than declining steadily as temperature increases.',
    table: {
      caption: 'Average Water Temperature and Annual Growth of *Acropora vellana*',
      headers: ['Site', 'Average water temperature (°C)', 'Average annual growth (mm)'],
      rows: [
        ['North Shoal', '26.1', '14.2'],
        ['Coral Bay', '27.4', '13.8'],
        ['East Ledge', '28.6', '7.9'],
        ['Outer Reef', '29.3', '6.5'],
      ],
    },
    prompt: "Which choice most effectively uses data from the table to support the team's conclusion?",
    choices: [
      'Growth fell by only 0.4 mm from North Shoal to Coral Bay, but it fell by 5.9 mm from Coral Bay to East Ledge, the first site above 28°C.',
      'Outer Reef had the highest average water temperature and the lowest average annual growth of the four sites.',
      'Average annual growth at East Ledge was 7.9 mm, which was greater than the growth at Outer Reef.',
      'Average annual growth at North Shoal was more than twice the growth at Outer Reef.',
    ],
    answer: 'A',
    explanation: {
      answerSummary: 'A: it shows a small drop below 28°C and a large drop just past 28°C, which is the "sharp, not steady" pattern.',
      steps: [
        'The conclusion is about a pattern: little change below about 28°C, then a sharp drop above it.',
        'To support it, a choice must contrast the change below 28°C with the change across 28°C.',
        'Check A: 14.2 − 13.8 = 0.4 and 13.8 − 7.9 = 5.9. Both values are accurate and show the pattern.',
      ],
      check: 'Table: Coral Bay 27.4°C, 13.8 mm; East Ledge 28.6°C, 7.9 mm. The drop of 5.9 mm across 28°C is far larger than the 0.4 mm drop below it.',
      whyWrong: {
        B: 'Accurate, but it shows only that hotter water goes with less growth, which a steady decline would also show.',
        C: 'Accurate, but comparing two sites that are both above 28°C says nothing about a sharp change at 28°C.',
        D: 'Accurate, but comparing the two extremes cannot tell a sharp drop from a steady one.',
      },
      takeaway: 'With data questions, every choice may be true; pick the one that proves the exact claim.',
    },
    hints: [
      'This is quantitative evidence: use the table to support a specific conclusion.',
      'The conclusion says growth drops sharply above 28°C rather than steadily. What would you need to compare?',
      'Compare the drop between the two cooler sites with the drop between Coral Bay and East Ledge.',
    ],
    formatTags: ['mcq', 'table', 'science'],
  }),
  rw({
    skillId: 'rw.ii.evidence', n: '003', type: 'textual', difficulty: 'medium',
    passage:
      '*The Salt Orchard* is a 1931 novel by the fictional author Ruth Calloway. In the novel, the narrator portrays her uncle Silas as someone who hides his kindness behind a gruff manner.',
    prompt: 'Which quotation from *The Salt Orchard* most effectively illustrates the claim?',
    choices: [
      '"Uncle Silas rose each day at five and walked the orchard rows before breakfast."',
      '"Uncle Silas spoke warmly to everyone in town, and everyone in town spoke warmly of him."',
      '"Uncle Silas complained loudly about the neighbors\' goats, and he never let them forget it."',
      '"Uncle Silas grumbled that the widow\'s roof was none of his business, then spent the whole Saturday patching it."',
    ],
    answer: 'D',
    explanation: {
      answerSummary: 'D: he grumbles (gruff manner) but then fixes the roof (hidden kindness), showing both parts of the claim.',
      steps: [
        'Split the claim into two parts: a gruff manner and kindness underneath.',
        'Test each quotation for both parts.',
        'Only D shows him acting gruff and then doing something kind.',
      ],
      check: '"grumbled that the widow\'s roof was none of his business" (gruff) + "spent the whole Saturday patching it" (kind).',
      whyWrong: {
        A: 'This shows a daily habit, not gruffness or kindness.',
        B: 'This shows open warmth, not kindness hidden behind gruffness.',
        C: 'This shows gruffness only, with no kindness.',
      },
      takeaway: 'When a claim has two parts, the right quotation must show both.',
    },
    hints: [
      'This asks for a quotation that illustrates a claim about a character.',
      'Break the claim into its two parts: how Silas acts and what he is really like.',
      'Eliminate quotations that show only one of the two parts.',
    ],
    formatTags: ['mcq', 'literature'],
  }),

  // ---------------- Inferences ----------------
  rw({
    skillId: 'rw.ii.inference', n: '001', type: 'logical_completion', difficulty: 'easy',
    passage:
      'Botanist Elif Durmaz grew two groups of a fictional desert shrub, *Larrea minor*, in identical soil. One group received water daily; the other received water once a week. After three months, the weekly-watered shrubs had developed roots nearly twice as deep as those of the daily-watered shrubs, though the two groups had reached similar heights. Durmaz concluded that the shrub\'s root depth depends at least partly on ______',
    prompt: 'Which choice most logically completes the text?',
    choices: [
      'the type of soil in which the shrub is planted.',
      'how often the shrub receives water.',
      'the height the shrub reaches above ground.',
      'the amount of sunlight the shrub receives.',
    ],
    answer: 'B',
    explanation: {
      answerSummary: 'B: watering frequency was the only difference between the groups, and root depth differed.',
      steps: [
        'Identify what differed between the two groups: only how often they were watered.',
        'Identify the result: root depth differed greatly.',
        'So root depth depends at least partly on watering frequency.',
      ],
      check: '"in identical soil" and "One group received water daily; the other received water once a week."',
      whyWrong: {
        A: 'The soil was identical, so it cannot explain the difference.',
        C: 'The groups had similar heights but very different roots, so height does not explain root depth.',
        D: 'Sunlight is never mentioned or varied in the study.',
      },
      takeaway: 'In an experiment, the conclusion should point to the one thing that was changed.',
    },
    hints: [
      'This is a logical completion: finish the reasoning the text sets up.',
      'What was different between the two groups of shrubs?',
      'Eliminate anything that was the same for both groups or never mentioned.',
    ],
    formatTags: ['mcq', 'science'],
  }),
  rw({
    skillId: 'rw.ii.inference', n: '002', type: 'logical_completion', difficulty: 'hard',
    passage:
      'In the fictional port city of Calloran, officials in the 1700s recorded every cargo that arrived in a harbor register. Historian Ines Moreau noticed that the register lists no shipments of tea between 1752 and 1758, yet household inventories from the same years show that many Calloran families owned tea that had been bought during that period. Because the register was required by law for all goods entering the harbor, Moreau concluded that ______',
    prompt: 'Which choice most logically completes the text?',
    choices: [
      'tea was not popular among Calloran families during the 1750s.',
      'Calloran families stopped buying tea after 1758.',
      'some tea reached Calloran during those years without being recorded in the harbor register.',
      'the household inventories were written long after 1758 and are therefore unreliable.',
    ],
    answer: 'C',
    explanation: {
      answerSummary: 'C: families bought tea in years when the register shows none, so some tea must have arrived unrecorded.',
      steps: [
        'Fact 1: the register shows no tea arriving from 1752 to 1758.',
        'Fact 2: families owned tea bought during those same years.',
        'Both facts can be true only if some tea arrived without being recorded.',
      ],
      check: '"lists no shipments of tea between 1752 and 1758, yet household inventories... show that many Calloran families owned tea that had been bought during that period."',
      whyWrong: {
        A: 'Many families owned tea, which suggests it was popular, not unpopular.',
        B: 'The text gives no information about tea buying after 1758.',
        D: 'Nothing in the text questions when the inventories were written or whether they are reliable.',
      },
      takeaway: 'When two sources conflict, the right inference explains how both could be true without adding outside facts.',
    },
    hints: [
      'This is a logical completion. Look for a conflict between two sources.',
      'What does the register show, and what do the household inventories show?',
      'Ask: how could families have tea from those years if the register lists none?',
    ],
    formatTags: ['mcq', 'history'],
  }),
  rw({
    skillId: 'rw.ii.inference', n: '003', type: 'logical_completion', difficulty: 'medium',
    passage:
      "Economists studying the fictional town of Bellmont found that when the town's only grocery store extended its closing time from 8 p.m. to midnight, its total weekly sales did not change. Sales between 6 a.m. and 8 p.m., however, dropped by roughly the same amount that the new late-night hours added. This pattern suggests that ______",
    prompt: 'Which choice most logically completes the text?',
    choices: [
      'many shoppers changed when they shopped rather than buying more groceries overall.',
      'the store attracted many new customers from neighboring towns.',
      "the store's late-night prices were higher than its daytime prices.",
      'most Bellmont residents prefer to shop in the early morning.',
    ],
    answer: 'A',
    explanation: {
      answerSummary: 'A: total sales stayed the same while daytime sales fell by what late-night sales added, so purchases shifted in time.',
      steps: [
        'Total sales: unchanged.',
        'Daytime sales fell by about the amount late-night sales added.',
        'So the same buying moved to later hours instead of growing.',
      ],
      check: '"its total weekly sales did not change" and daytime sales "dropped by roughly the same amount that the new late-night hours added."',
      whyWrong: {
        B: 'Many new customers would likely raise total sales, but total sales did not change.',
        C: 'The text gives no information about prices.',
        D: 'Daytime sales fell, and nothing in the text singles out early morning.',
      },
      takeaway: 'If a total stays the same while one part rises, another part must have fallen to make up for it.',
    },
    hints: [
      'This is a logical completion about a pattern in data.',
      'What happened to total sales, and what happened to daytime sales?',
      'If the total did not grow, where did the late-night sales come from?',
    ],
    formatTags: ['mcq', 'social_science'],
  }),

  // ---------------- Words in Context ----------------
  rw({
    skillId: 'rw.cs.words', n: '001', type: 'completion', difficulty: 'easy',
    passage:
      'Architect Sunita Rao is known for buildings that blend into their surroundings. Her library in the fictional hill town of Perrow, for example, is built from local stone and set partly into the slope, so that from a distance it is almost ______: visitors often walk within a few meters of it before noticing it at all.',
    prompt: 'Which choice completes the text with the most logical and precise word?',
    choices: ['ornate', 'crumbling', 'towering', 'inconspicuous'],
    answer: 'D',
    explanation: {
      answerSummary: 'D: "inconspicuous" means hard to notice, which matches visitors not noticing the building.',
      steps: [
        'Find the clue after the colon: visitors walk close before "noticing it at all."',
        'Predict a word: "hidden" or "unnoticeable."',
        '"Inconspicuous" means not easily noticed.',
      ],
      check: '"blend into their surroundings" and "visitors often walk within a few meters of it before noticing it at all."',
      whyWrong: {
        A: '"Ornate" means highly decorated, which would make the building stand out.',
        B: '"Crumbling" means falling apart; nothing suggests the library is damaged.',
        C: '"Towering" means very tall, which would make it easy to notice.',
      },
      takeaway: 'A colon often explains the word before it, so use what follows the colon as your clue.',
    },
    hints: [
      'This is a words-in-context question: predict the word before reading the choices.',
      'Read the part after the colon. What does it tell you about the building?',
      'Your word should mean something like "hard to notice."',
    ],
    formatTags: ['mcq', 'humanities'],
  }),
  rw({
    skillId: 'rw.cs.words', n: '002', type: 'meaning', difficulty: 'medium',
    passage:
      'The following text is from a short story by the fictional writer Marguerite Osei. Tomas is a young baker preparing for his first market day.\n\nTomas had practiced the recipe a hundred times, yet on the morning of the market he found that his confidence had grown thin. He checked the oven temperature twice, then a third time, and rearranged the loaves on their tray until his sister laughed and told him to leave them alone.',
    prompt: 'As used in the text, what does the word "thin" most nearly mean?',
    choices: ['narrow', 'weak', 'slender', 'watery'],
    answer: 'B',
    explanation: {
      answerSummary: 'B: his confidence had become weak, as shown by his nervous rechecking.',
      steps: [
        '"Thin" describes his confidence, not an object.',
        'The next sentence shows nervousness: checking the oven three times and rearranging loaves.',
        'So his confidence had become weak.',
      ],
      check: '"yet on the morning of the market he found that his confidence had grown thin. He checked the oven temperature twice, then a third time..."',
      whyWrong: {
        A: '"Narrow" describes physical width, which does not apply to confidence here.',
        C: '"Slender" describes a body or object, not a feeling.',
        D: '"Watery" describes liquids, such as soup, not confidence.',
      },
      takeaway: 'Replace the word with each choice and ask whether it fits what is being described.',
    },
    hints: [
      'This is a meaning-in-context question: the common meaning may not fit.',
      'Notice what "thin" describes. Is it an object or a feeling?',
      'Use his actions in the next sentence to decide how his confidence changed.',
    ],
    formatTags: ['mcq', 'literature'],
  }),
  rw({
    skillId: 'rw.cs.words', n: '003', type: 'completion', difficulty: 'hard',
    passage:
      "Some researchers have described the fictional deep-sea fish *Benthophis ardens* as a voracious predator. Biologist Kofi Mensah's video recordings, however, show the fish spending most of its time motionless near the seafloor and striking only at the rare prey that drifts directly past it. Mensah's observations suggest that the fish's hunting strategy is better described as ______ than as aggressive.",
    prompt: 'Which choice completes the text with the most logical and precise word?',
    choices: ['relentless', 'erratic', 'opportunistic', 'cooperative'],
    answer: 'C',
    explanation: {
      answerSummary: 'C: the fish waits and strikes only when prey happens to pass, which is opportunistic hunting.',
      steps: [
        'The word must contrast with "aggressive" ("better described as ___ than as aggressive").',
        'The evidence: the fish stays still and strikes only at prey that drifts past.',
        '"Opportunistic" means taking advantage of chances as they come.',
      ],
      check: '"spending most of its time motionless near the seafloor and striking only at the rare prey that drifts directly past it."',
      whyWrong: {
        A: '"Relentless" means never stopping, which is close to "aggressive" and opposite to the fish\'s stillness.',
        B: '"Erratic" means irregular or unpredictable, but the fish follows a steady wait-and-strike pattern.',
        D: '"Cooperative" means working with others, and the text describes no other fish.',
      },
      takeaway: 'Use the contrast word ("however," "rather than") to set the direction of the missing word, then match the evidence.',
    },
    hints: [
      'This is a word completion: predict a word that contrasts with "aggressive."',
      'Look at Mensah\'s recordings. What does the fish do most of the time, and when does it strike?',
      'Your word should describe waiting for chances rather than chasing prey.',
    ],
    formatTags: ['mcq', 'science'],
  }),

  // ---------------- Text Structure and Purpose ----------------
  rw({
    skillId: 'rw.cs.structure', n: '001', type: 'purpose', difficulty: 'medium',
    passage:
      'Many listeners assume that the fictional composer Ilse Brandt wrote her famous *Harbor Suite* quickly, in a burst of inspiration after a single visit to the sea. Letters held in the Brandt family archive tell a different story. They show that Brandt drafted and discarded at least six versions of the suite\'s opening over nearly four years, and that she returned to the harbor again and again to listen to the sounds she was trying to capture.',
    prompt: 'Which choice best describes the main purpose of the text?',
    choices: [
      'To present evidence that challenges a common belief about how a piece of music was composed',
      "To argue that the *Harbor Suite* is Brandt's most important work",
      'To describe in detail the harbor sounds that inspired Brandt',
      "To explain why Brandt's family chose to preserve her letters",
    ],
    answer: 'A',
    explanation: {
      answerSummary: 'A: the text states a common assumption, then uses letters to show it is wrong.',
      steps: [
        'Sentence 1: a common belief (Brandt wrote quickly after one visit).',
        'Sentences 2–3: letters "tell a different story" with evidence of years of revision.',
        'So the text presents evidence against a common belief.',
      ],
      check: '"Many listeners assume..." followed by "Letters held in the Brandt family archive tell a different story."',
      whyWrong: {
        B: 'The text calls the suite "famous" but never ranks it among her works.',
        C: 'The text mentions the sounds but never describes them in detail.',
        D: 'The text never explains why the letters were kept.',
      },
      takeaway: 'For purpose questions, describe what the text does (challenges, explains, compares), not just its topic.',
    },
    hints: [
      'This asks for the purpose of the whole text: what is the author doing?',
      'Notice the turn from "Many listeners assume" to "tell a different story."',
      'Pick the choice that fits every sentence, not just one.',
    ],
    formatTags: ['mcq', 'humanities'],
  }),
  rw({
    skillId: 'rw.cs.structure', n: '002', type: 'sentence_function', difficulty: 'medium',
    passage:
      'For decades, scientists assumed that the fictional Arden salamander could survive only in cold mountain streams. __In 2019, however, ecologist Rafael Duarte found a thriving population in a warm lowland pond more than 80 kilometers from the nearest mountain.__ Duarte\'s discovery has prompted researchers to reexamine which habitats the species can tolerate and to survey lowland ponds that had previously been ignored.',
    prompt: 'Which choice best describes the function of the underlined sentence in the text as a whole?',
    choices: [
      'It provides an example that confirms the assumption described in the first sentence.',
      'It explains why scientists held the assumption described in the first sentence.',
      'It presents a finding that conflicts with the assumption described in the first sentence.',
      'It summarizes the research methods described in the last sentence.',
    ],
    answer: 'C',
    explanation: {
      answerSummary: 'C: a thriving population in a warm lowland pond contradicts the belief that the species lives only in cold mountain streams.',
      steps: [
        'Sentence 1 gives an assumption: only cold mountain streams.',
        'The underlined sentence begins with "however" and reports a warm lowland population.',
        'That finding conflicts with the assumption, and the last sentence describes the response to it.',
      ],
      check: '"could survive only in cold mountain streams" vs. "a thriving population in a warm lowland pond."',
      whyWrong: {
        A: 'A warm lowland population goes against the assumption; it does not confirm it.',
        B: 'The sentence reports a new discovery, not the reasons for the old belief.',
        D: 'The sentence comes before the last sentence and reports a finding, not methods.',
      },
      takeaway: 'Words like "however" often signal that a sentence pushes back against what came before it.',
    },
    hints: [
      'This asks what the underlined sentence does in the text.',
      'Compare the underlined sentence with the assumption in the first sentence.',
      'Notice the word "however." Does the sentence agree with or go against the assumption?',
    ],
    formatTags: ['mcq', 'underlined', 'science'],
  }),
  rw({
    skillId: 'rw.cs.structure', n: '003', type: 'overall_structure', difficulty: 'hard',
    passage:
      'In 1867, residents of the fictional river town of Lanford voted to build a stone bridge to replace their ferry. Supporters promised that the bridge would draw traders from across the region. Within a decade, however, a new railroad bypassed Lanford entirely, and traders followed the rail line instead. The bridge, built at great expense, saw so little traffic that the town eventually reopened the ferry to save on maintenance costs.',
    prompt: 'Which choice best describes the overall structure of the text?',
    choices: [
      'It describes a problem facing a town and then explains how the town\'s residents solved it.',
      'It describes a decision made with a particular expectation and then explains how an unforeseen development kept that expectation from being met.',
      'It compares two ways of crossing a river and argues that one is better than the other.',
      'It presents two historians\' differing interpretations of a town\'s decision.',
    ],
    answer: 'B',
    explanation: {
      answerSummary: 'B: Lanford built a bridge expecting traders, but the new railroad drew traders away.',
      steps: [
        'Part 1: the decision (build a bridge) and the expectation (draw traders).',
        'Part 2: "however," a railroad bypassed the town, and traders went elsewhere.',
        'Part 3: the bridge saw little traffic, so the expectation was not met.',
      ],
      check: '"Supporters promised that the bridge would draw traders" followed by "a new railroad bypassed Lanford entirely, and traders followed the rail line instead."',
      whyWrong: {
        A: 'The bridge did not solve anything; it saw so little traffic that the town reopened the ferry.',
        C: 'The text mentions a bridge and a ferry but never argues that one is better.',
        D: 'No historians or competing interpretations appear in the text.',
      },
      takeaway: 'For structure questions, label each part of the text (claim, turn, result) before reading the choices.',
    },
    hints: [
      'This asks how the whole text is organized.',
      'Label each sentence: what was decided, what was expected, and what actually happened?',
      'Ask whether the bridge met the hopes its supporters had for it.',
    ],
    formatTags: ['mcq', 'history'],
  }),

  // ---------------- Cross-Text Connections ----------------
  rw({
    skillId: 'rw.cs.crosstext', n: '001', type: 'response', difficulty: 'medium',
    passage:
      'Many ecologists have argued that urban parks benefit native birds mainly by providing food. On this view, planting more fruiting shrubs in a park should be the most effective way to increase the number of native bird species that live there.',
    passage2:
      'Ecologist Yara Lindqvist surveyed twenty parks in the fictional city of Esterholm. Parks with abundant fruiting shrubs did not host more native bird species than other parks did. Instead, the number of native species was most closely tied to the amount of dense, low cover: thick brush where birds can nest and hide from predators.',
    prompt: 'Based on the texts, how would the author of Text 2 most likely respond to the view presented in Text 1?',
    choices: [
      'By agreeing that food is the main factor that determines how many native bird species live in a park',
      'By arguing that urban parks do not benefit native birds in any way',
      'By claiming that fruiting shrubs harm native birds by attracting predators',
      'By suggesting that adding dense, low cover may do more to increase native bird species in a park than planting fruiting shrubs would',
    ],
    answer: 'D',
    explanation: {
      answerSummary: 'D: Text 2 finds that dense, low cover, not fruiting shrubs, best predicts the number of native species.',
      steps: [
        'Text 1: more fruiting shrubs should be the best way to add native species.',
        'Text 2: fruiting shrubs did not matter much; dense, low cover did.',
        'So Text 2 would point to cover as the more effective change.',
      ],
      check: 'Text 2: "Parks with abundant fruiting shrubs did not host more native bird species" and "most closely tied to the amount of dense, low cover."',
      whyWrong: {
        A: 'Text 2\'s findings go against the idea that food is the main factor.',
        B: 'Text 2 says parks with cover host more species, so parks can clearly benefit birds.',
        C: 'Text 2 never says fruiting shrubs harm birds; it says they did not increase species counts.',
      },
      takeaway: 'Summarize each text\'s claim in one line, then ask exactly where they agree or disagree.',
    },
    hints: [
      'This is a cross-text question: compare the claims of two texts.',
      'Write one line for each text: what does each say increases native bird species?',
      'Avoid choices that go further than Text 2 actually does.',
    ],
    formatTags: ['mcq', 'paired_texts', 'science'],
  }),
  rw({
    skillId: 'rw.cs.crosstext', n: '002', type: 'response', difficulty: 'hard',
    passage:
      'Art historian Celeste Marchand argues that the fictional painter Oren Vale abandoned bright color in his later work because his eyesight was failing. As evidence, she points to letters in which Vale complains of blurred vision during the years when his palette turned to grays and browns.',
    passage2:
      "Vale's later palette has often been explained as a symptom of illness. Yet the restorer Ama Boateng, examining the paintings under ultraviolet light, found that Vale had first painted several of these works in vivid reds and blues and then deliberately covered those layers with muted tones. Such careful overpainting suggests that the shift was an artistic choice rather than a limitation.",
    prompt: "Based on the texts, how would the author of Text 2 most likely respond to Marchand's argument in Text 1?",
    choices: [
      'By pointing out that Vale painted bright layers and then covered them, which suggests he chose muted colors rather than being forced into them',
      "By agreeing that Vale's letters prove that his eyesight caused the change in his palette",
      'By arguing that Vale never complained about his eyesight in his letters',
      "By claiming that Vale's later paintings are more valuable than his earlier ones",
    ],
    answer: 'A',
    explanation: {
      answerSummary: 'A: Text 2 uses the hidden bright layers to argue the muted palette was a choice, which undercuts Marchand\'s eyesight explanation.',
      steps: [
        'Text 1: Vale stopped using bright color because his eyesight failed.',
        'Text 2: Vale painted bright colors first, then covered them on purpose.',
        'Text 2 concludes the shift was "an artistic choice rather than a limitation," so it would reject Marchand\'s cause.',
      ],
      check: 'Text 2: "deliberately covered those layers with muted tones" and "the shift was an artistic choice rather than a limitation."',
      whyWrong: {
        B: 'Text 2 disagrees with the eyesight explanation; it does not accept it.',
        C: 'Text 2 never disputes that the letters exist or what they say.',
        D: 'Text 2 says nothing about the value of the paintings.',
      },
      takeaway: 'An author can disagree with a conclusion without denying the other side\'s evidence; look for what the new evidence suggests instead.',
    },
    hints: [
      'This is a cross-text question: how would one author respond to the other?',
      'State the cause each text gives for Vale\'s change in color.',
      'Look for the choice that uses Text 2\'s evidence, not one that attacks evidence Text 2 never mentions.',
    ],
    formatTags: ['mcq', 'paired_texts', 'humanities'],
  }),
  rw({
    skillId: 'rw.cs.crosstext', n: '003', type: 'response', difficulty: 'easy',
    passage:
      'Some education researchers claim that homework in the early grades offers little benefit. In a study of the fictional Brookfield School District, researcher Leon Achebe found that second graders who received nightly homework scored no higher on end-of-year reading tests than second graders who received none.',
    passage2:
      'Studies of early-grade homework often measure only test scores. When researcher Priya Nandakumar interviewed families in a similar district, she found that brief homework assignments led many parents to read with their children more often, a habit that many families continued for years. Judging homework solely by short-term test results may miss such effects.',
    prompt: "Based on the texts, how would the author of Text 2 most likely respond to Achebe's finding in Text 1?",
    choices: [
      "By arguing that Achebe's test scores were calculated incorrectly",
      'By agreeing that early-grade homework has no value for students or families',
      'By accepting that homework may not raise end-of-year test scores while arguing that it can have other benefits the study did not measure',
      'By claiming that second graders should receive more homework than older students do',
    ],
    answer: 'C',
    explanation: {
      answerSummary: 'C: Text 2 does not dispute the test results but says test scores miss benefits such as family reading habits.',
      steps: [
        'Text 1: homework did not raise test scores, so it offers little benefit.',
        'Text 2: tests miss other effects, like parents reading with children.',
        'So Text 2 would accept the test result but reject "little benefit."',
      ],
      check: 'Text 2: "Judging homework solely by short-term test results may miss such effects."',
      whyWrong: {
        A: 'Text 2 never questions how the scores were calculated.',
        B: 'Text 2 describes benefits of homework, so it would not agree that homework has no value.',
        D: 'Text 2 never compares second graders with older students.',
      },
      takeaway: 'A response can accept the other study\'s data while questioning what that data leaves out.',
    },
    hints: [
      'This is a cross-text question about one author\'s response to a finding.',
      'What does Text 2 say about measuring homework only by test scores?',
      'Does Text 2 deny Achebe\'s result, or say it is incomplete?',
    ],
    formatTags: ['mcq', 'paired_texts', 'social_science'],
  }),

  // ---------------- Rhetorical Synthesis ----------------
  rw({
    skillId: 'rw.eoi.synthesis', n: '001', type: 'notes_goal', difficulty: 'medium',
    passage:
      'While researching a topic, a student has taken the following notes:\n\n• Kestrel Lake is a fictional lake in a northern forest region.\n\n• In 2015, Kestrel Lake had an estimated 1,200 common loons.\n\n• In 2023, it had an estimated 1,850 common loons.\n\n• A 2016 rule banned motorboats on the lake\'s northern half.\n\n• Loons build nests at the water\'s edge, where boat wakes can flood them.',
    prompt: 'The student wants to present a possible explanation for the change in the lake\'s loon population. Which choice most effectively uses relevant information from the notes to accomplish this goal?',
    choices: [
      "Kestrel Lake's estimated loon population rose from 1,200 in 2015 to 1,850 in 2023.",
      "Kestrel Lake's estimated loon population rose from 1,200 to 1,850 after a 2016 rule banned motorboats on the lake's northern half, a change that may have protected loons' shoreline nests from boat wakes.",
      'Loons build their nests at the water\'s edge on Kestrel Lake, which is home to an estimated 1,850 loons.',
      'In 2016, a rule banned motorboats on the northern half of Kestrel Lake.',
    ],
    answer: 'B',
    explanation: {
      answerSummary: 'B: it states the population change and links it to a likely cause (fewer boat wakes flooding nests).',
      steps: [
        'Goal: a possible explanation for the change, so the answer needs both the change and a cause.',
        'Eliminate choices that give only the change or only the rule.',
        'B connects the motorboat ban to nest protection and the population increase.',
      ],
      check: 'Goal words: "possible explanation for the change." B includes the change (1,200 to 1,850) and a cause ("may have protected loons\' shoreline nests from boat wakes").',
      whyWrong: {
        A: 'It states the change but offers no explanation for it.',
        C: 'It gives one population number and a nesting fact, but no change and no explanation.',
        D: 'It mentions the rule but does not connect it to loons or to any change.',
      },
      takeaway: 'In notes questions, the stated goal is the test: an accurate sentence that misses the goal is wrong.',
    },
    hints: [
      'This is a notes question: the goal in the prompt decides the answer.',
      'The goal asks for an explanation of a change. What two things must the sentence include?',
      'Eliminate any choice that mentions only the numbers or only the rule.',
    ],
    formatTags: ['mcq', 'notes', 'science'],
  }),
  rw({
    skillId: 'rw.eoi.synthesis', n: '002', type: 'notes_goal', difficulty: 'easy',
    passage:
      'While researching a topic, a student has taken the following notes:\n\n• The fictional Marlowe Textile Mill opened in 1848 in the town of Ashby Falls.\n\n• It was powered by a waterwheel on the Tess River.\n\n• The fictional Corwin Ironworks opened in 1851 in the nearby town of Redcliff.\n\n• It was powered by coal-fired steam engines.\n\n• Both businesses employed about 300 workers at their peak.',
    prompt: 'The student wants to emphasize a difference between the two businesses. Which choice most effectively uses relevant information from the notes to accomplish this goal?',
    choices: [
      'The Marlowe Textile Mill and the Corwin Ironworks each employed about 300 workers at their peak.',
      'The Marlowe Textile Mill opened in Ashby Falls in 1848, near the Tess River.',
      'Both the Marlowe Textile Mill and the Corwin Ironworks opened in the mid-1800s.',
      'While the Marlowe Textile Mill relied on a waterwheel, the Corwin Ironworks ran on coal-fired steam engines.',
    ],
    answer: 'D',
    explanation: {
      answerSummary: 'D: it contrasts the two power sources, which is a difference between the businesses.',
      steps: [
        'Goal: a difference between the two businesses, so the answer must mention both and contrast them.',
        'A and C describe similarities; B mentions only one business.',
        'D uses "While" to contrast waterwheel power with steam power.',
      ],
      check: 'Goal words: "a difference between the two businesses." D: "While the Marlowe Textile Mill relied on a waterwheel, the Corwin Ironworks ran on coal-fired steam engines."',
      whyWrong: {
        A: 'This is a similarity (same number of workers), not a difference.',
        B: 'This describes only one business, so it cannot show a difference.',
        C: 'This is a similarity (both opened in the mid-1800s).',
      },
      takeaway: 'A "difference" answer must name both things and show how they contrast.',
    },
    hints: [
      'This is a notes question: focus on the goal in the prompt.',
      'The goal is a difference. Which choices mention both businesses?',
      'Of those, which shows how the businesses were not alike?',
    ],
    formatTags: ['mcq', 'notes', 'history'],
  }),
  rw({
    skillId: 'rw.eoi.synthesis', n: '003', type: 'notes_goal', difficulty: 'hard',
    passage:
      'While researching a topic, a student has taken the following notes:\n\n• Adaeze Nwosu is a fictional novelist.\n\n• Her first novel, *Paper Rivers* (2009), is set in a fishing village.\n\n• *Paper Rivers* is told by a single narrator.\n\n• Her second novel, *The Glass Year* (2016), is set in a large city.\n\n• *The Glass Year* is told in alternating chapters by four narrators.\n\n• Critics praised both novels for their vivid descriptions of place.',
    prompt: "The student wants to emphasize how Nwosu's approach to narration changed between her two novels. Which choice most effectively uses relevant information from the notes to accomplish this goal?",
    choices: [
      "Whereas Nwosu's *Paper Rivers* (2009) relies on a single narrator, her *The Glass Year* (2016) alternates among four.",
      "Critics praised both of Nwosu's novels, *Paper Rivers* and *The Glass Year*, for their vivid descriptions of place.",
      '*The Glass Year*, published in 2016, is set in a large city and told in alternating chapters by four narrators.',
      "Nwosu's *Paper Rivers* is set in a fishing village, while her *The Glass Year* is set in a large city.",
    ],
    answer: 'A',
    explanation: {
      answerSummary: 'A: it contrasts the narration of the first novel (one narrator) with the second (four narrators).',
      steps: [
        'Goal: a change in narration, so the answer must compare narration across both novels.',
        'C describes narration in only one novel; D compares setting, not narration.',
        'A compares the number of narrators in the earlier and later novel.',
      ],
      check: 'Goal words: "approach to narration changed." A: "relies on a single narrator" vs. "alternates among four."',
      whyWrong: {
        B: 'This describes a similarity in description of place, not a change in narration.',
        C: 'This describes only *The Glass Year*, so it does not show a change.',
        D: 'This shows a change in setting, not in narration.',
      },
      takeaway: 'Check every key word of the goal: here, both "changed" and "narration" must be met.',
    },
    hints: [
      'This is a notes question with a two-part goal.',
      'The goal needs a change (two novels) and a specific topic (narration).',
      'Eliminate choices that cover only one novel or compare something other than narration.',
    ],
    formatTags: ['mcq', 'notes', 'literature'],
  }),

  // ---------------- Transitions ----------------
  rw({
    skillId: 'rw.eoi.transitions', n: '001', type: 'contrast', difficulty: 'easy',
    passage:
      'Most species of the fictional moth genus *Nocturna* are active only at night, relying on darkness to hide from birds. ______ *Nocturna solaris* feeds in full daylight, protected by bright warning colors that signal to birds that it is toxic.',
    prompt: 'Which choice completes the text with the most logical transition?',
    choices: ['Similarly,', 'Therefore,', 'By contrast,', 'For example,'],
    answer: 'C',
    explanation: {
      answerSummary: 'C: most species are active at night, but this one feeds in daylight, which is a contrast.',
      steps: [
        'Sentence 1: most *Nocturna* species are active only at night.',
        'Sentence 2: *N. solaris* feeds in full daylight.',
        'Night vs. daylight is a contrast, so use "By contrast."',
      ],
      check: '"active only at night" vs. "feeds in full daylight."',
      whyWrong: {
        A: '"Similarly" signals a likeness, but the second species behaves differently.',
        B: '"Therefore" signals a result, but daytime feeding does not follow from other species being nocturnal.',
        D: '"For example" would introduce an example of night activity, but *N. solaris* is an exception.',
      },
      takeaway: 'Name the relationship between the two sentences (contrast, cause, example) before looking at the choices.',
    },
    hints: [
      'This is a transitions question: identify how the two sentences relate.',
      'Compare when most *Nocturna* moths are active with when *N. solaris* feeds.',
      'Is the second sentence a similar case, a result, an example, or an exception?',
    ],
    formatTags: ['mcq', 'science'],
  }),
  rw({
    skillId: 'rw.eoi.transitions', n: '002', type: 'cause_effect', difficulty: 'medium',
    passage:
      'In the 1890s, the fictional city of Vellmar relied on wells that frequently became contaminated during spring floods. Outbreaks of illness followed nearly every flood season. ______ the city council approved funding in 1897 for a reservoir and a network of pipes to carry clean water from the hills.',
    prompt: 'Which choice completes the text with the most logical transition?',
    choices: ['Nevertheless,', 'Consequently,', 'Likewise,', 'In other words,'],
    answer: 'B',
    explanation: {
      answerSummary: 'B: repeated contamination and illness led the council to fund clean water, which is cause and effect.',
      steps: [
        'Earlier sentences: contaminated wells and repeated illness (a problem).',
        'Final sentence: the council funds a clean water system (a response).',
        'The response is a result of the problem, so use "Consequently."',
      ],
      check: '"Outbreaks of illness followed nearly every flood season" leads to "the city council approved funding... for a reservoir."',
      whyWrong: {
        A: '"Nevertheless" signals an unexpected outcome, but fixing the water supply is the expected response.',
        C: '"Likewise" signals a similar point, but the funding is a response, not a similar problem.',
        D: '"In other words" signals a restatement, but the funding decision is new information.',
      },
      takeaway: 'Problem followed by a response usually calls for a cause-and-effect transition.',
    },
    hints: [
      'This is a transitions question.',
      'What problem do the first two sentences describe, and what does the last sentence describe?',
      'Is the council\'s decision a contrast, a restatement, a similar case, or a result?',
    ],
    formatTags: ['mcq', 'history'],
  }),
  rw({
    skillId: 'rw.eoi.transitions', n: '003', type: 'addition_example', difficulty: 'hard',
    passage:
      'Linguist Tomoko Hayashi argues that the fictional island language Valtic borrows words mainly for things that first arrived on the island through trade. Many Valtic words for metal tools, ______ come from the language of the merchants who first brought such tools to the island, while Valtic words for traditional fishing gear have no foreign origin.',
    prompt: 'Which choice completes the text with the most logical transition?',
    choices: ['however,', 'nonetheless,', 'instead,', 'for instance,'],
    answer: 'D',
    explanation: {
      answerSummary: 'D: metal-tool words borrowed from traders are a specific example of Hayashi\'s general claim.',
      steps: [
        'Sentence 1 makes a general claim: Valtic borrows words for things that arrived through trade.',
        'Sentence 2 gives a specific case: words for traded metal tools are borrowed.',
        'A specific case of a general claim is an example, so use "for instance."',
      ],
      check: '"borrows words mainly for things that first arrived on the island through trade" is illustrated by "words for metal tools... come from the language of the merchants."',
      whyWrong: {
        A: '"However" signals contrast, but the second sentence supports the first.',
        B: '"Nonetheless" signals something true despite what came before, but nothing in sentence 2 goes against sentence 1.',
        C: '"Instead" signals a replacement, but sentence 2 does not replace any idea from sentence 1.',
      },
      takeaway: 'A transition in the middle of a sentence still links that sentence to the one before it; ignore the "while" contrast inside the sentence.',
    },
    hints: [
      'This is a transitions question with the blank in the middle of a sentence.',
      'Compare sentence 2 as a whole with the general claim in sentence 1.',
      'Does sentence 2 go against the claim, or show a case of it?',
    ],
    formatTags: ['mcq', 'social_science'],
  }),

  // ---------------- Boundaries ----------------
  rw({
    skillId: 'rw.sec.boundaries', n: '001', type: 'clause_join', difficulty: 'easy',
    passage:
      'Glaciologists have tracked the fictional Tarrow Glacier for decades. The glacier has retreated nearly two kilometers since ______ its meltwater now feeds a lake that did not exist a century ago.',
    prompt: 'Which choice completes the text so that it conforms to the conventions of Standard English?',
    choices: ['1950, and', '1950,', '1950 and,', '1950'],
    answer: 'A',
    explanation: {
      answerSummary: 'A: two independent clauses can be joined with a comma plus a coordinating conjunction ("and").',
      steps: [
        'Left side: "The fictional Tarrow Glacier has retreated nearly two kilometers since 1950" is a complete sentence.',
        'Right side: "its meltwater now feeds a lake..." is also a complete sentence.',
        'Two complete sentences need a period, a semicolon, or a comma + and/but/so. Only A does this.',
      ],
      check: 'Rule: join two independent clauses with a comma and a coordinating conjunction (", and").',
      whyWrong: {
        B: 'A comma alone between two independent clauses creates a comma splice.',
        C: 'The comma must come before "and," not after it.',
        D: 'No punctuation between two independent clauses creates a run-on sentence.',
      },
      takeaway: 'Two complete sentences cannot be joined by a comma alone; add "and/but/so" or use a period or semicolon.',
    },
    hints: [
      'This is a sentence-boundary question: the choices differ only in punctuation.',
      'Check whether the words before and after the blank could each stand alone as a sentence.',
      'If both sides are complete, ask which choices correctly join two complete sentences.',
    ],
    formatTags: ['mcq', 'science'],
  }),
  rw({
    skillId: 'rw.sec.boundaries', n: '002', type: 'nonessential', difficulty: 'hard',
    passage:
      'The fictional ceramicist Hollis Grey, whose glazes were made from ash collected at her own wood-fired ______ rarely sold her work during her lifetime. Today, her bowls are prized by collectors.',
    prompt: 'Which choice completes the text so that it conforms to the conventions of Standard English?',
    choices: ['kiln;', 'kiln', 'kiln—', 'kiln,'],
    answer: 'D',
    explanation: {
      answerSummary: 'D: the nonessential clause opened with a comma after "Grey," so it must close with a comma.',
      steps: [
        'Spot the extra information: "whose glazes were made from ash collected at her own wood-fired kiln."',
        'It opens with a comma after "Grey," so it must close with matching punctuation.',
        'Removing the clause leaves "The ceramicist Hollis Grey rarely sold her work," which confirms it is extra.',
      ],
      check: 'Rule: a nonessential element must be set off by matching punctuation on both sides (comma ... comma).',
      whyWrong: {
        A: 'A semicolon separates the subject "Hollis Grey" from its verb "sold" and must join two complete clauses.',
        B: 'Without closing punctuation, the nonessential clause runs into the main verb.',
        C: 'A dash cannot close an element that was opened with a comma.',
      },
      takeaway: 'Extra information takes matching punctuation on both sides: two commas, two dashes, or two parentheses.',
    },
    hints: [
      'This is a punctuation question about extra (nonessential) information.',
      'Find where the extra information begins. What punctuation opens it?',
      'The punctuation that closes it must match the punctuation that opens it.',
    ],
    formatTags: ['mcq', 'humanities'],
  }),
  rw({
    skillId: 'rw.sec.boundaries', n: '003', type: 'colon_dash', difficulty: 'medium',
    passage:
      'City planners in the fictional town of Mirefield wanted to know what mattered most to residents. A survey of residents identified the feature they valued most in their ______ safe, well-lit sidewalks.',
    prompt: 'Which choice completes the text so that it conforms to the conventions of Standard English?',
    choices: ['neighborhoods, these were', 'neighborhoods:', 'neighborhoods;', 'neighborhoods, which'],
    answer: 'B',
    explanation: {
      answerSummary: 'B: a colon can follow a complete clause to introduce an explanation, here the feature residents valued.',
      steps: [
        'The words before the blank form a complete clause ending with "neighborhoods."',
        'The words after ("safe, well-lit sidewalks") name the feature mentioned before.',
        'A colon after a complete clause introduces that kind of explanation.',
      ],
      check: 'Rule: use a colon after an independent clause to introduce an explanation, example, or list.',
      whyWrong: {
        A: '"these were safe, well-lit sidewalks" is a complete clause, so joining it with only a comma creates a comma splice.',
        C: 'A semicolon must be followed by a complete clause, but "safe, well-lit sidewalks" has no verb.',
        D: '"which safe, well-lit sidewalks" has no verb, so the sentence does not make sense.',
      },
      takeaway: 'Use a colon when a complete clause sets up something that the words after the colon explain or name.',
    },
    hints: [
      'This is a punctuation question about colons and semicolons.',
      'Is the part before the blank a complete sentence? Is the part after it?',
      'Ask which punctuation mark can introduce a phrase that names "the feature."',
    ],
    formatTags: ['mcq', 'social_science'],
  }),

  // ---------------- Form, Structure, and Sense ----------------
  rw({
    skillId: 'rw.sec.form', n: '001', type: 'sv_agreement', difficulty: 'medium',
    passage:
      'The collection of fossilized leaves unearthed near the fictional village of Odran ______ researchers with clues about the region\'s climate roughly 40 million years ago.',
    prompt: 'Which choice completes the text so that it conforms to the conventions of Standard English?',
    choices: ['provide', 'have provided', 'provides', 'are providing'],
    answer: 'C',
    explanation: {
      answerSummary: 'C: the subject is the singular noun "collection," so it needs the singular verb "provides."',
      steps: [
        'Cross out the phrases between subject and verb: "of fossilized leaves unearthed near... Odran."',
        'The subject left is "The collection," which is singular.',
        'A singular subject takes a singular verb: "provides."',
      ],
      check: 'Rule: a verb agrees with its subject ("collection"), not with a noun inside a prepositional phrase ("leaves").',
      whyWrong: {
        A: '"Provide" is plural and agrees with "leaves," not with the subject "collection."',
        B: '"Have provided" is plural and does not agree with "collection."',
        D: '"Are providing" is plural and does not agree with "collection."',
      },
      takeaway: 'Cross out "of..." phrases to find the true subject before choosing the verb.',
    },
    hints: [
      'This is a subject-verb agreement question.',
      'Find the true subject by crossing out the phrase that begins with "of."',
      'Is that subject singular or plural?',
    ],
    formatTags: ['mcq', 'science'],
  }),
  rw({
    skillId: 'rw.sec.form', n: '002', type: 'pronoun_possessive', difficulty: 'medium',
    passage:
      'The fictional Brightwater Museum, known for its large collection of maps and ship models, reopened in 2021 after a renovation that doubled ______ gallery space.',
    prompt: 'Which choice completes the text so that it conforms to the conventions of Standard English?',
    choices: ['its', 'their', "it's", "its'"],
    answer: 'A',
    explanation: {
      answerSummary: 'A: the pronoun refers to the singular "Museum," and the possessive form of "it" is "its."',
      steps: [
        'Ask whose gallery space doubled: the museum\'s.',
        '"Museum" is singular, so the pronoun must be singular.',
        'The singular possessive pronoun is "its" (no apostrophe).',
      ],
      check: 'Rule: a pronoun must agree in number with its antecedent ("Museum"), and the possessive of "it" is "its"; "it\'s" means "it is."',
      whyWrong: {
        B: '"Their" is plural and would wrongly refer to "maps and ship models."',
        C: '"It\'s" means "it is," which does not make sense before "gallery space."',
        D: '"Its\'" is not a word in Standard English.',
      },
      takeaway: 'Find the pronoun\'s antecedent by meaning, not by the nearest noun, and remember "its" = possessive, "it\'s" = "it is."',
    },
    hints: [
      'This is a pronoun and possessive question.',
      'Ask what the gallery space belongs to. Is that noun singular or plural?',
      'Decide between the possessive form and the contraction for "it is."',
    ],
    formatTags: ['mcq', 'humanities'],
  }),
  rw({
    skillId: 'rw.sec.form', n: '003', type: 'modifier', difficulty: 'hard',
    passage:
      'In 1902, a small survey team mapped the fictional Halvar Mountains for the first time, producing charts still used by hikers today. Trained as a mapmaker before she ever studied geology, ______',
    prompt: 'Which choice completes the text so that it conforms to the conventions of Standard English?',
    choices: [
      'the 1902 survey was led by Clara Whitfield, who relied on her drafting skills.',
      "Clara Whitfield's drafting skills proved essential when she led the 1902 survey.",
      'the drafting skills of Clara Whitfield proved essential to the survey she led.',
      'Clara Whitfield relied on her drafting skills when she led the 1902 survey.',
    ],
    answer: 'D',
    explanation: {
      answerSummary: 'D: the person "trained as a mapmaker" is Clara Whitfield, so her name must come right after the comma.',
      steps: [
        'Ask who was "trained as a mapmaker": Clara Whitfield.',
        'An introductory modifier must be followed immediately by the noun it describes.',
        'Only D places "Clara Whitfield" directly after the comma.',
      ],
      check: 'Rule: a dangling modifier error occurs when an introductory phrase is not followed by the noun it describes.',
      whyWrong: {
        A: 'This says the survey was trained as a mapmaker.',
        B: 'The subject is "drafting skills," not Whitfield; the possessive "Whitfield\'s" does not make her the subject.',
        C: 'This says the drafting skills were trained as a mapmaker.',
      },
      takeaway: 'After an introductory modifier, the very next noun must be the one doing or receiving the action.',
    },
    hints: [
      'This is a modifier placement question.',
      'Who was "trained as a mapmaker"?',
      'Check which noun comes right after the comma in each choice; a possessive form does not count.',
    ],
    formatTags: ['mcq', 'history'],
  }),
];
