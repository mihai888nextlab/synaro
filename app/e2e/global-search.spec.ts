import { expect, test } from "@playwright/test";

import {
  E2E_PROJECT_PRIMARY_NAME,
  E2E_PROJECT_PRIMARY_SLUG,
} from "./helpers/seed";
import { useEnglishLocale } from "./helpers/locale";

test.describe("Global search", () => {
  test.beforeEach(async ({ page }) => {
    await useEnglishLocale(page);
  });

  test("prefetches index once and navigates to a project", async ({ page }) => {
    let searchIndexRequests = 0;
    page.on("request", (request) => {
      if (request.url().includes("/api/account/search-index")) {
        searchIndexRequests += 1;
      }
    });

    await page.goto("/dashboard", { waitUntil: "networkidle" });
    await expect.poll(() => searchIndexRequests).toBeGreaterThanOrEqual(1);

    const requestsBeforeOpen = searchIndexRequests;

    await page.keyboard.press("ControlOrMeta+KeyK");
    await expect(page.getByRole("dialog")).toBeVisible();

    const searchInput = page.getByRole("combobox", { name: "Search pages, projects, agents, and actions" });
    await searchInput.fill(E2E_PROJECT_PRIMARY_NAME);

    await page.getByRole("option", { name: new RegExp(E2E_PROJECT_PRIMARY_NAME) }).click();
    await expect(page).toHaveURL(`/projects/${E2E_PROJECT_PRIMARY_SLUG}`);

    expect(searchIndexRequests).toBe(requestsBeforeOpen);
  });

  test("does not refetch index while typing", async ({ page }) => {
    let searchIndexRequests = 0;
    page.on("request", (request) => {
      if (request.url().includes("/api/account/search-index")) {
        searchIndexRequests += 1;
      }
    });

    await page.goto("/dashboard", { waitUntil: "networkidle" });
    await expect.poll(() => searchIndexRequests).toBeGreaterThanOrEqual(1);

    const requestsBeforeTyping = searchIndexRequests;

    await page.keyboard.press("ControlOrMeta+KeyK");
    const searchInput = page.getByRole("combobox", { name: "Search pages, projects, agents, and actions" });
    await searchInput.fill("e2e");
    await searchInput.fill("e2e demo");
    await page.keyboard.press("Escape");

    expect(searchIndexRequests).toBe(requestsBeforeTyping);
  });

  test("highlights agent from search navigation", async ({ page }) => {
    const searchIndex = {
      projects: [],
      agents: [{ id: "agent-e2e-1", name: "E2E Research Agent", description: "Seeded for search tests" }],
    };
    const agentRecord = {
      id: "agent-e2e-1",
      name: "E2E Research Agent",
      description: "Seeded for search tests",
      systemPrompt: "test",
      tools: [],
      toolMode: "auto",
      maxSteps: 5,
      enabled: true,
      createdAt: new Date().toISOString(),
    };

    await page.route("**/api/account/search-index", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(searchIndex),
      });
    });

    await page.route("**/api/agents", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([agentRecord]),
        });
        return;
      }
      await route.continue();
    });

    await page.goto("/dashboard", { waitUntil: "networkidle" });
    await page.keyboard.press("ControlOrMeta+KeyK");

    const searchInput = page.getByRole("combobox", { name: "Search pages, projects, agents, and actions" });
    await searchInput.fill("E2E Research Agent");
    await page.getByRole("option", { name: /E2E Research Agent/i }).click();

    await expect(page).toHaveURL("/agents");
    await expect(page.locator("#agent-card-agent-e2e-1")).toBeVisible();
  });
});
