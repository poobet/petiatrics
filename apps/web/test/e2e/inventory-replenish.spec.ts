import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

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

test.describe('Inventory Replenish', () => {
  test.beforeEach(async ({ page, request }) => {
    await loginViaApi(page, request, OWNER_EMAIL, OWNER_PASSWORD);
  });

  test('renders product options without crashing', async ({ page }) => {
    await page.goto('/clinic/inventory/replenish');

    await expect(page.getByRole('heading', { name: /replenish stock/i })).toBeVisible();

    // Products load client-side after branch context resolves; wait for the request
    await page.waitForResponse('**/api/v1/inventory/products');

    const productSelect = page.locator('select[name="productId"]');
    await expect(productSelect).toBeVisible();
    await expect.poll(async () => productSelect.locator('option').count()).toBeGreaterThan(1);
  });
});