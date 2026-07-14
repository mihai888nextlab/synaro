import { expect, test } from "@playwright/test";

import { useEnglishLocale } from "./helpers/locale";

const AGENT_ID = "agent-e2e-1";
const RUN_ID = "run-e2e-1";

const enabledAgent = {
  id: AGENT_ID,
  name: "E2E Research Agent",
  description: "Seeded for agents tests",
  systemPrompt: "Research assistant",
  tools: ["web_search"],
  maxSteps: 5,
  enabled: true,
  createdAt: new Date().toISOString(),
};

const disabledAgent = {
  ...enabledAgent,
  id: "agent-e2e-disabled",
  name: "E2E Disabled Agent",
  enabled: false,
};

const runRunning = {
  id: RUN_ID,
  agentId: AGENT_ID,
  status: "RUNNING",
  trigger: "manual",
  input: "Find Synaro docs",
  output: null,
  steps: [
    {
      step: 1,
      tool: "web_search",
      args: { query: "Synaro" },
      observation: "Found several results about Synaro.",
    },
  ],
  startedAt: new Date().toISOString(),
  finishedAt: null,
  createdAt: new Date().toISOString(),
};

const runDone = {
  ...runRunning,
  status: "DONE",
  output: "Synaro is an AI dev workspace.",
  finishedAt: new Date().toISOString(),
};

test.describe("Agents", () => {
  test.beforeEach(async ({ page }) => {
    await useEnglishLocale(page);
  });

  test("loads agents page with empty list", async ({ page }) => {
    await page.route("**/api/agents", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: "[]",
        });
        return;
      }
      await route.continue();
    });

    await page.goto("/agents", { waitUntil: "networkidle" });

    await expect(page.getByRole("heading", { name: "Agents", exact: true })).toBeAttached();
    await expect(page.getByText("+ New agent")).toBeVisible();
    await expect(page.locator('[data-onboarding="agents-grid"]')).toBeVisible();
  });

  test("toggles agent enable state via PATCH", async ({ page }) => {
    let enabled = true;

    await page.route("**/api/agents", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([{ ...enabledAgent, enabled }]),
        });
        return;
      }
      await route.continue();
    });

    await page.route(`**/api/agents/${AGENT_ID}`, async (route) => {
      if (route.request().method() === "PATCH") {
        const body = route.request().postDataJSON() as { enabled?: boolean };
        enabled = Boolean(body.enabled);
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ...enabledAgent, enabled }),
        });
        return;
      }
      await route.continue();
    });

    await page.goto("/agents", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Disable agent" }).click();
    await expect(page.getByRole("button", { name: "Enable agent" })).toBeVisible();
  });

  test("saves agent edits from dialog", async ({ page }) => {
    let agent = { ...enabledAgent };

    await page.route("**/api/agents", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([agent]),
        });
        return;
      }
      await route.continue();
    });

    await page.route(`**/api/agents/${AGENT_ID}`, async (route) => {
      if (route.request().method() === "PATCH") {
        const body = route.request().postDataJSON() as { name?: string };
        agent = { ...agent, name: body.name ?? agent.name };
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(agent),
        });
        return;
      }
      await route.continue();
    });

    await page.goto("/agents", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "More options for E2E Research Agent" }).click();
    await page.getByRole("menuitem", { name: "Edit agent" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.getByPlaceholder("My Research Agent").fill("E2E Updated Agent");
    await page.getByRole("button", { name: "Save changes" }).click();

    await expect(page.getByText("E2E Updated Agent")).toBeVisible();
  });

  test("disables run button for disabled agent", async ({ page }) => {
    await page.route("**/api/agents", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([disabledAgent]),
        });
        return;
      }
      await route.continue();
    });

    await page.goto("/agents", { waitUntil: "networkidle" });
    await expect(page.getByRole("button", { name: "Run", exact: true })).toBeDisabled();
  });

  test("navigates to run detail from runs dialog", async ({ page }) => {
    let runDetailPolls = 0;

    await page.route("**/api/agents", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([enabledAgent]),
        });
        return;
      }
      await route.continue();
    });

    await page.route(`**/api/agents/${AGENT_ID}/runs`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([runDone]),
      });
    });

    await page.route(`**/api/agents/runs/${RUN_ID}`, async (route) => {
      runDetailPolls += 1;
      const payload = runDetailPolls <= 2 ? runRunning : runDone;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(payload),
      });
    });

    await page.goto("/agents", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "runs" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: /View run/i }).click();

    await expect(page).toHaveURL(`/agents/${AGENT_ID}/runs/${RUN_ID}`);
    await expect(page.getByText("web_search")).toBeVisible();
    await expect.poll(() => runDetailPolls).toBeGreaterThanOrEqual(2);
    await expect(page.getByText("Synaro is an AI dev workspace.")).toBeVisible();
    await expect(page.getByText("Done")).toBeVisible();
  });

  test("shows back link on run detail page", async ({ page }) => {
    await page.route(`**/api/agents/runs/${RUN_ID}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(runDone),
      });
    });

    await page.goto(`/agents/${AGENT_ID}/runs/${RUN_ID}`, { waitUntil: "networkidle" });
    await expect(page.getByRole("link", { name: "Back to agents" })).toBeVisible();
  });
});
