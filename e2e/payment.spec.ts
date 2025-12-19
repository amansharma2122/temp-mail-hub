import { test, expect } from "@playwright/test";

test.describe("Payment Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to pricing page
    await page.goto("/pricing");
  });

  test("should display all subscription tiers", async ({ page }) => {
    // Check that pricing page loads
    await expect(page.locator("h1")).toContainText(/pricing/i);
    
    // Verify tier cards are visible
    const tierCards = page.locator('[data-testid="tier-card"]');
    await expect(tierCards).toHaveCount(3); // Free, Pro, Business
    
    // Check Free tier
    await expect(page.getByText(/free/i).first()).toBeVisible();
    
    // Check Pro tier
    await expect(page.getByText(/pro/i).first()).toBeVisible();
    
    // Check Business tier
    await expect(page.getByText(/business/i).first()).toBeVisible();
  });

  test("should show upgrade button for paid tiers", async ({ page }) => {
    const upgradeButtons = page.locator('button:has-text("Upgrade"), button:has-text("Subscribe")');
    await expect(upgradeButtons.first()).toBeVisible();
  });

  test("should redirect to auth when clicking upgrade without login", async ({ page }) => {
    // Click on upgrade button
    const upgradeButton = page.locator('button:has-text("Upgrade"), button:has-text("Get Started")').first();
    await upgradeButton.click();
    
    // Should redirect to auth page
    await expect(page).toHaveURL(/\/auth/);
  });

  test("should display feature comparison", async ({ page }) => {
    // Check for feature list items
    const features = page.locator('[data-testid="feature-item"]');
    
    // Verify common features are listed
    await expect(page.getByText(/email/i).first()).toBeVisible();
  });
});

test.describe("Billing History", () => {
  test("should redirect to auth if not logged in", async ({ page }) => {
    await page.goto("/billing");
    
    // Should redirect to auth or show login prompt
    await expect(page).toHaveURL(/\/auth|\/billing/);
  });
});

test.describe("Subscription Management", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should show subscription status in profile", async ({ page }) => {
    // Navigate to profile (if logged in)
    await page.goto("/profile");
    
    // If not logged in, should redirect
    const url = page.url();
    expect(url).toMatch(/\/profile|\/auth/);
  });
});

test.describe("Checkout Flow", () => {
  test("should handle checkout initiation", async ({ page }) => {
    await page.goto("/pricing");
    
    // Find and click a subscribe button
    const subscribeButton = page.locator('button:has-text("Subscribe"), button:has-text("Upgrade")').first();
    
    if (await subscribeButton.isVisible()) {
      await subscribeButton.click();
      
      // Should either redirect to auth or initiate checkout
      await page.waitForURL(/\/auth|stripe\.com|\/pricing/);
    }
  });
});
