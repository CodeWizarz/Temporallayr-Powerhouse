import { test, expect } from '@playwright/test';

test.describe('Dashboard End-to-End Tests', () => {
    let apiKey = '';

    test('Tenant Registration and Login Flow', async ({ page }) => {
        // 1. Navigate to Signup
        await page.goto('http://localhost:3000/signup');
        await expect(page).toHaveURL(/.*signup/);

        // 2. Fill out signup form
        await page.fill('input[placeholder="my-org"]', `test-tenant-${Date.now()}`);
        await page.fill('input[placeholder="sk-admin-..."]', 'sk-admin-9cNUxpiYyW02HbzJAFyYee15yg-HW8oWgzbWb_V9LB4');

        // 3. Submit
        await page.click('button:has-text("Provision Tenant")');

        // 4. Wait for API key screen
        await page.waitForSelector('text="Tenant Provisioned"');

        // Extract API key
        apiKey = await page.locator('code').textContent() || '';
        expect(apiKey).not.toBe('');

        // 5. Navigate to Login
        await page.click('button:has-text("Continue to Login")');
        await expect(page).toHaveURL(/.*login/);

        // 6. Login
        await page.fill('input[type="password"]', apiKey);
        await page.click('button:has-text("Sign In")');

        // 7. Verify Overview redirect
        await expect(page).toHaveURL(/.*overview/);
        await expect(page.locator('h1')).toHaveText('Overview');
        // 8. Test Navigation by direct URL
        const testNav = async (expectedUrlPath: string, expectedHeading: string) => {
            await page.goto(`http://localhost:3000/${expectedUrlPath}`);
            await expect(page).toHaveURL(new RegExp(`.*${expectedUrlPath}`));
            const heading = page.locator('h1, h2, h3').first();
            await expect(heading).toContainText(expectedHeading);
        };

        await testNav('traces', 'Traces');
        await testNav('incidents', 'Incidents');
        await testNav('datasets', 'Datasets');
        await testNav('cost', 'Cost');
        await testNav('stream', 'Event Stream');
        await testNav('settings', 'Settings');
    });
});
