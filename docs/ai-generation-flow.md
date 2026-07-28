# How Synaro generates projects (presentation diagrams)

Mermaid source for slides. Paste any block into mermaid.live, GitHub, Notion, or a slide tool that
supports Mermaid.

---

## Full project workflow (one diagram)

The whole lifecycle: describe → generate → run → iterate → deploy.

```mermaid
flowchart TD
  A(["1 · User describes the app in plain language<br/>(optionally from a GitHub repo)"]) --> B["Create project —<br/>spin up an isolated container + volume"]
  B --> C(["2 · User prompts the AI in the chat"])
  C --> D["AI Orchestration Service —<br/>grounds in the project's stack + past work"]

  subgraph LOOP ["3 · Agent loop — Kimi K2.6 with tools, inside the container"]
    direction LR
    R["read files"] --> W["edit / write"] --> X["run commands"] --> V["verify build"] --> Q{"errors?"}
    Q -- "yes → fix" --> R
  end

  D --> R
  Q -- "no → done" --> F["Changes applied —<br/>streamed live to the chat"]
  F --> G(["4 · Run"])
  G --> H["Live preview —<br/>slug.synaro.tech on port 3000"]
  H --> I{"keep going?"}
  I -- "iterate → new prompt" --> C
  I -- "ship it" --> J(["5 · Deploy"])
  J --> K["Production deployment —<br/>build + always-up + stable URL"]
  F -. "optional" .-> P["Commit &amp; push to GitHub"]
```

**Say this:** "A user describes an app; we spin up an isolated container for it. Every prompt goes to
the orchestration service, which grounds itself in the project and runs an AI agent that reads, edits,
runs, and verifies the code — looping until it works. The result streams back live. The user runs it
for an instant preview, keeps iterating, and when it's ready, deploys it to an always-up production URL."

---

## Full workflow — color-coded by service (with tools + sub-agent)

Colors = which service each part belongs to:
🟦 Browser · 🟩 Next.js App · 🟪 AI Orchestration Service · 🟨 Environment Service · 🟥 Moonshot API (external)

```mermaid
flowchart TB
  classDef browser fill:#e0e7ff,stroke:#6366f1,color:#1e1b4b
  classDef app fill:#d1fae5,stroke:#10b981,color:#064e3b
  classDef orch fill:#f3e8ff,stroke:#a855f7,color:#3b0764
  classDef env fill:#fef3c7,stroke:#f59e0b,color:#78350f
  classDef ext fill:#ffe4e6,stroke:#f43f5e,color:#881337

  subgraph BROWSER ["Browser"]
    UI["Chat UI<br/>prompt in · live stream out"]
  end

  subgraph APP ["Next.js App (gateway)"]
    API["/api/projects/:id/ai-task"]
  end

  subgraph ORCH ["AI Orchestration Service"]
    EX["executeTask<br/>create Task · run async"]
    GR["Ground:<br/>detect stack + past work"]
    LOOP["Agent loop"]
    TOOLS["Agent tools:<br/>list_files · read_file · edit_file<br/>write_file · run_command · finish"]
    DEL["delegate"]
    SUB["Explore sub-agent<br/>read-only: list_files · read_file · finish"]
    DB[("Task DB")]
  end

  subgraph ENV ["Environment Service"]
    CONT[("Project container<br/>base image + volume")]
    RUN["Run → live preview"]
    DEP["Deploy → production"]
  end

  subgraph EXT ["Moonshot API (external)"]
    KIMI["Kimi K2.6<br/>tool-calling LLM"]
  end

  UI -- "prompt" --> API --> EX --> GR --> LOOP
  LOOP <-- "tool calls / results" --> KIMI
  LOOP --> TOOLS
  LOOP --> DEL
  TOOLS -- "operate on" --> CONT
  DEL -- "spawns" --> SUB
  SUB -- "read-only" --> CONT
  SUB -- "report" --> LOOP
  LOOP -- "stream tokens + progress" --> UI
  LOOP -- "finish" --> EX
  EX <--> DB
  UI -- "Run" --> RUN --> CONT
  UI -- "Deploy" --> DEP --> CONT
  CONT -- "preview :3000" --> UI
  DEP -- "stable URL" --> UI

  class UI browser
  class API app
  class EX,GR,LOOP,TOOLS,DEL,SUB,DB orch
  class CONT,RUN,DEP env
  class KIMI ext
```

---

## Layer 1 — High-level (for the jury)

```mermaid
flowchart TB
  U(["User describes the app in plain language"]) --> AG["AI Agent<br/>runs in the project's isolated container"]
  AG --> RD
  subgraph LOOP ["The agent works in a loop — like a developer"]
    direction LR
    RD["Read the code"] --> ED["Edit / write files"] --> RUN["Run &amp; build"] --> FIX{"Errors?"}
    FIX -- "yes → fix" --> RD
  end
  FIX -- "no → done" --> DONE(["App built, verified &amp; running"]) --> PREV["Live preview on its own URL"]
```

**Say this:** "You describe the app in plain language. An AI agent then works inside an isolated
container the way a developer does — reads the code, edits it, runs the build, and fixes its own
errors — looping until the app actually works and is running live. And you watch the whole thing happen."

---

## Layer 2 — Detailed technical

### 2a. Architecture + data flow

```mermaid
flowchart TB
  subgraph B ["Browser"]
    UI["Chat UI<br/>live token + activity stream"]
  end
  subgraph APP ["Next.js App (gateway)"]
    RT["/api/projects/:id/ai-task"]
  end
  subgraph AIS ["AI Orchestration Service"]
    EX["executeTask<br/>creates Task, runs async (UI polls)"]
    GR["Ground: detect stack<br/>package.json / AGENTS.md<br/>or scaffold from scratch"]
    AL["Agent loop"]
    K[["Kimi K2.6<br/>Moonshot API (tool-calling)"]]
  end
  subgraph ENVS ["Environment Service"]
    C[("Per-project container<br/>node:20-alpine (+ Python on demand)<br/>+ persistent volume")]
  end

  UI -- "prompt" --> RT --> EX --> GR --> AL
  AL <-- "tool calls / results" --> K
  AL -- "list · read · edit · write · run_command" --> C
  AL -- "self-verify: tsc / npm run build" --> C
  AL -- "stream tokens + activity" --> UI
  AL -- "finish(summary)" --> EX
  EX -- "Run" --> C
  C -- "Traefik → {slug}.synaro.tech :3000" --> UI
```

### 2b. The agent loop (sequence)

```mermaid
sequenceDiagram
  actor U as User
  participant A as Agent (Orchestration)
  participant M as Kimi K2.6
  participant C as Container
  U->>A: prompt
  A->>M: task + tools + file list
  loop until finish() or budget
    M-->>A: tool call (read / edit / run)
    A->>C: execute in container
    C-->>A: result
    A-->>U: stream progress
    A->>M: tool result
  end
  M-->>A: finish(summary)
  A->>C: start app on :3000
  C-->>U: live preview (subdomain)
```

**Say this:** "The model runs as an agent with tools backed by the real container. Each step it calls a
tool, we execute it, and feed the result back — reading before editing, and verifying the build before
finishing. It's an observe → act → observe → adapt loop with real feedback, which is far more reliable
than generating the whole app in one shot."

### 2c. Sub-agents (the `delegate` tool — optional, flag-gated)

```mermaid
flowchart LR
  MAIN["Main agent<br/>builds the app, owns integration"]
  MAIN -- "delegate: 'investigate X'" --> SUB["Sub-agent<br/>fresh context · READ-ONLY"]
  SUB -- "list_files · read_file" --> C[("Project container")]
  C -- "file contents" --> SUB
  SUB -- "concise report" --> MAIN
```

**Say this:** "For a large or unfamiliar codebase, the main agent can hand a bounded, read-only
investigation to a sub-agent — 'find how routing works' — which explores in its own separate context
and returns just a concise report. The main agent stays focused and keeps one coherent view, so we get
the scalability of multiple agents on the parts where it's safe, without the inconsistency that breaks
naïve multi-agent code generation." *(Flag-gated, off by default.)*

---

## Legend (slide-side notes)

**Tools the agent uses** — all backed by the container:
`list_files` · `read_file` · `edit_file` · `write_file` · `run_command` · `finish`
(+ optional `delegate` → a read-only exploration sub-agent, flag-gated)

**What makes it reliable:**
- Isolated container + volume per project
- Streams live (you see every step)
- Self-verifies (runs the build, fixes its own errors)
- Resilient: stall watchdog, per-step timeout keeps partial work, context pruning, tolerant edit-matching, cancellable
- Safe by design: the agent path is flag-gated with a Docker fallback

**Model:** Kimi K2.6 — an agentic, tool-calling LLM — via the Moonshot API.
