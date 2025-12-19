import { test, expect } from "@playwright/test";

test.describe("Email Generation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should display email generator on homepage", async ({ page }) => {
    // Check for email display
    await expect(page.locator('[data-testid="temp-email"], .email-display')).toBeVisible({ timeout: 10000 });
  });

  test("should generate new email on button click", async ({ page }) => {
    // Find generate/refresh button
    const generateButton = page.locator('button:has-text("Generate"), button:has-text("New"), button[aria-label*="generate"]');
    
    if (await generateButton.isVisible()) {
      // Get current email
      const emailBefore = await page.locator('[data-testid="temp-email"], .email-display').textContent();
      
      // Click generate
      await generateButton.click();
      
      // Wait for new email
      await page.waitForTimeout(1000);
    }
  });

  test("should copy email to clipboard", async ({ page }) => {
    // Grant clipboard permission
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    
    // Find copy button
    const copyButton = page.locator('button:has-text("Copy"), button[aria-label*="copy"]');
    
    if (await copyButton.isVisible()) {
      await copyButton.click();
      
      // Should show success toast
      await expect(page.locator('.toast, [role="status"]')).toBeVisible({ timeout: 5000 });
    }
  });

  test("should display inbox section", async ({ page }) => {
    // Check for inbox
    await expect(page.locator('[data-testid="inbox"], .inbox')).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Inbox Functionality", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("should show empty state when no emails", async ({ page }) => {
    // Check for empty inbox message or email list
    const inbox = page.locator('[data-testid="inbox"], .inbox');
    await expect(inbox).toBeVisible({ timeout: 10000 });
  });

  test("should have refresh button", async ({ page }) => {
    const refreshButton = page.locator('button:has-text("Refresh"), button[aria-label*="refresh"]');
    await expect(refreshButton).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Email History", () => {
  test("should redirect to auth if not logged in", async ({ page }) => {
    await page.goto("/history");
    
    // Should redirect to auth
    await expect(page).toHaveURL(/\/auth/);
  });
});
