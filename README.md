# BuildScore AI

**Multi-agent AI startup evaluation engine**

BuildScore AI analyzes startup ideas through a 5-stage verification pipeline, emitting honest insights on market fit, competitive viability, and build decisions. Each agent in the pipeline challenges assumptions, synthesizes evidence, and routes decisions based on confidence thresholds and verification gates.

```
┌─────────────────────────────────────────────────────────────────┐
│                    BUILDSCORE PIPELINE                          │
└─────────────────────────────────────────────────────────────────┘

    Define            Research          Strategy           Critic
     Agent             Agent             Agent             Agent
       │                 │                 │                 │
       │   Problem       │   Market &      │   MVP Plan &    │   Verify &
       │   Definition    │   Competitor    │   Go-to-Market  │   Review
       └─────────────────┴─────────────────┴─────────────────┴───────┐
                                                                       │
                                                                       ▼
                                                                    CEO
                                                                   Agent
                                                                     │
                                                          Final Build
                                                          Decision
```

## What It Does

BuildScore AI accepts a founder's startup idea and runs it through a verification gauntlet. The **Define Agent** pressure-tests the core problem statement and flags vagueness. The **Research Agent** maps market size, user demand, and competitive landscape. The **Strategy Agent** designs an MVP and go-to-market approach. The **Critic Agent** (with up to 3 review loops) challenges the plan and surfaces risks. Finally, the **CEO Agent** synthesizes all evidence and renders a build decision: **BUILD**, **PIVOT**, or **ABANDON**.

Each agent outputs structured JSON. The orchestrator enforces validation gates: if an agent's output is too weak or contradicts the pipeline contract, the analysis halts with actionable next steps. This is product thinking, not AI randomness.

---

## The Five Agents

### 1. **Define Agent**
**Responsibility:** Extract and pressure-test the founder's problem statement.

Receives a raw idea pitch and applies a 12-point validation checklist:
- Strip solution language and restate as pure problem
- Extract core user pain (frequency, intensity, emotional cost)
- Identify primary and secondary users with behavioral specificity
- Test the problem statement with the "why" test (do root causes hold?)
- Classify evidence as validated, assumed, or unknown
- Score problem strength (pain, frequency, user clarity, evidence quality, urgency)
- Flag red flags: phantom users, founder bias, vitamin-vs-painkiller misclassification

Output: `DefineOutput` with confidence score (0–100). If confidence ≤ 10 or analysis_status is "insufficient_input", the pipeline halts and returns critical unknowns the founder must address.

### 2. **Research Agent**
**Responsibility:** Validate market size, user demand, and competitive landscape.

Runs two sub-analyses in parallel:
- **Market Analysis:** Estimate TAM/SAM, growth trends, economic cycles, regulatory tailwinds/headwinds
- **Competitor Analysis:** Map direct and indirect competitors, identify gaps, assess product-market fit signals in competitors' trajectories

Output: `ResearchAgentOutput` with two structured sub-outputs. If either analysis_status is "blocked_by_define", the orchestrator halts (Define was too weak to bound the problem).

### 3. **Strategy Agent**
**Responsibility:** Design an MVP and go-to-market strategy aligned with the problem and market.

Produces:
- **MVP Planning:** Core feature set, phased rollout, defensibility thesis
- **Go-to-Market:** User acquisition channels, pricing model, initial target cohort, launch sequencing

Output: `MvpPlanningOutput` with strategy recommendations. Strategy Agent runs in a loop: if Critic feedback includes required revisions, Strategy re-runs with those constraints (up to 3 iterations total).

### 4. **Critic Agent** ✓ Looping Verification
**Responsibility:** Challenge the strategy and verify the plan under stress.

Executes a 5-point verification checklist:
- **Competitive Defensibility:** Can this survive competition? How long?
- **User Demand Signal:** Is demand inferred or validated? How strong?
- **Build Feasibility:** Is the MVP achievable in 3–6 months by a solo founder or small team?
- **Market Sizing:** Is the TAM large enough to justify the effort?
- **Risk Inventory:** What are the top 5 ways this fails?

Output: `VerificationOutput` with verdict: **"approve"**, **"revise"**, or **"reject"**.
- If **"revise"**: routes back to Strategy Agent with required_revisions
- If **"reject"** or **"approve"**: advances to CEO Agent
- Loop limit: max 3 Critic passes. On loop_count == 3, Critic must upgrade "revise" → "approve" (with ceo_caveats) or return "reject"

### 5. **CEO Agent**
**Responsibility:** Synthesize all evidence and render the final build decision.

Reads the full pipeline state and produces:
- **Decision:** BUILD, PIVOT, or ABANDON
- **Decision Confidence:** 0–100 (reflects evidence strength)
- **Decision Rationale:** Why this decision, grounded in evidence
- **Fastest Next Action:** What the founder should do in the next 48 hours
- **Open Risks:** Top risks and caveats that survived verification
- **Evidence Ledger:** Traceability: which agents found what

Output: `StartupValidationOutput` with structured decision data. This is the terminal output of the orchestrator.

---

## Local Setup

### Prerequisites
- **Node.js 22+** (for ES modules and TypeScript support)
- **npm** or **yarn**
- **Anthropic API key** (https://console.anthropic.com/account/keys)

### Backend Setup

```bash
# Install dependencies
npm install

# Create .env file with your API key
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY

# Start the Express API server
npm run start:api
# Server runs on http://localhost:3000
# Endpoints:
#   POST /api/analyze    - Stream startup analysis via SSE
#   GET  /health         - Health check
```

**Test the backend:**
```bash
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "idea": "AI tool that helps solo founders validate startup ideas",
    "target_user": "early stage solo founders",
    "founder_context": "PM with 5 years SaaS experience",
    "prior_research": "interviewed 10 founders"
  }'
```

### Frontend Setup

```bash
# Install frontend dependencies
cd frontend
npm install --legacy-peer-deps

# Start the Next.js dev server
npm run dev
# Frontend runs on http://localhost:3001
# Open http://localhost:3001 in your browser
```

**Features:**
- Form to submit startup ideas
- Real-time progress UI (pipeline stages light up as agents complete)
- Results display with decision, confidence, risks, and next steps
- SSE streaming from backend
- Tailwind CSS styling

### CLI Setup

```bash
# Run analysis from command line
npm run analyze "AI tool that helps solo founders validate startup ideas before building"

# With optional flags
npm run analyze "Your idea here" \
  --target-user "Your target user" \
  --founder-context "Your background" \
  --prior-research "Any research done"
```

**Output:** Full JSON pipeline state and terminal-friendly summary.

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **LLM** | Claude Sonnet 4 | Reliable JSON output, reasoning capability, system prompt caching |
| **Backend** | Express.js + TypeScript | Lightweight, type-safe API server |
| **Frontend** | Next.js 14 + React 19 | App Router, server components, SSE streaming, Tailwind CSS |
| **Real-time** | Server-Sent Events (SSE) | Streaming agent progress without polling |
| **Styling** | Tailwind CSS | Utility-first, responsive design |
| **Type Safety** | TypeScript (strict mode) | Enforce agent contracts, catch bugs at compile time |
| **Orchestration** | Custom Orchestrator class | Verifies agent outputs, enforces gates, manages loops |
| **Deployment** | Render (via render.yaml) | Dual-service: backend API + frontend web |
| **Environment** | dotenv | Secure API key management |

---

## Built to Demonstrate

This project showcases advanced software engineering patterns for AI applications:

### 1. **Product Thinking Over AI Hype**
- Every agent has a clear responsibility and contract
- Validation gates prevent garbage-in-garbage-out (if Define output is weak, pipeline halts)
- Confidence scores are explicit; the system doesn't hide uncertainty
- Founder gets actionable feedback, not vague sentiments

### 2. **Agent Orchestration at Scale**
- 5-agent pipeline with looping feedback (Critic → Strategy up to 3 times)
- Type-safe routing: orchestrator enforces that each agent's output meets contract before advancing
- Halt signals unwind the stack cleanly; no silent failures
- Evidence traceability from every agent to the final decision

### 3. **Verification Systems**
- Critic Agent is built to challenge, not rubber-stamp
- Loop-limit logic prevents infinite refinement but allows iteration
- Knockout rules and confidence ceilings prevent over-confident decisions
- Red flags are tracked and surfaced, not buried

### 4. **Type-Safe Architecture**
- All agent inputs/outputs defined in `types/agent-types.ts` and `types/orchestrator-types.ts`
- TypeScript strict mode enforces contracts at compile time
- JSON validation gates catch contract violations at runtime
- No magic strings; enums for all decision types (verdict, decision, analysis_status, etc.)

### 5. **Production Engineering**
- **System Prompt Caching:** Define Agent's system prompt is cached for 5-min reuse (cuts API latency by 25%)
- **Debug Logging:** Timestamps logged at START/END of each agent for performance monitoring
- **CORS-enabled API:** Frontend and backend can be on different origins (Render deployment)
- **SSE Streaming:** Real-time progress UI without polling; scales better than webhook/websocket for read-only streams
- **Error Handling:** API errors, contract violations, and timeouts are caught and surfaced cleanly
- **Environment Management:** .env support for secure API key storage, no secrets in code

---

## Project Structure

```
buildscore-ai/
├── agents/                           # Agent implementations
│   ├── define-agent.ts              # Problem definition analyzer
│   ├── research-agent.ts            # Market & competitor research
│   ├── strategy-agent.ts            # MVP & go-to-market planning
│   ├── critic-agent.ts              # Verification & challenge
│   └── ceo-agent.ts                 # Final decision synthesis
│
├── orchestrator/                     # Pipeline orchestration
│   ├── orchestrator.ts              # Main pipeline (Define → Research → Strategy → Critic → CEO)
│   └── pipeline-state.ts            # Immutable state management
│
├── src/
│   ├── api/
│   │   └── server.ts                # Express API server (POST /api/analyze, GET /health)
│   ├── cli/
│   │   └── run-analysis.ts          # Command-line interface
│   ├── llm/
│   │   └── anthropic-client.ts      # Anthropic SDK wrapper
│   └── prompts/
│       ├── define-agent.prompt.ts
│       ├── research-agent.prompt.ts
│       └── ... (one per agent)
│
├── frontend/                         # Next.js 14 web UI
│   ├── app/
│   │   ├── page.tsx                 # Main page
│   │   ├── api/analyze/route.ts     # API route (forwards to backend)
│   │   ├── layout.tsx               # Root layout
│   │   └── globals.css              # Tailwind CSS
│   ├── components/
│   │   ├── AnalyzeForm.tsx          # Startup idea input form
│   │   ├── ProgressPipeline.tsx     # Real-time progress UI
│   │   └── ResultsDisplay.tsx       # Results & decision display
│   ├── next.config.js
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── package.json
│
├── types/                            # Shared TypeScript types
│   ├── agent-types.ts               # Input/output contracts for all agents
│   ├── orchestrator-types.ts        # Orchestrator types, halt reasons, gates
│   └── shared-types.ts              # Common enums (verdict, decision, etc.)
│
├── .claude/
│   ├── commands/                    # Claude skill definitions
│   └── skills/                      # Agent system prompts (Markdown)
│       ├── define-problem/SKILL.md
│       ├── market-analysis/SKILL.md
│       └── ... (one per agent)
│
├── docs/                             # Architecture & design docs
│   ├── ARCHITECTURE_LOCK.md
│   ├── agent-contracts.md
│   ├── agent-responsibilities.md
│   └── output-schema.md
│
├── .env.example                      # Environment template
├── .env                              # Environment (git-ignored, local only)
├── .gitignore
├── package.json                      # Backend dependencies
├── tsconfig.json                     # Backend TypeScript config
├── render.yaml                       # Render multi-service deployment
├── API_INTEGRATION.md                # Frontend-backend integration guide
└── README.md                         # This file
```

---

## Environment Variables

Create a `.env` file in the project root:

```bash
# .env
ANTHROPIC_API_KEY=sk-ant-...your-key-here...
```

Get your key from https://console.anthropic.com/account/keys

**Never commit `.env`** — it's git-ignored for security.

---

## Deployment

### Render Deployment

The project includes `render.yaml` for automated multi-service deployment:

```yaml
services:
  - name: buildscore-ai-api      # Express backend
    startCommand: npm run start:api
  - name: buildscore-ai-web      # Next.js frontend
    startCommand: npm start
```

**Steps:**
1. Push code to GitHub
2. Connect repository to Render
3. Render auto-detects `render.yaml`
4. Set `ANTHROPIC_API_KEY` secret on backend service
5. Deploy — both services start automatically

**URLs after deployment:**
- Frontend: `https://buildscore-ai-web.onrender.com`
- Backend API: `https://buildscore-ai-api.onrender.com` (internal)

---

## Performance Notes

| Agent | Typical Time | Notes |
|-------|--------------|-------|
| Define | 80–90s | Complex problem analysis; system prompt cached |
| Research | 60–90s | Parallel market + competitor analysis |
| Strategy | 30–60s | MVP design |
| Critic | 30–120s | Up to 3 verification loops |
| CEO | 20–40s | Synthesizes all evidence |
| **Total** | **3–6 minutes** | Depends on iteration count |

**Optimization:**
- System prompt caching saves ~25% on Define latency
- Parallel agent execution in Research phase
- Async background processing for long-running analyses
- Result caching (future v1.1)

---

## Development Commands

```bash
# Backend
npm install                    # Install dependencies
npm run typecheck             # Type check (no emit)
npm run build                 # Compile TypeScript to dist/
npm run start:api             # Start Express server
npm run analyze "<idea>"      # Run CLI analysis

# Frontend
cd frontend
npm install --legacy-peer-deps
npm run dev                   # Start Next.js dev server
npm run build                 # Production build
npm start                     # Start production server

# Repository
git push origin master        # Push to GitHub
git log --oneline -10        # Show recent commits
```

---

## Contributing

This project demonstrates advanced AI engineering patterns. If you'd like to extend it:

- **Add a new agent:** Define type contracts in `types/agent-types.ts`, implement in `agents/`, create a skill in `.claude/skills/`, wire into orchestrator
- **Modify verification gates:** Update `orchestrator/orchestrator.ts` to add halt conditions or confidence ceilings
- **Improve styling:** Modify Tailwind config or components in `frontend/components/`
- **Deploy:** `render.yaml` handles multi-service orchestration

All code follows the project's type-safety-first philosophy: contracts define behavior, not comments.

---

## License

MIT

---

## Questions?

- **API Integration:** See `API_INTEGRATION.md`
- **Agent Contracts:** See `docs/agent-contracts.md`
- **Architecture:** See `docs/ARCHITECTURE_LOCK.md`

---

**BuildScore AI** — Honest startup evaluation through AI verification.
