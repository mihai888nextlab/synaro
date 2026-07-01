import { expect, test } from "@playwright/test";

import {
  E2E_PROJECT_PRIMARY_NAME,
  E2E_PROJECT_PRIMARY_SLUG,
  E2E_PROJECT_SECONDARY_NAME,
} from "./helpers/seed";

test.describe("Projects", () => {
  test("lists seeded project cards", async ({ page }) => {
    await page.goto("/projects");
    await expect(page.getByRole("link", { name: `Open project: ${E2E_PROJECT_PRIMARY_NAME}` })).toBeVisible();
    await expect(page.getByRole("link", { name: `Open project: ${E2E_PROJECT_SECONDARY_NAME}` })).toBeVisible();
  });

  test("opens a seeded project workspace", async ({ page }) => {
    await page.goto("/projects");
    await page.getByRole("link", { name: `Open project: ${E2E_PROJECT_PRIMARY_NAME}` }).click();
    await expect(page).toHaveURL(`/projects/${E2E_PROJECT_PRIMARY_SLUG}`);
  });

  test("new project dialog validates and submits with mocked API", async ({ page }) => {
    const mockSlug = "e2e-mock-created";
    const mockTitle = "E2E Mock Created";

    await page.route("**/api/projects", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            project: {
              id: "e2e-mock-project-id",
              slug: mockSlug,
              title: mockTitle,
              description: "Created via Playwright mock",
              stack: "Workspace",
              updatedRelative: "just now",
              environmentStatus: "INACTIVE",
              icon: "brain",
              viewerCanDelete: true,
            },
            environmentWarning: "Mock environment provisioning skipped in E2E.",
          }),
        });
        return;
      }
      await route.continue();
    });

    await page.goto("/projects");
    await page.getByRole("button", { name: "+ New project" }).click();
    await expect(page.getByRole("heading", { name: "New project" })).toBeVisible();

    await page.getByLabel("Project name").fill(mockTitle);
    await page.getByRole("button", { name: "Create project" }).click();

    await expect(page.getByText("Project created.")).toBeVisible();
    await expect(page.getByRole("link", { name: `Open project: ${mockTitle}` })).toBeVisible();
  });
});
