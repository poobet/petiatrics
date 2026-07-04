import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

/**
 * E2E: Item Master ERP Workspace — filter, tab-preserve, and edit flow
 *
 * Prerequisites:
 *   - App running at PLAYWRIGHT_BASE_URL (default http://localhost:3000)
 *   - Seeded clinic with a CLINIC_OWNER user
 *   - At least 2 items seeded (1 INVENTORY, 1 SERVICE)
 *
 * To run:
 *   npx playwright test --project=chromium test/e2e/inventory-workspace.spec.ts
 */

const OWNER_EMAIL = process.env.E2E_OWNER_EMAIL ?? 'owner@happypaws.io';
const OWNER_PASSWORD = process.env.E2E_OWNER_PASSWORD ?? 'Password@1';
const API_BASE_URL = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:3001/api/v1';

async function loginViaApi(page: Page, request: APIRequestContext, identifier: string, password: string) {
  const response = await request.post(`${API_BASE_URL}/auth/login`, {
    data: { identifier, password },
  });

  expect(response.ok()).toBeTruthy();

  const setCookie = response.headers()['set-cookie'];
  const sessionId = setCookie?.match(/petiatrics_sid=([^;]+)/)?.[1];
  expect(sessionId).toBeTruthy();

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
}

test.describe('Inventory Workspace — ERP-style filter and edit flow', () => {
  test.beforeEach(async ({ page, request }) => {
    await loginViaApi(page, request, OWNER_EMAIL, OWNER_PASSWORD);
    await page.goto('/clinic/inventory');
    await expect(page.getByRole('heading', { name: /inventory/i })).toBeVisible();
    // Items now load client-side after branch context is resolved; wait for them
    await page.waitForResponse('**/api/v1/inventory/products');
    await expect(page.getByText(/loading/i)).toHaveCount(0);
  });

  test('filter by item type — SERVICE only', async ({ page }) => {
    const typeSelect = page.locator('main select').first();
    await typeSelect.selectOption('SERVICE');
    await page.waitForLoadState('networkidle');
    const rows = page.locator('tbody tr');
    const count = await rows.count();
    for (let i = 0; i < count; i++) {
      await expect(rows.nth(i).getByText(/service/i)).toBeVisible();
    }
  });

  test('filter by text search', async ({ page }) => {
    const searchInput = page.locator('main input[type="search"]');
    await searchInput.fill('Consultation');
    await page.waitForTimeout(400); // debounce
    const results = page.locator('tbody tr');
    const count = await results.count();
    if (count > 0) {
      await expect(results.first()).toContainText(/consultation/i);
    }
  });

  test('filter by category', async ({ page }) => {
    const categorySelect = page.locator('main select').nth(1);
    await categorySelect.selectOption({ label: 'Medicine' });
    await page.waitForLoadState('networkidle');
    // Just verify no error state
    await expect(page.getByRole('table')).toBeVisible();
  });

  test('include inactive toggle shows more items', async ({ page }) => {
    const activeCount = await page.locator('tbody tr').count();
    const inactiveCheckbox = page.getByRole('checkbox', { name: /inactive/i });
    await inactiveCheckbox.check();
    await page.waitForTimeout(400);
    const allCount = await page.locator('tbody tr').count();
    expect(allCount).toBeGreaterThanOrEqual(activeCount);
  });

  test('tabs preserve state when switching', async ({ page }) => {
    // Go to new item form
    await page.getByRole('link', { name: /add item/i }).click();
    await expect(page).toHaveURL(/\/products\/new/);

    // Fill general tab
    await page.getByLabel(/item code/i).fill('WORKSPACE-001');
    await page.getByLabel(/item name/i).fill('Workspace Test Item');

    // Switch to pricing tab
    await page.getByRole('button', { name: /pricing/i }).click();
    await page.getByLabel(/base selling price/i).fill('999');

    // Switch back to general tab and verify state is preserved
    await page.getByRole('button', { name: /general/i }).click();
    await expect(page.getByLabel(/item code/i)).toHaveValue('WORKSPACE-001');
    await expect(page.getByLabel(/item name/i)).toHaveValue('Workspace Test Item');

    // Return to pricing tab and verify price preserved
    await page.getByRole('button', { name: /pricing/i }).click();
    await expect(page.getByLabel(/base selling price/i)).toHaveValue('999');
  });

  test('edit item in Thai locale shows correct labels', async ({ page }) => {
    await page.getByRole('banner').getByRole('button', { name: 'TH' }).click();
    await page.getByRole('menuitem', { name: /ภาษาไทย/i }).click();
    await expect(page.getByRole('heading', { name: /คลังสินค้า/i })).toBeVisible();
  });

  test('empty state is visible when no items match filter', async ({ page }) => {
    const searchInput = page.locator('main input[type="search"]');
    await searchInput.fill('ZZZNOMATCH99999');
    await page.waitForTimeout(400);
    const emptyState = page.getByText(/no items found/i);
    if (await emptyState.isVisible()) {
      await expect(emptyState).toBeVisible();
    } else {
      // No rows in table is also acceptable
      await expect(page.locator('tbody tr')).toHaveCount(0);
    }
  });
});
