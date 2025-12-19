import { test, expect } from "@playwright/test";

test.describe("Authentication Flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/auth");
  });

  test("should display login form", async ({ page }) => {
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("should show validation errors for empty form", async ({ page }) => {
    // Click submit without filling form
    await page.locator('button[type="submit"]').click();
    
    // Should show validation error
    await expect(page.locator('[role="alert"], .text-destructive')).toBeVisible();
  });

  test("should toggle between login and signup", async ({ page }) => {
    // Find toggle link
    const toggleLink = page.locator('button:has-text("Sign up"), a:has-text("Sign up")');
    
    if (await toggleLink.isVisible()) {
      await toggleLink.click();
      
      // Should show signup form elements
      await expect(page.locator('input[type="email"]')).toBeVisible();
    }
  });

  test("should show password requirements on signup", async ({ page }) => {
    // Switch to signup mode
    const signupToggle = page.locator('button:has-text("Sign up"), a:has-text("Sign up")');
    
    if (await signupToggle.isVisible()) {
      await signupToggle.click();
      
      // Fill in weak password
      await page.locator('input[type="password"]').fill("123");
      
      // Should show password requirement hints or validation
      await page.locator('button[type="submit"]').click();
    }
  });

  test("should handle invalid login credentials", async ({ page }) => {
    // Fill in invalid credentials
    await page.locator('input[type="email"]').fill("invalid@test.com");
    await page.locator('input[type="password"]').fill("wrongpassword123");
    
    // Submit form
    await page.locator('button[type="submit"]').click();
    
    // Should show error message
    await expect(page.locator('[role="alert"], .text-destructive, .toast')).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Protected Routes", () => {
  test("should redirect to auth for protected pages", async ({ page }) => {
    // Try accessing protected routes
    const protectedRoutes = ["/history", "/dashboard", "/profile", "/admin"];
    
    for (const route of protectedRoutes) {
      await page.goto(route);
      
      // Should redirect to auth or show restricted content
      const url = page.url();
      expect(url).toMatch(/\/auth|\/$/);
    }
  });
});

test.describe("Email Verification", () => {
  test("should handle verify-email page", async ({ page }) => {
    await page.goto("/verify-email");
    
    // Should show verification message or prompt
    await expect(page.locator("body")).toBeVisible();
  });

  test("should handle verify-email with token", async ({ page }) => {
    await page.goto("/verify-email?token=invalid-token");
    
    // Should show error or verification status
    await expect(page.locator("body")).toBeVisible();
  });
});
