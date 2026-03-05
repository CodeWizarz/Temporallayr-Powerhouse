import { test, expect } from '@playwright/test';

test.describe('Dashboard Production Build', () => {
  test('should load the index page', async ({ page }) => {
    await page.goto('/');
    
    // Check that the page title is present
    await expect(page).toHaveTitle(/TemporalLayr/i);
  });

  test('should have static assets in dist', async ({ page }) => {
    // Navigate to the built index.html
    await page.goto('/');
    
    // Verify the main JavaScript bundle is loaded
    const scripts = await page.locator('script').all();
    expect(scripts.length).toBeGreaterThan(0);
  });
});
