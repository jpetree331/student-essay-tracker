-- Demo dataset for new-teacher exploration. Loaded into the separate demo
-- database (demo.db) each time demo mode is turned on — never touches real
-- data. All names and writing samples are fictional.

INSERT INTO students (id, first_name, last_name, period, iep_flags, iep_goals, writing_goal, writing_goal_summary) VALUES
  (1, 'Marcus', 'Bell', 2, 'Written expression', 'Will write a paragraph with a claim and at least one piece of cited evidence in 3 of 4 opportunities.', 1, 'Add evidence from a named source'),
  (2, 'Aaliyah', 'Carter', 2, NULL, NULL, 0, NULL),
  (3, 'Diego', 'Fuentes', 2, 'Reading comprehension', 'Will identify key details from grade-level science text with 80% accuracy.', 1, 'Explain why the evidence matters'),
  (4, 'Emma', 'Nguyen', 2, NULL, NULL, 0, NULL),
  (5, 'Jayden', 'Osei', 4, 'Executive function', 'Will complete multi-step written tasks with no more than one prompt.', 1, 'Finish every part of the prompt'),
  (6, 'Sofia', 'Reyes', 4, NULL, NULL, 0, NULL),
  (7, 'Tyler', 'Simmons', 4, 'Written expression', 'Will expand written responses to 4+ sentences using a sentence-stem scaffold.', 1, 'Write more than two sentences'),
  (8, 'Zoe', 'Washington', 4, NULL, NULL, 0, NULL);

INSERT INTO assignments (id, name, unit, aks_standard, prompt_text, source_documents, date_assigned) VALUES
  (1, 'Cell Transport CER', 'Cells', 'SB1.c', 'Make a claim about why the gummy bear changed size in salt water. Support it with evidence from the lab data table and explain your reasoning.', 'Lab data table; textbook p. 84', '2026-02-09'),
  (2, 'Pedigree Argument', 'Genetics', 'SB3.a', 'Is the trait in the pedigree dominant or recessive? Cite at least two individuals from the pedigree as evidence.', 'Pedigree chart handout; Source 1 (article)', '2026-03-02'),
  (3, 'Peppered Moth IRR', 'Evolution', 'SB6.b', 'What caused the peppered moth population to change over time? Use the graph and at least one named source.', 'Source 1 (population graph); Source 2 (Manchester article)', '2026-03-30');

-- Entries: word_count is recomputed by the UPDATE at the bottom.
INSERT INTO entries (id, student_id, assignment_id, date_submitted, writing_sample, student_feedback, teacher_notes, flagged_for_followup) VALUES
  (1, 1, 1, '2026-02-13', 'The gummy bear got smaller. I think the salt did it.', 'Good start Marcus — you noticed the change! Next time tell me a number from the data table.', 'Two sentences, no data cited. Try the evidence sentence stem next time.', 0),
  (2, 1, 2, '2026-03-06', 'The trait is recessive because person II-3 has the trait but there parents dont. That means the parents was carriers.', 'You used a person from the chart as evidence — that is exactly the move we practiced!', 'First time citing evidence unprompted. Big step.', 0),
  (3, 1, 3, '2026-04-03', 'I claim the moths changed because of polution. Source 1 shows the dark moths went from 2% to 95% after the factorys came. This proves the dark ones survived better because the trees got dark and birds couldnt see them.', 'Claim, number evidence, AND a because — this is a complete CER. So proud of this one.', 'Full CER structure. Compare with entry 1 at conference.', 0),
  (4, 2, 1, '2026-02-13', 'My claim is the gummy bear shrunk because water left it. The data table shows it went from 12.4g to 8.1g in salt water. This happened because of osmosis, the water moves to where theres more salt.', NULL, 'Solid from day one. Push for scientific vocabulary next.', 0),
  (5, 2, 3, '2026-04-03', 'The moth population changed because of natural selection. According to Source 2, soot from factories in Manchester turned the trees black. Source 1 shows dark moths rose to 95%. The light moths stood out so birds ate them, which means the dark ones passed on there genes.', 'Two sources in one response — you are writing like a scientist.', NULL, 0),
  (6, 3, 1, '2026-02-14', 'It shrunk. Salt water.', 'You got the right idea Diego. Lets work on writing it as a full sentence together.', 'Fragment answers. Reads the data fine verbally — writing is the barrier, not understanding.', 1),
  (7, 3, 2, '2026-03-06', 'I think it is recessive. Two people in generation two have it but the parents in generation one do not have it.', 'Full sentences this time and you used the pedigree! Which two people? Name them next time.', 'Verbal rehearsal before writing worked well.', 0),
  (8, 3, 3, '2026-04-04', 'The moths changed color because the trees changed color. The graph shows the dark moths went up alot after 1850. I think this is because birds eat the moths they can see.', 'You explained WHY the evidence matters — that was your goal and you did it.', 'Hit his IEP writing goal. Note the reasoning sentence.', 0),
  (9, 4, 2, '2026-03-05', 'The trait must be dominant because it shows up in every generation of the pedigree. Individual I-1 and II-2 both have it, and II-2 passed it to III-1. If it was recessive it could skip generations but it never does here.', NULL, NULL, 0),
  (10, 5, 1, '2026-02-13', 'The gummy bear in salt water got smaller because osmosis. The bear in plain water got bigger', 'You answered the salt water part — what about the second question on why the plain water bear grew?', 'Stopped halfway again. Chunk the prompt into checkboxes next time.', 1),
  (11, 5, 3, '2026-04-03', 'My claim is the moth population changed because the enviroment changed. Source 1 graph shows dark moths going from rare to common. This is because the polution made tree bark darker so dark moths were camoflaged. Both parts of the prompt are done.', 'You finished every part — I know that last sentence was for you as much as me. It worked!', 'Used his own self-check strategy. Celebrate this.', 0),
  (12, 6, 3, '2026-04-03', 'Natural selection caused the change. The dark moth numbers increased in Source 1 when the factories came.', NULL, 'Accurate but brief. She can do more — raise the bar.', 0),
  (13, 7, 2, '2026-03-06', 'Recessive. II-3 has it. Parents dont.', 'Three thoughts — now lets connect them into sentences with because.', 'Still fragments but they are the RIGHT fragments. Scaffold is working.', 0),
  (14, 7, 3, '2026-04-04', 'I think the moths changed because of the factories. The graph in Source 1 shows dark moths went up. This matters because the dark moths could hide on the dirty trees. The light moths got eaten more.', 'FOUR sentences Tyler! And every one of them earns its place. This is your best science writing yet.', 'Doubled his typical length. Sentence stems can fade soon.', 0),
  (15, 8, 1, '2026-02-13', 'Claim: the gummy bear lost mass in the salt solution. Evidence: the data table shows a drop from 11.9g to 7.6g overnight. Reasoning: water diffused out of the bear toward the higher salt concentration, which is osmosis.', NULL, 'Uses the CER frame independently. Consider enrichment prompts.', 0);

INSERT INTO source_links (entry_id, label, url) VALUES
  (3, 'Source 1 — Moth population graph', 'https://example.org/demo/moth-graph'),
  (5, 'Source 2 — Manchester article', 'https://example.org/demo/manchester-article'),
  (11, 'Source 1 — Moth population graph', 'https://example.org/demo/moth-graph');

INSERT INTO writing_tags (entry_id, claim_present, evidence_cited, explanation_present, source_named, response_incomplete, ai_flag, notes) VALUES
  (1, 1, 0, 0, 0, 0, 0, 'Claim only — no data cited.'),
  (2, 1, 1, 1, 0, 0, 0, 'Cited II-3 from the pedigree.'),
  (3, 1, 1, 1, 1, 0, 0, 'Complete CER with named source.'),
  (4, 1, 1, 1, 0, 0, 0, NULL),
  (5, 1, 1, 1, 1, 0, 0, 'Two named sources.'),
  (6, 0, 0, 0, 0, 1, 0, 'Fragments; did not attempt full response.'),
  (7, 1, 1, 0, 0, 0, 0, NULL),
  (8, 1, 1, 1, 0, 0, 0, 'Reasoning sentence — IEP goal met.'),
  (9, 1, 1, 1, 0, 0, 0, NULL),
  (10, 1, 1, 0, 0, 1, 0, 'Second half of prompt not attempted.'),
  (11, 1, 1, 1, 1, 0, 0, 'All prompt parts complete.'),
  (12, 1, 1, 0, 1, 0, 0, 'Brief but accurate.'),
  (13, 1, 1, 0, 0, 1, 0, 'Fragments.'),
  (14, 1, 1, 1, 1, 0, 0, 'Four full sentences.'),
  (15, 1, 1, 1, 0, 0, 0, 'Independent CER frame.');

-- Samples above use single spaces, so word count = spaces + 1.
UPDATE entries
SET word_count = LENGTH(TRIM(writing_sample)) - LENGTH(REPLACE(TRIM(writing_sample), ' ', '')) + 1
WHERE writing_sample IS NOT NULL AND TRIM(writing_sample) != '';
