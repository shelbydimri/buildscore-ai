/**
 * BuildScore AI — CLI entry point
 *
 * Usage:
 *   tsx src/cli/run-analysis.ts "<startup idea>"
 *   tsx src/cli/run-analysis.ts "<idea>" --target-user "<who>" --founder-context "<context>"
 *
 * Flags (all optional):
 *   --target-user          Who the founder believes the primary user is
 *   --current-solutions    Existing tools or workarounds the founder is aware of
 *   --founder-context      Is the founder the user? Relevant industry background?
 *   --prior-research       Interviews, data, or validation already gathered
 *
 * Environment:
 *   ANTHROPIC_API_KEY      Required. Set via .env file or shell: export ANTHROPIC_API_KEY="sk-ant-..."
 */

import 'dotenv/config';
import { Orchestrator } from '../../orchestrator/orchestrator';
import type { OrchestratorDecisionOutput, OrchestratorHaltOutput } from '../../types/orchestrator-types';
import type { DefineAgentInput } from '../../types/agent-types';

// ── ANSI helpers ──────────────────────────────────────────────────────────────

const C = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  red:    '\x1b[31m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  cyan:   '\x1b[36m',
  white:  '\x1b[37m',
} as const;

const W = 58; // output column width

function rule(): void {
  console.log(`  ${C.dim}${'─'.repeat(W)}${C.reset}`);
}

function section(title: string): void {
  console.log();
  console.log(`  ${C.bold}${C.cyan}${title}${C.reset}`);
  rule();
}

function wrap(text: string, indent = 4, width = W - 2): string {
  const pad = ' '.repeat(indent);
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    if ((line + word).length > width) {
      if (line) lines.push(pad + line.trimEnd());
      line = word + ' ';
    } else {
      line += word + ' ';
    }
  }
  if (line.trim()) lines.push(pad + line.trimEnd());
  return lines.join('\n');
}

// ── Arg parser ────────────────────────────────────────────────────────────────

function parseArgs(): DefineAgentInput {
  const argv = process.argv.slice(2);

  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') {
    console.log(`
  ${C.bold}BuildScore AI${C.reset} — Startup idea analyser

  ${C.cyan}Usage${C.reset}
    tsx src/cli/run-analysis.ts "<startup idea>" [options]

  ${C.cyan}Options${C.reset}
    --target-user         Who the founder believes the primary user is
    --current-solutions   Tools or workarounds already in use
    --founder-context     Founder background; are they the target user?
    --prior-research      Interviews, data, or validation already gathered

  ${C.cyan}Example${C.reset}
    tsx src/cli/run-analysis.ts "AI scheduling tool for independent therapists" \\
      --target-user "solo therapists in private practice" \\
      --founder-context "Former therapist, 8 years experience"
`);
    process.exit(0);
  }

  const input: Partial<DefineAgentInput> = {};

  for (let i = 0; i < argv.length; i++) {
    const arg  = argv[i];
    const next = argv[i + 1];
    if (!arg) continue;
    if (arg === '--target-user'            && next) { input.target_user       = next; i++; }
    else if (arg === '--current-solutions' && next) { input.current_solutions = next; i++; }
    else if (arg === '--founder-context'   && next) { input.founder_context   = next; i++; }
    else if (arg === '--prior-research'    && next) { input.prior_research    = next; i++; }
    else if (!arg.startsWith('--') && !input.idea)  { input.idea             = arg;  }
  }

  if (!input.idea) {
    console.error(`${C.red}Error:${C.reset} startup idea is required as the first argument.\n`);
    console.error(`  tsx src/cli/run-analysis.ts "<your idea>"\n`);
    process.exit(1);
  }

  return input as DefineAgentInput;
}

// ── Decision renderer ─────────────────────────────────────────────────────────

function printDecision(result: OrchestratorDecisionOutput, idea: string): void {
  const { decision, decision_confidence, decision_status, loop_count,
          rationale, fastest_next_action, open_risks } = result;

  // Colour the decision badge
  const decisionColor =
    decision === 'PROCEED'              ? C.green  :
    decision === 'PROCEED WITH CAUTION' ? C.yellow :
    C.red;

  console.log();
  console.log(`  ${C.bold}${C.cyan}BUILDSCORE AI${C.reset}  ${C.dim}run ${result.run_id}${C.reset}`);
  console.log();
  console.log(`  ${C.dim}Idea:${C.reset}  ${idea}`);
  console.log();
  rule();
  console.log();
  console.log(`  ${C.bold}${decisionColor}${decision}${C.reset}`);
  console.log();
  console.log(`  Confidence    ${C.bold}${decision_confidence}${C.reset} / 100`);
  console.log(`  Status        ${decision_status}`);
  console.log(`  Critic loops  ${loop_count}`);

  // Primary factors
  if (rationale.primary_factors.length > 0) {
    section('PRIMARY FACTORS');
    for (const f of rationale.primary_factors) {
      const icon  = f.direction === 'supports' ? `${C.green}✓${C.reset}` : `${C.red}✗${C.reset}`;
      const label = f.direction === 'supports'
        ? `${C.dim}supports${C.reset}`
        : `${C.dim}opposes ${C.reset}`;
      console.log(`  ${icon}  ${label}  ${f.factor}`);
    }
  }

  // Counter-argument
  if (rationale.strongest_counterargument) {
    section('COUNTER-ARGUMENT');
    console.log(wrap(rationale.strongest_counterargument));
  }

  // Bear case (only on proceed decisions)
  if (decision !== 'DO NOT BUILD' && rationale.bear_case) {
    section('BEAR CASE');
    console.log(wrap(rationale.bear_case));
  }

  // Fastest next action
  section('FASTEST NEXT ACTION');
  console.log(`  ${C.bold}${fastest_next_action.action}${C.reset}`);
  console.log(`  ${C.dim}Effort: ${fastest_next_action.effort}${C.reset}`);
  if (fastest_next_action.expected_learning) {
    console.log();
    console.log(wrap(fastest_next_action.expected_learning));
  }

  // Open risks (critical and major only)
  const flaggedRisks = open_risks.filter(r => r.severity === 'critical' || r.severity === 'major');
  if (flaggedRisks.length > 0) {
    section(`OPEN RISKS  (${flaggedRisks.length})`);
    for (const risk of flaggedRisks) {
      const sevColor = risk.severity === 'critical' ? C.red : C.yellow;
      const mit      = risk.mitigation_status === 'mitigated' ? C.dim + '✓ mitigated' : C.red + risk.mitigation_status;
      console.log(`  ${sevColor}[${risk.severity}]${C.reset}  ${risk.risk}  ${C.dim}→ ${mit}${C.reset}`);
    }
  }

  console.log();
  rule();
  console.log();
}

// ── Halt renderer ─────────────────────────────────────────────────────────────

function printHalt(result: OrchestratorHaltOutput, idea: string): void {
  console.log();
  console.log(`  ${C.bold}${C.cyan}BUILDSCORE AI${C.reset}  ${C.dim}run ${result.run_id}${C.reset}`);
  console.log();
  console.log(`  ${C.dim}Idea:${C.reset}  ${idea}`);
  console.log();
  rule();
  console.log();
  console.log(`  ${C.bold}${C.yellow}ANALYSIS HALTED${C.reset}`);
  console.log();
  console.log(`  Reason   ${result.halt_reason}`);
  console.log(`  Stage    ${result.halt_stage}`);

  if (result.what_is_needed.length > 0) {
    section('WHAT IS NEEDED TO CONTINUE');
    result.what_is_needed.forEach((item, i) => {
      console.log(`  ${C.dim}${i + 1}.${C.reset}  ${item}`);
    });
  }

  console.log();
  rule();
  console.log();
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const input = parseArgs();

  // Running banner
  console.log();
  console.log(`  ${C.bold}${C.cyan}BUILDSCORE AI${C.reset}`);
  console.log(`  ${C.dim}Running full pipeline — Define → Research → Strategy → Critic → CEO${C.reset}`);
  console.log(`  ${C.dim}This typically takes 8–10 minutes (includes TPM management). API key: ${
    process.env['GROQ_API_KEY'] ? 'found' : C.red + 'MISSING' + C.reset + C.dim
  }${C.reset}`);
  console.log();

  let elapsed = 0;
  const spinner = setInterval(() => {
    elapsed++;
    process.stdout.write(`\r  ${C.dim}Analyzing... ${elapsed}s${C.reset}   `);
  }, 1000);

  let result;
  try {
    result = await new Orchestrator().run(input);
  } finally {
    clearInterval(spinner);
    process.stdout.write('\r' + ' '.repeat(40) + '\r');
  }

  if (result.outcome === 'decision') {
    printDecision(result, input.idea);
  } else {
    printHalt(result, input.idea);
  }
}

main().catch(err => {
  console.error(`\n  ${C.red}${C.bold}Fatal error${C.reset}`);
  console.error(`  ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
