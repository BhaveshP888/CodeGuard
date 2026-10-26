# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Software engineers, engineering leads, and application security reviewers auditing pull requests in fast-moving engineering teams against internal architecture rules and security standards.

## Product Purpose

CodeGuard AI is an autonomous codebase security and architectural auditor that catches violations, hardcoded secrets, and compliance drift before code merges. It cross-references diffs against team style guides stored in `pgvector` and streams line-by-line remediations that can be committed to the PR branch in one click.

## Positioning

Unlike generic AI code assistants that hallucinate arbitrary rules or charge enterprise seat licenses, CodeGuard AI anchors every comment to your team's actual uploaded RFCs and security documents in `pgvector`. It features zero-latency SAST detection, runs on a permanent $0/month free-tier architecture, and enables one-click GitHub PR commits directly from the diff console.

## Operating Context

GitHub Pull Request code review workflows, GitHub Checks API, architectural compliance reviews, and pre-merge security gates.

## Capabilities and Constraints

- Next.js 15 App Router on Vercel Hobby ($0/mo)
- GitHub OAuth 2.0 with AES-256-GCM token encryption
- PostgreSQL + pgvector (768 dimensions, HNSW index) on Supabase / Neon Free Tier
- Language-aware AST splitting via LangChain
- Google Gemini 3.8 Flash & gemini-embedding-001 via official `@google/genai`
- Zustand v5 split-screen & unified diff viewer state
- TanStack Query v5 optimistic comment resolution
- Direct branch commit dispatch via GitHub Git Data API

## Brand Commitments

- Name: CodeGuard AI
- Visual Identity: Dense technical command center, deep carbon substrate (`#090d16`), surgical contrast, monospace reserved strictly for code/tokens/line numbers, razor-sharp status indicators, and immediate functional feedback.

## Product Principles

1. **Proof Over Slogans:** The interface proves capability by demonstrating live, line-by-line diff audits directly on screen.
2. **Authoritative Citations:** Every security alert cites the explicit internal team rule or OWASP/CWE standard violated.
3. **Closing the Loop:** An alert is incomplete without remediation; provide exact diff replacement blocks with one-click branch application.
4. **Zero Fluff & High Density:** Respect the engineer's cognitive bandwidth with dense, scannable, and distraction-free tooling.
