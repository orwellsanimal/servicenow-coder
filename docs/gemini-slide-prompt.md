# Gemini Slide Prompt — Agentic SDLC for ServiceNow

> Paste everything below the `=== PROMPT START ===` marker into Gemini in
> Google Slides. The deck is structured to be ~10 slides, demo-ready,
> technical-but-accessible. Tweak `[AUDIENCE]` and `[PRESENTER]` before pasting.

---

=== PROMPT START ===

You are helping me create a Google Slides presentation. The deck should be **clean, technical, and demo-ready** — favor whitespace and clear typography over heavy visuals. Use the title-and-content layout for most slides. Body content should be tight bullets (3–5 per slide max, ≤12 words each).

**Audience:** [AUDIENCE — e.g., a Google internal team evaluating ServiceNow AI tooling]
**Presenter:** [PRESENTER — e.g., Jody Whitlow]
**Total slides:** 10
**Tone:** Confident, technical, no marketing fluff. Treat the audience as engineers.

Build the deck exactly as specified below. For each slide, render the **Title** as the slide title, the **Body** as bullet points (or a diagram description for the diagram slides), and put the **Speaker Notes** in the slide's notes pane.

When a slide includes a `[DIAGRAM PLACEHOLDER]`, insert a centered text box describing the diagram — I'll replace it with a real image after generation.

---

## Slide 1 — Title

**Title:** Agentic SDLC for ServiceNow

**Subtitle:** Grounded · Scoped · Tested · Reversible

**Body:**
- Presenter: [PRESENTER]
- Date: [DATE]

**Speaker Notes:** Opening. Set the frame: this is a working SDLC, not a slideware concept. Everything in the deck has been exercised end-to-end on a real ServiceNow instance, with code in a public repo.

---

## Slide 2 — The thesis

**Title:** Ground → Generate → Build → Deploy → Verify

**Body:**
- An AI agent participates at every stage
- Git is the only source of truth — no update sets
- Real instance metadata grounds every decision
- Every change has a rollback URL and a passing test
- Same pipeline scales from single dev instance to multi-instance via Harness

**Speaker Notes:** The five-stage frame is the spine of the rest of the deck. Each stage gets its own slide. The agent is a peer in the loop, not a code-completion tool.

---

## Slide 3 — The pipeline (hero diagram)

**Title:** The five-stage agentic pipeline

**Body:**
[DIAGRAM PLACEHOLDER — replace with the hero diagram showing: instance-config (Ground) → AI Agent (Generate) → now-sdk build (Build) → now-sdk install (Deploy) → ATF + PySNC (Verify) → back to Git as source of truth. Show the feedback loop from Verify back to Ground.]

**Speaker Notes:** Walk the diagram clockwise once. Emphasize that grounding and verification close the loop — the agent's view of the instance stays accurate because we re-sync after every plugin activation and verify with real tests.

---

## Slide 4 — Stage 1: Ground

**Title:** Ground — know what exists before you build

**Body:**
- `instance-config/` snapshots live instance: tables, choices, scopes, plugins, catalog items
- Node export covers static schema; PySNC export covers runtime data
- One command re-syncs everything: `node scripts/sync-instance-config.js`
- Plugin activation? Re-sync, diff, commit — the grounding layer never drifts
- AI generates against verified GUIDs, not training-data guesses

**Speaker Notes:** This is the most important slide. Most AI code generation for ServiceNow hallucinates table names and choice values. Our grounding layer makes that impossible — the agent reads what's actually on the instance before writing anything.

---

## Slide 5 — Stage 2: Generate

**Title:** Generate — scoped-first, global as artifact

**Body:**
- ServiceNow Fluent SDK: every artifact defined as TypeScript `.now.ts` files
- Scoped apps go through full CI/CD pipeline
- Global-scope changes mocked in `scratch/` with runbook for human dev
- Scope naming enforced: `x_<vendor>_<≤9-char>`, ≤19 chars total
- The agent's contract: if it can be scoped, it MUST be

**Speaker Notes:** Most ServiceNow shops let global-scope changes drift over time. We treat global changes as code artifacts that humans deploy with a documented runbook — the agent doesn't pretend it can deploy global modifications safely.

---

## Slide 6 — Stage 3 & 4: Build + Deploy

**Title:** Build → Deploy — deterministic, reversible

**Body:**
- `now-sdk build` produces XML metadata; pure function of source
- TypeScript type-checks against `@servicenow/glide` before any deploy
- `now-sdk install` ships to instance via Application Repository (not update sets)
- Every install creates a rollback context — recovery is one URL away
- Same path scales to multi-instance via Harness when needed

**Speaker Notes:** No update sets. No "promote from dev to test" ceremony. Git is the source, the build is reproducible, and the deploy is reversible. Mention the rollback URLs — every deploy logs one.

---

## Slide 7 — Stage 5: Verify

**Title:** Verify — tests where it counts

**Body:**
- ATF (Automated Test Framework) suites defined as `.now.ts` files
- One suite per app, named `<scope>-suite`, runs on the instance
- CI triggers `/api/sn_cicd/testsuite/run` after every deploy
- PySNC handles fixtures: seed data before tests, teardown after
- Fail → CI exits non-zero → merge blocked

**Speaker Notes:** Tests run *on the platform*, not against mocks. ATF exercises the real instance. PySNC manages the test data lifecycle from outside. Together they prove the deploy actually worked, not just that the build succeeded.

---

## Slide 8 — The scope boundary

**Title:** Scoped (automated) vs Global (artifact)

**Body:**
[DIAGRAM PLACEHOLDER — two columns side by side. Left column "SCOPED (automated)": apps/<app>/src/fluent/, Fluent SDK builds, CI deploys, ATF tests. Right column "GLOBAL (artifact)": scratch/<feature>/, runbook for human dev, ordering documented, not auto-deployed. Bottom: "The agent's contract: if it can be scoped, it MUST be."]

**Speaker Notes:** This is the honest split. We don't pretend AI can safely deploy global changes. We DO use AI to generate the code, document the dependencies, and hand a runbook to a developer. That's still 80% of the work done.

---

## Slide 9 — What's different from traditional ServiceNow dev

**Title:** Traditional vs. agentic

**Body:** (render as a two-column table)
- **Update sets** → Git + Application Repository
- **Manual Studio dev** → AI-generated Fluent code
- **Tribal knowledge of GUIDs** → committed `instance-config/`
- **Ad-hoc test runs** → ATF gated by CI on every push
- **Plugin upgrades surprise teams** → sync script reports the delta
- **Global changes drift** → tracked as code in `scratch/`

**Speaker Notes:** Hit the comparison fast — this is the "why does this matter" slide. The right column isn't aspirational, it's what's running in the repo today.

---

## Slide 10 — TL;DR

**Title:** What this gets you

**Body:**
- AI participates as a peer — memory, tool access, grounding, verification
- Git as the only state of record — auditable, reversible, mergeable
- Real tests on a real instance — no mock-based confidence
- Honest scope handoff — global changes don't pretend to be automated
- Same pipeline scales from PDI to enterprise multi-instance

**Subtitle:** Ground → Generate → Build → Deploy → Verify — with humans in the loop where it counts.

**Speaker Notes:** Close with the one-line. The deck is short on purpose — if anyone wants depth, the public repo at github.com/orwellsanimal/servicenow-coder has the working examples.

---

After generating the deck, please:
1. Use a consistent color scheme (suggest: dark navy for titles, lighter gray for body)
2. Use a monospace font for any code-like terms (e.g., `now-sdk build`, `instance-config/`)
3. Leave the diagram placeholders as visible text boxes I can replace
4. Set the slide aspect ratio to 16:9

=== PROMPT END ===

---

## How to use this

1. Open Google Slides → start a blank deck
2. Open Gemini in the side panel (or use Help > Try Gemini)
3. Replace `[AUDIENCE]`, `[PRESENTER]`, and `[DATE]` placeholders above
4. Copy everything between `=== PROMPT START ===` and `=== PROMPT END ===`
5. Paste into the Gemini prompt
6. Generate, then replace the two `[DIAGRAM PLACEHOLDER]` text boxes with screenshots of the diagrams from `docs/sdlc-outline.md`

## Tips

- If Gemini hallucinates extra slides or marketing fluff, prompt with: "Use exactly the 10 slides I specified — no more, no less. Remove anything not in my outline."
- For the diagram slides, you can also try asking Gemini's image generation to draw them — but the ASCII art in `sdlc-outline.md` is more accurate. Screenshot those and paste in.
- If the audience is non-technical, change the tone instruction in the prompt header from "Treat the audience as engineers" to "Make every term accessible — define jargon inline."
