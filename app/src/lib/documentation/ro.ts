import type { DocNavGroup, DocPage } from "./types";
export { DEFAULT_DOC_SLUG } from "./types";

export const DOC_NAV: DocNavGroup[] = [
  {
    title: "Introducere",
    items: [
      { slug: "what-is-synaro", label: "Ce este Synaro?" },
      { slug: "getting-started", label: "Primii pași" },
    ],
  },
  {
    title: "Platformă",
    items: [
      { slug: "projects", label: "Proiecte" },
      { slug: "environments", label: "Medii și Docker" },
      { slug: "workspace", label: "Spațiul de lucru al proiectului" },
      { slug: "ai-tasks", label: "Motor de sarcini AI" },
    ],
  },
  {
    title: "Agenți AI",
    items: [
      { slug: "ai-agents", label: "Agenți AI" },
      { slug: "agent-tools", label: "Instrumente și execuții" },
    ],
  },
  {
    title: "API public",
    items: [
      { slug: "public-api", label: "Prezentare generală și autentificare" },
      { slug: "public-api-projects", label: "Proiecte și medii" },
      { slug: "public-api-tasks", label: "Sarcini AI" },
      { slug: "public-api-agents", label: "Agenți" },
    ],
  },
  {
    title: "Dezvoltatori",
    items: [
      { slug: "architecture", label: "Arhitectură" },
      { slug: "tech-stack", label: "Stack tehnologic" },
      { slug: "services", label: "Servicii și API-uri" },
      { slug: "local-development", label: "Dezvoltare locală" },
    ],
  },
  {
    title: "Operațiuni",
    items: [
      { slug: "security", label: "Securitate" },
      { slug: "roadmap", label: "Foaie de parcurs" },
    ],
  },
];

export const DOC_PAGES: Record<string, DocPage> = {
  "what-is-synaro": {
    slug: "what-is-synaro",
    title: "Ce este Synaro?",
    description:
      "Synaro transformă idei exprimate în limbaj natural în software containerizat și rulabil—cu scaffolding AI, medii izolate și un plan de control unificat.",
    blocks: [
      {
        type: "p",
        text: "Synaro este o platformă de infrastructură pentru dezvoltatori. Descrie ce vrei să construiești; Synaro generează structura depozitului, provisionează un spațiu de lucru Docker și îți permite să iterezi cu sarcini asistate de AI—dintr-un singur panou de control.",
      },
      {
        type: "p",
        text: "Fiecare proiect primește propriul spațiu de lucru identificat prin slug, cu arbore de fișiere, terminal în browser, previzualizare live și un chat AI care poate analiza depozitul, pune întrebări de clarificare și aplica modificări de cod în siguranță.",
      },
      {
        type: "callout",
        variant: "tip",
        title: "Pentru cine este?",
        text: "Echipe și persoane care vor bucle de feedback rapide: prototip în câteva minute, previzualizări partajabile și medii izolate fără a gestiona manual console cloud pentru fiecare experiment.",
      },
      {
        type: "h2",
        text: "Ce poți face",
      },
      {
        type: "ul",
        items: [
          "Creezi proiecte dintr-un prompt, import GitHub sau încărcare de folder local",
          "Pornești și oprești medii de dezvoltare containerizate per proiect",
          "Navighezi fișiere, deschizi un terminal web, previzualizezi aplicații în execuție și descarci spațiul de lucru ca arhivă zip",
          "Rulezi sarcini AI în chat-ul proiectului care generează, validează și aplică modificări în depozit",
          "Creezi agenți AI independenți cu căutare web și instrumente HTTP pentru cercetare și sarcini programate",
          "Inviți colaboratori și urmărești activitatea platformei în jurnale",
          "Automatizezi proiecte, deploy-uri și agenți prin API-ul public (/api/v1) cu chei API",
        ],
      },
    ],
  },
  "getting-started": {
    slug: "getting-started",
    title: "Primii pași",
    description: "Creează un cont, pornește primul proiect și deschide spațiul de lucru.",
    blocks: [
      {
        type: "h2",
        text: "1. Înregistrare",
      },
      {
        type: "p",
        text: "Accesează aplicația Synaro și creează un cont cu email/parolă sau conectează GitHub prin NextAuth. După autentificare ajungi pe panoul de control cu KPI-uri, proiecte recente și jurnale de activitate.",
      },
      {
        type: "h2",
        text: "2. Creează un proiect",
      },
      {
        type: "p",
        text: "Din Proiecte, alege Creează pentru scaffolding dintr-o descriere, Import pentru a clona un depozit GitHub sau încarcă un folder local. Fiecare proiect primește un slug unic folosit în URL-uri (/projects/your-slug).",
      },
      {
        type: "h2",
        text: "3. Pornește mediul",
      },
      {
        type: "p",
        text: "Deschide spațiul de lucru al proiectului și folosește controlul Docker (indicator running / stopped) pentru a provisiona un container. Când mediul este RUNNING, folosește Run pentru a porni procesul aplicației și deschide panoul de previzualizare.",
      },
      {
        type: "h2",
        text: "4. Iterează cu AI",
      },
      {
        type: "p",
        text: "Comută la tab-ul chat AI, descrie o modificare, răspunde la întrebările de clarificare și trimite. Serviciul de orchestrare urmărește starea sarcinii (analyzing → generating → applying) până când modificările ajung în arborele tău.",
      },
      {
        type: "code",
        title: "Exemplu de prompt",
        code: 'Add a health check route at GET /api/health that returns { "ok": true }.',
      },
      {
        type: "h2",
        text: "5. Încearcă agenții AI (opțional)",
      },
      {
        type: "p",
        text: "Deschide Agenți din bara laterală a panoului de control. Creează un agent cu un system prompt și unul sau mai multe instrumente (căutare web, HTTP GET/POST), apoi rulează-l la cerere sau atașează o programare cron pentru sarcini de cercetare recurente. Agenții nu necesită un mediu de proiect în execuție.",
      },
      {
        type: "h2",
        text: "6. Automatizează cu API-ul public (opțional)",
      },
      {
        type: "p",
        text: "Pentru scripturi și CI, mergi la Setări → Chei API, creează o cheie și apelează /api/v1 cu Authorization: Bearer <key>. Începe cu GET /api/v1/me, apoi vezi secțiunea API public din Documentație pentru proiecte, sarcini și agenți.",
      },
    ],
  },
  projects: {
    slug: "projects",
    title: "Proiecte",
    description: "Ciclu de viață, metadate, importuri, partajare și cum se mapează proiectele la servicii.",
    blocks: [
      {
        type: "p",
        text: "Un proiect este unitatea de nivel superior în Synaro. Stochează nume, slug, descriere, URL Git remote opțional, selecție de imagine Docker de bază și starea mediului sincronizată din serviciul de mediu.",
      },
      {
        type: "h2",
        text: "Fluxuri de creare",
      },
      {
        type: "ul",
        items: [
          "Gol / prompt — scaffolding asistat de AI cu imagine runtime aleasă (Node, Python, Go, Nginx, Ubuntu sau detectare automată)",
          "Import GitHub — clonează depozitul în volumul spațiului de lucru la provisionare",
          "Încărcare folder — importă fișiere fără istoric Git (fără metadate de commit în arborele de fișiere)",
        ],
      },
      {
        type: "h2",
        text: "Colaborare",
      },
      {
        type: "p",
        text: "Proprietarii de proiect pot invita membri prin linkuri de partajare (invitații de proiect cu token-uri expirabile). Membrii primesc acces la spațiul de lucru; proprietarii păstrează ștergerea și gestionarea invitațiilor.",
      },
      {
        type: "h2",
        text: "Depozite de date",
      },
      {
        type: "p",
        text: "Metadatele proiectului sunt în baza de date principală a aplicației (Prisma pe PostgreSQL). project-service menține propria schemă pentru înregistrări specifice serviciului. Starea runtime a mediului este stocată separat în baza de date a environment-service.",
      },
    ],
  },
  environments: {
    slug: "environments",
    title: "Medii și Docker",
    description: "Cum provisionează Synaro containere, expune previzualizări și gestionează starea runtime.",
    blocks: [
      {
        type: "p",
        text: "environment-service comunică cu socket-ul Docker local (sau runtime-ul de cluster în producție) pentru a crea spații de lucru izolate per proiect. Starea revine în UI ca INACTIVE, PROVISIONING, RUNNING, STOPPED sau ERROR.",
      },
      {
        type: "h2",
        text: "Ciclu de viață",
      },
      {
        type: "ol",
        items: [
          "Utilizatorul pornește Docker din bara de instrumente a spațiului de lucru",
          "Serviciul clonează sau montează spațiul de lucru al proiectului și selectează o imagine de bază",
          "Containerul rulează cu limite CPU/memorie și politică de rețea",
          "WebSocket-ul terminalului se atașează pentru shell-uri interactive",
          "Stop sau destroy eliberează resursele",
        ],
      },
      {
        type: "h2",
        text: "Previzualizare și rulare",
      },
      {
        type: "p",
        text: "Când este RUNNING, controlul Run execută comanda de start și transmite jurnalele în panoul de jurnale al spațiului de lucru. iframe-ul de previzualizare încarcă URL-ul de previzualizare publicat (adesea porturi localhost redirecționate din container).",
      },
      {
        type: "callout",
        variant: "info",
        text: "Multe site-uri terțe blochează încorporarea în iframe (X-Frame-Options). Folosește URL-uri pe care le controlezi pentru previzualizări fiabile.",
      },
    ],
  },
  workspace: {
    slug: "workspace",
    title: "Spațiul de lucru al proiectului",
    description: "Arbore de fișiere, terminal, chat AI, previzualizare și stare UI persistată.",
    blocks: [
      {
        type: "p",
        text: "Spațiul de lucru de la /projects/[slug] este inima operațională a Synaro. Combină trei tab-uri principale cu o coloană de previzualizare live pe ecrane late.",
      },
      {
        type: "table",
        headers: ["Tab", "Scop"],
        rows: [
          ["Arbore de fișiere", "Navighezi fișierele depozitului, cauți și inspectezi metadatele selecției (commit-uri când Git este prezent)"],
          ["Chat AI", "Sarcini în limbaj natural cu clarificare, intrare vocală (Web Speech API), răspunsuri markdown și aplicare automată la finalizare"],
          ["Terminal", "Sesiune xterm.js în containerul în execuție când mediul este activ"],
        ],
      },
      {
        type: "h2",
        text: "Persistență client",
      },
      {
        type: "p",
        text: "Folderele expandate, ultimul fișier selectat și tab-ul activ sunt stocate în localStorage per proiect, astfel încât revenirea la un spațiu de lucru restaurează contextul fără reîncărcare completă.",
      },
      {
        type: "h2",
        text: "Descărcare spațiu de lucru",
      },
      {
        type: "p",
        text: "Când mediul este activ, descarcă arborele complet al spațiului de lucru ca arhivă zip din bara de instrumente. Aplicația face proxy al arhivei de la serviciul de mediu, astfel încât poți face backup sau partaja fișiere în afara Synaro.",
      },
    ],
  },
  "ai-tasks": {
    slug: "ai-tasks",
    title: "Motor de sarcini AI",
    description: "Clarificare, orchestrare, integrare Moonshot/Kimi și stări ale sarcinilor.",
    blocks: [
      {
        type: "p",
        text: "Munca AI este asincronă. Aplicația apelează ai-orchestration-service, care poate pune întrebări de follow-up, apoi rulează ANALYZING → GENERATING → APPLYING înainte de a marca DONE sau FAILED.",
      },
      {
        type: "h2",
        text: "Flux",
      },
      {
        type: "ol",
        items: [
          "Utilizatorul trimite un prompt din chat-ul AI (opțional după captură vocală)",
          "Aplicația poate apela /api/projects/[id]/ai-clarify pentru întrebări structurate",
          "Trimiterea creează o sarcină interogată prin /api/ai-tasks/[taskId]",
          "Orchestratorul citește spațiul de lucru prin environment-service și scrie patch-uri de fișiere",
          "UI-ul arată progresul, căile rezultate și erorile inline în fir, ca markdown",
        ],
      },
      {
        type: "h2",
        text: "Configurare",
      },
      {
        type: "p",
        text: "Setează KIMI_API_KEY (Moonshot) în mediul serviciului de orchestrare. Fără o cheie validă, sarcinile eșuează cu erori de autentificare de la furnizor.",
      },
      {
        type: "callout",
        variant: "info",
        title: "Nu este același lucru cu agenții AI",
        text: "Sarcinile AI de proiect modifică depozitul în interiorul unui spațiu de lucru Docker. Agenții independenți de la /agents rulează separat cu instrumente web și HTTP—vezi secțiunea Agenți AI pentru acea funcționalitate.",
      },
    ],
  },
  "ai-agents": {
    slug: "ai-agents",
    title: "Agenți AI",
    description:
      "Agenți la nivel de utilizator pentru cercetare, apeluri HTTP și sarcini programate—separat de chat-ul proiectului.",
    blocks: [
      {
        type: "p",
        text: "Agenții AI trăiesc pe pagina Agenți (/agents) din panoul de control. Fiecare agent are un nume, system prompt, instrumente selectate și programare cron opțională. Agenții rulează în fundal printr-o buclă ReAct dedicată și nu au nevoie de container de proiect sau arbore de fișiere.",
      },
      {
        type: "callout",
        variant: "tip",
        title: "Când să folosești agenți vs chat AI de proiect",
        text: "Folosește chat-ul AI de proiect când vrei cod scris în depozit. Folosește agenții independenți pentru cercetare mai lungă, apeluri API sau sarcini recurente care produc un răspuns text mai degrabă decât patch-uri de fișiere.",
      },
      {
        type: "h2",
        text: "Crearea unui agent",
      },
      {
        type: "ol",
        items: [
          "Deschide Agenți din bara laterală a panoului de control și apasă + Agent nou",
          "Introdu un nume, descriere opțională și system prompt care definește rolul agentului",
          "Activează instrumente: Web Search, HTTP GET și/sau HTTP POST",
          "Setează max steps (1–50, implicit 20) pentru a limita câte iterații de raționament permite runner-ul",
          "Adaugă opțional o expresie cron (de ex. */30 * * * *) pentru rulări automate",
        ],
      },
      {
        type: "h2",
        text: "Acțiuni pe cardul agentului",
      },
      {
        type: "table",
        headers: ["Acțiune", "Scop"],
        rows: [
          ["Run", "Pornește o execuție manuală cu text de intrare opțional"],
          ["runs →", "Deschide istoricul execuțiilor; apasă o rulare pentru trasarea live a pașilor"],
          ["Edit", "Actualizează nume, prompt, instrumente, pași maximi și programare"],
          ["Comutator activare", "Dezactivează agenții pentru a bloca rulările manuale și cron"],
          ["Delete", "Elimină agentul și toate execuțiile asociate"],
        ],
      },
      {
        type: "h2",
        text: "Pagina de detaliu rulare",
      },
      {
        type: "p",
        text: "Fiecare rulare se deschide la /agents/{agentId}/runs/{runId} cu o cronologie live a pașilor ReAct cât timp starea este PENDING sau RUNNING (interogare la fiecare 2 secunde), plus intrare și output markdown când sunt disponibile.",
      },
      {
        type: "h2",
        text: "Arhitectură",
      },
      {
        type: "p",
        text: "Aplicația Next.js face proxy cererilor autentificate prin sesiune către agent-service (port 3007), care stochează agenții și execuțiile în PostgreSQL. La declanșare, agent-service creează o execuție și notifică agent-runner (port 3008), care execută bucla ReAct cu Kimi K2.6 și raportează finalizarea prin webhook.",
      },
    ],
  },
  "agent-tools": {
    slug: "agent-tools",
    title: "Instrumente și execuții",
    description: "Instrumente disponibile, ciclu de viață al execuțiilor, programare și cerințe de mediu.",
    blocks: [
      {
        type: "p",
        text: "Fiecare agent primește doar instrumentele pe care le activezi la creare. Runner-ul le transmite LLM-ului ca apeluri de funcție; observațiile sunt reintroduse până când modelul termină sau se atinge max steps.",
      },
      {
        type: "h2",
        text: "Instrumente",
      },
      {
        type: "table",
        headers: ["Instrument", "Ce face"],
        rows: [
          ["web_search", "Interoghează web-ul prin Brave Search API; returnează rezultatele principale ca context"],
          ["http_get", "Preia un URL public (protejat SSRF, dimensiune limitată)"],
          ["http_post", "Trimite un POST JSON către un URL public cu aceleași limite de siguranță"],
        ],
      },
      {
        type: "h2",
        text: "Ciclu de viață al execuției",
      },
      {
        type: "ol",
        items: [
          "Declanșarea creează o execuție în starea PENDING și returnează imediat (asincron)",
          "agent-runner setează RUNNING și intră în bucla ReAct",
          "La fiecare pas: Kimi poate apela instrumente sau returna un răspuns final",
          "La finalizare runner-ul postează la agent-service; starea devine DONE sau FAILED",
          "Dialogul de execuții face polling la câteva secunde cât timp o execuție este încă activă",
        ],
      },
      {
        type: "h2",
        text: "Stări ale execuției",
      },
      {
        type: "table",
        headers: ["Stare", "Semnificație"],
        rows: [
          ["PENDING", "În coadă, așteaptă ca runner-ul să o preia"],
          ["RUNNING", "Buclă ReAct în desfășurare"],
          ["DONE", "Output final disponibil în lista de execuții"],
          ["FAILED", "Eroare sau max steps atins fără finalizare"],
        ],
      },
      {
        type: "h2",
        text: "Configurare",
      },
      {
        type: "p",
        text: "agent-runner necesită KIMI_API_KEY pentru LLM și BRAVE_SEARCH_API_KEY când web_search este activat. Setează AGENT_SERVICE_KEY consistent în aplicație, agent-service și agent-runner pentru autentificarea între servicii.",
      },
      {
        type: "callout",
        variant: "info",
        text: "Joburile cron se înregistrează când agent-runner pornește. După crearea sau modificarea programărilor, repornește containerul runner pentru ca noile expresii cron să intre în vigoare.",
      },
    ],
  },
  "public-api": {
    slug: "public-api",
    title: "API public — prezentare generală",
    description:
      "Acces programatic la Synaro prin /api/v1 cu chei API per utilizator, autentificare Bearer și JSON snake_case.",
    blocks: [
      {
        type: "p",
        text: "API-ul public Synaro îți permite să gestionezi proiecte, medii, sarcini AI și agenți independenți din scripturi, pipeline-uri CI sau integrări proprii. Toate endpoint-urile sunt sub /api/v1 pe același host ca aplicația web (de exemplu https://app.synaro.com/api/v1 sau http://localhost:3000/api/v1 local).",
      },
      {
        type: "callout",
        variant: "info",
        title: "Nu este API-ul de sesiune al panoului",
        text: "Rutele precum /api/projects și /api/agents necesită o sesiune NextAuth în browser. API-ul public folosește chei API și este suprafața suportată pentru automatizare. Microserviciile interne nu sunt expuse direct niciodată.",
      },
      {
        type: "h2",
        text: "Start rapid",
      },
      {
        type: "ol",
        items: [
          "Autentifică-te în Synaro și deschide Setări → Chei API (/settings/api-keys)",
          "Creează o cheie, copiază secretul imediat (este afișat o singură dată)",
          "Trimite Authorization: Bearer <your_key> la fiecare cerere /api/v1",
          "Apelează GET /api/v1/me pentru a verifica că cheia funcționează",
        ],
      },
      {
        type: "code",
        title: "Verifică cheia",
        code: `curl -s \\
  -H "Authorization: Bearer sk_live_YOUR_KEY" \\
  https://YOUR_SYNARO_HOST/api/v1/me`,
      },
      {
        type: "h2",
        text: "Autentificare",
      },
      {
        type: "p",
        text: "Fiecare cerere /api/v1 trebuie să includă un header Authorization cu token Bearer. Cheile folosesc prefixul sk_live_ urmat de un secret aleatoriu. Doar un hash SHA-256 este stocat pe server; dacă pierzi secretul, revocă cheia și creează una nouă.",
      },
      {
        type: "table",
        headers: ["Header", "Valoare"],
        rows: [
          ["Authorization", "Bearer sk_live_…"],
          ["Content-Type", "application/json (pentru corpuri POST/PATCH)"],
        ],
      },
      {
        type: "p",
        text: "Cheile API sunt create și revocate din panoul de control (autentificare prin sesiune). Nu există endpoint public pentru a genera chei—doar pentru a le folosi.",
      },
      {
        type: "h2",
        text: "Convenții",
      },
      {
        type: "ul",
        items: [
          "Numele câmpurilor JSON folosesc snake_case atât în cereri cât și în răspunsuri",
          "Identificatorii de proiect din URL sunt UUID-uri (project_id), nu slug-uri",
          "Erorile returnează JSON cu un câmp error; multe răspunsuri includ și detail",
          "Colaboratorii cu acces la proiect pot folosi aceleași endpoint-uri ca proprietarul",
          "HTTP 401 înseamnă cheie API lipsă sau invalidă; 404 înseamnă de obicei că resursa lipsește sau nu este vizibilă utilizatorului tău",
          "HTTP 429 înseamnă limită de rată depășită — implicit 120 cereri la 60 de secunde per cheie API (SYNARO_API_RATE_LIMIT și SYNARO_API_RATE_WINDOW_SEC)",
          "Răspunsurile includ X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset; răspunsurile 429 includ și Retry-After",
        ],
      },
      {
        type: "h2",
        text: "Hartă endpoint-uri",
      },
      {
        type: "table",
        headers: ["Zonă", "Cale de bază", "Pagină doc"],
        rows: [
          ["Cont și stare", "GET /api/v1/me, GET /api/v1/status", "Această pagină"],
          ["Proiecte", "/api/v1/projects…", "Proiecte și medii"],
          ["Sarcini AI de proiect", "/api/v1/projects/:id/tasks, /api/v1/tasks/:id", "Sarcini AI"],
          ["Agenți independenți", "/api/v1/agents…, /api/v1/runs/:id", "Agenți"],
        ],
      },
      {
        type: "h2",
        text: "Cont și stare platformă",
      },
      {
        type: "h3",
        text: "GET /api/v1/me",
      },
      {
        type: "p",
        text: "Returnează utilizatorul asociat cheii API.",
      },
      {
        type: "code",
        title: "Răspuns (200)",
        code: `{
  "user_id": "uuid",
  "email": "you@example.com",
  "name": "Your Name",
  "created_at": "2026-01-15T10:00:00.000Z"
}`,
      },
      {
        type: "h3",
        text: "GET /api/v1/status",
      },
      {
        type: "p",
        text: "Raportează starea platformei (baza de date a aplicației, environment-service, ai-orchestration-service). Poți transmite opțional project_id ca parametru query pentru a include starea mediului acelui proiect și dacă portul 3000 din interiorul containerului acceptă conexiuni.",
      },
      {
        type: "code",
        title: "Exemplu",
        code: `curl -s -H "Authorization: Bearer sk_live_…" \\
  "https://YOUR_HOST/api/v1/status?project_id=PROJECT_UUID"`,
      },
      {
        type: "callout",
        variant: "tip",
        text: "Folosește /api/v1/status în verificări de sănătate sau înainte de scripturi de deploy pentru a confirma că serviciile dependente sunt accesibile.",
      },
    ],
  },
  "public-api-projects": {
    slug: "public-api-projects",
    title: "API public — proiecte și medii",
    description:
      "Creează și listează proiecte, pornește/oprește medii Docker, deploy aplicații și citește jurnale runtime.",
    blocks: [
      {
        type: "p",
        text: "Proiectele sunt unitatea de nivel superior în Synaro. Fiecare are un UUID (project_id), un slug URL pentru panoul de control și un spațiu de lucru Docker izolat. Aceste endpoint-uri reflectă ce poți face din pagina Proiecte și bara de instrumente a spațiului de lucru.",
      },
      {
        type: "h2",
        text: "Listează proiecte",
      },
      {
        type: "h3",
        text: "GET /api/v1/projects",
      },
      {
        type: "code",
        title: "Răspuns (200)",
        code: `{
  "projects": [
    {
      "project_id": "uuid",
      "slug": "my-app",
      "name": "My App",
      "description": null,
      "environment_status": "RUNNING",
      "repository_location": "http://localhost:32847",
      "clone_repository_url": "https://github.com/org/repo",
      "created_at": "2026-01-15T10:00:00.000Z",
      "updated_at": "2026-01-16T08:30:00.000Z"
    }
  ]
}`,
      },
      {
        type: "h2",
        text: "Creează un proiect",
      },
      {
        type: "h3",
        text: "POST /api/v1/projects",
      },
      {
        type: "table",
        headers: ["Câmp", "Tip", "Obligatoriu", "Descriere"],
        rows: [
          ["name", "string", "Da*", "Nume afișat (max 120 caractere). *Derivat din repository_url dacă lipsește la import GitHub."],
          ["description", "string", "Nu", "Descriere opțională (max 2000 caractere)"],
          ["repository_url", "string", "Nu", "URL HTTPS GitHub (https://github.com/owner/repo) de clonat la provisionare"],
          ["docker_image", "string", "Nu", "Indiciu imagine de bază (de ex. node:20-alpine); implicit selecție automată"],
        ],
      },
      {
        type: "code",
        title: "Cerere",
        code: `curl -s -X POST \\
  -H "Authorization: Bearer sk_live_…" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Demo API","repository_url":"https://github.com/org/repo"}' \\
  https://YOUR_HOST/api/v1/projects`,
      },
      {
        type: "p",
        text: "Returnează 201 cu obiectul proiect. Dacă provisionarea mediului eșuează, environment_warning conține un mesaj lizibil și environment_status poate fi ERROR.",
      },
      {
        type: "h2",
        text: "Obține sau șterge un proiect",
      },
      {
        type: "h3",
        text: "GET /api/v1/projects/:projectId",
      },
      {
        type: "p",
        text: "Returnează un singur obiect proiect (aceeași formă ca elementele din listă).",
      },
      {
        type: "h3",
        text: "DELETE /api/v1/projects/:projectId",
      },
      {
        type: "p",
        text: "Distruge mediile remote ale proiectului și șterge rândul din baza de date. Returnează 204 fără corp.",
      },
      {
        type: "h2",
        text: "Ciclu de viață al mediului",
      },
      {
        type: "p",
        text: "Start provisionează sau reia spațiul de lucru Docker; stop oprește containerul în execuție. environment_status din răspunsuri reflectă INACTIVE, PROVISIONING, RUNNING, STOPPED sau ERROR.",
      },
      {
        type: "table",
        headers: ["Endpoint", "Metodă", "Descriere"],
        rows: [
          ["/api/v1/projects/:projectId/environment/start", "POST", "Creează, reia sau asigură un mediu în execuție"],
          ["/api/v1/projects/:projectId/environment/stop", "POST", "Oprește mediul activ"],
        ],
      },
      {
        type: "code",
        title: "Răspuns start (200)",
        code: `{
  "environment_status": "RUNNING",
  "preview_url": "http://localhost:32847",
  "repository_location": "http://localhost:32847"
}`,
      },
      {
        type: "callout",
        variant: "info",
        text: "Dacă un mediu este deja PROVISIONING, start poate returna 409 cu un mesaj de așteptare. Clonarea GitHub la prima provisionare folosește token-ul GitHub legat al proprietarului proiectului când repository_url este setat.",
      },
      {
        type: "h2",
        text: "Deploy (rulează aplicația)",
      },
      {
        type: "h3",
        text: "POST /api/v1/projects/:projectId/deploy",
      },
      {
        type: "p",
        text: "Asigură că mediul rulează, detectează scripturile package.json, instalează dependențele dacă e necesar și pornește procesul aplicației (de obicei pe portul 3000 în container).",
      },
      {
        type: "table",
        headers: ["Câmp", "Tip", "Implicit", "Descriere"],
        rows: [
          ["wait_until_ready", "boolean", "true", "Așteaptă până când portul 3000 acceptă conexiuni"],
          ["timeout_seconds", "number", "120", "Așteptare maximă când wait_until_ready este true (5–300)"],
        ],
      },
      {
        type: "code",
        title: "Răspuns (200)",
        code: `{
  "environment_status": "RUNNING",
  "run_status": "running",
  "preview_url": "http://localhost:32847",
  "command": "npm run dev"
}`,
      },
      {
        type: "p",
        text: "run_status este starting, running sau not_ready în funcție de dacă aplicația s-a legat de portul 3000 în timpul alocat.",
      },
      {
        type: "h2",
        text: "Jurnale",
      },
      {
        type: "h3",
        text: "GET /api/v1/projects/:projectId/logs",
      },
      {
        type: "table",
        headers: ["Query", "Implicit", "Descriere"],
        rows: [
          ["source", "runtime", "runtime = tail /tmp/app.log în container; task = flux sarcină AI"],
          ["lines", "150", "Număr de linii de jurnal pentru sursa runtime (1–500)"],
          ["task_id", "—", "Obligatoriu când source=task"],
        ],
      },
      {
        type: "code",
        title: "Jurnale runtime",
        code: `curl -s -H "Authorization: Bearer sk_live_…" \\
  "https://YOUR_HOST/api/v1/projects/PROJECT_UUID/logs?lines=100"`,
      },
    ],
  },
  "public-api-tasks": {
    slug: "public-api-tasks",
    title: "API public — sarcini AI",
    description:
      "Rulează muncă AI la nivel de depozit în spațiul de lucru al unui proiect: creează sarcini, listează istoricul și interoghează până la finalizare.",
    blocks: [
      {
        type: "p",
        text: "Sarcinile AI de proiect folosesc același motor ca chat-ul AI din spațiul de lucru. Analizează depozitul, generează modificări și aplică patch-uri în mediul Docker. Sarcinile sunt asincrone—creează cu POST, apoi interoghează GET /api/v1/tasks/:taskId până când status este DONE sau FAILED.",
      },
      {
        type: "callout",
        variant: "info",
        title: "Nu sunt agenți independenți",
        text: "Aceste endpoint-uri modifică un depozit de proiect. Pentru agenți cu căutare web și instrumente HTTP fără proiect, folosește paginile API Agenți.",
      },
      {
        type: "h2",
        text: "Creează o sarcină",
      },
      {
        type: "h3",
        text: "POST /api/v1/projects/:projectId/tasks",
      },
      {
        type: "table",
        headers: ["Câmp", "Tip", "Obligatoriu", "Descriere"],
        rows: [
          ["prompt", "string", "Da", "Instrucțiune în limbaj natural pentru AI"],
          ["mode", "string", "Nu", "generate (implicit) sau answer pentru Q&A fără aplicarea modificărilor"],
        ],
      },
      {
        type: "code",
        title: "Cerere și răspuns (202)",
        code: `curl -s -X POST \\
  -H "Authorization: Bearer sk_live_…" \\
  -H "Content-Type: application/json" \\
  -d '{"prompt":"Add a health check route to the API"}' \\
  https://YOUR_HOST/api/v1/projects/PROJECT_UUID/tasks

# Response:
{
  "task_id": "uuid",
  "status": "PENDING",
  "poll_url": "/api/v1/tasks/uuid"
}`,
      },
      {
        type: "h2",
        text: "Listează sarcini pentru un proiect",
      },
      {
        type: "h3",
        text: "GET /api/v1/projects/:projectId/tasks",
      },
      {
        type: "p",
        text: "Returnează istoricul sarcinilor din ai-orchestration-service. Numele câmpurilor sunt convertite la snake_case în răspuns.",
      },
      {
        type: "h2",
        text: "Interoghează starea sarcinii",
      },
      {
        type: "h3",
        text: "GET /api/v1/tasks/:taskId",
      },
      {
        type: "table",
        headers: ["Query", "Implicit", "Descriere"],
        rows: [
          ["wait", "true", "Blochează până la DONE, FAILED sau timeout (setează false pentru un snapshot unic)"],
          ["timeout_seconds", "300", "Așteptare maximă când wait=true (5–600)"],
        ],
      },
      {
        type: "code",
        title: "Sarcină finalizată (200)",
        code: `{
  "task_id": "uuid",
  "project_id": "uuid",
  "status": "DONE",
  "progress": null,
  "summary": "Added GET /health returning { ok: true }",
  "changes": [],
  "git": { "html_url": "…", "branch": "main" },
  "meta": { "explored_files": 12, "ai_steps": 4 },
  "error_message": null,
  "stream_content": "…",
  "timed_out": false
}`,
      },
      {
        type: "h2",
        text: "Stări ale sarcinii",
      },
      {
        type: "table",
        headers: ["Stare", "Semnificație"],
        rows: [
          ["PENDING", "În coadă"],
          ["ANALYZING / GENERATING / APPLYING", "În desfășurare (faze de orchestrare)"],
          ["DONE", "Finalizată cu succes; summary și changes populate"],
          ["FAILED", "Eroare; vezi error_message"],
        ],
      },
      {
        type: "h2",
        text: "Flux tipic de automatizare",
      },
      {
        type: "ol",
        items: [
          "POST /api/v1/projects/:id/environment/start — asigură că spațiul de lucru este pornit",
          "POST /api/v1/projects/:id/tasks — trimite promptul",
          "GET /api/v1/tasks/:taskId?wait=true — așteaptă finalizarea",
          "GET /api/v1/projects/:id/logs?source=task&task_id=… — flux de jurnal al sarcinii opțional",
          "POST /api/v1/projects/:id/deploy — rulează aplicația după modificări",
        ],
      },
      {
        type: "callout",
        variant: "tip",
        text: "Conectează GitHub la contul tău Synaro pentru ca sarcinile să poată face commit folosind token-ul tău când clone_repository_url este setat pe proiect.",
      },
    ],
  },
  "public-api-agents": {
    slug: "public-api-agents",
    title: "API public — agenți",
    description:
      "Gestionează agenți AI independenți, declanșează execuții și inspectează output-ul execuțiilor prin API-ul public.",
    blocks: [
      {
        type: "p",
        text: "Agenții independenți sunt automatizări la nivel de utilizator cu system prompt, instrumente opționale (căutare web, HTTP) și programare cron. Rulează în agent-runner și nu necesită container de proiect. API-ul public face proxy către agent-service; răspunsurile folosesc snake_case.",
      },
      {
        type: "h2",
        text: "Listează și creează agenți",
      },
      {
        type: "h3",
        text: "GET /api/v1/agents",
      },
      {
        type: "p",
        text: "Returnează agenții deținuți de utilizatorul cheii API.",
      },
      {
        type: "h3",
        text: "POST /api/v1/agents",
      },
      {
        type: "p",
        text: "Creează un agent. Trimite aceleași câmpuri JSON pe care le-ai folosi din panoul de control sau API-ul de sesiune (name, system_prompt, tools, schedule etc.). user_id este setat automat din cheia ta API—nu trebuie să transmiți id-ul altui utilizator.",
      },
      {
        type: "code",
        title: "Exemplu creare",
        code: `curl -s -X POST \\
  -H "Authorization: Bearer sk_live_…" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Research bot",
    "system_prompt": "Summarize top news about AI infrastructure.",
    "tools": ["web_search"]
  }' \\
  https://YOUR_HOST/api/v1/agents`,
      },
      {
        type: "h2",
        text: "Agent singular",
      },
      {
        type: "table",
        headers: ["Endpoint", "Metodă", "Descriere"],
        rows: [
          ["/api/v1/agents/:agentId", "GET", "Preia configurația agentului"],
          ["/api/v1/agents/:agentId", "PATCH", "Actualizează câmpurile agentului"],
          ["/api/v1/agents/:agentId", "DELETE", "Șterge agentul (204)"],
        ],
      },
      {
        type: "h2",
        text: "Declanșează o execuție",
      },
      {
        type: "h3",
        text: "POST /api/v1/agents/:agentId/trigger",
      },
      {
        type: "p",
        text: "Pornește o execuție la cerere a agentului. Corpul JSON opțional poate include intrare specifică execuției în funcție de configurația agentului. Returnează metadatele execuției de la agent-service (snake_case).",
      },
      {
        type: "h2",
        text: "Execuții",
      },
      {
        type: "h3",
        text: "GET /api/v1/agents/:agentId/runs",
      },
      {
        type: "p",
        text: "Listează execuțiile anterioare ale agentului (cele mai noi primele).",
      },
      {
        type: "h3",
        text: "GET /api/v1/runs/:runId",
      },
      {
        type: "p",
        text: "Preia o singură execuție după ID, inclusiv starea și output-ul la finalizare.",
      },
      {
        type: "h2",
        text: "Stări ale execuției",
      },
      {
        type: "table",
        headers: ["Stare", "Semnificație"],
        rows: [
          ["PENDING", "În coadă"],
          ["RUNNING", "Buclă ReAct în desfășurare"],
          ["DONE", "Finalizată; output disponibil"],
          ["FAILED", "Eroare sau max steps fără finalizare"],
        ],
      },
      {
        type: "callout",
        variant: "info",
        text: "Agenții programați necesită agent-runner cu KIMI_API_KEY și BRAVE_SEARCH_API_KEY valide (când web_search este activat). Înregistrarea cron are loc la pornirea runner-ului—repornește runner-ul după modificarea programărilor.",
      },
    ],
  },
  architecture: {
    slug: "architecture",
    title: "Arhitectură",
    description: "Plan de control, microservicii și straturi de infrastructură.",
    blocks: [
      {
        type: "p",
        text: "Synaro folosește un backend modular: aplicația Next.js este suprafața produsului și BFF (rute API, NextAuth, Prisma). Servicii specializate gestionează Docker, proiecte, AI și execuție.",
      },
      {
        type: "code",
        title: "Diagramă de nivel înalt",
        code: `┌─────────────────────────────────────────┐
│         Next.js App (port 3000)         │
│  Dashboard · Projects · Agents · APIs   │
└────────────────────┬────────────────────┘
                     │
     ┌───────────────┼───────────────┬──────────────┬──────────────┐
     ▼               ▼               ▼              ▼              ▼
 Project Svc    Environment Svc   AI Orch Svc   Execution Mgr  Agent Svc
  :3001            :3002            :3003          :3004         :3007
     │               │               │              │              │
     │               │               │              │              ▼
     │               │               │              │         Agent Runner
     │               │               │              │            :3008
     └───────────────┴───────────────┴──────────────┘              │
                     │                                             │
              Docker · PostgreSQL ◄────────────────────────────────┘`,
      },
      {
        type: "h2",
        text: "Responsabilități",
      },
      {
        type: "table",
        headers: ["Serviciu", "Rol"],
        rows: [
          ["project-service", "CRUD proiecte și metadate la nivel de serviciu (Fastify)"],
          ["environment-service", "Ciclu de viață container, fișiere, terminal WS, operații git, descărcare spațiu de lucru"],
          ["ai-orchestration-service", "Sarcini LLM, analiză depozit, aplicare patch-uri"],
          ["execution-manager", "Rulare/oprire proces, captură jurnale, monitorizare runtime"],
          ["agent-service", "CRUD agenți, declanșare execuții, webhook-uri de finalizare"],
          ["agent-runner", "Buclă de execuție ReAct, apeluri instrumente, programator cron"],
        ],
      },
    ],
  },
  "tech-stack": {
    slug: "tech-stack",
    title: "Stack tehnologic",
    description: "Limbaje, framework-uri și infrastructură folosite în monorepo.",
    blocks: [
      {
        type: "table",
        headers: ["Strat", "Tehnologii"],
        rows: [
          ["Frontend", "Next.js 16 (Pages Router), React 19, TypeScript, Tailwind CSS 4, Framer Motion"],
          ["UI", "Primitive Radix UI, componente în stil shadcn, pictograme Lucide, Recharts, xterm.js"],
          ["Auth", "NextAuth.js, adaptor Prisma, credențiale bcrypt, GitHub OAuth"],
          ["Date aplicație", "Prisma 5, PostgreSQL 16"],
          ["Servicii", "Node.js, Fastify 4, Zod, tsx (dev)"],
          ["AI", "Moonshot / Kimi API (K2.6) prin ai-orchestration-service și agent-runner"],
          ["Instrumente agent", "Brave Search API (web_search), client HTTP protejat SSRF"],
          ["Runtime", "Docker (dev prin montare socket), manifeste Kubernetes în /k8s"],
          ["Testare", "Jest, Testing Library"],
        ],
      },
      {
        type: "h2",
        text: "Structură monorepo",
      },
      {
        type: "ul",
        items: [
          "app/ — produs Next.js și rute API",
          "services/project-service/",
          "services/environment-service/",
          "services/ai-orchestration-service/",
          "services/agent-service/",
          "services/agent-runner/",
          "services/execution-manager/",
          "k8s/ — manifeste de deploy",
          "docker-compose.yml — stack multi-serviciu local",
        ],
      },
    ],
  },
  services: {
    slug: "services",
    title: "Servicii și API-uri",
    description: "Porturi, baze de date și rute API reprezentative în aplicație.",
    blocks: [
      {
        type: "table",
        headers: ["Serviciu", "Port implicit", "Bază de date"],
        rows: [
          ["Next.js app", "3000", "PostgreSQL (synaro) — utilizatori, proiecte, invitații, sesiuni"],
          ["project-service", "3001", "PostgreSQL (synaro_project_service)"],
          ["ai-orchestration-service", "3003", "PostgreSQL (synaro) — sarcini"],
          ["environment-service", "3002 (host 3004)", "PostgreSQL (synaro_env)"],
          ["execution-manager", "3004", "—"],
          ["agent-service", "3005 (host 3007)", "PostgreSQL (synaro) — agenți, execuții"],
          ["agent-runner", "3006 (host 3008)", "PostgreSQL (synaro) — schemă partajată"],
          ["PostgreSQL (app)", "5433", "synaro"],
          ["PostgreSQL (env)", "5434", "synaro_env"],
        ],
      },
      {
        type: "h2",
        text: "Rute API aplicație (exemple)",
      },
      {
        type: "p",
        text: "Rutele panoului de control necesită o sesiune NextAuth. Pentru automatizare, folosește API-ul public (/api/v1) cu chei API—vezi secțiunea API public din această documentație.",
      },
      {
        type: "ul",
        items: [
          "/api/v1/* — API public (cheie API Bearer); proiecte, sarcini, agenți, deploy",
          "/api/account/api-keys — creează și revocă chei (doar sesiune)",
          "/api/projects — listează și creează proiecte",
          "/api/projects/[projectId]/workspace-files — arbore de fișiere",
          "/api/projects/[projectId]/workspace-selection — detaliu fișier/folder",
          "/api/projects/[projectId]/run — pornește procesul aplicației",
          "/api/projects/[projectId]/ai-clarify — întrebări de clarificare",
          "/api/projects/[projectId]/ai-task — creează sarcină AI de proiect",
          "/api/ai-tasks/[taskId] — interoghează starea sarcinii AI",
          "/api/agents — listează și creează agenți independenți",
          "/api/agents/[agentId]/trigger — pornește o execuție de agent",
          "/api/agents/[agentId]/runs — listează execuțiile unui agent",
          "/api/invites/[token] — acceptă invitație de proiect",
          "/api/auth/* — handler-e NextAuth",
        ],
      },
    ],
  },
  "local-development": {
    slug: "local-development",
    title: "Dezvoltare locală",
    description: "Rulează stack-ul complet cu Docker Compose și variabile de mediu.",
    blocks: [
      {
        type: "h2",
        text: "Cerințe prealabile",
      },
      {
        type: "ul",
        items: [
          "Node.js 20+",
          "Docker Desktop (pentru acces socket environment-service)",
          "Clienți PostgreSQL opționali (migrări prin Prisma)",
        ],
      },
      {
        type: "h2",
        text: "Pornește infrastructura",
      },
      {
        type: "code",
        title: "Din rădăcina depozitului",
        code: `docker compose up -d postgresql postgresql-env
cd app && npm install && npm run db:migrate:local
docker compose up project-service environment-service ai-orchestration-service execution-manager agent-service agent-runner
cd app && npm run dev`,
      },
      {
        type: "h2",
        text: "Fișiere de mediu",
      },
      {
        type: "p",
        text: "Copiază exemplele env în app/.env.local (DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL, GitHub OAuth dacă este folosit). Setează KIMI_API_KEY pentru sarcini AI și agenți. Setează BRAVE_SEARCH_API_KEY și AGENT_SERVICE_KEY pentru căutare web agent și autentificare între servicii. Indică AGENT_SERVICE_URL la http://localhost:3007 când rulezi agenți local. environment-service citește app/.env.local prin env_file din docker-compose.",
      },
      {
        type: "callout",
        variant: "tip",
        text: "După modificarea schemelor Prisma, rulează migrate/generate în pachetul relevant înainte de a reporni serviciile.",
      },
    ],
  },
  security: {
    slug: "security",
    title: "Securitate",
    description: "Sandboxing, autentificare și execuție sigură a codului utilizatorului.",
    blocks: [
      {
        type: "p",
        text: "Codul utilizatorului rulează în containere Docker—nu în procesul Node de pe host. Synaro urmărește să combine izolarea la nivel de OS cu cote și restricții de rețea.",
      },
      {
        type: "ul",
        items: [
          "Medii per proiect cu controale start/stop",
          "Autentificare bazată pe sesiune; rutele API verifică apartenența la proiect",
          "Chei API publice (sk_live_…) pentru /api/v1; hash la repaus, revocabile din Setări",
          "Token-uri de invitație cu expirare și revocare",
          "iframe-uri de previzualizare în sandbox (allow-scripts, same-origin unde e necesar)",
          "Instrumentele HTTP ale agenților blochează IP-uri private și limitează dimensiunea răspunsului (protecție SSRF)",
          "Planificat: egress de rețea mai strict și politici de oprire la inactivitate",
        ],
      },
    ],
  },
  roadmap: {
    slug: "roadmap",
    title: "Foaie de parcurs",
    description: "Ce este livrat astăzi și ce urmează.",
    blocks: [
      {
        type: "h2",
        text: "MVP (livrat)",
      },
      {
        type: "ul",
        items: [
          "Creare proiecte din limbaj natural",
          "Scaffolding AI și aplicare sarcini în chat-ul proiectului",
          "Provisionare mediu Docker și descărcare spațiu de lucru",
          "Panou de control, jurnale, UI spațiu de lucru și pagina Agenți",
          "Agenți AI independenți cu căutare web, instrumente HTTP și programare cron",
          "UI de editare agent, comutatoare activare/dezactivare și vizualizator trasare pași per rulare",
          "API public v1 (/api/v1) cu chei API per utilizator pentru proiecte, sarcini și agenți",
        ],
      },
      {
        type: "h2",
        text: "Faza infrastructură",
      },
      {
        type: "ul",
        items: [
          "Integrare Kubernetes mai profundă",
          "Autoscaling medii",
          "Metrici avansate și alertare",
        ],
      },
      {
        type: "h2",
        text: "Faza automatizare",
      },
      {
        type: "ul",
        items: [
          "Pipeline-uri de test în stil CI per proiect",
          "Recomandări de auto-optimizare",
          "Editare colaborativă în timp real",
        ],
      },
    ],
  },
};
