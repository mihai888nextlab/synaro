# Synaro — Descriere tehnică

## Informații generale

- **Categorie:** Web
- **Judetul:** Bihor
- **Homepage:** [https://synaro.tech](https://synaro.tech)

## Descriere

Synaro este o platformă web pentru developeri care acoperă ciclul de la idee la proiect rulabil: generare din limbaj natural, medii Docker izolate, workspace (editor, terminal, preview), chat AI pe codebase și agenți autonomi pentru automatizare. 🚀

Pe lângă UI, platforma expune API public, [SDK TypeScript](https://www.npmjs.com/package/@synaro/sdk) (`@synaro/sdk`) și MCP, astfel încât proiectele și agenții pot fi controlați și din unelte externe (CLI, scripturi, Cursor / LLM-uri).

## Feature-uri ale platformei

- ✨ **Proiecte din limbaj natural:** descrii ce vrei să construiești; Synaro generează structură, config și cod de start. Runtime-uri suportate: [Node.js](https://nodejs.org/), [Python](https://www.python.org/), [Go](https://go.dev/), [Nginx](https://nginx.org/), Ubuntu sau detectare automată.
- 📥 **Import proiect:** clone din [GitHub](https://github.com/) sau upload folder local, apoi lucrul continuă în același workspace.
- 🐳 **Medii [Docker](https://www.docker.com/) per proiect:** fiecare proiect are container propriu — provisionare, start/stop, preview live (proxy local în dezvoltare; subdomain prin [Traefik](https://traefik.io/) în producție).
- 🖥️ **Workspace:** file tree, editor ([Monaco](https://microsoft.github.io/monaco-editor/)), chat AI pe fișiere, terminal în container ([xterm.js](https://xtermjs.org/)), preview al aplicației și download arhivă.
- 🧠 **Task-uri AI pe proiect:** flux clarificare → ANALYZING → GENERATING → APPLYING. Modificările pe repo sunt validate și aplicate prin `ai-orchestration-service` ([Kimi](https://platform.moonshot.ai/) / Moonshot).
- 👥 **Colaborare:** invitații pe proiect cu token și dată de expirare.
- 🤖 **Agenți:** agenții nu depind de un container de proiect. Se creează și gestionează din `/agents` (nume, system prompt, tool-uri, model, cron, MCP, memorie, enable/disable). Pot rula la cerere sau pe schedule și lasă istoric de run-uri cu pașii ReAct vizibili în UI.
    - 🔍 **Tool-uri built-in:**
        - `web_search` — căutare web ([Brave Search](https://brave.com/search/api/))
        - `http_get` / `http_post` — cereri HTTP pe URL-uri publice (cu protecție SSRF)
        - `list_files` / `read_file` / `write_file` / `delete_file` — workspace de fișiere al agentului
        - `remember` / `recall` — memorie key/value pe agent
        - `list_projects` / `get_project` / `start_project` / `stop_project` — control proiecte Synaro
        - `run_agent` — delegare către un alt agent
        - tool-uri din servere **MCP** configurate pe agent
        - `finish` — marchează răspunsul final
    - 🔄 **Ciclu run (ReAct):** trigger din UI / API / SDK / CLI / cron → PENDING → RUNNING (gândire → tool call → observation → pas următor) → DONE / FAILED / CANCELLED. Dacă un server MCP cere autentificare, run-ul trece în **NEEDS_INPUT**, utilizatorul trimite credențialele și execuția continuă.
    - 📊 **Vizibilitate:** timeline pe `/agents/{id}/runs/{runId}`, widget **last run** pe dashboard, indicatori în header pentru run-uri active; email opțional la finalizare.
- 🎛️ **Dashboard personalizabil:** layout pe grid ([react-grid-layout](https://github.com/react-grid-layout/react-grid-layout)), drag-and-drop, widget-uri (KPI, showcase proiecte/agenți, activity, shortcuts, last run, API keys), salvat per utilizator.
- 🔒 **Autentificare și cont:** email/parolă, OAuth Google/GitHub ([NextAuth](https://next-auth.js.org/)), verificare email, reset parolă ([Resend](https://resend.com/)), settings (profil, securitate, sesiuni) și generare chei API.
- 🔎 **Căutare globală** pe proiecte, agenți și activitate din shell-ul aplicației.
- 💬 **Voce:** input STT și output TTS ([ElevenLabs](https://elevenlabs.io/), cu fallback browser).
- 🌐 **API public:** autentificare cu chei `sk_live_…`, documentat OpenAPI; operații pe proiecte, task-uri AI, agenți, run-uri, memory; ~120 req/min/cheie.

## Internationalizare și accesibilitate

- 🌓 Mod Light / Dark / System
- 🌍 Interfață internaționalizată. Limbi disponibile: Română și Engleză
- ♿ Design accesibil; teste a11y cu [Playwright](https://playwright.dev/) și [axe-core](https://github.com/dequelabs/axe-core)

## Ecosistem de dezvoltare

Pentru a facilita integrarea cu platforma:

- 📦 [**@synaro/sdk**](https://www.npmjs.com/package/@synaro/sdk): SDK TypeScript pentru Node.js (≥ 18) — client tipizat pentru `/api/v1` (proiecte, task-uri, agenți, run-uri, memory) și CLI `synaro` (`npx synaro me`, deploy, `agents run`, etc.)
- 🤖 **MCP Server Synaro:** tool-uri pentru LLM-uri / Cursor — create proiect, deploy, logs, agenți, status
- 🔌 **Agenți ca clienți MCP:** pe lângă MCP-ul platformei, fiecare agent poate avea `mcpServers` proprii; `agent-runner` încarcă tool-urile la runtime (inclusiv fluxul NEEDS_INPUT pentru auth)
- 📚 **Documentație:** [synaro.tech/documentation](https://synaro.tech/documentation) (EN + RO) — overview, agenți, API public, SDK

## Tehnologii

### Frontend

- ⚡ [**Next.js**](https://nextjs.org/): framework principal (Pages Router, React 19)
- 🎨 [**Shadcn UI**](https://ui.shadcn.com/) / [Radix UI](https://www.radix-ui.com/): componente UI
- 💨 [**Tailwind CSS**](https://tailwindcss.com/): stilizare utilitară
- ✨ [**Framer Motion**](https://www.framer.com/motion/): animații
- 📊 [**Recharts**](https://recharts.org/), [**react-grid-layout**](https://github.com/react-grid-layout/react-grid-layout): grafice și dashboard
- 📝 [**Monaco Editor**](https://microsoft.github.io/monaco-editor/), [**xterm.js**](https://xtermjs.org/): editor și terminal în browser

### Backend

- 🔌 [**Fastify**](https://fastify.dev/) + [**Zod**](https://zod.dev/): microservicii tipizate
    - `project-service` — lifecycle / metadata proiecte
    - `environment-service` — Docker, fișiere, terminal WebSocket, git
    - `ai-orchestration-service` — task-uri AI pe codebase
    - `execution-manager` — start/stop proces app, loguri
    - `agent-service` — CRUD agenți, trigger, memory, webhooks
    - `agent-runner` — buclă ReAct, catalog tool-uri, MCP runtime, scheduler cron
    - `mcp-server` — bridge MCP → API Synaro
- 🗄️ [**Prisma**](https://www.prisma.io/): ORM
- 🐘 [**PostgreSQL**](https://www.postgresql.org/): bază de date (utilizatori, proiecte, agenți, run-uri)
- 🐳 [**Docker**](https://www.docker.com/): runtime izolat per proiect
- 🔐 [**NextAuth.js**](https://next-auth.js.org/): autentificare (sesiuni, OAuth, adapter Prisma)

### Servicii third-party

- 🌙 [**Moonshot / Kimi**](https://platform.moonshot.ai/): LLM pentru proiecte și agenți
- 🔍 [**Brave Search**](https://brave.com/search/api/): căutare web pentru agenți (`web_search`)
- ✉️ [**Resend**](https://resend.com/): email (verificare, reset parolă)
- 🗣️ [**ElevenLabs**](https://elevenlabs.io/): STT / TTS (opțional)
- 🛡️ [**Traefik**](https://traefik.io/): reverse proxy și TLS în producție (`*.synaro.tech`)

## Develop, Test, Deploy! 🚀

Unit tests cu [Jest](https://jestjs.io/) 🧪 (app) și [Vitest](https://vitest.dev/) (SDK); End-to-End cu [Playwright](https://playwright.dev/) 🎭; a11y cu axe-core.

CI prin [GitHub Actions](https://github.com/features/actions) 🔄 (lint, Jest, SDK build/test, Playwright, a11y), cu [Docker](https://www.docker.com/) 🐋 pentru Postgres și microservicii.

Deploy pe VPS cu Docker Compose + Traefik, după trecerea testelor. ✅

## Cerințe sistem

**Pentru utilizarea platformei:**

- Browser modern (Google Chrome, Mozilla Firefox, Safari, etc.)
- Conexiune la internet

**Pentru dezvoltare:**

- macOS, Linux sau Windows, cu cel puțin 8GB RAM (recomandat 16GB)
- [Node.js](https://nodejs.org/) 20.x sau mai nou
- [Docker](https://www.docker.com/)
- Orice editor de text ([VS Code](https://code.visualstudio.com/), [Cursor](https://cursor.com/), IntelliJ IDEA, etc.)
