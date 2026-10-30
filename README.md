<div align="center">

# 🛡️ CodeGuard AI

**Autonomous, open-source codebase security & architectural compliance auditor.**  
*Runs permanently on a $0/month free-tier cloud architecture.*

[![Next.js](https://img.shields.io/badge/Next.js-15.1-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.0-61dafb?style=flat-square&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178c6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-pgvector-336791?style=flat-square&logo=postgresql)](https://github.com/pgvector/pgvector)
[![Google Gemini](https://img.shields.io/badge/Gemini-3.8%20%26%203.5%20Flash-4285F4?style=flat-square&logo=google)](https://ai.google.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38bdf8?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald?style=flat-square)](LICENSE)

[**Live Demo**](https://codeguard-ai.vercel.app) • [**Architecture**](#-architecture--data-flow) • [**Key Features**](#-key-features) • [**Zero-Cost Stack**](#-permanent-0month-cloud-architecture) • [**Quick Start**](#-quick-start) • [**Configuration**](#-configuration--environment-variables)

</div>

---

## 📌 Overview

**CodeGuard AI** is an autonomous pull request auditor and security gatekeeper. Unlike general-purpose AI coding tools that hallucinate rules or charge steep per-seat enterprise fees, CodeGuard AI anchors every finding to your team's real internal RFCs, coding conventions, and security mandates stored in a vector database (`pgvector`).

When a pull request is opened or updated, CodeGuard AI:
1. **Traps vulnerabilities instantly** via a 0ms in-memory SAST engine (detecting leaked API keys, tokens, and raw SQL queries before AI tokens are spent).
2. **Retrieves relevant architectural policies** using 768-dimensional cosine vector embeddings (`hnsw`).
3. **Audits changes with Google Gemini 3.8 Flash**, generating line-specific findings, an executive risk score (0–100), and interactive **Mermaid.js sequence diagrams**.
4. **Enables 1-click branch commits** directly from the diff console via the GitHub Git API with automated conflict resolution.
5. **Provides an interactive PR Copilot** powered by **Gemini 3.5 Flash** accessible through a web drawer (`⌘K`) or by mentioning `@codeguard` in GitHub comments.

---

## 🌟 Key Features

### ⚡ 1. Zero-Latency In-Memory SAST Trap (0 ms)
- Evaluates unified diffs instantly prior to external AI requests.
- Regex heuristics immediately trap hardcoded secrets: AWS Access Keys, GitHub PATs, Stripe Secret Keys, OpenAI API Keys, Slack Tokens, RSA/SSH private keys, and unsafe `eval()` or unparameterized SQL interpolations.
- Zero AI tokens wasted on obvious, pattern-based violations.

### 🧠 2. Semantic Architectural Policy Engine (`pgvector`)
- Ingests Markdown, RFCs, and team standards into PostgreSQL via LangChain AST splitters and Google Gemini embeddings (`gemini-embedding-001`, 768 dimensions).
- Uses `hnsw` cosine distance indexing (`<=>`) to fetch only the rules relevant to touched files.
- Includes pre-loaded industry standards:
  - **RFC-104**: Zero-Secret Ingestion & IAM Mandate
  - **SEC-202**: Mandatory Parameterized SQL Queries
  - **ARCH-305**: Server Action & Auth Isolation Standard

### 🤖 3. Dual-Model Gemini Routing Architecture
- **Gemini 3.8 Flash (`reviewModel`)**: Mainstay model for complex code reasoning, cross-referencing vector guidelines, calculating risk scores, generating structured remediation patches, and synthesizing Mermaid architecture flows.
- **Gemini 3.5 Flash (`chatModel`)**: High-throughput, low-latency model exclusively powering interactive PR Copilot chat (`⌘K`) and GitHub `@codeguard` comment replies, preventing queue bottlenecks.

### 📊 4. Automated Mermaid.js Architecture Diagrams
- Analyzes touched components, APIs, and databases across the PR to generate clean sequence diagrams (e.g. `Client ->> Handler ->> Service ->> DB`).
- Rendered live in the web dashboard with an interactive SVG viewer (zoom, pan, full-screen) and posted directly into GitHub PR review comments.

### 🔍 5. CodeRabbit-Inspired Diff & Audit Console
- **Split & Unified View**: Toggle between synchronized side-by-side view (Base vs Head) and a single-column stream.
- **Interactive File Tree**: Displays affected files, status badges, line diff counts (`+16 -0`), and categorized severity indicators.
- **Inline Finding Cards**: Expandable diagnostic cards placed directly below affected code lines, featuring rule citations, severity badges (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`), and copyable remediation blocks.
- **One-Click "Apply Fix to PR"**: Commits recommended fixes directly to the active pull request branch via GitHub's Git Data API, featuring automatic commit SHA re-fetching and blob conflict resolution.
- **Optimistic State Updates**: Mark findings as resolved with immediate UI feedback backed by Zustand and TanStack Query.

### 💬 6. Interactive PR Copilot (Ask CodeGuard)
- **Web UI Drawer (`⌘K`)**: Ask questions about vulnerabilities, request refactoring suggestions, or generate unit test suites against the active diff.
- **GitHub Mention Bot**: Comment `@codeguard` or `@codeguard-ai` on any GitHub pull request or review thread to receive immediate context-aware responses with copyable code snippets.

### 🔒 7. Enterprise-Grade Security & Privacy
- **AES-256-GCM Token Encryption**: User GitHub OAuth access tokens are encrypted at rest with unique initialization vectors and authentication tags.
- **HMAC Webhook Verification**: All GitHub webhook events are authenticated with timing-safe SHA-256 HMAC comparisons.

---

## 🏗️ Architecture & Data Flow

```mermaid
sequenceDiagram
    autonumber
    actor Dev as Developer
    participant GH as GitHub (PR / Webhook)
    participant API as CodeGuard Backend (Next.js 15)
    participant SAST as In-Memory SAST Trap (0ms)
    participant VEC as pgvector (Neon / Supabase)
    participant AI as Google Gemini (3.8 & 3.5 Flash)
    participant UI as Diff & Review Console

    Dev->>GH: Push commit / Open Pull Request
    GH->>API: POST /api/webhooks/github (HMAC Verified)
    API->>GH: Fetch Raw Unified Diff (Octokit)
    API->>SAST: Scan additions for secrets & injection patterns
    SAST-->>API: Instant SAST findings (0 tokens)
    API->>VEC: Cosine query (<=>) for matching team rules & RFCs
    VEC-->>API: Relevant architectural guidelines
    API->>AI: Gemini 3.8 Flash (Diff + Rules + SAST)
    AI-->>API: Findings + Risk Score + Mermaid Sequence Diagram
    API->>GH: Post Check Run & GitHub PR Batch Review with suggestions
    Dev->>UI: Open CodeGuard Audit Console
    UI->>Dev: Render Split Diff, Findings, & Mermaid Flow
    Dev->>UI: Click "Apply Fix to PR"
    UI->>API: POST /api/review/apply-fix
    API->>GH: Commit patch to branch via Git Trees API
```

---

## 💸 Permanent $0/Month Cloud Architecture

CodeGuard AI was deliberately designed to eliminate SaaS seat fees and surprise cloud infrastructure bills:

| Infrastructure Layer | Service Provider | Free Tier Allowance | CodeGuard AI Monthly Cost |
|---|---|---|---|
| **Web & API Compute** | [Vercel](https://vercel.com/) Hobby Tier | Unlimited serverless invocations, 100GB bandwidth | **$0.00 / mo** |
| **Vector Database** | [Neon](https://neon.tech/) or [Supabase](https://supabase.com/) | 0.5 GB PostgreSQL storage with `pgvector` support | **$0.00 / mo** |
| **LLM Reasoning & Embeddings** | [Google AI Studio](https://aistudio.google.com/) | Generous free rate limits for Gemini 3.8/3.5 Flash | **$0.00 / mo** |
| **Object / RFC Storage** | [Cloudflare R2](https://www.cloudflare.com/developer-platform/r2/) | 10 GB storage, $0 egress fees | **$0.00 / mo** |
| **Authentication** | [Auth.js (NextAuth v5)](https://authjs.dev/) | GitHub OAuth 2.0 with AES-256-GCM token encryption | **$0.00 / mo** |
| **Total Operating Cost** | | | **$0.00 / mo** |

---

## 🚀 Quick Start

### Prerequisites
- [Bun](https://bun.sh/) (v1.1+ recommended) or Node.js 20+
- PostgreSQL database instance with `pgvector` extension enabled (e.g. [Neon](https://neon.tech/) or [Supabase](https://supabase.com/))
- [Google Gemini API Key](https://aistudio.google.com/app/apikey)
- [GitHub OAuth App credentials](https://github.com/settings/developers)

### 1. Clone the Repository
```bash
git clone https://github.com/BhaveshP888/CodeGuard.git
cd CodeGuard
```

### 2. Install Dependencies
```bash
bun install
```

### 3. Configure Environment Variables
Copy the example environment configuration file and fill in your credentials:
```bash
cp .env.example .env.local
```

### 4. Push Database Schema
Ensure the `vector` extension is enabled in your database, then push the Drizzle ORM schema:
```bash
bun run db:push
```

### 5. Run the Development Server
```bash
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## ⚙️ Configuration & Environment Variables

| Variable | Description | Example / Required |
|---|---|---|
| `AUTH_SECRET` | NextAuth / Auth.js secret key | `bunx auth secret` (Required) |
| `AUTH_URL` | Application base URL | `http://localhost:3000` (Required) |
| `AUTH_GITHUB_ID` | GitHub OAuth App Client ID | Client ID from GitHub Developer settings |
| `AUTH_GITHUB_SECRET` | GitHub OAuth App Client Secret | Client Secret from GitHub Developer settings |
| `GITHUB_WEBHOOK_SECRET` | Secret to sign and verify GitHub webhook payloads | Random string matching GitHub webhook config |
| `DATABASE_URL` | PostgreSQL connection string with `pgvector` | `postgresql://user:pass@host/db?sslmode=require` |
| `GEMINI_API_KEY` | Google AI Studio API key | `AIzaSy...` (Required) |
| `GEMINI_REVIEW_MODEL` | Model for code audit and Mermaid synthesis | Default: `gemini-3.8-flash` |
| `GEMINI_CHAT_MODEL` | Model for interactive PR Copilot chat | Default: `gemini-3.5-flash` |
| `TOKEN_ENCRYPTION_KEY` | 32-byte hex secret for AES-256-GCM token encryption | `openssl rand -hex 32` (Required) |
| `R2_ACCOUNT_ID` | Cloudflare account ID (for RFC document storage) | Optional |
| `R2_ACCESS_KEY_ID` | Cloudflare R2 access key ID | Optional |
| `R2_SECRET_ACCESS_KEY` | Cloudflare R2 secret access key | Optional |
| `R2_BUCKET_NAME` | Cloudflare R2 bucket name | Optional |
| `R2_ENDPOINT` | Cloudflare S3 endpoint URL | Optional |

---

## 🔗 GitHub Webhook & App Setup

To enable automated reviews on pull requests and comment replies:

1. In your GitHub repository or organization, go to **Settings** > **Webhooks** > **Add webhook**.
2. **Payload URL**: `https://your-domain.com/api/webhooks/github` (or your ngrok / local tunnel URL for development).
3. **Content type**: `application/json`.
4. **Secret**: Enter your `GITHUB_WEBHOOK_SECRET`.
5. **Events to trigger**:
   - `Pull requests`
   - `Issue comments`
   - `Pull request review comments`
6. Click **Add webhook**.

---

## 🧪 Testing & Verification

Run the test suite using Vitest:
```bash
# Run unit & security scanner tests
bun run test

# Run Next.js production build verification
bun run build
```

---

## 📂 Project Structure

```text
CodeGuard/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/              # NextAuth v5 authentication handlers
│   │   │   ├── repos/             # Repository and PR synchronization endpoints
│   │   │   ├── review/
│   │   │   │   ├── apply-fix/     # 1-click GitHub commit dispatcher
│   │   │   │   ├── chat/          # PR Copilot streaming endpoint (Gemini 3.5 Flash)
│   │   │   │   ├── publish/       # GitHub PR review and status poster
│   │   │   │   └── stream/        # Real-time structured review stream (Gemini 3.8 Flash)
│   │   │   ├── rules/             # Rule ingestion & vectorization endpoints
│   │   │   └── webhooks/github/   # GitHub webhook listener & mention bot
│   │   ├── dashboard/             # Main application console & diff viewer
│   │   ├── layout.tsx             # Root layout & providers
│   │   └── page.tsx               # Product landing page & interactive demo
│   ├── components/
│   │   ├── diff-viewer/           # Split/unified diff viewer & inline cards
│   │   ├── rules/                 # Team rule studio & markdown editor
│   │   ├── mermaid-viewer.tsx     # Interactive Mermaid.js sequence viewer
│   │   └── pr-chat-drawer.tsx     # Ask CodeGuard PR Copilot drawer (⌘K)
│   ├── lib/
│   │   ├── ai/
│   │   │   └── gemini.ts          # Dual-model configuration & review schemas
│   │   ├── crypto/
│   │   │   └── tokens.ts          # AES-256-GCM token encryption utilities
│   │   ├── db/
│   │   │   └── schema.ts          # Drizzle ORM schema with vector(768) custom type
│   │   ├── github/                # Octokit client, diff parser, comment poster
│   │   ├── ingestion/             # LangChain AST chunker & Gemini embedder
│   │   ├── rag/                   # Context builder & pgvector cosine query
│   │   └── security/              # 0ms in-memory regex SAST engine
├── drizzle.config.ts              # Drizzle Kit configuration
├── package.json                   # Project metadata & scripts
└── tsconfig.json                  # Strict TypeScript configuration
```

---

## 🤝 Contributing

Contributions, bug reports, and suggestions are welcome!
1. Fork the repository.
2. Create your feature branch (`git checkout -b feature/amazing-feature`).
3. Commit your changes (`git commit -m 'feat: add amazing feature'`).
4. Push to the branch (`git push origin feature/amazing-feature`).
5. Open a Pull Request.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
