---
name: "Conclave"
tagline: "Consensus before commit."
version: 1
language: en
---

# Conclave

## Strategy

### Overview

Conclave is a multi-model consensus engine for code review and developer decision-making. It runs multiple AI CLIs in parallel — Claude, Codex, Gemini, Qwen, Mistral, Ollama, Grok — and synthesizes their outputs into a single verdict weighted by agreement.

It was born from a simple observation: different models, trained on different data, have different blind spots. When two models independently flag the same issue, it's probably real. When only one does, it might be noise. That asymmetry is the product.

What Conclave actually does is extract signal from the disagreement between AI models. It doesn't generate code. It doesn't replace human judgment. It takes the messy, overlapping, sometimes contradictory outputs of multiple models and reduces them to what matters: where do they agree, where do they diverge, and what should you pay attention to.

**The problem it solves:** Every AI model hallucinates differently. Developers using a single model for code review are exposed to that model's specific failure modes with no way to distinguish real findings from noise. The only current alternative is manually running multiple tools and comparing outputs by hand.

**The transformation:**
- **Before:** Developer runs one AI review, gets a mix of real issues and hallucinated noise, has no way to tell which is which. Or runs multiple tools manually, copy-pasting context between terminals.
- **After:** One command, multiple perspectives, consensus highlighted, noise dimmed. The developer sees what matters and skips what doesn't.

**Long-term ambition:** Become the standard way developers get a second opinion from AI — not by picking the best model, but by letting models check each other.

### Positioning

**Category:** Consensus-driven code intelligence.

Not multi-model orchestration. Not an AI platform. Not a code review tool. Conclave is the layer that sits between multiple AI models and the developer, filtering signal from noise through consensus.

**What Conclave is NOT:**
- Not a platform. No web UI, no accounts, no subscriptions. It's a CLI tool that lives in your terminal.
- Not an AI model. It doesn't write code or generate suggestions. It triangulates opinions from models that do.
- Not a replacement for human review. It surfaces what to look at, not what to do.
- Not model-specific. It works with whatever AI CLIs you have installed. Add a new model in the config and it joins the council.
- Not a SaaS product. It runs locally, on your machine, with your API keys.

**Competitive landscape:**

The market splits into two camps, and Conclave occupies neither:

1. **Generic multi-model platforms** (Council AI, llm-council, Perplexity Model Council) — "Ask all the models!" Web apps with broad audiences, no opinion about when consensus matters or what to do with disagreement. They treat more models as inherently better.
2. **Orchestration frameworks** (ccg-workflow, Claude Code Bridge, Bifrost) — Route tasks to different models based on strengths. Smart dispatching, but no synthesis. No consensus detection. The developer still has to reconcile outputs manually.

Conclave is the only tool that treats consensus as the primary signal and single-model findings as potential noise. It has a point of view: more models ≠ better. Agreement = signal.

**Structural differentials:**
- Consensus detection as a first-class primitive, not an afterthought
- Lives inside the developer's existing workflow (Claude Code slash commands), not as a separate app
- CLI-native — no browser, no dashboard, no context switching
- Model-agnostic — any CLI tool that accepts stdin can participate
- Opinionated about signal vs. noise: findings are ranked by agreement, not by model prestige

**The territory Conclave owns:** The space between "one model's opinion" and "human certainty." The confidence gap.

### Personality

**Dominant archetype:** The Arbiter — neutral, decisive, fair. Weighs evidence from multiple sources. Doesn't pick favorites. Delivers a clear verdict.

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
- A filter, not a firehose
- Understated and confident

**What Conclave is NOT:**
- The loudest voice in the room
- A hype machine promising "revolutionary AI"
- A Swiss Army knife trying to do everything
- Flashy, eager, or performative

### Promise

- When models agree, you can trust it.
- When they disagree, you see both sides.
- When only one model flags something, you know to be skeptical.

**Base message:** Conclave gives you the confidence that no single AI model can provide — not by being smarter, but by letting models check each other's work.

**Synthesizing phrase:** One command. Multiple perspectives. Clear signal.

### Guardrails

**Tone summary:** Understated, direct, warm, honest, dry.

**What the brand cannot be:**
- Breathless or hype-driven ("revolutionary," "game-changing," "unleash the power")
- Vendor-speak ("leverage," "solution," "enterprise-grade")
- Vague or hand-wavy about what consensus means
- Dismissive of single-model tools — Conclave extends them, it doesn't replace them
- Cold or robotic — the warm palette and quiet tone are deliberate

**Litmus test:** If it sounds like a product launch blog post, it's wrong.

---

## Voice

### Identity

We are a CLI tool that runs AI code reviews from multiple models and tells you where they agree. That's it. We don't generate code. We don't replace your judgment. We surface the signal so you can make better decisions faster.

We are not a platform. We are not a SaaS product. We are not a startup trying to "disrupt code review." We are a developer tool that does one thing well: it takes the noisy, overlapping outputs of multiple AI models and reduces them to a clear verdict. Consensus items get highlighted. Single-model findings get dimmed. You decide what to act on.

We believe that no single AI model should be trusted blindly. Every model has blind spots. Every model hallucinates differently. The value isn't in picking the "best" model — it's in letting them check each other. When Claude, Codex, and Gemini all flag the same race condition, that's not three opinions. That's a signal.

**Essence:** Confidence through consensus.

### Tagline & Slogans

**Primary tagline:** Consensus before commit.
*Use on: GitHub repo description, landing page hero, social bios.*

**Alternatives:**
- One command. Every model. Clear signal.
- Multiple models. One verdict.
- Grounded decisions, together.

**Slogans for different contexts:**
- Hero/landing: "Run AI code reviews locally, before you push."
- Technical: "When 2 out of 3 models flag it, it's probably real."
- Philosophy: "More models ≠ better. Consensus = signal."
- Action: "One command, multiple perspectives."
- Community: "Let the models deliberate. You decide."

### Manifesto

Every AI model has blind spots.

They hallucinate differently. Miss different edge cases. Get confident about different wrong things. You've seen it — one model flags a race condition that isn't there, another misses the one that is.

The solution isn't a better model. It's more perspectives.

Not more output. Not more noise. More independent eyes on the same code, and a way to see where they converge.

That's what consensus is. Not unanimity. Not majority rule. A filter. When multiple models independently reach the same conclusion, the signal gets stronger. When only one model sees something, you know to be skeptical.

Conclave doesn't write code. It doesn't replace your reviewer. It sits between the models and you, surfacing what matters and dimming what doesn't.

One command. The models deliberate. You get the verdict.

No platform. No dashboard. No accounts. Just your terminal, your models, and a clear answer.

Conclave.

### Message Pillars

**Consensus**
- When models agree, you can trust it. When they don't, you see both sides.
- Agreement is the signal. Disagreement is the context.

**Signal over noise**
- Not everything a model flags is real. Consensus separates the signal from the noise.
- One model says it's a bug? Maybe. Two models say it's a bug? Fix it.

**Developer-first**
- A slash command in your terminal. No new tools to learn. No tabs to switch.
- Works with the AI CLIs you already have installed.

**Honest about limits**
- More models isn't always better. Consensus isn't certainty.
- We tell you when only one model flagged something. That's useful information too.

**Open and local**
- Your machine, your API keys, your data. Open source. MIT license.
- Add any CLI tool that accepts stdin. The council is extensible.

### Phrases

- "2/3 consensus. Likely a real issue."
- "Only Gemini flagged this. Might be noise."
- "Claude and Codex both flagged this. Fix it?"
- "More models ≠ better. Consensus = signal."
- "One command. Multiple perspectives."
- "The models deliberated. Here's what matters."
- "Signal, not volume."

### Social Bios

**GitHub:**
Multi-model AI consensus for Claude Code. Run parallel code reviews from Claude, Codex, Gemini, and more. When they agree, it's probably real.

**LinkedIn:**
Conclave is an open-source CLI tool that runs AI code reviews from multiple models in parallel and surfaces consensus. Built for developers who want signal, not noise. One command, multiple perspectives, clear verdict.

**X/Twitter:**
Multi-model consensus for code review. One command, every model, clear signal. Open source.

**Website (short):**
A slash command for Claude Code that runs multiple AI CLIs in parallel. When they agree, it's probably real. When they don't, it might be noise.

### Tonal Rules

1. Speak in short, declarative sentences. No compound clauses where a period would do.
2. Use "you" and "your," not "users" or "developers." We're talking to one person at their terminal.
3. Understated confidence. Never exclamation marks. Never "amazing" or "powerful."
4. Be honest about limitations. "Consensus isn't certainty" is a brand-level statement.
5. Name the models by name. "Claude and Codex both flagged this" is more credible than "multiple models detected an issue."
6. Use numbers when possible. "2/3 consensus" is stronger than "most models agree."
7. Dry humor is allowed. "Only Gemini flagged this. Might be noise." has personality without trying.
8. Never explain what AI is. The audience knows.
9. Prefer lowercase in casual contexts. "looks good" not "Looks Good."
10. The word "revolutionary" is banned. So is "leverage," "unlock," "empower," and "game-changing."

**Identity boundaries:**
- We are not consultants who leave a deck behind.
- We are not a platform asking for your email.
- We are not a startup with a pitch deck and a "vision."
- We are a tool. You install it, configure it, run it. It works.

| We Say | We Never Say |
|---|---|
| "2/3 consensus" | "Our AI detected a critical issue" |
| "Might be noise" | "Warning: potential vulnerability found" |
| "Fix it?" | "We recommend immediate remediation" |
| "One command" | "Seamlessly integrate into your workflow" |
| "Works with your existing CLIs" | "Powered by cutting-edge AI technology" |
| "Open source, runs locally" | "Enterprise-grade security and compliance" |
| "More models ≠ better" | "Leverage the power of multiple AI models" |
| "Only Codex flagged this" | "Our advanced systems have identified..." |

---

## Visual

### Colors

**Primary — Sage Green**
- `#7cb38b` (green-500) — Primary brand color. Used for the ⊛ symbol, consensus indicators, CTAs, and primary actions.
- `#5a9a6b` (green-600) — Darker variant for hover states and emphasis.
- `#9ec9a9` (green-400) — Lighter variant for highlights and secondary indicators.
- `#c1dbc8` (green-300) — Subtle backgrounds and tints.
- `#e3f0e6` (green-200) — Lightest tint, used sparingly.

**Neutral — Warm Earth**
- `#0f0e0c` (warm-900) — Primary background. Not pure black — warm, like aged paper in a dark room.
- `#1a1916` (warm-800) — Card and surface backgrounds.
- `#222019` (warm-700) — Elevated surfaces, headers, footers.
- `#2d2a25` (warm-600) — Borders and dividers.
- `#e8dcc4` (warm-100) — Primary text. Warm off-white, not clinical.
- `#b5ae9f` (warm-200) — Secondary text.
- `#8a8478` (warm-300) — Muted text and captions.

**Accent**
- `#c9a962` (amber) — Sparingly, for performance indicators and special emphasis.

**Model Colors** (used only in model-specific contexts)
- Claude: `#c9875c` (warm terracotta)
- Codex: `#7cb38b` (sage green)
- Gemini: `#6b9ac4` (soft blue)
- Qwen: `#8b7cb3` (muted purple)
- Mistral: `#ff7000` (orange)
- Ollama: `#ffffff` (white)
- Grok: `#1da1f2` (blue)

**Semantic**
- Consensus: `#7cb38b` (same as primary — consensus IS the brand)
- Bug: `#c97070`
- Style: `#6b9ac4`
- Performance: `#c9a962`

**Colors to avoid:** Saturated neons, pure black (#000), pure white (#fff), any color that reads as "startup gradient." The palette is earthy and warm, never clinical or electric.

### Typography

**Display:** Outfit, weights 400–700
- Used for headings, brand name, UI labels, and body copy.
- Clean geometric sans-serif with warmth. Not as cold as Inter, not as quirky as rounded fonts.

**Monospace:** JetBrains Mono, weights 400–500
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
- Abstract representations of convergence and consensus (overlapping circles, intersecting lines)
- Developer workspaces — real, not staged

**Avoid:**
- Stock photos of people pointing at screens
- Futuristic/sci-fi AI imagery (neural networks, glowing brains)
- Crowded, busy compositions
- Anything that could appear on a SaaS landing page template

### Style

**Design keywords:** Warm, grounded, minimal, typographic, quiet, precise, earthy, restrained.

**Reference brands:** Resend (developer-first minimalism, dark palette, confident copy), Linear (precision, restraint, opinionated product design), Vercel (clean developer tooling, dark themes, typographic hierarchy).

**Direction:** The identity communicates signal, not decoration. Every visual element should earn its place. When in doubt, remove it. The warm earth palette distinguishes Conclave from the cold blue/purple developer tool aesthetic that dominates the market — it should feel like a trusted tool with patina, not a fresh startup.

**Logo:**
- Symbol: ⊛ (circled asterisk, U+229B) in green-500
- Wordmark: "conclave" in Outfit 600, warm-100
- Combined: `⊛ conclave`
- The symbol represents convergence — multiple points meeting at center. It echoes the asterisk (a developer symbol) enclosed in consensus (the circle).
