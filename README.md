# 🔬 CodeAutopsy

**Understand any GitHub codebase in minutes.**

CodeAutopsy is an AI-powered repository analysis tool that performs real static analysis before sending structured context to an LLM. It's not an API wrapper — it builds import graphs, detects entry points, ranks files by importance, and feeds structured data to Gemini for architectural analysis.

🌐 **Live Demo:** https://codeautopsy-lyart.vercel.app

---

## What it does

Paste any GitHub repo URL and get:

- **Architecture Overview** — pattern detection (MVC, Monolith, Library, etc.)
- **Execution Flow** — how the app runs from start to finish
- **Dependency Graph** — visual Mermaid diagram built from real import parsing
- **Tech Stack Detection** — languages, frameworks, and their roles
- **Key Modules Breakdown** — what each file does and why it exists
- **Developer Onboarding Guide** — what a new contributor needs to know
- **Ask the Repo Chat** — ask questions about the codebase in natural language
- **Shareable Reports** — every analysis gets a public URL at `/view/{owner}/{repo}`

---

## Why it's not just an API wrapper

Most "AI code analysis" tools dump a repo into an LLM and display the response. CodeAutopsy has a real engineering layer that runs before any AI call:

### Layer 1 — Repository Parser

- Fetches the full file tree in a single GitHub API call (Git Trees API)
- Filters noise: `node_modules`, `dist`, `build`, lock files, binaries
- Detects entry points via filename patterns + `package.json` manifest parsing
- Classifies files by role: entry, config, core, test, other

### Layer 2 — Static Analysis Engine

- Parses `import`/`require` statements across all files using regex
- Builds a dependency graph (adjacency list) with resolved local paths
- Computes fan-in scores (how many files import each file)
- Ranks files by importance using: entry point status + fan-in + depth + role
- Generates Mermaid diagram strings from the dependency graph

### Layer 3 — Structured AI Analysis

- Sends only the top 15 ranked files to Gemini (not the whole repo)
- Forces strict JSON output with a typed schema
- Validates that all referenced filenames actually exist in the repo
- Returns: architecture pattern, execution flow, tech stack, modules, onboarding guide

### Layer 4 — Caching & Infrastructure

- Caches analyses in Supabase keyed by `repo_url + branch + analysis_version`
- Repeat analyses return instantly (zero API calls)
- IP-based rate limiting via Upstash Redis (3 analyses per 24h on free tier)
- Private repo support via GitHub OAuth provider_token injection

---

## Tech Stack

| Layer           | Technology                                |
| --------------- | ----------------------------------------- |
| Frontend        | Next.js 16 + Tailwind CSS + Framer Motion |
| AI Analysis     | Google Gemini 2.5 Flash                   |
| Chat            | Groq (Llama 3.1 8B)                       |
| Repo Data       | GitHub REST API                           |
| Database + Auth | Supabase                                  |
| Rate Limiting   | Upstash Redis                             |
| Diagrams        | Mermaid.js                                |
| Deployment      | Vercel                                    |

---

## Features

- 🔐 **Authentication** — GitHub OAuth, Google OAuth, email/password
- 📁 **Private Repos** — analyze private repositories when logged in with GitHub
- 📊 **History Page** — view all previously analyzed repositories
- 🔗 **Shareable Links** — every analysis accessible at `/view/{owner}/{repo}`
- 💬 **Chat Interface** — ask natural language questions about any analyzed repo
- ⚡ **Smart Caching** — instant results for previously analyzed repos
- 🛡️ **Rate Limiting** — prevents API abuse with per-IP daily limits

---

## Running Locally

```bash
git clone https://github.com/Sidhant0707/codeautopsy
cd codeautopsy
npm install
```

Create a `.env.local` file:

```env
GITHUB_TOKEN=your_github_token
GEMINI_API_KEY=your_gemini_api_key
GROQ_API_KEY=your_groq_api_key
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

## Architecture Diagram

```
User pastes GitHub URL
        ↓
GitHub API → fetch file tree (single call)
        ↓
Filter noise files (your code)
        ↓
Detect entry points (your code)
        ↓
Build dependency graph (your code)
        ↓
Rank files by importance (your code)
        ↓
Fetch top 15 file contents
        ↓
Send structured context to Gemini
        ↓
Gemini returns typed JSON
        ↓
Store in Supabase cache
        ↓
Render analysis + dependency graph + chat
```

---

## Built by

[Sidhant Kumar](https://github.com/Sidhant0707)
