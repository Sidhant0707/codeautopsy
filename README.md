<div align="center">
  <img src="./public/codeautopsy-logo1.png" alt="CodeAutopsy Logo" width="80" height="80" />
  <h1>CodeAutopsy V3</h1>
  <p><b>An AI-powered diagnostic engine that reverse-engineers, maps, and secures complex codebases in seconds.</b></p>
  
  <img src="https://img.shields.io/badge/Deployed-Vercel-black?style=for-the-badge&logo=vercel" alt="Deployed on Vercel" />
  <img src="https://img.shields.io/badge/AI-Groq_Llama_3.3-blue?style=for-the-badge&logo=meta" alt="Powered by Groq" />
  <img src="https://img.shields.io/badge/Marketplace-GitHub_Action-2ea44f?style=for-the-badge&logo=github" alt="GitHub Action" />
  <br/>
  <a href="https://codeautopsy-lyart.vercel.app/analyze?repo=Sidhant0707/codeautopsy">
  <img src="https://codeautopsy-lyart.vercel.app/api/badge?repo=Sidhant0707/codeautopsy&v=1" alt="CodeAutopsy Health" />
  </a>
</div>

---

## 🔬 Overview

Reading someone else's code is hard. Figuring out the blast radius of a Pull Request across thousands of files is even harder.

**CodeAutopsy** is a continuous diagnostic pipeline. It is not a simple AI wrapper—it performs deterministic static analysis, constructs graphing algorithms, intercepts hardcoded secrets, and feeds highly structured context to an LLM. It helps developers understand new codebases and merge PRs safely in minutes rather than days.

🌐 **Live Engine:** [codeautopsy.app](https://codeautopsy-lyart.vercel.app)

---

## 🚀 Core Features

### 1. The Diagnostic Engine (Repository Level)

- **Architecture Blueprints** — Pattern detection (MVC, Monolith, Library) and visual Mermaid.js dependency graphs.
- **Execution Flow Tracing** — Detailed traces of how the application runs from entry to exit.
- **Tech Stack & Key Modules** — Deep dive into languages, frameworks, and a functional analysis of what each file does.
- **Developer Onboarding** — Instant documentation and setup guides for new contributors.
- **Repo Chat Copilot** — Natural language Q&A powered by Groq/Llama 3.3 to interrogate the codebase.

### 2. PR Impact Analyzer (Branch Level)

- **Blast Radius Detection** — Shows exactly what downstream files will break if you modify critical code.
- **Context-Aware Reviewers** — Fetches historical `git blame` data to intelligently recommend PR reviewers based on who actually authored the modified files.
- **Enterprise Security Scanner** — High-speed RegEx interception layer that catches exposed AWS keys, private keys, and secrets _before_ they are sent to the LLM.

### 3. Global Distribution (CI/CD)

- **Shareable Reports** — Persistent analysis URLs at `/view/{owner}/{repo}`.
- **Official GitHub Action** — Automatically maps your architecture and injects a live SVG dependency graph into your README on every push.

---

## 🔌 Integrate the GitHub Action

Make your repository self-documenting. Add the CodeAutopsy Action to automatically generate and inject a live architecture map directly into your repository's README.

**1. Place the Map Beacon**
Add these invisible HTML comments anywhere in your `README.md`. The action will automatically replace the space between them on every push.

```html
<!-- CODEAUTOPSY_MAP_START -->
<!-- CODEAUTOPSY_MAP_END -->

2. Add the Workflow Create a new file at .github/workflows/codeautopsy.yml and
paste this configuration: name: Update Architecture Map on: push: branches: [
main, master ] jobs: update-map: runs-on: ubuntu-latest steps: - uses:
actions/checkout@v4 - name: CodeAutopsy Architecture Sync uses:
Sidhant0707/codeautopsy-action@v1.0.0 with: github_token: ${{
secrets.GITHUB_TOKEN }} 🏗️ Deep Engineering (How it Works) Most "AI code
analysis" tools dump a repo into an LLM and pray. CodeAutopsy uses a
sophisticated engineering pipeline that runs before any AI call is made: Layer 1
— Repository Parser Fetches the full file tree in a single call via the GitHub
Git Trees API. Intelligent noise filtering: ignores node_modules, dist, lock
files, and binaries. Entry point detection via manifest parsing (package.json)
and filename patterns. Layer 2 — Static Analysis Engine Regex Parsing: Extracts
import/require statements across the codebase. Graph Construction: Builds a
dependency adjacency list with local path resolution. Metric Computation:
Calculates Fan-in scores to dynamically identify core utility modules. Ranking
Algorithm: Sorts files by "Architectural Significance" (Fan-in + Depth + Role).
Layer 3 — Structured AI Analysis Context Optimization: Only the top ranked files
are sent to Groq to prevent "lost in the middle" LLM degradation. Strict Schema:
Forces AI into a typed JSON schema for consistent UI rendering. Security
Interception: Diff patches are pre-scanned locally; if secrets are found, AI
risk assessments are physically overridden to HIGH RISK. Layer 4 —
Infrastructure Smart Caching: Supabase (PostgreSQL) caching keyed by repo_url +
commit_sha + analysis_version. Stateless Auth: @supabase/ssr for secure session
handling and Private Repo token injection. Traffic Control: Upstash Redis
rate-limiting (3 analyses/day for free users, 10 for authenticated). 📐
Architecture Flow User pastes GitHub URL ↓ GitHub API → fetch file tree (single
call) ↓ Filter noise files & Detect entry points ↓ Build dependency graph & Rank
files by importance ↓ Pre-scan PR diffs for hardcoded secrets (Regex Engine) ↓
Fetch top file contents & Send structured context to Groq ↓ Groq returns strict
typed JSON ↓ Store in Supabase cache ↓ Render Analysis + Dependency Graph +
Context-Aware Reviewers + Chat 💻 Tech Stack Layer,Technology Frontend
UI,Next.js 16 (App Router) + Tailwind CSS + Framer Motion AI Analysis,Groq
(Llama 3.3 70B Versatile) Repo Chat,Groq (Llama 3.1 8B) Data Fetching,GitHub
REST API & Git Trees API Database & Auth,Supabase (PostgreSQL) Rate
Limiting,Upstash Redis Diagrams,Mermaid.js Deployment,Vercel 🚀 Running Locally
1. Clone & Install git clone
[https://github.com/Sidhant0707/codeautopsy](https://github.com/Sidhant0707/codeautopsy)
cd codeautopsy npm install 2. Configure Environment Create a .env.local file:
GITHUB_TOKEN=your_github_token GITHUB_FALLBACK_TOKEN=your_fallback_token
GROQ_API_KEY=your_groq_api_key USE_GROQ_FOR_ANALYSIS=true
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_supabase_service_key
UPSTASH_REDIS_REST_URL=your_upstash_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_token 3. Launch npm run dev 👨‍💻 Built by
Sidhant Kumar Software Development Engineer LinkedIn — GitHub
```
