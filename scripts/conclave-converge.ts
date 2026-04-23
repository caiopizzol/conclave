#!/usr/bin/env bun
// scripts/conclave-converge.ts
// Stateful coordinator for /converge. See docs/converge.md for design.

import { createHash } from "node:crypto";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

type Severity = "blocker" | "concern" | "nit";
type IssueStatus = "open" | "resolved" | "disputed" | "partially_resolved" | "stalemate";
type Verdict = "still_open" | "agreed_resolved" | "new_concern";
type Overall = "lgtm" | "concerns" | "blocker";
type ClaudeStatus = "resolved" | "disputed" | "partially_resolved";

interface LedgerIssue {
	id: string;
	kind: string;
	scope: string;
	location: string;
	claim_normalized: string;
	claim_display: string;
	severity: Severity;
	status: IssueStatus;
	first_seen_round: number;
	last_updated_round: number;
	variant_claims?: string[];
	claude_rationale?: string;
	history: { round: number; action: string; rationale?: string }[];
}

interface Ledger {
	version: 1;
	issues: LedgerIssue[];
	next_id: number;
}

interface ImplementerResponse {
	schema_version: 1;
	round: number;
	plan_markdown: string;
	sections?: { id: string; title: string; summary: string }[];
	decisions?: { claim: string; why: string }[];
	open_questions?: string[];
	responses?: { id: string; status: ClaudeStatus; rationale: string }[];
}

interface ReviewerResponse {
	schema_version: 1;
	round: number;
	references: { id: string; verdict: Verdict }[];
	new_issues: {
		kind: string;
		scope: string;
		location: string;
		claim: string;
		severity: Severity;
	}[];
	overall: Overall;
}

interface ToolConfig {
	enabled: boolean;
	command: string;
	input?: "stdin" | "argument";
	model?: string;
	description?: string;
	extraArgs?: string[];
}

interface ToolsFile {
	tools: Record<string, ToolConfig>;
}

// -------------------- CLI --------------------

function parseArgs(argv: string[]) {
	const args: Record<string, string> = {};
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a.startsWith("--")) {
			args[a.slice(2)] = argv[i + 1] ?? "";
			i++;
		}
	}
	return args;
}

function die(msg: string, code = 1): never {
	console.error(`conclave-converge: ${msg}`);
	process.exit(code);
}

// -------------------- Config --------------------

const CONFIG_PATH = join(homedir(), ".config/conclave/tools.json");
const IMPLEMENTER_KEY = "claude-opus";
const REVIEWER_KEY = "codex";

function loadTools(): { implementer: ToolConfig; reviewer: ToolConfig } {
	let raw: string;
	try {
		raw = readFileSync(CONFIG_PATH, "utf8");
	} catch {
		die(`config not found: ${CONFIG_PATH}. Run 'bun run register' from conclave.`);
	}
	const parsed: ToolsFile = JSON.parse(raw);
	const impl = parsed.tools?.[IMPLEMENTER_KEY];
	const rev = parsed.tools?.[REVIEWER_KEY];
	if (!impl?.enabled) {
		die(
			`tools.json key '${IMPLEMENTER_KEY}' is missing or disabled. /converge requires it as the implementer.`,
		);
	}
	if (!rev?.enabled) {
		die(
			`tools.json key '${REVIEWER_KEY}' is missing or disabled. /converge requires it as the reviewer.`,
		);
	}
	return { implementer: impl, reviewer: rev };
}

// -------------------- Spawning --------------------

function stripAnsi(s: string): string {
	// biome-ignore lint/suspicious/noControlCharactersInRegex: stripping ANSI
	return s.replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, "").replace(/\x1b\[[0-9;?]*[hlGK]/g, "");
}

function shellQuote(s: string): string {
	return `'${s.replace(/'/g, `'\\''`)}'`;
}

async function runTool(
	tool: ToolConfig,
	prompt: string,
	timeoutSec = 600,
): Promise<{ ok: true; output: string } | { ok: false; error: string }> {
	const input = tool.input ?? "stdin";
	const extra = (tool.extraArgs ?? []).map(shellQuote).join(" ");
	let cmdLine: string;
	if (input === "argument") {
		const escaped = prompt.replace(/'/g, `'\\''`);
		cmdLine = extra ? `${tool.command} ${extra} '${escaped}'` : `${tool.command} '${escaped}'`;
	} else {
		cmdLine = extra ? `${tool.command} ${extra}` : tool.command;
	}

	const proc = Bun.spawn({
		cmd: ["bash", "-lc", cmdLine],
		stdin: input === "stdin" ? "pipe" : "ignore",
		stdout: "pipe",
		stderr: "pipe",
	});

	if (input === "stdin" && proc.stdin) {
		proc.stdin.write(prompt);
		proc.stdin.end();
	}

	const timer = setTimeout(() => proc.kill(), timeoutSec * 1000);
	const exitCode = await proc.exited;
	clearTimeout(timer);

	const stdout = stripAnsi(await new Response(proc.stdout).text());
	const stderr = stripAnsi(await new Response(proc.stderr).text());

	if (exitCode !== 0) {
		return { ok: false, error: `exit ${exitCode}: ${stderr || stdout}`.slice(0, 2000) };
	}
	return { ok: true, output: stdout };
}

// -------------------- JSON extraction --------------------

function extractJson(raw: string): unknown {
	const trimmed = raw.trim();

	try {
		return JSON.parse(trimmed);
	} catch {}

	const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
	if (fenceMatch) {
		try {
			return JSON.parse(fenceMatch[1].trim());
		} catch {}
	}

	const first = trimmed.indexOf("{");
	if (first !== -1) {
		let depth = 0;
		let end = -1;
		let inStr = false;
		let esc = false;
		for (let i = first; i < trimmed.length; i++) {
			const c = trimmed[i];
			if (esc) {
				esc = false;
				continue;
			}
			if (c === "\\") {
				esc = true;
				continue;
			}
			if (c === '"') inStr = !inStr;
			if (inStr) continue;
			if (c === "{") depth++;
			else if (c === "}") {
				depth--;
				if (depth === 0) {
					end = i;
					break;
				}
			}
		}
		if (end !== -1) {
			try {
				return JSON.parse(trimmed.slice(first, end + 1));
			} catch {}
		}
	}

	throw new Error("no parseable JSON in model output");
}

// -------------------- Schema validation --------------------

const CLAUDE_STATUSES: ClaudeStatus[] = ["resolved", "disputed", "partially_resolved"];
const VERDICTS: Verdict[] = ["still_open", "agreed_resolved", "new_concern"];
const OVERALLS: Overall[] = ["lgtm", "concerns", "blocker"];
const SEVERITIES: Severity[] = ["blocker", "concern", "nit"];

function validateImplementer(
	o: unknown,
	round: number,
	openIds: string[],
): { ok: true; value: ImplementerResponse } | { ok: false; errors: string[] } {
	const errs: string[] = [];
	const r = o as Record<string, unknown>;
	if (!r || typeof r !== "object") return { ok: false, errors: ["not an object"] };
	if (r.schema_version !== 1) errs.push("schema_version must be 1");
	if (typeof r.plan_markdown !== "string" || !r.plan_markdown.trim())
		errs.push("plan_markdown must be a non-empty string");
	if (typeof r.round !== "number" || r.round !== round) errs.push(`round must be ${round}`);

	const rawResponses = r.responses;
	if (rawResponses !== undefined && !Array.isArray(rawResponses))
		errs.push("responses must be an array");
	const responses: unknown[] = Array.isArray(rawResponses) ? rawResponses : [];

	if (round === 0) {
		if (responses.length > 0) errs.push("round 0 responses must be empty");
	} else {
		const seen = new Set<string>();
		for (const raw of responses) {
			const resp = raw as Record<string, unknown>;
			if (!resp || typeof resp !== "object") {
				errs.push("each response must be an object");
				continue;
			}
			if (typeof resp.id !== "string" || !openIds.includes(resp.id)) {
				errs.push(`response.id '${String(resp.id)}' not in actionable issue set`);
				continue;
			}
			if (seen.has(resp.id)) errs.push(`duplicate response for ${resp.id}`);
			seen.add(resp.id);
			if (!CLAUDE_STATUSES.includes(resp.status as ClaudeStatus))
				errs.push(`response.status invalid for ${resp.id}`);
			if (typeof resp.rationale !== "string" || !resp.rationale.trim())
				errs.push(`response.rationale required for ${resp.id}`);
		}
		for (const id of openIds) {
			if (!seen.has(id)) errs.push(`missing response for actionable issue ${id}`);
		}
	}

	if (errs.length) return { ok: false, errors: errs };
	return { ok: true, value: r as unknown as ImplementerResponse };
}

function validateReviewer(
	o: unknown,
	round: number,
	knownIds: string[],
): { ok: true; value: ReviewerResponse } | { ok: false; errors: string[] } {
	const errs: string[] = [];
	const r = o as Record<string, unknown>;
	if (!r || typeof r !== "object") return { ok: false, errors: ["not an object"] };
	if (r.schema_version !== 1) errs.push("schema_version must be 1");
	if (typeof r.round !== "number" || r.round !== round) errs.push(`round must be ${round}`);
	if (!OVERALLS.includes(r.overall as Overall)) errs.push("overall invalid");

	const rawRefs = r.references;
	if (rawRefs !== undefined && !Array.isArray(rawRefs)) errs.push("references must be an array");
	const references: unknown[] = Array.isArray(rawRefs) ? rawRefs : [];
	if (round === 1 && references.length > 0) errs.push("round 1 references must be empty");
	for (const raw of references) {
		const ref = raw as Record<string, unknown>;
		if (typeof ref.id !== "string" || !knownIds.includes(ref.id))
			errs.push(`reference.id '${String(ref.id)}' unknown`);
		if (!VERDICTS.includes(ref.verdict as Verdict)) errs.push("reference.verdict invalid");
	}

	const rawNew = r.new_issues;
	if (rawNew !== undefined && !Array.isArray(rawNew)) errs.push("new_issues must be an array");
	const newIssues: unknown[] = Array.isArray(rawNew) ? rawNew : [];
	for (const raw of newIssues) {
		const ni = raw as Record<string, unknown>;
		for (const f of ["kind", "scope", "location", "claim"]) {
			if (typeof ni[f] !== "string" || !(ni[f] as string).trim())
				errs.push(`new_issue.${f} must be a non-empty string`);
		}
		if (!SEVERITIES.includes(ni.severity as Severity)) errs.push("new_issue.severity invalid");
	}

	if (errs.length) return { ok: false, errors: errs };
	return { ok: true, value: r as unknown as ReviewerResponse };
}

// -------------------- Normalization and fingerprint --------------------

const STOPWORDS = new Set([
	"a",
	"an",
	"the",
	"is",
	"are",
	"was",
	"were",
	"be",
	"been",
	"being",
	"to",
	"of",
	"in",
	"on",
	"at",
	"by",
	"for",
	"with",
	"from",
	"as",
	"and",
	"or",
	"but",
	"not",
	"no",
	"that",
	"this",
	"these",
	"those",
	"it",
	"its",
	"if",
	"then",
	"else",
	"when",
	"where",
	"while",
	"should",
	"would",
	"could",
	"may",
	"might",
	"will",
	"shall",
]);

function normalizeClaim(claim: string): string {
	const tokens = claim
		.toLowerCase()
		.replace(/[^a-z0-9\s]/g, " ")
		.split(/\s+/)
		.filter((t) => t && !STOPWORDS.has(t));
	return [...new Set(tokens)].sort().join(" ");
}

function fingerprint(
	kind: string,
	scope: string,
	location: string,
	claimNormalized: string,
): string {
	const h = createHash("sha256");
	h.update(`${kind}\x00${scope}\x00${location}\x00${claimNormalized}`);
	return h.digest("hex").slice(0, 16);
}

// -------------------- Ledger --------------------

function newLedger(): Ledger {
	return { version: 1, issues: [], next_id: 1 };
}

function mintId(ledger: Ledger): string {
	const id = `ISSUE-${String(ledger.next_id).padStart(3, "0")}`;
	ledger.next_id++;
	return id;
}

function isActionable(i: LedgerIssue): boolean {
	// Issues Claude must respond to in a revise round.
	// Open issues always. Disputed blockers too: a disputed blocker is never
	// allowed to silently disappear from Claude's workload, because blockers
	// don't auto-stalemate. Disputed nit/concern issues stand until stalemate
	// triggers or the reviewer drops them.
	if (i.status === "open") return true;
	if (i.status === "disputed" && i.severity === "blocker") return true;
	return false;
}

function actionableIssueIds(ledger: Ledger): string[] {
	return ledger.issues.filter(isActionable).map((i) => i.id);
}

function hasUnresolvedBlocker(ledger: Ledger): boolean {
	// For stop-condition purposes, a disputed blocker counts as unresolved.
	// Only round_cap (or a phase-2 adjudication) can terminate a disputed blocker.
	return ledger.issues.some(
		(i) => i.severity === "blocker" && (i.status === "open" || i.status === "disputed"),
	);
}

function allIssueIds(ledger: Ledger): string[] {
	return ledger.issues.map((i) => i.id);
}

function findIssue(ledger: Ledger, id: string): LedgerIssue | undefined {
	return ledger.issues.find((i) => i.id === id);
}

function reconcileNewIssues(
	ledger: Ledger,
	critique: ReviewerResponse,
	round: number,
): { reraisedIds: string[] } {
	const reraisedIds: string[] = [];
	for (const ni of critique.new_issues) {
		const claimNorm = normalizeClaim(ni.claim);
		const fp = fingerprint(ni.kind, ni.scope, ni.location, claimNorm);
		const byFp = ledger.issues.find(
			(i) => fingerprint(i.kind, i.scope, i.location, i.claim_normalized) === fp,
		);
		if (byFp) {
			byFp.last_updated_round = round;
			if (byFp.status === "disputed") {
				byFp.history.push({ round, action: "reraised_by_reviewer" });
				reraisedIds.push(byFp.id);
			} else if (byFp.status === "resolved" || byFp.status === "partially_resolved") {
				byFp.status = "open";
				byFp.history.push({ round, action: "reviewer_rejects_resolution" });
			} else if (byFp.status === "stalemate") {
				byFp.history.push({ round, action: "reraised_but_stalemate" });
			} else {
				byFp.history.push({ round, action: "reraised_by_reviewer" });
			}
			continue;
		}

		const variant = ledger.issues.find(
			(i) => i.kind === ni.kind && i.scope === ni.scope && i.location === ni.location,
		);
		if (variant) {
			variant.variant_claims = variant.variant_claims ?? [];
			variant.variant_claims.push(ni.claim);
			variant.last_updated_round = round;
			if (variant.status === "disputed") {
				variant.history.push({ round, action: "variant_by_reviewer" });
				reraisedIds.push(variant.id);
			} else if (variant.status === "resolved" || variant.status === "partially_resolved") {
				variant.status = "open";
				variant.history.push({ round, action: "variant_rejects_resolution" });
			} else if (variant.status === "stalemate") {
				variant.history.push({ round, action: "variant_but_stalemate" });
			} else {
				variant.history.push({ round, action: "variant_by_reviewer" });
			}
			continue;
		}

		const id = mintId(ledger);
		ledger.issues.push({
			id,
			kind: ni.kind,
			scope: ni.scope,
			location: ni.location,
			claim_normalized: claimNorm,
			claim_display: ni.claim.slice(0, 200),
			severity: ni.severity,
			status: "open",
			first_seen_round: round,
			last_updated_round: round,
			history: [{ round, action: "created_by_reviewer" }],
		});
	}
	return { reraisedIds };
}

function applyReviewerReferences(
	ledger: Ledger,
	critique: ReviewerResponse,
	round: number,
): { reraisedIds: string[] } {
	const reraisedIds: string[] = [];
	for (const ref of critique.references) {
		const issue = findIssue(ledger, ref.id);
		if (!issue) continue;
		issue.last_updated_round = round;
		if (ref.verdict === "agreed_resolved") {
			if (issue.status === "resolved" || issue.status === "partially_resolved") {
				issue.history.push({ round, action: "reviewer_confirmed_resolved" });
			} else {
				issue.status = "resolved";
				issue.history.push({ round, action: "reviewer_accepted_resolution" });
			}
		} else if (ref.verdict === "still_open") {
			if (issue.status === "disputed") {
				reraisedIds.push(issue.id);
				issue.history.push({ round, action: "reviewer_reraises_dispute" });
			} else if (issue.status === "resolved" || issue.status === "partially_resolved") {
				issue.status = "open";
				issue.history.push({ round, action: "reviewer_rejects_resolution" });
			} else {
				issue.history.push({ round, action: "reviewer_still_open" });
			}
		} else if (ref.verdict === "new_concern") {
			issue.status = "open";
			issue.history.push({ round, action: "reviewer_new_concern" });
		}
	}
	return { reraisedIds };
}

function applyClaudeResponses(ledger: Ledger, impl: ImplementerResponse, round: number): void {
	for (const resp of impl.responses ?? []) {
		const issue = findIssue(ledger, resp.id);
		if (!issue) continue;
		issue.status = resp.status;
		issue.claude_rationale = resp.rationale;
		issue.last_updated_round = round;
		issue.history.push({
			round,
			action: `claude_${resp.status}`,
			rationale: resp.rationale,
		});
	}
}

function applyStalemates(ledger: Ledger, reraisedIds: string[], round: number): void {
	for (const id of reraisedIds) {
		const issue = findIssue(ledger, id);
		if (!issue) continue;
		if (issue.status !== "disputed") continue;
		if (issue.severity === "blocker") continue;
		issue.status = "stalemate";
		issue.history.push({ round, action: "auto_stalemate" });
	}
}

// -------------------- Stop conditions --------------------

type StopReason = "no_open_blockers" | "stable_with_disputes" | "round_cap";

function evaluateStop(
	ledger: Ledger,
	critique: ReviewerResponse,
	roundsRun: number,
	maxRounds: number,
): StopReason | null {
	// Disputed blockers count as unresolved. Blockers never auto-stalemate, so
	// only round_cap (or a later phase-2 adjudication) can terminate them.
	const unresolvedBlockers = hasUnresolvedBlocker(ledger);
	if (critique.overall === "lgtm" && !unresolvedBlockers) {
		return "no_open_blockers";
	}
	if (critique.new_issues.length === 0 && !unresolvedBlockers) {
		return "stable_with_disputes";
	}
	if (roundsRun >= maxRounds) return "round_cap";
	return null;
}

// -------------------- Prompts --------------------

function implementerSystemHeader(): string {
	return `You are the IMPLEMENTER in a conclave /converge session.

OUTPUT CONTRACT:
- Respond with ONE valid JSON object and NOTHING ELSE.
- No prose before the JSON. No prose after the JSON.
- No markdown fences. No code blocks. No commentary.
- If your first instinct is to explain, put the explanation inside "plan_markdown".

If you violate this, the coordinator rejects your output.
`;
}

function reviewerSystemHeader(): string {
	return `You are the REVIEWER in a conclave /converge session.

OUTPUT CONTRACT:
- Respond with ONE valid JSON object and NOTHING ELSE.
- No prose before the JSON. No prose after the JSON.
- No markdown fences. No code blocks. No commentary.

If you violate this, the coordinator rejects your output.
`;
}

function buildImplementerRound0(task: string, context: string): string {
	return `${implementerSystemHeader()}
# Task
${task}

# Context
${context}

# Response schema (ImplementerResponse v1)
{
  "schema_version": 1,
  "round": 0,
  "plan_markdown": "<full plan in markdown>",
  "sections": [{ "id": "sec-1", "title": "...", "summary": "..." }],
  "decisions": [{ "claim": "...", "why": "..." }],
  "open_questions": ["..."],
  "responses": []
}

Round 0 rules: "responses" MUST be an empty array. This is the initial draft.
Emit the JSON object only.`;
}

function buildImplementerReviseN(
	round: number,
	task: string,
	context: string,
	priorArtifact: string,
	ledger: Ledger,
	priorClaudeResponses: ImplementerResponse["responses"],
): string {
	const actionable = ledger.issues.filter(isActionable);
	const snapshot = actionable
		.map(
			(i) =>
				`- ${i.id} [${i.severity}/${i.status}] (${i.kind}/${i.scope} at ${i.location}): ${i.claim_display}`,
		)
		.join("\n");
	const actionableIds = actionable.map((i) => i.id);
	const priorJson = priorClaudeResponses?.length
		? JSON.stringify(priorClaudeResponses, null, 2)
		: "[]";

	return `${implementerSystemHeader()}
# Task
${task}

# Context
${context}

# Prior plan (round ${round - 1})
${priorArtifact}

# Open issues (ledger snapshot)
${snapshot || "(none)"}

# Your prior-round responses (for continuity)
${priorJson}

# Response schema (ImplementerResponse v1)
{
  "schema_version": 1,
  "round": ${round},
  "plan_markdown": "<revised plan>",
  "sections": [...],
  "decisions": [...],
  "open_questions": [...],
  "responses": [
${actionableIds.map((id) => `    { "id": "${id}", "status": "resolved|disputed|partially_resolved", "rationale": "..." }`).join(",\n")}
  ]
}

HARD RULES for "responses":
- Exactly one entry per actionable issue ID above. No more, no less.
- Actionable issue IDs: ${actionableIds.join(", ") || "(none)"}
- "Actionable" = all open issues, plus any disputed blocker (blockers cannot be abandoned silently).
- status must be one of: resolved, disputed, partially_resolved.
- rationale must be a non-empty string.
- Do not invent IDs. Do not rename IDs. Do not skip IDs.

Emit the JSON object only.`;
}

function buildReviewerRound1(task: string, context: string, artifact: string): string {
	return `${reviewerSystemHeader()}
# Task
${task}

# Context
${context}

# Plan to review (round 0 draft)
${artifact}

# Response schema (ReviewerResponse v1)
{
  "schema_version": 1,
  "round": 1,
  "references": [],
  "new_issues": [
    { "kind": "correctness|design|scope|test|perf|style",
      "scope": "planning|file:path|function:name",
      "location": "free-text locator",
      "claim": "concise problem statement",
      "severity": "blocker|concern|nit" }
  ],
  "overall": "lgtm|concerns|blocker"
}

Round 1 rules: "references" MUST be empty (no prior ledger exists).
Flag real issues only. Blockers are for correctness or design problems that must be fixed.
Emit the JSON object only.`;
}

function buildReviewerRoundN(
	round: number,
	task: string,
	context: string,
	artifact: string,
	ledger: Ledger,
): string {
	const snapshot = ledger.issues
		.map(
			(i) =>
				`- ${i.id} [${i.severity}/${i.status}] (${i.kind}/${i.scope} at ${i.location}): ${i.claim_display}`,
		)
		.join("\n");
	const knownIds = allIssueIds(ledger).join(", ");

	return `${reviewerSystemHeader()}
# Task
${task}

# Context
${context}

# Plan to review (round ${round - 1} revision)
${artifact}

# Ledger snapshot
${snapshot || "(empty)"}

# Response schema (ReviewerResponse v1)
{
  "schema_version": 1,
  "round": ${round},
  "references": [
    { "id": "ISSUE-XXX", "verdict": "still_open|agreed_resolved|new_concern" }
  ],
  "new_issues": [
    { "kind": "...", "scope": "...", "location": "...", "claim": "...", "severity": "..." }
  ],
  "overall": "lgtm|concerns|blocker"
}

RULES:
- "references" may include any ledger IDs you want to comment on. Valid IDs: ${knownIds || "(none)"}.
- "new_issues" are only for problems not already in the ledger.
- If an existing issue you cared about is now addressed, mark it "agreed_resolved".
- If you still disagree with Claude's resolution, mark it "still_open".
- Do not restate existing issues in "new_issues". The coordinator fingerprints and will reject restatements.

Emit the JSON object only.`;
}

// -------------------- Model call with retry --------------------

async function callImplementer(
	tool: ToolConfig,
	prompt: string,
	round: number,
	openIds: string[],
	log: (msg: string) => void,
): Promise<ImplementerResponse> {
	for (let attempt = 1; attempt <= 2; attempt++) {
		const runResult = await runTool(tool, prompt);
		if (!runResult.ok) {
			log(`implementer attempt ${attempt} failed: ${runResult.error}`);
			if (attempt === 2) throw new Error(`implementer failed: ${runResult.error}`);
			continue;
		}
		let parsed: unknown;
		try {
			parsed = extractJson(runResult.output);
		} catch {
			log(`implementer attempt ${attempt} JSON parse failed`);
			if (attempt === 2) throw new Error("implementer: no valid JSON after retry");
			prompt = `${prompt}\n\n[COORDINATOR REMINDER] Your previous response was not valid JSON. Respond with exactly one JSON object and nothing else.`;
			continue;
		}
		const valid = validateImplementer(parsed, round, openIds);
		if (valid.ok) return valid.value;
		log(`implementer attempt ${attempt} schema errors: ${valid.errors.join("; ")}`);
		if (attempt === 2) throw new Error(`implementer schema invalid: ${valid.errors.join("; ")}`);
		prompt = `${prompt}\n\n[COORDINATOR REMINDER] Your previous response failed schema validation:\n${valid.errors.map((e) => `- ${e}`).join("\n")}\nRespond with exactly one valid JSON object matching the schema.`;
	}
	throw new Error("unreachable");
}

async function callReviewer(
	tool: ToolConfig,
	prompt: string,
	round: number,
	knownIds: string[],
	log: (msg: string) => void,
): Promise<ReviewerResponse> {
	for (let attempt = 1; attempt <= 2; attempt++) {
		const runResult = await runTool(tool, prompt);
		if (!runResult.ok) {
			log(`reviewer attempt ${attempt} failed: ${runResult.error}`);
			if (attempt === 2) throw new Error(`reviewer failed: ${runResult.error}`);
			continue;
		}
		let parsed: unknown;
		try {
			parsed = extractJson(runResult.output);
		} catch {
			log(`reviewer attempt ${attempt} JSON parse failed`);
			if (attempt === 2) throw new Error("reviewer: no valid JSON after retry");
			prompt = `${prompt}\n\n[COORDINATOR REMINDER] Your previous response was not valid JSON. Respond with exactly one JSON object and nothing else.`;
			continue;
		}
		const valid = validateReviewer(parsed, round, knownIds);
		if (valid.ok) return valid.value;
		log(`reviewer attempt ${attempt} schema errors: ${valid.errors.join("; ")}`);
		if (attempt === 2) throw new Error(`reviewer schema invalid: ${valid.errors.join("; ")}`);
		prompt = `${prompt}\n\n[COORDINATOR REMINDER] Your previous response failed schema validation:\n${valid.errors.map((e) => `- ${e}`).join("\n")}\nRespond with exactly one valid JSON object matching the schema.`;
	}
	throw new Error("unreachable");
}

// -------------------- Main --------------------

async function main() {
	const args = parseArgs(process.argv.slice(2));
	const task = args.task;
	const contextPath = args.context;
	const session = args.session;
	const maxRounds = Number(args["max-rounds"] ?? "3");

	if (!task) die("--task required");
	if (!contextPath) die("--context required");
	if (!session) die("--session required");
	if (!Number.isFinite(maxRounds) || maxRounds < 1) die("--max-rounds must be >= 1");

	const context = readFileSync(contextPath, "utf8");
	writeFileSync(join(session, "task.md"), task);

	const { implementer, reviewer } = loadTools();
	const ledger = newLedger();

	const logPath = join(session, "coordinator.log");
	const log = (msg: string) => {
		const line = `[${new Date().toISOString()}] ${msg}\n`;
		try {
			appendFileSync(logPath, line);
		} catch {}
		process.stderr.write(line);
	};

	const writeRound = (n: number, name: string, content: string) => {
		const dir = join(session, `round_${n}`);
		mkdirSync(dir, { recursive: true });
		writeFileSync(join(dir, name), content);
	};

	// ---- Round 0: draft ----
	log("round 0: drafting initial plan");
	const round0Prompt = buildImplementerRound0(task, context);
	writeRound(0, "prompt_implementer.md", round0Prompt);
	const round0 = await callImplementer(implementer, round0Prompt, 0, [], log);
	writeRound(0, "artifact.json", JSON.stringify(round0, null, 2));
	writeRound(0, "artifact.md", round0.plan_markdown);

	let prevArtifact: ImplementerResponse = round0;
	let prevArtifactMd = round0.plan_markdown;
	let roundsRun = 0;
	let stopReason: StopReason | null = null;
	let finalArtifactPath = join(session, "round_0", "artifact.md");

	for (let n = 1; n <= maxRounds; n++) {
		// ---- Review phase ----
		log(`round ${n}: review phase`);
		const reviewerPrompt =
			n === 1
				? buildReviewerRound1(task, context, prevArtifactMd)
				: buildReviewerRoundN(n, task, context, prevArtifactMd, ledger);
		writeRound(n, "prompt_reviewer.md", reviewerPrompt);

		const critique = await callReviewer(reviewer, reviewerPrompt, n, allIssueIds(ledger), log);
		writeRound(n, "critique.json", JSON.stringify(critique, null, 2));

		const { reraisedIds: reraisedByRefs } = applyReviewerReferences(ledger, critique, n);
		const { reraisedIds: reraisedByNew } = reconcileNewIssues(ledger, critique, n);
		const allReraised = [...new Set([...reraisedByRefs, ...reraisedByNew])];
		applyStalemates(ledger, allReraised, n);

		roundsRun = n;
		writeRound(n, "ledger_after_review.json", JSON.stringify(ledger, null, 2));

		stopReason = evaluateStop(ledger, critique, roundsRun, maxRounds);
		finalArtifactPath = join(session, `round_${n - 1}`, "artifact.md");
		// final artifact is the one that was just reviewed, i.e. prev
		// if stop fires now, we don't revise and prev stands

		if (stopReason) {
			log(`round ${n}: stop (${stopReason})`);
			break;
		}

		// ---- Revise phase ----
		log(`round ${n}: revise phase`);
		const actionableIds = actionableIssueIds(ledger);
		const revisePrompt = buildImplementerReviseN(
			n,
			task,
			context,
			prevArtifactMd,
			ledger,
			prevArtifact.responses,
		);
		writeRound(n, "prompt_implementer.md", revisePrompt);

		const revised = await callImplementer(implementer, revisePrompt, n, actionableIds, log);
		writeRound(n, "artifact.json", JSON.stringify(revised, null, 2));
		writeRound(n, "artifact.md", revised.plan_markdown);

		applyClaudeResponses(ledger, revised, n);
		writeRound(n, "ledger_after_revise.json", JSON.stringify(ledger, null, 2));

		prevArtifact = revised;
		prevArtifactMd = revised.plan_markdown;
	}

	if (!stopReason) {
		stopReason = "round_cap";
		finalArtifactPath = join(session, `round_${roundsRun}`, "artifact.md");
	}

	// Reviewer schema (ReviewerResponse) carries claim + verdict but no per-issue rationale,
	// so "reviewer_claim" here is the claim as originally raised. Do not fabricate a
	// separate "codex_rationale" that would imply the reviewer wrote free-form prose it didn't.
	const disputes = ledger.issues
		.filter((i) => i.status === "disputed")
		.map((i) => ({
			id: i.id,
			severity: i.severity,
			reviewer_claim: i.claim_display,
			claude_rationale: i.claude_rationale ?? "",
		}));
	const stalemates = ledger.issues
		.filter((i) => i.status === "stalemate")
		.map((i) => ({
			id: i.id,
			severity: i.severity,
			reviewer_claim: i.claim_display,
			claude_rationale: i.claude_rationale ?? "",
		}));
	const resolved = ledger.issues
		.filter((i) => i.status === "resolved" || i.status === "partially_resolved")
		.map((i) => ({
			id: i.id,
			claim: i.claim_display,
			resolved_in_round: i.last_updated_round,
		}));

	const final = {
		rounds_run: roundsRun,
		stop_reason: stopReason,
		final_artifact: finalArtifactPath,
		ledger: ledger.issues.map((i) => ({
			id: i.id,
			kind: i.kind,
			status: i.status,
			severity: i.severity,
			claim: i.claim_display,
		})),
		disputes,
		stalemates,
		resolved,
	};
	writeFileSync(join(session, "final.json"), JSON.stringify(final, null, 2));
	console.log(JSON.stringify(final, null, 2));
}

main().catch((e) => {
	console.error(`conclave-converge: ${(e as Error).message}`);
	process.exit(1);
});
