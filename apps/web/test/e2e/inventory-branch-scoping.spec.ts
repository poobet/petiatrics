import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

/**
 * E2E: Branch-Scoped Inventory Regression
 *
 * Verifies that:
 *   1. The inventory page blocks (shows warning) when no active branch is set.
 *   2. Products API call carries the x-active-branch header from the active branch.
 *   3. The replenish page blocks when no active branch is set.
 *   4. Switching the active branch triggers a fresh product reload.
 *
 * Prerequisites:
 *   - App running at PLAYWRIGHT_BASE_URL (default http://localhost:3000)
 *   - Seeded clinic with CLINIC_OWNER user
 *   - Clinic has at least 2 branches configured
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

test.describe('Inventory — Branch Scoping', () => {
  test('shows "select a branch" warning when no active branch is set', async ({ page, request }) => {
    await loginViaApi(page, request, OWNER_EMAIL, OWNER_PASSWORD);

    // Intercept /auth/me to return a user with NO branches so Zustand won't auto-set one
    await page.route('**/api/v1/auth/me', async (route) => {
      const response = await route.fetch();
      const json = await response.json();
      json.data = { ...json.data, branches: [] };
      await route.fulfill({ json });
    });

    await page.goto('/clinic/inventory');
    await expect(page.getByText(/select a branch/i)).toBeVisible();
  });

  test('replenish page shows "select a branch" warning when no active branch', async ({ page, request }) => {
    await loginViaApi(page, request, OWNER_EMAIL, OWNER_PASSWORD);

    await page.route('**/api/v1/auth/me', async (route) => {
      const response = await route.fetch();
      const json = await response.json();
      json.data = { ...json.data, branches: [] };
      await route.fulfill({ json });
    });

    await page.goto('/clinic/inventory/replenish');
    await expect(page.getByText(/select a branch/i)).toBeVisible();
  });

  test('products request carries x-active-branch header', async ({ page, request }) => {
    await loginViaApi(page, request, OWNER_EMAIL, OWNER_PASSWORD);

    let capturedBranchHeader: string | null = null;

    // Capture the branch header from the products API call
    await page.route('**/api/v1/inventory/products', async (route) => {
      capturedBranchHeader = route.request().headers()['x-active-branch'] ?? null;
      await route.continue();
    });

    await page.goto('/clinic/inventory');
    // Wait for the request to fire (items load async)
    await page.waitForResponse('**/api/v1/inventory/products');

    expect(capturedBranchHeader).not.toBeNull();
    expect(capturedBranchHeader!.length).toBeGreaterThan(0);
  });

  test('items reload when active branch changes', async ({ page, request }) => {
    await loginViaApi(page, request, OWNER_EMAIL, OWNER_PASSWORD);
    await page.goto('/clinic/inventory');

    // Wait for initial items load
    await page.waitForResponse('**/api/v1/inventory/products');
    await expect(page.getByText(/loading/i)).toHaveCount(0);

    // Track how many times the products endpoint is called
    let loadCount = 0;
    await page.route('**/api/v1/inventory/products', (route) => {
      loadCount++;
      void route.continue();
    });

    // Click the branch selector and pick a different branch (if available)
    const branchSelector = page.locator('[data-testid="branch-selector"]');
    if (await branchSelector.isVisible()) {
      const options = branchSelector.locator('button, [role="option"]');
      if (await options.count() > 1) {
        await options.nth(1).click();
        await page.waitForResponse('**/api/v1/inventory/products');
        expect(loadCount).toBeGreaterThan(0);
      }
    }
    // If only one branch, verify the page shows branch name in subtitle
    await expect(page.locator('text=Branch:')).toBeVisible();
  });
});
