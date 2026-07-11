import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

const OWNER_EMAIL = process.env.E2E_OWNER_EMAIL ?? 'owner@happypaws.io';
const OWNER_PASSWORD = process.env.E2E_OWNER_PASSWORD ?? 'Password@1';
const API_BASE_URL = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:3001/api/v1';

async function loginAndCreateSupplier(page: Page, request: APIRequestContext) {
  // 1. Login
  const loginRes = await request.post(`${API_BASE_URL}/auth/login`, {
    data: { identifier: OWNER_EMAIL, password: OWNER_PASSWORD },
  });
  expect(loginRes.ok()).toBeTruthy();
  const setCookie = loginRes.headers()['set-cookie'];
  const sessionId = setCookie?.match(/petiatrics_sid=([^;]+)/)?.[1];
  expect(sessionId).toBeTruthy();

  // Add cookie to browser page context
  await page.context().addCookies([
    {
      name: 'petiatrics_sid',
      value: sessionId!,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Strict',
    },
  ]);

  // 2. Create supplier BusinessPartner via API
  const bpRes = await request.post(`${API_BASE_URL}/clinic/business-partners`, {
    headers: {
      'cookie': `petiatrics_sid=${sessionId}`,
    },
    data: {
      type: 'SUPPLIER',
      name: 'Alpha Supplier',
    },
  });
  expect(bpRes.ok()).toBeTruthy();
}

test.describe('Document Sequencing — Branch Scoping Walkthrough', () => {
  test('should configure branch scoping and verify independent sequencing per branch', async ({ page, request }) => {
    // Log in and create supplier
    await loginAndCreateSupplier(page, request);

    // Go to Document Sequence settings
    await page.goto('/clinic/settings/document-sequence');
    await page.waitForSelector('text=Sequence Overrides');

    // Customize Purchase Order row to be Branch-scoped
    const row = page.locator('tr').filter({ hasText: 'Purchase Order' });
    await row.getByRole('button', { name: /customize/i }).click();

    // Fill custom template and scope
    await page.locator('#configTemplate').fill('PO-{branchCode}-{yyyy}-{number:4}');
    
    // Select "BRANCH" scope
    await page.locator('#configScope').click();
    await page.getByRole('option', { name: /per-branch/i }).click();

    // Save sequence config
    await page.getByRole('button', { name: 'Save Sequence Config' }).click();

    // Verify it saved and now shows in the table
    await expect(page.locator('tr').filter({ hasText: 'Purchase Order' }).getByText('Branch-Scoped')).toBeVisible();
    await expect(page.locator('tr').filter({ hasText: 'Purchase Order' }).getByText('PO-{branchCode}-{yyyy}-{number:4}')).toBeVisible();

    // Navigate to Procurement page
    await page.goto('/clinic/procurement');
    await page.waitForSelector('text=Procurement');

    // Ensure we select "Main Branch"
    await page.locator('button:has(.text-blue-500)').first().click(); // MapPin trigger
    await page.getByRole('menuitem', { name: /main branch/i }).click();

    // Create PO on Main Branch
    await page.getByRole('button', { name: /new purchase order/i }).click();
    await page.locator('form select').first().selectOption({ label: 'Alpha Supplier' }); // select seeded supplier
    await page.getByRole('button', { name: /\+ add item/i }).click();
    await page.locator('form select').nth(1).selectOption({ index: 1 }); // select product
    await page.locator('form input[type="number"]').nth(1).fill('5'); // Qty
    await page.locator('form input[step="0.01"]').fill('120.00'); // Price
    await page.getByRole('button', { name: 'Save Purchase Order' }).click();

    // Verify PO code contains MAIN prefix and counter starts at 1
    const currentYear = new Date().getFullYear();
    const expectedMainCode = `PO-MAIN-${currentYear}-0001`;
    await expect(page.getByText(expectedMainCode)).toBeVisible();

    // Switch active branch to "North Branch"
    await page.locator('button:has(.text-blue-500)').first().click(); // MapPin trigger
    await page.getByRole('menuitem', { name: /north branch/i }).click();

    // Create PO on North Branch
    await page.getByRole('button', { name: /new purchase order/i }).click();
    await page.locator('form select').first().selectOption({ label: 'Alpha Supplier' }); // select seeded supplier
    await page.getByRole('button', { name: /\+ add item/i }).click();
    await page.locator('form select').nth(1).selectOption({ index: 1 }); // select product
    await page.locator('form input[type="number"]').nth(1).fill('2'); // Qty
    await page.locator('form input[step="0.01"]').fill('95.50'); // Price
    await page.getByRole('button', { name: 'Save Purchase Order' }).click();

    // Verify PO code contains NORTH prefix and resets to 1
    const expectedNorthCode = `PO-NORTH-${currentYear}-0001`;
    await expect(page.getByText(expectedNorthCode)).toBeVisible();
  });
});
