# BuildScore AI - Frontend to Backend Integration Guide

This document explains how the Next.js frontend connects to the Express API backend for real-time streaming of the BuildScore orchestrator pipeline.

## Architecture Overview

```
┌─────────────────┐
│  Next.js 14 Web │
│   (Frontend)    │
│  Port: 3000     │
└────────┬────────┘
         │
    SSE + CORS
         │
         ▼
┌─────────────────┐
│ Express API     │
│  (Backend)      │
│  Port: 3000     │
└────────┬────────┘
         │
    Orchestrates
         │
         ▼
   ┌─────────────────────────────────┐
   │  BuildScore AI Agents           │
   │  1. Define Agent (80s)          │
   │  2. Research Agent (market)     │
   │  3. Strategy Agent (MVP)        │
   │  4. Critic Agent (verification) │
   │  5. CEO Agent (decision)        │
   └─────────────────────────────────┘
```

## Data Flow

### Request
```
Frontend Form
  ↓
{
  "idea": "AI tool that helps solo founders validate startup ideas",
  "target_user": "First-time founders",
  "founder_context": "Product manager, 5 years SaaS",
  "prior_research": "Interviewed 10 founders"
}
  ↓
POST /api/analyze
```

### Response (Server-Sent Events)

The backend streams a sequence of events:

```javascript
// Event 1: Stage transition (Define Agent starts)
data: {"type":"stage","stage":"define"}

// Event 2: Agent output (when agent completes)
data: {"type":"data","data":{"define_output":{...}}}

// Event 3: Stage transition (Research Agent starts)
data: {"type":"stage","stage":"research"}

// ... more events ...

// Final: CEO decision
data: {"type":"data","data":{"define_output":{...},"market_analysis_output":{...},"ceo_decision":{"decision":"build","decision_confidence":72,...}}}

// Completion
data: {"type":"complete"}

// OR on error:
data: {"type":"error","error":"insufficient_input: What is the specific moment when..."}
```

## Files Modified/Created

### Backend (Express API)

**File:** `src/api/server.ts`
- Express server with CORS enabled
- POST `/api/analyze` endpoint
- Accepts JSON: `{idea, target_user?, founder_context?, prior_research?}`
- Runs real Orchestrator instance
- Intercepts `console.log` to detect agent START/END timestamps
- Streams SSE events with real agent outputs
- GET `/health` endpoint for health checks

**File:** `package.json`
- Added: `express`, `cors` dependencies
- Added: `@types/express`, `@types/cors` dev dependencies
- Added: `npm run start:api` script

### Frontend (Next.js 14)

**File:** `frontend/app/api/analyze/route.ts`
- Server-side API route (Next.js)
- Accepts POST from browser
- Forwards request to backend Express server via `BACKEND_URL`
- Streams SSE response back to client
- Error handling for backend failures

**File:** `frontend/app/page.tsx`
- Main page component
- Manages state: currentStage, isLoading, results, error
- Fetches from `/api/analyze` and reads SSE stream
- Parses events and updates UI
- Accumulates results from all events

### Deployment Config

**File:** `render.yaml`
- Dual-service deployment:
  - **buildscore-ai-api**: Express server
    - Start: `npm run start:api`
    - Port: 3000
    - Env: `ANTHROPIC_API_KEY` (sync from secret)
  - **buildscore-ai-web**: Next.js frontend
    - Start: `npm start` (after `npm run build`)
    - Env: `BACKEND_URL` = `{{ (resources.web.buildscore-ai-api).url }}`

## Development Setup

### Prerequisites
- Node.js 22+
- npm or yarn
- `.env` file with `ANTHROPIC_API_KEY`

### Local Development (Two Terminal Windows)

**Terminal 1 - Backend API:**
```bash
cd /path/to/buildscore-ai
npm install
npm run start:api
# Server running on http://localhost:3000
```

**Terminal 2 - Frontend:**
```bash
cd /path/to/buildscore-ai/frontend
npm install
npm run dev
# Frontend running on http://localhost:3000
```

⚠️ **Port conflict**: Both run on 3000 by default. Either:
- Run backend on different port: `PORT=4000 npm run start:api`
- Update frontend's `frontend/.env.local` to call backend:
  ```
  BACKEND_URL=http://localhost:4000
  ```

### Testing the Integration

1. Open http://localhost:3000 in browser
2. Fill in "Your Startup Idea" (required)
3. Optionally fill optional fields
4. Click "Analyze My Idea"
5. Watch progress pipeline light up as each agent completes
6. See final results with decision, confidence, risks, and next steps

### Example Flow (Local)

```
[Browser] ─────POST /api/analyze────────> [Next.js /api/analyze]
                                               │
                                               ├─ Validate input
                                               ├─ Call backend
                                               │
                                         [Express :3000]
                                               │
                                               ├─ Validate input
                                               ├─ Create Orchestrator
                                               ├─ Intercept console.log
                                               │
                                         [Orchestrator]
                                               │
                                               ├─[Define Agent] 84s
                                               │   └─ Emit: stage="define"
                                               │   └─ Emit: data={define_output}
                                               │
                                               ├─[Research Agent] 90s
                                               │   └─ Emit: stage="research"
                                               │   └─ Emit: data={market_analysis}
                                               │
                                               ├─[Strategy Agent] 45s
                                               │   └─ Emit: stage="strategy"
                                               │
                                               ├─[Critic Agent] 60s (max 3 loops)
                                               │   └─ Emit: stage="critic"
                                               │
                                               ├─[CEO Agent] 30s
                                               │   └─ Emit: stage="ceo"
                                               │   └─ Emit: data={ceo_decision}
                                               │
                                               └─ Emit: complete
                                               │
[Browser] <────SSE Stream─────────────────────┘
  │
  ├─ stage: define → light up Define circle
  ├─ data: {define_output} → show in results
  ├─ stage: research → light up Research circle
  ├─ ...
  ├─ stage: ceo → light up CEO circle
  ├─ data: {ceo_decision} → show decision card
  ├─ complete → show full results
```

## Deployment to Render

### Setup

1. Push code to GitHub with all changes committed
2. Go to render.com and create new "Blueprint" (multi-service)
3. Connect GitHub repository
4. Render detects `render.yaml` automatically
5. Set environment variables:
   - **Backend Service:**
     - `ANTHROPIC_API_KEY`: Your Anthropic API key (keep private/secret)
     - `NODE_ENV`: `production`
     - `PORT`: (auto-set to 3000)
   - **Frontend Service:**
     - `BACKEND_URL`: Auto-populated from backend service URL
     - `NODE_ENV`: `production`

### Deploy

Click "Deploy" on the blueprint. Render will:

1. Build backend: `npm install`
2. Start backend: `npm run start:api`
3. Build frontend: `npm install && npm run build`
4. Start frontend: `npm start`
5. Link services via `BACKEND_URL` environment variable
6. Frontend can call backend at `${BACKEND_URL}/api/analyze`

### URLs After Deployment

- **Frontend (Public):** `https://buildscore-ai-web.onrender.com`
- **Backend (Private, accessed by frontend):** `https://buildscore-ai-api.onrender.com`
- **Health Check:** `https://buildscore-ai-api.onrender.com/health`

### Debugging on Render

- Check backend logs: Click service → Logs
- Check frontend logs: Click service → Logs
- Test health: `curl https://buildscore-ai-api.onrender.com/health`
- Test API manually:
  ```bash
  curl -X POST https://buildscore-ai-api.onrender.com/api/analyze \
    -H "Content-Type: application/json" \
    -d '{"idea":"Test idea"}'
  ```

## CORS Configuration

### Backend (Express)
```typescript
app.use(cors()); // Allow all origins (configured in src/api/server.ts)
```

### Frontend
```typescript
res.setHeader('Access-Control-Allow-Origin', '*');
```

This allows:
- Local development: `http://localhost:3000` → `http://localhost:4000`
- Render: `https://...onrender.com` → `https://...onrender.com`

## Troubleshooting

### "Backend is unreachable"
**Symptom:** Frontend shows error immediately after clicking "Analyze"

**Solutions:**
1. Check backend is running: `curl http://localhost:4000/health`
2. Check `BACKEND_URL` in `.env.local` (frontend)
3. Verify no CORS errors in browser DevTools → Network tab
4. On Render: Check backend logs for errors

### "Connection timeout after 3–6 minutes"
**Symptom:** Analysis stops midway

**Causes:**
- Orchestrator timeout (Define Agent can take 84s)
- Network timeout in Next.js or Express
- Render free tier inactivity (spins down after 30s idle)

**Solutions:**
1. Use paid tier on Render (no spin-down)
2. Increase timeouts in `/api/analyze` and Express
3. Check logs for which agent timed out
4. Consider async job queue for long-running tasks

### "Invalid JSON from backend"
**Symptom:** Browser console shows parsing errors

**Cause:** Backend returned malformed JSON in SSE events

**Solution:**
1. Check backend logs for stack traces
2. Verify orchestrator output structure
3. Test backend directly: `curl -X POST http://localhost:3000/api/analyze -H "Content-Type: application/json" -d '{"idea":"test"}'`

### Frontend shows "Define Agent takes 84 seconds"
**Expected:** This is normal for complex problem analysis. The UI should show a progress bar and explain the wait time.

**If it gets stuck:**
1. Check backend logs to see which agent is running
2. Verify `ANTHROPIC_API_KEY` is valid
3. Check Anthropic API rate limits
4. Try with a shorter idea: just "A tool for X" (may fail validation but completes faster)

## Performance Notes

| Component | Typical Time | Variation |
|-----------|--------------|-----------|
| Define Agent | 80–90s | Complex ideas take longer |
| Research Agent | 60–90s | Depends on market data |
| Strategy Agent | 30–60s | May revise based on Critic |
| Critic Agent | 30–120s | Loops up to 3 times |
| CEO Agent | 20–40s | Synthesizes all inputs |
| **Total** | **3–6 minutes** | Depends on looping |

**Optimization opportunities:**
- Cache Define output for repeated ideas
- Batch Research queries
- Pre-load market data
- Implement result caching (backend)

## Next Steps

1. **Test locally** with `npm run start:api` and frontend dev server
2. **Deploy to Render** using the blueprint in `render.yaml`
3. **Monitor logs** for errors and performance
4. **Add caching** for frequently analyzed ideas
5. **Implement job queue** if you plan for concurrent analyses
6. **Set up monitoring** with Render's analytics or third-party tools

## References

- [Express.js Docs](https://expressjs.com)
- [Server-Sent Events (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [Render Documentation](https://render.com/docs)
- [Next.js API Routes](https://nextjs.org/docs/api-routes/introduction)
