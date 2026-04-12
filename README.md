<div align="center">
  <img src="./public/codeautopsy-logo1.png" alt="CodeAutopsy Logo" width="80" height="80" />
  <h1>CodeAutopsy</h1>
  <p><b>AI-powered codebase visualization and architectural analysis.</b></p>
  
  <img src="https://img.shields.io/badge/Deployed-Vercel-black?style=for-the-badge&logo=vercel" alt="Deployed on Vercel" />
  <img src="https://img.shields.io/badge/AI-Gemini_1.5_Pro-blue?style=for-the-badge&logo=google-gemini" alt="Powered by Gemini" />
</div>

---

## 🔬 Overview
CodeAutopsy is a deep-analysis pipeline that transforms complex GitHub repositories into interactive architectural maps. By leveraging Gemini 1.5 Pro and custom static analysis, it helps developers understand new codebases in minutes rather than days.

**Understand any GitHub codebase in minutes.**

CodeAutopsy is an AI-powered repository analysis tool that performs real static analysis before sending structured context to an LLM. It's not an API wrapper — it builds import graphs, detects entry points, ranks files by importance, and feeds structured data to Gemini for architectural analysis.

🌐 **Live Demo:** [codeautopsy.app](https://codeautopsy-lyart.vercel.app)

---

## 🛠️ What it does

Paste any GitHub repo URL and get:

- **Architecture Overview** — Pattern detection (MVC, Monolith, Library, etc.).
- **Execution Flow** — Detailed trace of how the app runs from start to finish.
- **Dependency Graph** — Visual Mermaid.js diagram built from real import parsing.
- **Tech Stack Detection** — Deep dive into languages, frameworks, and their specific roles.
- **Key Modules Breakdown** — Functional analysis of what each file does and why it exists.
- **Developer Onboarding Guide** — Instant documentation for new contributors.
- **Ask the Repo Chat** — Natural language Q&A powered by Groq/Llama 3.1.
- **Shareable Reports** — Persistent analysis URLs at `/view/{owner}/{repo}`.

---

## 🏗️ Why it's not just an API wrapper

Most "AI code analysis" tools dump a repo into an LLM and pray. CodeAutopsy uses a sophisticated engineering pipeline that runs before any AI call:

### Layer 1 — Repository Parser
- Fetches the full file tree in a single call via the **GitHub Git Trees API**.
- Intelligent noise filtering: `node_modules`, `dist`, lock files, and binaries.
- Entry point detection via manifest parsing (`package.json`) and filename patterns.

### Layer 2 — Static Analysis Engine
- **Regex Parsing:** Extracts `import`/`require` statements across the codebase.
- **Graph Construction:** Builds a dependency adjacency list with local path resolution.
- **Metric Computation:** Calculates **Fan-in scores** to identify core utility modules.
- **Ranking Algorithm:** Sorts files by "Architectural Significance" (Fan-in + Depth + Role).

### Layer 3 — Structured AI Analysis
- **Context Optimization:** Only the top 15-20 ranked files are sent to Gemini to prevent "lost in the middle" context issues.
- **Strict Schema:** Forces Gemini into a typed JSON schema for consistent UI rendering.
- **Cross-Validation:** Ensures AI-generated insights match the actual file tree.

### Layer 4 — Infrastructure
- **Smart Caching:** Supabase (PostgreSQL) caching keyed by `repo_url + commit_sha + analysis_version`.
- **Stateless Auth:** `@supabase/ssr` for secure session handling and Private Repo token injection.
- **Traffic Control:** Upstash Redis rate-limiting (3 analyses per 24h).

---

## 💻 Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | Next.js 16 (App Router) + Tailwind CSS + Framer Motion |
| **AI Engine** | Google Gemini 2.5 Pro / Flash |
| **Repo Chat** | Groq (Llama 3.1 8B) |
| **Auth / DB** | Supabase (PostgreSQL) |
| **Rate Limiting** | Upstash Redis |
| **Diagrams** | Mermaid.js |
| **Deployment** | Vercel |

---

## 🚀 Running Locally

1. **Clone & Install**
   ```bash
   git clone [https://github.com/Sidhant0707/codeautopsy](https://github.com/Sidhant0707/codeautopsy)
   cd codeautopsy
   npm install
Configure Environment
Create a .env.local file:

Code snippet
GITHUB_TOKEN=your_github_token
GEMINI_API_KEY=your_gemini_api_key
GROQ_API_KEY=your_groq_api_key
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_supabase_service_key
UPSTASH_REDIS_REST_URL=your_upstash_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_token
Launch

Bash
npm run dev
📐 Architecture Flow
Code snippet
graph TD
    A[User pastes GitHub URL] --> B[GitHub API: Fetch File Tree]
    B --> C[Filter Noise & Binary Files]
    C --> D[Detect Entry Points & Parse Imports]
    D --> E[Build Dependency Graph & Rank Files]
    E --> F[Fetch Top Ranked File Contents]
    F --> G[Gemini 1.5 Pro: Architectural Analysis]
    G --> H[Store in Supabase Cache]
    H --> I[Render Dashboard & Mermaid Diagram]
👨‍💻 Built by
Sidhant Kumar - LinkedIn | GitHub


