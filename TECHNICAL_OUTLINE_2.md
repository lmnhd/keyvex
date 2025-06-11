
# Keyvex – Technical Outline & Implementation Strategy  
_Last updated 2025-06-11_

---

## 1. Executive Summary
Keyvex empowers consultants, coaches, and B2B service providers to create interactive lead-magnet tools (calculators, quizzes, assessments) through AI co-creation.  
Version 2 introduces a **multi-agent orchestration architecture** that:

* Converts natural-language requirements into polished React tools in real time.  
* Streams progress to the UI through enhanced WebSockets.  
* Guarantees professional design consistency with ShadCN components and Tailwind styling.  
* Scales beyond Vercel edge-function limits by off-loading heavy AI chains to AWS Lambda.

---

## 2. High-Level Goals
|
 Theme 
|
 Goal 
|
 Metric 
|
|
-------
|
------
|
--------
|
|
 Speed 
|
 < 4 s perceived latency before first streamed token 
|
 TTI P90 
|
|
 Quality 
|
 ≥ 95 % of generated tools pass V2 validation suite on first run 
|
 QA dashboard 
|
|
 UX 
|
 100 % ShadCN compliance & responsive grid layouts 
|
 Visual diff tests 
|
|
 Reliability 
|
 Zero data loss during multi-agent races 
|
 Post-mortem count 
|
|
 Extensibility 
|
 New agent added with < 2 h engineering time 
|
 Eng. time logs 
|

---

## 3. Architecture Overview

### 3.1 Hybrid Vercel + AWS
Frontend (Vercel → Edge) ──▶ API Route /api/ai/create-tool ║ (lightweight orchestrator, 10 s max) ▼ AWS Lambda complex-ai-processor ──▶ OpenAI/Claude ▲ ║ └────────────────── DynamoDB / S3 ◀─┘

* **Vercel Edge Functions** – Fast orchestration and WebSocket hand-off.  
* **AWS Lambda** – Long-running AI chains, bulk generation, analytics.  
* **DynamoDB** – Persistent `ToolConstructionContext` (TCC) + version history.  
* **IndexedDB** – Primary on-device cache for Workbench.  
* **Vercel KV** – Short-lived locks & mutexes.

### 3.2 Frontend Workbench
* Next.js 15 App Router, React 19, TypeScript, Tailwind CSS.  
* Component hierarchy rooted in `/components/tool-creator-ui/` (ShadCN).  
* Loads/merges tools from IndexedDB, DynamoDB, or local uploads.  
* Real-time updates via enhanced WebSocket channel (`/api/ws`).

---

## 4. V2 Multi-Agent Tool-Creation Pipeline

| # | Agent | Purpose | Key Output |
|---|-------|---------|-------------|
| 1 | Requirements-Parser | Distil user prompt into structured spec | `UserRequirements` |
| 2 | Decomposition | Break spec into atomic build steps | `TaskGraph` |
| 3 | Data-Mapping | Map inputs ↔ outputs, bind data sources | `DataModel` |
| 4 | Tailwind-Styling | Apply coherent Tailwind & ShadCN grid | Styled JSX |
| 5 | Layout-Polish | Enforce Card wrapper + tooltips | Polished JSX |
| 6 | QA-Validator | Run static & runtime tests | `ValidationReport` |
| 7 | Auto-Fixer | Attempt to resolve non-blocking issues | Patched code |
| 8 | Unit-Test-Writer | Generate Jest + RTL tests | `/__tests__/tool.spec.tsx` |
| 9 | Packager | Version, compress, and persist | S3 artifact |

All agents share / modify the **Tool Construction Context (TCC)**:
```ts
interface ToolConstructionContext {
  jobId: string;
  userId?: string;
  selectedModel: 'gpt-4o' | 'claude-3.5-sonnet';
  requirements: UserRequirements;
  taskGraph: TaskGraph;
  dataModel: DataModel;
  sourceCode: string;
  validation: ValidationReport;
  version: string;         // semver
  locks: { [section: string]: string }; // mutexes
}
Synchronization – locks persisted in Vercel KV to prevent step collisions.
Deep-Merge Utility – Idempotent, cleans up stale locks automatically.
## 5. Prompt Architecture
Aspect	State
Storage	Separated – one XML file per agent in /lib/prompts/<agent>.xml
Validation	XML Schema Definition (XSD) ensures tag integrity
Dynamic Builders	/lib/prompt-builders/*.ts inject runtime context
Security	PII scrub + policy tags before model call
Example excerpt (Tailwind-Styling):

xml
<tool>
  <layout grid="12" card="true" tooltip="required">
    <section colSpan="4"> ... </section>
</tool>
6. Quality-Assurance & Auto-Fix
Static Checks
ESLint + Type-checking (strict).
Proprietary regex rules for ShadCN compliance.
Runtime Smoke Test
Headless browser renders tool; intercepts console & network.
Real-Time Validation Categories
blocking – build halts; must auto-fix or ask user.
nonBlocking – info/warn; surfaced in collapsible UI.
Auto-Fix Strategy
Pattern-specific transformers (arrow-to-function, missing keys).
Limits: ≤ 3 consecutive fixes to avoid loops.
7. UI & Component Guidelines
Mandatory Main Card Wrapper – Centers tool visually.
Grid System – Tailwind grid-cols-12; breakpoints sm/md/lg/xl.
ShadCN Components – Inputs, Dropdowns, Tooltips, Tabs.
Info Tooltip – ? icon on every header describing purpose & data flow.
Accessibility – All interactive elements pass Lighthouse a11y ≥ 95.
8. Real-Time Streaming & Analytics
Enhanced WebSocket API:
Heartbeat ping every 15 s.
Graceful reconnection with resume tokens.
Analytics captured per job:
Response latency, edit patterns, validation iterations.
Behavior model shifts → feeds personalization engine.
9. Storage, Versioning & Deployment
Layer	Purpose
IndexedDB	Primary offline store for TCC + code
DynamoDB	Long-term persistence + collaboration
S3	Packaged artifacts & rollback bundles
GitHub Actions → Vercel	Continuous deployment (Edge + static)
CDK Stack	Infra-as-code for Lambda, API GW, DynamoDB, S3
10. Security & Compliance
Auth – Clerk (Vercel middleware) + JWT pass-through to Lambda.
Data Isolation – Row-level security by userId in DynamoDB.
Secrets – Vercel project env vars synced to AWS via SM.
PII Handling – Prompt scrub + encryption-at-rest (DynamoDB, S3 AES-256).
Audit Logs – All agent state diffs emitted to tool-audit DynamoDB table.
11. Current Status & Roadmap
Completed (V2 Phase 1)
Multi-agent skeleton + Requirements, Decomposition, Data-Mapping agents.
Workbench UI with load/save, real-time stream.
Basic WebSocket connection management.
Phase 2 (in progress)
Tailwind-Styling, Layout-Polish, QA-Validator, Auto-Fixer.
Production observability (OpenTelemetry).
External data-source connectors (file | API | DB).
Phase 3 (planned)
Advanced analytics / adaptive UX.
Marketplace for community-shared tool templates.
Self-host option via CDK blueprint.
12. Appendix
Glossary – TCC, Agent, TaskGraph, etc.
Mermaid Diagrams – /docs/diagrams/*.mmd.
Contact – architecture@keyvex.ai

---

### How this replaces the old outline

1. **Removed** obsolete references to one-off fixes (e.g., “Saved Brainstorm Dropdown”) and the monolithic test file.  
2. **Merged** all V2 agent details from [PRODUCT_TOOL_CREATION_LOGIC.md](cci:7://file:///c:/Users/Administrator/Dropbox/Source/Projects-25/Keyvex_Project/keyvex_app/src/app/tests/ui/PRODUCT_TOOL_CREATION_LOGIC.md:0:0-0:0), ensuring each agent is explicitly listed.  
3. **Added** concrete storage, security, and performance notes matching the current codebase (IndexedDB, DynamoDB, mutex locks).  
4. **Kept** original themes (Prompt separation, ShadCN mandate) but updated wording to reflect that they are now _fully implemented_.  
5. **Inserted** roadmap table to signal status and next steps.

Feel free to edit wording or re-order sections, but this draft is ready to drop into [TECHNICAL_OUTLINE.md](cci:7://file:///c:/Users/Administrator/Dropbox/Source/Projects-25/Keyvex_Project/keyvex_app/TECHNICAL_OUTLINE.md:0:0-0:0) as a comprehensive, up-to-date source of truth.
Feedback submitted