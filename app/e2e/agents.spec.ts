import { expect, test } from "@playwright/test";

import {
  acceptNextDialog,
  E2E_AGENT_ID,
  E2E_AGENT_SCHEDULED_ID,
  E2E_RUN_ID,
  E2E_RUN_NEEDS_INPUT_ID,
  makeAutoAgent,
  makeDisabledAgent,
  makeManualAgent,
  makeRunCancelled,
  makeRunDone,
  makeRunFailed,
  makeRunNeedsInput,
  makeRunRunning,
  makeScheduledAgent,
  mockAgentApi,
} from "./helpers/agents";
import { useEnglishLocale } from "./helpers/locale";

test.describe("Agents", () => {
  test.beforeEach(async ({ page }) => {
    await useEnglishLocale(page);
  });

  test.describe("page basics", () => {
    test("loads agents page with empty list", async ({ page }) => {
      await mockAgentApi(page, { agents: [] });
      await page.goto("/agents", { waitUntil: "networkidle" });

      await expect(page.getByRole("heading", { name: "Agents", exact: true })).toBeAttached();
      await expect(page.getByText("+ New agent")).toBeVisible();
      await expect(page.locator('[data-onboarding="agents-grid"]')).toBeVisible();
    });

    test("shows auto tools label on auto-mode agent card", async ({ page }) => {
      await mockAgentApi(page, { agents: [makeAutoAgent()] });
      await page.goto("/agents", { waitUntil: "networkidle" });
      await expect(page.getByText("Auto tools")).toBeVisible();
    });

    test("shows manual tools count on manual-mode agent card", async ({ page }) => {
      await mockAgentApi(page, { agents: [makeManualAgent()] });
      await page.goto("/agents", { waitUntil: "networkidle" });
      await expect(page.getByText("1 tool")).toBeVisible();
    });

    test("shows schedule summary and next run on scheduled agent", async ({ page }) => {
      await mockAgentApi(page, { agents: [makeScheduledAgent()] });
      await page.goto("/agents", { waitUntil: "networkidle" });
      await expect(page.getByText(/Weekly on Mon at/i)).toBeVisible();
      await expect(page.getByText(/Next run:/i)).toBeVisible();
    });

    test("toggles agent enable state via PATCH", async ({ page }) => {
      let enabled = true;
      await mockAgentApi(page, {
        agents: [makeAutoAgent({ enabled })],
        onPatchAgent: (_id, body) => {
          enabled = Boolean(body.enabled);
          return makeAutoAgent({ enabled });
        },
      });

      await page.goto("/agents", { waitUntil: "networkidle" });
      await page.getByRole("button", { name: "Disable agent" }).click();
      await expect(page.getByRole("button", { name: "Enable agent" })).toBeVisible();
    });

    test("disables run button for disabled agent", async ({ page }) => {
      await mockAgentApi(page, { agents: [makeDisabledAgent()] });
      await page.goto("/agents", { waitUntil: "networkidle" });
      await expect(page.getByRole("button", { name: "Run", exact: true })).toBeDisabled();
    });
  });

  test.describe("create agent", () => {
    test("creates auto-tools agent with default fields", async ({ page }) => {
      let createBody: Record<string, unknown> | null = null;

      await mockAgentApi(page, {
        agents: [],
        onCreateAgent: (body) => {
          createBody = body;
          return makeAutoAgent({
            id: "agent-created-1",
            name: String(body.name),
            systemPrompt: String(body.systemPrompt),
            toolMode: String(body.toolMode ?? "auto"),
            tools: Array.isArray(body.tools) ? (body.tools as string[]) : [],
          });
        },
      });

      await page.goto("/agents", { waitUntil: "networkidle" });
      await page.getByText("+ New agent").click();
      await expect(page.getByRole("heading", { name: "New Agent" })).toBeVisible();

      await page.getByPlaceholder("My Research Agent").fill("E2E Created Agent");
      await page.getByPlaceholder(/You are a helpful research assistant/i).fill("Summarize topics clearly.");
      await page.getByRole("button", { name: "Create Agent" }).click();

      await expect(page.getByText("E2E Created Agent")).toBeVisible();
      expect(createBody).toMatchObject({
        name: "E2E Created Agent",
        systemPrompt: "Summarize topics clearly.",
        toolMode: "auto",
      });
      expect(createBody?.tools).toBeUndefined();
    });

    test("creates agent with weekly schedule from picker", async ({ page }) => {
      let createBody: Record<string, unknown> | null = null;

      await mockAgentApi(page, {
        agents: [],
        onCreateAgent: (body) => {
          createBody = body;
          return makeAutoAgent({
            id: "agent-created-scheduled",
            name: String(body.name),
            systemPrompt: String(body.systemPrompt),
            schedule: typeof body.schedule === "string" ? body.schedule : null,
          });
        },
      });

      await page.goto("/agents", { waitUntil: "networkidle" });
      await page.getByText("+ New agent").click();

      await page.getByPlaceholder("My Research Agent").fill("E2E Scheduled Create");
      await page.getByPlaceholder(/You are a helpful research assistant/i).fill("Run weekly reports.");

      await page.getByRole("checkbox", { name: /Run on schedule/i }).check();
      await page.getByRole("button", { name: "Weekly" }).click();
      await page.getByRole("button", { name: "Wed" }).click();

      await page.getByRole("button", { name: "Create Agent" }).click();
      await expect(page.getByText("E2E Scheduled Create")).toBeVisible();

      expect(typeof createBody?.schedule).toBe("string");
      expect(String(createBody?.schedule)).toMatch(/\* \* [0-9,]+/);
    });
  });

  test.describe("edit agent", () => {
    test("saves agent edits from dialog", async ({ page }) => {
      let agent = makeAutoAgent();

      await mockAgentApi(page, {
        agents: [agent],
        getAgent: () => agent,
        onPatchAgent: (_id, body) => {
          agent = { ...agent, name: String(body.name ?? agent.name) };
          return agent;
        },
      });

      await page.goto("/agents", { waitUntil: "networkidle" });
      await page.getByRole("button", { name: "More options for E2E Research Agent" }).click();
      await page.getByRole("menuitem", { name: "Edit agent" }).click();
      await expect(page.getByRole("dialog")).toBeVisible();

      await page.getByPlaceholder("My Research Agent").fill("E2E Updated Agent");
      await page.getByRole("button", { name: "Save changes" }).click();

      await expect(page.getByText("E2E Updated Agent")).toBeVisible();
    });

    test("switches to manual tools in advanced settings", async ({ page }) => {
      let agent = makeAutoAgent();
      let patchBody: Record<string, unknown> | null = null;

      await mockAgentApi(page, {
        agents: [agent],
        getAgent: () => agent,
        onPatchAgent: (_id, body) => {
          patchBody = body;
          agent = {
            ...agent,
            toolMode: String(body.toolMode ?? agent.toolMode),
            tools: Array.isArray(body.tools) ? (body.tools as string[]) : agent.tools,
          };
          return agent;
        },
      });

      await page.goto("/agents", { waitUntil: "networkidle" });
      await page.getByRole("button", { name: "More options for E2E Research Agent" }).click();
      await page.getByRole("menuitem", { name: "Edit agent" }).click();

      await page.getByRole("button", { name: "Advanced" }).click();
      await page.getByRole("checkbox", { name: /Auto tools/i }).uncheck();
      await page.getByRole("button", { name: "Web Search" }).click();
      await page.getByRole("button", { name: "Save changes" }).click();

      expect(patchBody).toMatchObject({ toolMode: "manual", tools: ["web_search"] });
      await expect(page.getByText("1 tool")).toBeVisible();
    });
  });

  test.describe("agent memory", () => {
    test("shows educational empty state on memory tab", async ({ page }) => {
      await mockAgentApi(page, {
        agents: [makeAutoAgent()],
        memoryByAgentId: { [E2E_AGENT_ID]: [] },
      });

      await page.goto("/agents", { waitUntil: "networkidle" });
      await page.getByRole("button", { name: "More options for E2E Research Agent" }).click();
      await page.getByRole("menuitem", { name: "Edit agent" }).click();
      await page.getByRole("tab", { name: "Memory" }).click();

      await expect(page.getByText("No memories yet")).toBeVisible();
      await expect(page.getByText(/remember and recall tools/i)).toBeVisible();
    });

    test("adds and displays a memory entry", async ({ page }) => {
      await mockAgentApi(page, {
        agents: [makeAutoAgent()],
        memoryByAgentId: { [E2E_AGENT_ID]: [] },
      });

      await page.goto("/agents", { waitUntil: "networkidle" });
      await page.getByRole("button", { name: "More options for E2E Research Agent" }).click();
      await page.getByRole("menuitem", { name: "Edit agent" }).click();
      await page.getByRole("tab", { name: "Memory" }).click();

      await page.getByRole("button", { name: "Add memory" }).click();
      await page.getByPlaceholder("e.g. user_preference").fill("user_theme");
      await page.getByPlaceholder("What should the agent remember?").fill("Prefers dark mode");
      await page.getByRole("button", { name: "Save", exact: true }).click();

      await expect(page.getByText("user_theme")).toBeVisible();
      await expect(page.getByText("Prefers dark mode")).toBeVisible();
      await expect(page.getByRole("tab", { name: /Memory/ })).toContainText("1");
    });

    test("deletes a memory entry with confirm", async ({ page }) => {
      const now = new Date().toISOString();
      await mockAgentApi(page, {
        agents: [makeAutoAgent()],
        memoryByAgentId: {
          [E2E_AGENT_ID]: [
            { key: "user_theme", content: "Prefers dark mode", createdAt: now, updatedAt: now },
          ],
        },
      });

      await page.goto("/agents", { waitUntil: "networkidle" });
      await page.getByRole("button", { name: "More options for E2E Research Agent" }).click();
      await page.getByRole("menuitem", { name: "Edit agent" }).click();
      await page.getByRole("tab", { name: "Memory" }).click();

      await page.getByRole("button", { name: "user_theme" }).click();
      acceptNextDialog(page);
      await page.getByRole("button", { name: "Delete", exact: true }).click();

      await expect(page.getByText("No memories yet")).toBeVisible();
    });
  });

  test.describe("runs list and detail", () => {
    test("navigates to run detail from runs dialog and polls to done", async ({ page }) => {
      await mockAgentApi(page, {
        agents: [makeAutoAgent()],
        runsByAgentId: { [E2E_AGENT_ID]: [makeRunDone()] },
        getRun: (runId, poll) => (poll <= 2 ? makeRunRunning() : makeRunDone()),
      });

      await page.goto("/agents", { waitUntil: "networkidle" });
      await page.getByRole("button", { name: "runs" }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.getByRole("button", { name: /View run/i }).click();

      await expect(page).toHaveURL(`/agents/${E2E_AGENT_ID}/runs/${E2E_RUN_ID}`);
      await expect(page.getByText("web_search")).toBeVisible();
      await expect(page.getByText("Synaro is an AI dev workspace.")).toBeVisible();
      await expect(page.getByText("Done")).toBeVisible();
    });

    test("shows done run output preview in runs dialog", async ({ page }) => {
      await mockAgentApi(page, {
        agents: [makeAutoAgent()],
        runsByAgentId: { [E2E_AGENT_ID]: [makeRunDone()] },
      });

      await page.goto("/agents", { waitUntil: "networkidle" });
      await page.getByRole("button", { name: "runs" }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await expect(page.getByText("Synaro is an AI dev workspace.")).toBeVisible();
    });

    test("shows failed run error snippet in runs dialog", async ({ page }) => {
      await mockAgentApi(page, {
        agents: [makeAutoAgent()],
        runsByAgentId: { [E2E_AGENT_ID]: [makeRunFailed()] },
      });

      await page.goto("/agents", { waitUntil: "networkidle" });
      await page.getByRole("button", { name: "runs" }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await expect(page.getByText("Could not connect to any MCP server.")).toBeVisible();
      await expect(page.getByText("Failed")).toBeVisible();
    });

    test("shows provide credentials link for needs-input run in runs dialog", async ({ page }) => {
      await mockAgentApi(page, {
        agents: [makeAutoAgent()],
        runsByAgentId: { [E2E_AGENT_ID]: [makeRunNeedsInput()] },
        getRun: () => makeRunNeedsInput(),
      });

      await page.goto("/agents", { waitUntil: "networkidle" });
      await page.getByRole("button", { name: "runs" }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await expect(page.getByText(/Waiting for github credentials/i)).toBeVisible();
      await page.getByRole("link", { name: "Provide credentials →" }).click();

      await expect(page).toHaveURL(
        `/agents/${E2E_AGENT_ID}/runs/${E2E_RUN_NEEDS_INPUT_ID}#run-credentials`,
      );
      await expect(page.getByRole("heading", { name: "MCP credentials required" })).toBeVisible();
      await expect(page.getByText(/Provide credentials for github/i)).toBeVisible();
    });

    test("shows back link on run detail page", async ({ page }) => {
      await mockAgentApi(page, {
        getRun: () => makeRunDone(),
      });

      await page.goto(`/agents/${E2E_AGENT_ID}/runs/${E2E_RUN_ID}`, { waitUntil: "networkidle" });
      await expect(page.getByRole("link", { name: "Back to agents" })).toBeVisible();
    });

    test("shows failed run error in output section", async ({ page }) => {
      await mockAgentApi(page, {
        getRun: () =>
          makeRunDone({
            status: "FAILED",
            output: "Could not connect to any MCP server.",
          }),
      });

      await page.goto(`/agents/${E2E_AGENT_ID}/runs/${E2E_RUN_ID}`, { waitUntil: "networkidle" });
      await expect(page.getByRole("heading", { name: "Error" })).toBeVisible();
      await expect(page.getByText("Could not connect to any MCP server.")).toBeVisible();
      await expect(page.getByText("Failed")).toBeVisible();
    });
  });

  test.describe("NEEDS_INPUT and MCP credentials", () => {
    test("shows credential form when run needs MCP auth", async ({ page }) => {
      await mockAgentApi(page, {
        getRun: () => makeRunNeedsInput(),
      });

      await page.goto(`/agents/${E2E_AGENT_ID}/runs/${E2E_RUN_NEEDS_INPUT_ID}`, {
        waitUntil: "networkidle",
      });

      await expect(page.getByText("Needs input")).toBeVisible();
      await expect(page.getByRole("heading", { name: "MCP credentials required" })).toBeVisible();
      await expect(page.getByText(/Provide credentials for github/i)).toBeVisible();
      await expect(page.getByPlaceholder("Bearer ghp_… or your MCP token")).toBeVisible();
    });

    test("requires credential fields before submit", async ({ page }) => {
      await mockAgentApi(page, {
        getRun: () => makeRunNeedsInput(),
      });

      await page.goto(`/agents/${E2E_AGENT_ID}/runs/${E2E_RUN_NEEDS_INPUT_ID}`, {
        waitUntil: "networkidle",
      });

      await page.getByRole("button", { name: "Submit and resume" }).click();
      await expect(page.getByText("All credential fields are required.")).toBeVisible();
    });

    test("submits credentials and resumes run to done", async ({ page }) => {
      let credentialsSubmitted = false;
      let runState = makeRunNeedsInput();

      await mockAgentApi(page, {
        getRun: () => runState,
        onSubmitCredentials: (runId, body) => {
          credentialsSubmitted = true;
          expect(runId).toBe(E2E_RUN_NEEDS_INPUT_ID);
          expect(body.mcpAuth).toBeTruthy();
          runState = makeRunDone({
            id: E2E_RUN_NEEDS_INPUT_ID,
            credentialRequest: null,
          });
          return { status: 202, body: { ok: true } };
        },
      });

      await page.goto(`/agents/${E2E_AGENT_ID}/runs/${E2E_RUN_NEEDS_INPUT_ID}`, {
        waitUntil: "networkidle",
      });

      await page.getByPlaceholder("Bearer ghp_… or your MCP token").fill("ghp_test_token");
      await page.getByRole("button", { name: "Submit and resume" }).click();

      await expect.poll(() => credentialsSubmitted).toBe(true);
      await expect(page.getByText("Done")).toBeVisible();
      await expect(page.getByText("Synaro is an AI dev workspace.")).toBeVisible();
    });
  });

  test.describe("cancel run", () => {
    test("cancels a running run from detail page", async ({ page }) => {
      let cancelled = false;
      let runState = makeRunRunning();

      await mockAgentApi(page, {
        activeRuns: [makeRunRunning()],
        getRun: () => runState,
        onCancelRun: (runId) => {
          cancelled = true;
          expect(runId).toBe(E2E_RUN_ID);
          runState = makeRunCancelled();
          return { status: 200, body: { ok: true } };
        },
      });

      acceptNextDialog(page);

      await page.goto(`/agents/${E2E_AGENT_ID}/runs/${E2E_RUN_ID}`, { waitUntil: "networkidle" });
      const cancelButton = page.locator("main").getByRole("button", { name: "Cancel run" });
      await expect(cancelButton).toBeVisible();
      await cancelButton.click();

      await expect.poll(() => cancelled).toBe(true);
      await expect(page.getByText("Cancelled by user")).toBeVisible();
    });

    test("shows active run pill while run is in progress", async ({ page }) => {
      await mockAgentApi(page, {
        agents: [makeAutoAgent()],
        activeRuns: [
          {
            ...makeRunRunning(),
            agent: { id: E2E_AGENT_ID, name: "E2E Research Agent" },
          },
        ],
        getRun: () => makeRunRunning(),
      });

      await page.goto("/agents", { waitUntil: "networkidle" });
      await expect(
        page.getByRole("link", { name: /E2E Research Agent is running/i }),
      ).toBeVisible({ timeout: 10_000 });
    });
  });

  test.describe("trigger run", () => {
    test("opens trigger dialog and starts a run", async ({ page }) => {
      let triggered = false;

      await mockAgentApi(page, {
        agents: [makeAutoAgent()],
        onTrigger: (_agentId, body) => {
          triggered = true;
          expect(body.input).toBe("Check Synaro docs");
          return { runId: E2E_RUN_ID };
        },
        getRun: () => makeRunDone(),
      });

      await page.goto("/agents", { waitUntil: "networkidle" });
      await page.getByRole("button", { name: "Run", exact: true }).click();
      await expect(page.getByRole("heading", { name: /Run E2E Research Agent/i })).toBeVisible();

      await page.getByPlaceholder(/What should the agent do/i).fill("Check Synaro docs");
      await page.getByRole("button", { name: "Run Agent" }).click();

      await expect.poll(() => triggered).toBe(true);
    });
  });
});
