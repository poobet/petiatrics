import { test, expect } from '@playwright/test';

test.describe('Customer Portal — Logout', () => {
  test('logs in as customer, verifies dashboard, and logs out successfully', async ({ page }) => {
    // Listen for console messages
    page.on('console', msg => console.log(`BROWSER CONSOLE [${msg.type()}]:`, msg.text()));
    page.on('pageerror', err => console.error('BROWSER PAGE ERROR:', err.message));

    // 1. Go to login page
    await page.goto('/login');

    // 2. Fill credentials
    await page.locator('#identifier').fill('customer@happypaws.io');
    await page.locator('#password').fill('Password@1');

    // 3. Submit login
    await page.getByRole('button', { name: /log in/i }).click();

    // 4. Verify redirected to customer dashboard /my
    await page.waitForURL('**/my');
    await expect(page.getByRole('heading', { name: /my pets/i })).toBeVisible();

    // 5. Verify the prominent logout button is visible and contains "Log Out" text
    const logoutBtn = page.locator('#customer-logout-btn');
    await expect(logoutBtn).toBeVisible();
    await expect(logoutBtn).toContainText(/log out/i);
    
    // 6. Click logout button
    await logoutBtn.click();

    // 7. Verify redirected back to login page
    await page.waitForURL('**/login**');
    await expect(page.getByRole('heading', { name: /welcome to petiatrics/i })).toBeVisible();
  });
});
