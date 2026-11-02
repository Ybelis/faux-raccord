// English product documentation. Chapter IDs and evidence links match the French edition.
// Recorded results and source passages are kept in their original language.
export const guideChaptersEn = [
  {
    id: 'utiliser',
    title: 'Using Faux Raccord',
    summary: 'Choose a screenplay, review the flagged passages and keep your decisions.',
    sections: [
      {
        title: 'A three-step workflow',
        paragraphs: [
          'Faux Raccord helps review props in the text of a screenplay. It suggests points to examine; an alert is not a confirmed error.',
          'In Screenplay, open an example or import a file and check the scene boundaries. In Analysis, choose the scenes and model. In Review, compare the two passages, then confirm or dismiss the point and add a note.',
        ],
        bullets: [
          'The interactive guide uses a separate copy of the demonstration and can be restarted from the menu.',
          'Paper, Slate and System are display themes; they do not change the results.',
          'A recorded analysis comes from a previous run and is identified as such. Viewing it does not start a new inference.',
        ],
      },
      {
        title: 'Choose a screenplay',
        paragraphs: [
          'You can import a PDF containing text, a TXT, Fountain or Markdown file. A JSON project exported by Faux Raccord can also be imported again. Check the scene boundaries before analysis; a scanned PDF needs text extraction first.',
        ],
        table: {
          columns: ['Source', 'Contents', 'References and conditions'],
          rows: [
            [
              'Original Valkaama',
              'The screenplay published by Tim Baumann, with its page references',
              'This is the source text; the injected errors are not attributed to it.',
            ],
            [
              'Valkaama — controlled experiment',
              'An identified adaptation containing 15 deliberately added inconsistencies',
              'The change log gives the edits, their two passages and the licence of the adaptation.',
            ],
            [
              'Les Heures Creuses',
              'A synthetic fiction for learning the workflow',
              'An introductory example, separate from the real screenplay and the controlled experiment.',
            ],
            [
              'MovieSum',
              'Local title and IMDb search; online preview and import',
              'The dataset licence does not guarantee rights to each underlying work; references identify XML scenes.',
            ],
          ],
        },
      },
      {
        title: 'Read a point before deciding',
        paragraphs: [
          'Read both quotations, open their scenes and check that they refer to the same prop. A change may be explained by a repair, a transfer, a time gap or a flashback.',
          'Confirming means the team accepts the point; dismissing records the opposite decision. The note is saved with that status. A human decision does not retrain the model.',
          'If all the model’s quotations are rejected, the result is marked unusable. In that situation, zero extracted props does not establish that the screenplay contains no inconsistencies.',
        ],
      },
      {
        title: 'Keep and share your work',
        paragraphs: [
          'Projects are stored in the browser on this device. There is no synchronisation between devices or users. The JSON project preserves text, sources, results and decisions and can be imported again. The Markdown report collects the review points.',
          'A new analysis replaces the previous result after confirmation. Export the version you want to keep before running it again.',
          'Exports contain screenplay text. Its redistribution conditions still apply.',
        ],
      },
    ],
  },
  {
    id: 'fonctionnement',
    title: 'Data and processing',
    summary:
      'Understand what the model generates, what the program checks and where the texts come from.',
    sections: [
      {
        title: 'What is generated',
        paragraphs: [
          'The model generates structured prop mentions, explanations and answers with sources. Processing follows a defined sequence; the reader makes the final decision.',
        ],
        table: {
          columns: ['Input', 'Model output', 'Code checks'],
          rows: [
            [
              'Screenplay scenes',
              'JSON: prop, state, owner, quotation',
              'Allowed fields, existing scene and quotation found in the text',
            ],
            [
              'Two mentions and their context',
              'Explanation and point to review',
              'Only the supplied candidates, without replacing their evidence',
            ],
            [
              'Question and retrieved passages',
              'Answer with references or NOT FOUND',
              'Known identifiers and consistent references',
            ],
          ],
        },
      },
      {
        title: 'From screenplay to passages for review',
        code: 'Screenplay → scenes and pages → prop extraction\n           → quotation checks → candidate changes\n           → context retrieval → model comparison\n           → two passages to inspect → reader’s decision',
        paragraphs: [
          'For example, a broken watch is later described as intact. Those mentions may produce a candidate. The context may reveal a repair or a flashback, so a candidate is not automatically an error.',
          'An exact quotation establishes that the passage is present, not that its interpretation is correct.',
        ],
      },
      {
        title: 'Retrieval and model settings',
        paragraphs: [
          'BM25 uses passages of up to 1,000 characters, with a 150-character overlap and up to five results. The overlap reduces boundary cuts; a passage never combines two scenes. These are explainable starting values, not parameters shown to be optimal.',
          'Retrieval is lexical, without embeddings or LoRA. Exact names and words help; paraphrases and French questions about an English text can be difficult. A BM25 score ranks passages; it is not a confidence estimate.',
          'Groq is a remote provider; Ollama runs models on the server machine. Temperature, output budgets and compatible parameters are actually applied. The two local configurations checked, qwen3:1.7b and llama3.2:latest, failed extraction on a short example despite a successful JSON connection check. This limited check does not establish the performance of their entire families.',
          'The continuity-free-v1 profile limits each extraction to 3,000 output tokens and each judgment to 1,000, with two candidates compared per request. A smaller user-selected budget is still respected. These ceilings keep requests within transport limits; they do not guarantee that quota is available. The effective profile accompanies the measurement.',
          'The report records the model, parameters and a code reference. Library versions are pinned in the lockfile, but an API identifier is not an immutable snapshot of the weights. A different model does not inherit earlier scores.',
        ],
      },
      {
        title: 'Choose a model for the task',
        paragraphs: [
          'The task requires structured text and exact quotations in their original language. Explanations can be generated in French or English. The measured profile keeps its French responses. The english-output-v1 profile passed an operational check on two synthetic scenes, but has no comparable quality benchmark yet. Correct states, actions and negations matter as much as JSON formatting.',
          'The measured remote profile uses openai/gpt-oss-120b on Groq: an API supporting JSON output, an Apache-2.0 licence and no weights to load on the workstation. The 120B was selected after the 20B quota was exhausted. The published comparison uses the same 120B for the system and the prompt-only baseline; it does not demonstrate that the 120B is better than the 20B.',
          'For local processing, the candidates below were selected from publisher model cards and the Ollama catalogue, checked on 2 November 2026. The application does not install them, and the current report does not evaluate them. The listed weight sizes exclude the context cache and runtime memory.',
        ],
        table: {
          columns: [
            'Local candidate',
            'Catalogue weight size',
            'Selection rationale',
            'Licence and status',
          ],
          rows: [
            [
              'qwen2.5:7b-instruct-q4_K_M',
              '4.7 GB',
              'An instruction model whose card explicitly mentions JSON and structured data; English and French support.',
              'Apache-2.0; candidate for evaluation, with memory use to check on a 6 GB GPU.',
            ],
            [
              'qwen3.5:4b-q4_K_M',
              '3.3 GB',
              'A more compact multilingual profile, leaving more room for context on a 6 GB GPU.',
              'Apache-2.0; extraction quality has not been measured.',
            ],
            [
              'phi4-mini:3.8b',
              '2.5 GB',
              'A different multilingual instruction family, designed in part for limited resources.',
              'MIT; an unmeasured compact comparison candidate.',
            ],
          ],
        },
        bullets: [
          'With 6 GB of VRAM, start with an 8,192-token context, one request and one loaded model at a time. A model with 5–6 GB of weights may spill into RAM once the cache is added.',
          'Check CPU/GPU placement with ollama ps. An advertised context of 128k or more does not guarantee that the machine can load it.',
          'Evaluate the same cases, prompts and budgets: usable JSON, exact quotations, correct states and negations, precision/recall, duration and memory. Include a repair and a case where the information is absent.',
          'Record the identifier, quantisation, weight digest, Ollama version and settings. A different model does not inherit existing scores.',
          'Ollama’s JSON schema can constrain fields; the application currently uses JSON mode and its own validation. Neither mechanism guarantees factual accuracy. Disabling reasoning depends on the model.',
        ],
        links: [
          {
            label: 'GPT-OSS 120B on Groq',
            href: 'https://console.groq.com/docs/model/openai/gpt-oss-120b',
          },
          {
            label: 'Qwen2.5: official model card',
            href: 'https://huggingface.co/Qwen/Qwen2.5-7B-Instruct',
          },
          {
            label: 'Qwen2.5 7B Q4_K_M: Ollama weights',
            href: 'https://ollama.com/library/qwen2.5:7b-instruct-q4_K_M',
          },
          {
            label: 'Qwen3.5 4B: official model card',
            href: 'https://huggingface.co/Qwen/Qwen3.5-4B',
          },
          {
            label: 'Qwen3.5 4B Q4_K_M: Ollama weights',
            href: 'https://ollama.com/library/qwen3.5:4b-q4_K_M',
          },
          {
            label: 'Phi-4-mini: Microsoft model card',
            href: 'https://huggingface.co/microsoft/Phi-4-mini-instruct',
          },
          {
            label: 'Phi-4-mini: Ollama weights',
            href: 'https://ollama.com/library/phi4-mini:3.8b',
          },
          { label: 'Ollama memory and context', href: 'https://docs.ollama.com/context-length' },
          {
            label: 'Ollama structured outputs',
            href: 'https://docs.ollama.com/capabilities/structured-outputs',
          },
          {
            label: 'Ollama reasoning controls',
            href: 'https://docs.ollama.com/capabilities/thinking',
          },
        ],
      },
      {
        title: 'Data provenance and licensing',
        paragraphs: [
          'Valkaama is Tim Baumann’s English screenplay, based on the novel by Hendrik Behnisch, version dated 30 June 2007. The PDF and the author’s page specify CC BY-SA 3.0. Adaptations retain attribution, identify changes and keep the same licence. The application code has its separate MIT licence.',
          'The fifteen inconsistencies in the experiment are deliberate edits. The original text and PDF remain separate. In the adaptation, page numbers locate scenes in the original; the original PDF does not contain the added sentences.',
          'MovieSum provides a local metadata index and an explicit import option. Its declared dataset licence, CC BY-NC 4.0, does not guarantee all rights to the underlying works. No full MovieSum screenplays are bundled in the repository.',
        ],
        links: [
          {
            label: 'Valkaama source page',
            href: 'https://www.valkaama.com/index.php?l=en&page=sources',
          },
          {
            label: 'CC BY-SA 3.0 licence',
            href: 'https://creativecommons.org/licenses/by-sa/3.0/',
          },
          {
            label: 'MovieSum and its dataset card',
            href: 'https://huggingface.co/datasets/rohitsaxena/MovieSum',
          },
        ],
      },
    ],
  },
  {
    id: 'evaluation',
    title: 'Results and tests',
    summary: 'Read the measurements, their references and the limits of what they demonstrate.',
    sections: [
      {
        title: 'A controlled experiment',
        paragraphs: [
          'The main experiment uses an adaptation of Valkaama with fifteen deliberately added inconsistencies and four explained transitions. The references identify the props and the two expected passages. They were proposed with AI assistance; no human review has been recorded yet.',
          'The adapted screenplay retains its 56 scenes. Evaluation covers scenes 1–12, containing 15 injections and four explained transitions. Only those 19 props are annotated. This is a visible controlled development set, not a separate hidden test.',
          'The fifty synthetic vignettes and twenty-four questions on real passages are complementary experiments. Their units and configurations differ; their scores do not form a combined result.',
        ],
      },
      {
        title: 'Measure each error and alert',
        paragraphs: [
          'An injection is an expected inconsistency identified before execution, with the prop and two supporting passages. A detected alert is matched to that reference. A match must be inspectable and must not count the same injection more than once.',
          'True positive: an injection is detected with two valid pieces of evidence. False positive: an alert on an annotated prop is unsupported, duplicated or accompanied by non-conforming evidence. False negative: an injection is not detected with the required evidence. An alert somewhere in the screenplay is not enough to recover all 15 errors.',
          'In this measurement, the prompt-only false positive comes from an approximate quotation about the watch: it recognised the change but altered the passage’s wording. The score therefore measures “error recognised with valid evidence”, not just whether the explanation sounds plausible.',
          'Alerts on other props are retained for review but excluded from the controlled score because annotations are not exhaustive. Displayed precision therefore does not describe every possible alert in the screenplay. The report gives their count separately.',
        ],
        code: 'Precision = TP / (TP + FP)\nRecall    = TP / expected number of injections\nF1        = 2 × precision × recall / (precision + recall)',
        bullets: [
          'Precision asks: what proportion of alerts is supported by the reference?',
          'Recall asks: what proportion of injected errors is detected?',
          'F1 combines both; it does not choose the useful trade-off on the reader’s behalf.',
          'The Wilson interval describes uncertainty in a small sample. The observations belong to the same screenplay and are not independent; the interval corrects neither that bias nor a questionable annotation.',
        ],
      },
      {
        title: 'Comparison and observed failures',
        paragraphs: [
          'The baseline receives the same text and uses the same model with a direct prompt. The system adds extraction, checks and retrieval before comparison. The report retains predictions, matches, false positives and missed injections, even if the baseline performs better.',
          'The references and matches were proposed with AI assistance; no human review has been recorded. After examining failures, a change to the detector should be evaluated on new independent cases.',
          'In case E03, the passage says the flask has not been refilled, but extraction assigns the action fill. The empty → full change is then treated as explained and discarded before comparison. Retrieval cannot correct a candidate that was already eliminated: a misread negation can therefore cause a missed inconsistency.',
          'Median latency means that half the cases take less time and half take more. Quota waits may be included, so it may not measure model speed alone. Tokens and dated pricing support a cost estimate, not a guaranteed bill.',
        ],
      },
      {
        title: 'What the tests check',
        table: {
          columns: ['Check', 'What it demonstrates', 'What it does not demonstrate'],
          rows: [
            [
              'Software tests',
              'Parser rules, quotations, limits, settings, persistence and calculations; providers are simulated where needed.',
              'That the LLM correctly understands every screenplay.',
            ],
            [
              'Browser checks',
              'Browser workflows: themes, guide, import, review and export.',
              'Time savings observed with an industry user.',
            ],
            [
              'Controlled Valkaama experiment',
              'Detection of inconsistencies inserted into an identified adaptation.',
              'Performance that generalises to every film.',
            ],
            [
              'Historical real-passage QA',
              'Answer, reference and format on real passages; the lexical rubric has limitations around synonyms and negation.',
              'Detection of continuity errors.',
            ],
            [
              'Red team',
              'Observed behaviour against a few attempts to redirect the system.',
              'A general security certification.',
            ],
          ],
        },
        paragraphs: [
          'Software tests and browser checks verify that the program works. They do not measure the model’s understanding of a screenplay and do not replace the continuity benchmark.',
        ],
      },
      {
        title: 'Inspect the evidence',
        paragraphs: [
          'Reports provide the configurations and reproduction commands. JSON files retain detailed predictions, their sources and their matches to the references.',
          'A recorded analysis is a previous run that can be viewed without calling the model again. Its measurements do not imply the same performance under a different configuration.',
        ],
        links: [
          { label: 'Evaluation report — PDF (French)', href: '/docs/print/evaluation.pdf' },
          { label: 'System card — PDF (French)', href: '/docs/print/system-card.pdf' },
          { label: 'Evaluation report — source (French)', href: '/docs/evaluation_report.md' },
          { label: 'Adversarial test log (French)', href: '/docs/red_team_log.md' },
        ],
      },
    ],
  },
  {
    id: 'limites',
    title: 'Limits and privacy',
    summary: 'Understand the tool’s scope, safeguards and text-processing conditions.',
    sections: [
      {
        title: 'Review scope',
        paragraphs: [
          'Faux Raccord processes screenplay text and explicitly mentioned props. It does not check images, audio or editing, and it does not provide a shooting schedule.',
          'A prop may be missed during extraction, confused with another or placed incorrectly in time. Implicit transfers, flashbacks, identical names and paraphrases remain difficult. An absent mention is not evidence of disappearance.',
          'Quotation checks reduce invented evidence. They guarantee neither a correct interpretation nor exhaustive detection. Scores on a controlled adaptation do not demonstrate time savings or validated usefulness on a film production.',
        ],
      },
      {
        title: 'Where does the data go?',
        paragraphs: [
          'Projects are stored in the browser on this device, without synchronisation. The API key stays in the server environment and is not included in exported projects.',
          'With Groq, analysis sends the selected scenes to the provider; a question sends the retrieved passages and the question. Use only texts whose transfer is authorised.',
          'With Ollama, inference runs on the machine hosting the server. A suitable local model can keep this processing on that machine. MovieSum previews and imports still require access to the external service.',
        ],
      },
      {
        title: 'Rights and safeguards',
        paragraphs: [
          'Users check the rights for their imports and shared texts. A document available online is not automatically reusable. Personal data must be authorised or anonymised as appropriate.',
          'The program limits import sizes, checks identifiers and verifies quotations. Instructions inside a screenplay are treated as data; model outputs are not executed as code or HTML.',
          'Every point must be reviewed in context before any screenplay correction. A confirmed or dismissed point remains the reader’s decision.',
        ],
        links: [
          { label: 'Use policy (French)', href: '/docs/use_policy.md' },
          { label: 'System card (French)', href: '/docs/system_card.md' },
        ],
      },
    ],
  },
];
