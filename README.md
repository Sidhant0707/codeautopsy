<div align="center">
  <img src="./public/codeautopsy-logo1.png" alt="CodeAutopsy Logo" width="80" height="80" />
  <h1>CodeAutopsy</h1>
  <p>Codebase intelligence platform. Point it at any GitHub repository — public or private — and get a complete architectural analysis in seconds.</p>

  <img src="https://img.shields.io/badge/Deployed-Vercel-black?style=for-the-badge&logo=vercel" alt="Deployed on Vercel" />
  <img src="https://img.shields.io/badge/AI-Cerebras-orange?style=for-the-badge" alt="Powered by Cerebras" />
  <img src="https://img.shields.io/badge/Marketplace-GitHub_Action-2ea44f?style=for-the-badge&logo=github" alt="GitHub Action" />
  <br/>
  <a href="https://codeautopsy-lyart.vercel.app/analyze?repo=Sidhant0707/codeautopsy">
    <img src="https://codeautopsy-lyart.vercel.app/api/badge?repo=Sidhant0707/codeautopsy&v=1" alt="CodeAutopsy Health" />
  </a>

  <br/><br/>
<br/>
<a href="https://codeautopsy-lyart.vercel.app">
  <img src="https://img.shields.io/badge/⚡ Try it Live — codeautopsy--lyart.vercel.app-%230b1120?style=for-the-badge&logoColor=white" />
</a>
<br/>
</div>

---

## What it does

Understanding a large unfamiliar codebase takes hours. Reviewing a PR without knowing its blast radius is a gamble. CodeAutopsy solves both.

Six analysis modules run on every repository:

| Module | What it does |
|--------|-------------|
| **Blueprint Map** | Interactive dependency graph with 3 visualization modes — dependency flow, folder structure, codebase weight |
| **Risk Radar** | Finds articulation points, bridge edges, circular dependencies, and orphaned code |
| **Diagnostic Engine** | CFG analysis for unreachable code, missing error handling, and infinite loops |
| **PR Impact** | Blast radius prediction before a change ships |
| **Arch Insights** | Ranks files by architectural influence using PageRank and betweenness centrality |
| **Read Docs** | Instant documentation and onboarding guide for any repo |

---

## This is not an AI wrapper

Most "AI code analysis" tools dump a repository into an LLM and hope for the best.

CodeAutopsy runs four deterministic layers before any AI call is made:

**Layer 1 — Repository Parser**
Fetches the full file tree in a single GitHub Git Trees API call. Filters noise intelligently — ignores `node_modules`, `dist`, lock files, binaries. Detects entry points via manifest parsing.

**Layer 2 — Static Analysis Engine**
This is where the real work happens. Regex parsing extracts import/require statements across the codebase. A dependency adjacency list is constructed with local path resolution. Fan-in scores are computed to identify core utility modules. Files are ranked by architectural significance using Fan-in + Depth + Role weighting.

The graph analysis uses:
- **Tarjan's algorithm** — articulation point detection
- **Brandes' algorithm** — betweenness centrality scoring  
- **PageRank** — architectural hub identification
- **Force-directed layout** — interactive dependency visualization

No AI is involved in this layer. The structural risks are real because the math is real.

**Layer 3 — Structured AI Analysis**
Only the top-ranked files reach the LLM — preventing "lost in the middle" degradation. Output is forced into a strict typed JSON schema for consistent rendering. PR diffs are pre-scanned locally for hardcoded secrets before anything reaches the AI. If secrets are found, risk assessments are physically overridden to HIGH RISK regardless of what the LLM returns.

**Layer 4 — Infrastructure**
Supabase PostgreSQL caching keyed by `repo_url + commit_sha + analysis_version`. Upstash Redis rate limiting (3 analyses/day free, 10 authenticated). `@supabase/ssr` for stateless auth and private repo token injection.

---

## Private repo support

Authenticate with GitHub and run CodeAutopsy against your actual production codebase. Not just public demos.

---

## GitHub Action

Make your repository self-documenting. The CodeAutopsy Action automatically generates and injects a live architecture map into your README on every push.

**1. Add the map beacon to your README:**

```html
<!-- CODEAUTOPSY_MAP_START -->
<!-- CODEAUTOPSY_MAP_END -->
```

**2. Add the workflow:**

```yaml
name: Update Architecture Map

on:
  push:
    branches: [main, master]

jobs:
  update-map:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: CodeAutopsy Architecture Sync
        uses: Sidhant0707/codeautopsy-action@v1.0.0
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
```

---

## Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js (App Router), TailwindCSS, Framer Motion |
| Graph Visualization | React Flow, D3.js |
| AI Analysis | Cerebras — Llama 3.3 70B |
| Repo Chat | Groq — Llama 3.1 8B |
| Data Fetching | GitHub REST API, Git Trees API |
| Database & Auth | Supabase (PostgreSQL) |
| Rate Limiting | Upstash Redis |
| Diagrams | Mermaid.js |
| Deployment | Vercel |

---

## Running locally

```bash
git clone https://github.com/Sidhant0707/codeautopsy
cd codeautopsy
npm install
```

Create `.env.local`:

```env
GITHUB_TOKEN=your_github_token
GITHUB_FALLBACK_TOKEN=your_fallback_token
CEREBRAS_API_KEY=your_cerebras_api_key
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_supabase_service_key
UPSTASH_REDIS_REST_URL=your_upstash_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_token
```

```bash
npm run dev
```

---

## Contributing

The areas that would benefit most from contribution right now:

- Additional language support for the static analysis engine
- More graph algorithm implementations
- New LLM provider integrations
- UI improvements to the visualization layers

Fork the repo, create a feature branch, open a PR. See `CONTRIBUTING.md` for architecture guidelines.

---

## License

MIT — see `LICENSE` for details.

---

Built by [Sidhant Kumar](https://github.com/Sidhant0707) — CS student at GLBITM, Greater Noida.  
[LinkedIn](https://linkedin.com/in/sidhant07) · [Live demo](https://codeautopsy-lyart.vercel.app)
