# BuildScore AI Frontend

Next.js 14 frontend for BuildScore AI with real-time SSE streaming of agent progress.

## Features

- **Single-page interface** with textarea for startup idea input
- **Optional fields** for target user, founder context, and prior research
- **Real-time progress UI** showing Define → Research → Strategy → Critic → CEO pipeline
- **Streaming results** via Server-Sent Events (SSE)
- **Professional styling** with Tailwind CSS
- **Responsive design** for desktop and mobile
- **Full results display** with build decision, confidence score, risks, and next actions

## Development

### Prerequisites
- Node.js 22+
- npm or yarn

### Setup

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build for Production

```bash
npm run build
npm start
```

## Project Structure

```
frontend/
├── app/
│   ├── api/
│   │   └── analyze/
│   │       └── route.ts          # SSE endpoint for analysis streaming
│   ├── globals.css               # Global styles and Tailwind setup
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Main page
├── components/
│   ├── AnalyzeForm.tsx           # Input form component
│   ├── ProgressPipeline.tsx      # Agent stage progress indicator
│   └── ResultsDisplay.tsx        # Results presentation
├── package.json
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
└── README.md
```

## API Integration

### POST `/api/analyze`

Accepts analysis input and streams progress events via SSE.

**Request Body:**
```json
{
  "idea": "AI tool that helps solo founders validate startup ideas",
  "target_user": "First-time founders",
  "founder_context": "Product manager, 5 years SaaS",
  "prior_research": "Interviewed 10 founders"
}
```

**Response:** Server-Sent Events stream

Events:
- `{ "type": "stage", "stage": "define" }` - Agent stage changed
- `{ "type": "data", "data": {...} }` - Partial results
- `{ "type": "complete" }` - Analysis finished
- `{ "type": "error", "error": "message" }` - Error occurred

## Styling

Uses Tailwind CSS with custom utility classes:
- `.btn-primary` - Primary action button
- `.btn-secondary` - Secondary action button
- `.input-field` - Form input styling
- `.card` - Card container

## Deployment

### Render

Uses `render.yaml` at the root directory. Push to trigger automatic deployment:

```bash
git push origin main
```

The frontend will be deployed to Render and communicate with the backend API via `BACKEND_URL` environment variable.

### Environment Variables

- `NEXT_PUBLIC_API_URL` - Public API URL (exposed to browser)
- `BACKEND_URL` - Backend service URL (server-side)
- `NODE_ENV` - Environment (development/production)

## Performance

- **Server-Sent Events (SSE)** for real-time streaming instead of polling
- **System prompt caching** for Define agent (backend)
- **Progressive result display** as agents complete
- **Optimized bundle** with Next.js 14 and SWC compilation

## Troubleshooting

### SSE Connection Issues
- Check CORS headers in API route
- Verify backend service is running
- Check network tab in DevTools for connection errors

### Build Errors
- Clear `.next` directory: `rm -rf .next`
- Reinstall dependencies: `npm install`
- Check Node.js version: `node --version` (must be 22+)

## License

Same as BuildScore AI main project
