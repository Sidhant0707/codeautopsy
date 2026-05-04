<div align="center">
  <img src="./public/codeautopsy-logo1.png" alt="CodeAutopsy Logo" width="80" height="80" />
  <h1>CodeAutopsy</h1>
  <p><b>An AI-powered diagnostic engine that reverse-engineers, maps, and analyzes complex codebases in seconds.</b></p>
  
  <img src="https://img.shields.io/badge/Deployed-Vercel-black?style=for-the-badge&logo=vercel" alt="Deployed on Vercel" />
  <img src="https://img.shields.io/badge/AI-Groq_Llama_3.3-blue?style=for-the-badge&logo=meta" alt="Powered by Groq" />
  <a href="https://codeautopsy-lyart.vercel.app/analyze?repo=Sidhant0707/codeautopsy">
  <img src="https://codeautopsy-lyart.vercel.app/api/badge?repo=Sidhant0707/codeautopsy&v=1" alt="CodeAutopsy Health" />
</a>
</div>

---

## 🔬 Overview

Reading someone else's code is hard. Figuring out how thousands of files connect is even harder.

**CodeAutopsy** is a deep-analysis pipeline that transforms complex GitHub repositories into interactive architectural maps. It is not a simple AI wrapper—it performs real static analysis, constructs custom graphing algorithms, and feeds highly structured context to AI to help developers understand new codebases in minutes rather than days.

🌐 **Live Demo:** [codeautopsy.app](https://codeautopsy-lyart.vercel.app)

---

## 🛠️ What it does

Paste any GitHub repo URL and get:

- **Architecture Overview** — Pattern detection (MVC, Monolith, Library, etc.)
- **Execution Flow** — Detailed trace of how the app runs from start to finish
- **Dependency Graph** — Visual Mermaid.js diagram built from real import parsing
- **Tech Stack Detection** — Deep dive into languages, frameworks, and their specific roles
- **Key Modules Breakdown** — Functional analysis of what each file does and why it exists
- **Developer Onboarding Guide** — Instant documentation for new contributors
- **Blast Radius Analysis** — Shows what breaks if you modify critical files
- **Ask the Repo Chat** — Natural language Q&A powered by Groq/Llama 3.3
- **Shareable Reports** — Persistent analysis URLs at `/view/{owner}/{repo}`

---

## 🏗️ Deep Engineering (How it Works)

Most "AI code analysis" tools dump a repo into an LLM and pray. CodeAutopsy uses a sophisticated engineering pipeline that runs before any AI call is made:

### Layer 1 — Repository Parser

- Fetches the full file tree in a single call via the **GitHub Git Trees API**
- Intelligent noise filtering: `node_modules`, `dist`, lock files, and binaries
- Entry point detection via manifest parsing (`package.json`) and filename patterns

### Layer 2 — Static Analysis Engine

- **Regex Parsing:** Extracts `import`/`require` statements across the codebase
- **Graph Construction:** Builds a dependency adjacency list with local path resolution
- **Metric Computation:** Calculates **Fan-in scores** to identify core utility modules
- **Ranking Algorithm:** Sorts files by "Architectural Significance" (Fan-in + Depth + Role)

### Layer 3 — Structured AI Analysis

- **Context Optimization:** Only the top 15-30 ranked files are sent to Groq to prevent "lost in the middle" context issues
- **Strict Schema:** Forces AI into a typed JSON schema for consistent UI rendering
- **Cross-Validation:** Ensures AI-generated insights match the actual file tree

### Layer 4 — Infrastructure

- **Smart Caching:** Supabase (PostgreSQL) caching keyed by `repo_url + commit_sha + analysis_version`
- **Stateless Auth:** `@supabase/ssr` for secure session handling and Private Repo token injection
- **Traffic Control:** Upstash Redis rate-limiting (3 analyses per 24h for free users, 10 for authenticated)

---

## 💻 Tech Stack

| Layer               | Technology                                             |
| ------------------- | ------------------------------------------------------ |
| **Frontend**        | Next.js 16 (App Router) + Tailwind CSS + Framer Motion |
| **AI Analysis**     | Groq (Llama 3.3 70B Versatile)                         |
| **Repo Chat**       | Groq (Llama 3.1 8B)                                    |
| **Repo Data**       | GitHub REST API                                        |
| **Database + Auth** | Supabase                                               |
| **Rate Limiting**   | Upstash Redis                                          |
| **Diagrams**        | Mermaid.js                                             |
| **Deployment**      | Vercel                                                 |

---

## 🚀 Running Locally

**1. Clone & Install**

```bash
git clone https://github.com/Sidhant0707/codeautopsy
cd codeautopsy
npm install
```

**2. Configure Environment**

Create a `.env.local` file:

```env
GITHUB_TOKEN=your_github_token
GITHUB_FALLBACK_TOKEN=your_fallback_token
GROQ_API_KEY=your_groq_api_key
USE_GROQ_FOR_ANALYSIS=true
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_supabase_service_key
UPSTASH_REDIS_REST_URL=your_upstash_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_token
```

**3. Launch**

```bash
npm run dev
```

---

## 📐 Architecture Flow

User pastes GitHub URL
↓
GitHub API → fetch file tree (single call)
↓
Filter noise files
↓
Detect entry points
↓
Build dependency graph
↓
Rank files by importance
↓
Fetch top 30 file contents
↓
Send structured context to Groq
↓
Groq returns typed JSON
↓
Store in Supabase cache
↓
Render analysis + dependency graph + chat

---

## 🎯 Features

- 🔐 **Authentication** — GitHub OAuth, Google OAuth, email/password
- 📁 **Private Repos** — analyze private repositories when logged in with GitHub
- 📊 **History Page** — view all previously analyzed repositories
- 🔗 **Shareable Links** — every analysis accessible at `/view/{owner}/{repo}`
- 💬 **Chat Interface** — ask natural language questions about any analyzed repo
- ⚡ **Smart Caching** — instant results for previously analyzed repos
- 🛡️ **Rate Limiting** — prevents API abuse with per-IP daily limits
- 🎯 **Blast Radius** — shows what breaks if you modify high-dependency files

---

## 👨‍💻 Built by

[Sidhant Kumar](https://github.com/Sidhant0707) — [LinkedIn](https://linkedin.com/in/sidhant0707)
