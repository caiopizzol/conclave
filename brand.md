---
name: "Conclave"
tagline: "Consensus before commit."
version: 2
language: en
---

# Conclave

## Strategy

### Overview

Conclave is a local multi-model CLI for developer decisions. It runs the same coding task through more than one model, then either compares the answers or makes the models challenge each other in bounded rounds.

It was born from a simple observation: different models, trained on different data, have different blind spots. When two models independently flag the same issue, it's probably real. When only one does, it might be noise. When one drafts and another challenges until they converge, you get a plan that has survived a real argument. That asymmetry is the product.

Conclave structures model output so disagreement becomes useful. It does not replace your judgment. It runs locally and uses the CLIs you already have - no Conclave-hosted service, no Conclave proxy. The underlying CLIs still call their providers' APIs; that part is yours to configure.

**The problem it solves:** Every AI model hallucinates differently. A developer using a single model for review, planning, or debugging is exposed to that model's specific failure modes with no cheap way to distinguish real findings from noise, or a real plan from a plausible-sounding one. The only alternative today is running multiple tools by hand and reconciling outputs across terminals.

**The transformation:**
- **Before:** One model, one opinion. Or multiple tools and copy-paste between terminals.
- **After:** One command. Perspectives when you want breadth. Deliberation when you want depth.

**Long-term ambition:** Become the default way developers get more than one model involved in a coding decision - not by picking the "best" model, but by letting them check and challenge each other.

### Positioning

**Category:** Multi-model CLI for developer decisions.

Not multi-model orchestration. Not an AI platform. Not an agent framework. Conclave is the thin layer between the developer and multiple AI CLIs that turns disagreement into signal and a single draft into a challenged plan.

**What Conclave is:**
- A CLI that runs locally, on your machine, using your existing AI CLIs and your own accounts.
- Two modes: compare (fan-out across N models) and converge (implementer and reviewer in a bounded loop).
- Model-agnostic. Any CLI that reads stdin can join the council.
- Open source. MIT.

**What Conclave is NOT:**
- Not agent soup. Two roles, one ledger, bounded rounds.
- Not a platform. No web UI, no accounts, no subscriptions.
- Not a hosted orchestration product. No Conclave-hosted service. No Conclave proxy. The underlying CLIs still call their providers' APIs - that's up to you to configure.
- Not always-on. It runs when you invoke it and exits.
- Not model-specific. Add a new CLI in config and it joins the council.
- Not a replacement for human review. It surfaces what to look at and structures the argument. You decide.

**Competitive landscape:**

1. **Generic multi-model platforms** (Council AI, llm-council, Perplexity Model Council) - "ask all the models" web apps. Broad audience, no opinion about what to do with disagreement, no concept of deliberation.
2. **Orchestration frameworks** (ccg-workflow, Claude Code Bridge, Bifrost) - route tasks to different models based on strengths. Smart dispatching, no synthesis, no consensus detection, no iteration.
3. **Agent frameworks** (various) - models call tools, each other, and loop autonomously. Unbounded, unstructured, "agent soup."

Conclave is the only tool that treats consensus as the primary signal for one mode and structured deliberation as the primary mechanism for the other. It has a point of view: more models does not mean better; bounded iteration beats unbounded autonomy; CLI-native beats platform lock-in.

**Structural differentials:**
- Two first-class modes (compare, converge), not one.
- A canonical issue ledger in `/converge` that the coordinator owns, not the models - so convergence cannot be faked.
- CLI-native - no browser, no dashboard, no context switching.
- Model-agnostic - any CLI that accepts stdin can participate.
- Local by default - no Conclave-hosted service, no proxy.

**The territory Conclave owns:** The space between "one model's opinion" and "human certainty." The confidence gap.

### Personality

**Dominant archetype:** The Arbiter - neutral, decisive, fair. Weighs evidence from multiple sources. Doesn't pick favorites. Delivers a clear verdict. In converge mode, also the adjudicator - tracks the argument, enforces the rules, stops the fight when it's over.

**Attributes the brand transmits:**
- Grounded
- Measured
- Honest
- Calm
- Opinionated
- Precise

**What Conclave IS:**
- The quiet senior engineer who reads every review before speaking
- The tiebreaker in a technical disagreement
- The structured debate, not the shouting match
- A filter, not a firehose
- Understated and confident

**What Conclave is NOT:**
- The loudest voice in the room
- A hype machine promising "revolutionary AI"
- A Swiss Army knife trying to do everything
- An agent framework promising autonomy
- Flashy, eager, or performative

### Promise

- When models agree, you can trust it.
- When they disagree, you see both sides.
- When one model flags something alone, you know to be skeptical.
- When two models argue until they agree, you get a plan that has survived the argument.

**Base message:** Conclave gives you the confidence that no single AI model can provide - not by being smarter, but by letting models check and challenge each other.

**Essence:** Confidence through independent perspectives.

**Synthesizing phrase:** Compare when you want perspectives. Converge when you want them to argue.

### Guardrails

**Tone summary:** Understated, direct, warm, honest, dry.

**What the brand cannot be:**
- Breathless or hype-driven ("revolutionary," "game-changing," "unleash the power")
- Vendor-speak ("leverage," "solution," "enterprise-grade")
- Vague or hand-wavy about what consensus or convergence mean
- Dismissive of single-model tools - Conclave extends them, it doesn't replace them
- Cold or robotic - the warm palette and quiet tone are deliberate

**Litmus test:** If it sounds like a product launch blog post, it's wrong.

---

## Voice

### Identity

We are a local CLI that runs developer tasks through more than one model. In compare mode, we fan out the same prompt and highlight where models agree. In converge mode, one model drafts, another challenges, and a coordinator tracks issues until they resolve or hit a cap. We don't replace your judgment. We structure the output so disagreement becomes useful.

We are not a platform. We are not a SaaS product. We are not an agent framework. We are a developer tool that does two things well: fast comparison when you want breadth, and bounded deliberation when you want depth.

We believe no single AI model should be trusted blindly. Every model has blind spots. Every model hallucinates differently. The value isn't in picking the "best" model - it's in letting them check and challenge each other. When Claude and Codex both flag the same race condition, that's not two opinions, that's a signal. When one drafts a plan and another argues it down to something they both accept, that's a plan that has actually been challenged.

**Essence:** Confidence through independent perspectives.

### Tagline & Slogans

**Primary tagline:** Consensus before commit.
*Use on: GitHub repo description, landing page hero, social bios.*

**Alternatives:**
- Compare or argue. Then commit.
- Multiple models. One decision.
- Grounded decisions, together.

**Slogans for different contexts:**
- Hero/landing: "A local multi-model CLI for developer decisions."
- Technical: "When two models flag it, it's probably real. When they argue it down, it's probably solid."
- Philosophy: "More models does not mean better. Structure does."
- Action: "Compare when you want perspectives. Converge when you want them to argue."
- Community: "Let the models deliberate. You decide."

### Manifesto

Every AI model has blind spots.

They hallucinate differently. Miss different edge cases. Get confident about different wrong things. You've seen it - one model flags a race condition that isn't there, another misses the one that is.

The solution isn't a better model. It's more perspectives, structured.

Sometimes you want fast comparison. Ask several models the same thing. Trust what they agree on. Be skeptical of what only one sees.

Sometimes you want an actual argument. Let one model draft a plan. Let another challenge it. A coordinator tracks every objection and resolution. The loop stops when the reviewer has no open blockers, or when the round cap hits. No forever loops. No autonomous agents making decisions for you.

Conclave doesn't write the final answer. It doesn't replace your reviewer. It sits between the models and you, surfacing what matters in compare mode and structuring the fight in converge mode.

No platform. No dashboard. No accounts. No hosted service. Just your terminal, your models, and a clearer answer.

Conclave.

### Message Pillars

**Independent perspectives**
- One model's opinion is one opinion. Two independent models agreeing is a signal. Two models arguing until they agree is a plan that has survived the argument.
- Agreement is breadth. Deliberation is depth.

**Signal over noise**
- Not everything a model flags is real. Consensus separates the signal from the noise.
- Not every plan survives scrutiny. Converge makes scrutiny cheap.

**Structured, not autonomous**
- Two roles, one ledger, bounded rounds. The coordinator owns the ledger so convergence cannot be faked.
- No unbounded agent loops. No tool soup. The rules are legible.

**Developer-first**
- A slash command in your terminal. No new tools to learn. No tabs to switch.
- Works with the AI CLIs you already have installed.

**Honest about limits**
- More models is not always better. Consensus is not certainty. A converged plan still needs a human to decide.
- Disagreements that cannot be resolved are first-class output, not failures.

**Open and local**
- Runs on your machine with your own API keys and accounts. Open source. MIT.
- No Conclave-hosted service. No Conclave proxy. Conclave invokes the CLIs you already have; those CLIs still talk to their providers' APIs.
- Add any CLI that accepts stdin. The council is extensible.

### Phrases

- "2/3 consensus. Likely a real issue."
- "Only Gemini flagged this. Might be noise."
- "Claude and Codex both flagged this. Fix it?"
- "Converged in 2 rounds, no open blockers."
- "Round cap hit with 1 disputed blocker. Your call."
- "More models does not mean better. Structure does."
- "Compare when you want perspectives. Converge when you want them to argue."
- "Two roles, one ledger, bounded rounds."

### Social Bios

**GitHub:**
A local multi-model CLI for developer decisions. Compare or converge across the AI CLIs you already have.

**LinkedIn:**
Conclave is an open-source CLI that runs coding tasks through more than one AI model. Use compare mode for fast perspectives, converge mode for a bounded implementer-vs-reviewer loop. Runs locally, no hosted service.

**X/Twitter:**
Local multi-model CLI. Compare or argue. Then commit.

**Website (short):**
A local CLI that runs your coding task through more than one model. Compare for fast perspectives. Converge for a bounded argument. Both use the AI CLIs you already have.

### Tonal Rules

1. Speak in short, declarative sentences. No compound clauses where a period would do.
2. Use "you" and "your," not "users" or "developers." We're talking to one person at their terminal.
3. Understated confidence. Never exclamation marks. Never "amazing" or "powerful."
4. Be honest about limitations. "Consensus is not certainty" is a brand-level statement.
5. Name the models by name. "Claude and Codex both flagged this" is more credible than "multiple models detected an issue."
6. Use numbers when possible. "2/3 consensus" is stronger than "most models agree." "Converged in 2 rounds" is stronger than "after a few iterations."
7. Dry humor is allowed. "Only Gemini flagged this. Might be noise." has personality without trying.
8. Never explain what AI is. The audience knows.
9. Prefer lowercase in casual contexts. "looks good" not "Looks Good."
10. The word "revolutionary" is banned. So is "leverage," "unlock," "empower," "game-changing," and "agent soup" (except when we're explicitly saying what we are NOT).

**Identity boundaries:**
- We are not consultants who leave a deck behind.
- We are not a platform asking for your email.
- We are not a startup with a pitch deck and a "vision."
- We are not an agent framework promising autonomy.
- We are a tool. You install it, configure it, run it. It works.

| We Say | We Never Say |
|---|---|
| "2/3 consensus" | "Our AI detected a critical issue" |
| "Converged in 2 rounds" | "AI-powered autonomous reasoning" |
| "1 disputed blocker remains" | "Unresolved" |
| "Might be noise" | "Warning: potential vulnerability found" |
| "Fix it?" | "We recommend immediate remediation" |
| "One command" | "Seamlessly integrate into your workflow" |
| "Works with your existing CLIs" | "Powered by cutting-edge AI technology" |
| "Open source, runs locally" | "Enterprise-grade security and compliance" |
| "More models does not mean better" | "Leverage the power of multiple AI models" |
| "Only Codex flagged this" | "Our advanced systems have identified..." |
| "Two roles, one ledger, bounded rounds" | "Agentic orchestration pipeline" |

---

## Visual

### Colors

**Primary - Sage Green**
- `#7cb38b` (green-500) - Primary brand color. Used for the ⊛ symbol, consensus indicators, CTAs, and primary actions.
- `#5a9a6b` (green-600) - Darker variant for hover states and emphasis.
- `#9ec9a9` (green-400) - Lighter variant for highlights and secondary indicators.
- `#c1dbc8` (green-300) - Subtle backgrounds and tints.
- `#e3f0e6` (green-200) - Lightest tint, used sparingly.

**Neutral - Warm Earth**
- `#0f0e0c` (warm-900) - Primary background. Not pure black - warm, like aged paper in a dark room.
- `#1a1916` (warm-800) - Card and surface backgrounds.
- `#222019` (warm-700) - Elevated surfaces, headers, footers.
- `#2d2a25` (warm-600) - Borders and dividers.
- `#e8dcc4` (warm-100) - Primary text. Warm off-white, not clinical.
- `#b5ae9f` (warm-200) - Secondary text.
- `#8a8478` (warm-300) - Muted text and captions.

**Accent**
- `#c9a962` (amber) - Sparingly, for performance indicators and special emphasis.

**Model Colors** (used only in model-specific contexts)
- Claude: `#c9875c` (warm terracotta)
- Codex: `#7cb38b` (sage green)
- Gemini: `#6b9ac4` (soft blue)
- Qwen: `#8b7cb3` (muted purple)
- Mistral: `#ff7000` (orange)
- Ollama: `#ffffff` (white)
- Grok: `#1da1f2` (blue)

**Semantic**
- Consensus / Converged: `#7cb38b` (same as primary - agreement IS the brand)
- Disputed: `#c9a962` (amber - attention without alarm)
- Bug: `#c97070`
- Style: `#6b9ac4`
- Performance: `#c9a962`

**Colors to avoid:** Saturated neons, pure black (#000), pure white (#fff), any color that reads as "startup gradient." The palette is earthy and warm, never clinical or electric.

### Typography

**Display:** Outfit, weights 400-700
- Used for headings, brand name, UI labels, and body copy.
- Clean geometric sans-serif with warmth. Not as cold as Inter, not as quirky as rounded fonts.

**Monospace:** JetBrains Mono, weights 400-500
- Used for code references, CLI output, file paths, and technical indicators.
- Industry-standard developer font. Familiar and legible.

**Usage rules:**
- Brand name "conclave" is always lowercase in running text.
- The ⊛ symbol always uses green-500 (`#7cb38b`).
- Wordmark uses warm-100 (`#e8dcc4`) on dark backgrounds.

### Photography

**Mood:** Warm, quiet, considered. Think early morning light in a library, not a tech conference stage.

**Subjects:**
- Terminal screens with warm color grading
- Abstract representations of convergence and consensus (overlapping circles, intersecting lines, opposing arrows meeting)
- Developer workspaces - real, not staged

**Avoid:**
- Stock photos of people pointing at screens
- Futuristic/sci-fi AI imagery (neural networks, glowing brains, agent swarms)
- Crowded, busy compositions
- Anything that could appear on a SaaS landing page template

### Style

**Design keywords:** Warm, grounded, minimal, typographic, quiet, precise, earthy, restrained.

**Reference brands:** Resend (developer-first minimalism, dark palette, confident copy), Linear (precision, restraint, opinionated product design), Vercel (clean developer tooling, dark themes, typographic hierarchy).

**Direction:** The identity communicates signal, not decoration. Every visual element should earn its place. When in doubt, remove it. The warm earth palette distinguishes Conclave from the cold blue/purple developer tool aesthetic that dominates the market - it should feel like a trusted tool with patina, not a fresh startup.

**Logo:**
- Symbol: ⊛ (circled asterisk, U+229B) in green-500
- Wordmark: "conclave" in Outfit 600, warm-100
- Combined: `⊛ conclave`
- The symbol represents convergence - multiple points meeting at center. It echoes the asterisk (a developer symbol) enclosed in consensus (the circle).
