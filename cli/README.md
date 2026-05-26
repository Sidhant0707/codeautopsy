# 🧬 CodeAutopsy CLI

> **Headless, AST-based GitHub repository analyzer for the terminal.**

CodeAutopsy CLI is a lightning-fast tool that parses public GitHub repositories, maps their internal architecture using Abstract Syntax Trees (AST), and generates instant health scores and dependency graphs — no cloning required.

Powered by a globally distributed Vercel Edge API and secured via Upstash Redis rate limiting.

---

## 🚀 Installation

```bash
npm install -g codeautopsy-cli
```

---

## 💻 Usage

```bash
codeautopsy analyze <github-url>
```

**Example:**

```bash
codeautopsy analyze https://github.com/facebook/react
```

**Example Output:**

```
╔══════════════════════════════╗
║    CodeAutopsy  AST Analyzer ║
╚══════════════════════════════╝

✔  Analysis complete.

Repository
─────────────────────────────────────────
Owner    facebook/react
Branch   main
Stars    ★ 245,277
Nodes    10 files · 1 edges
Cached   yes

Health Score
─────────────────────────────────────────
  A    98/100  Pristine Architecture
```

---

## ✨ Features

| Feature                   | Description                                                                   |
| ------------------------- | ----------------------------------------------------------------------------- |
| **Zero-Setup Analysis**   | No cloning needed — CodeAutopsy pulls and parses code directly from GitHub.   |
| **AST Parsing Engine**    | Deep dependency resolution and blast-radius calculations.                     |
| **Edge-Optimized**        | Backend processing offloaded to a headless Vercel Edge API for maximum speed. |
| **Beautiful Terminal UI** | Built with Commander and Chalk for a seamless developer experience.           |

---

## 👤 Author

Developed by **Sidhant Kumar**
