import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

/**
 * E2E: Business Partner management flow
 *
 * Prerequisites:
 *   - App running at PLAYWRIGHT_BASE_URL (default http://localhost:3000)
 *   - Seeded clinic with a CLINIC_OWNER user (test credentials below)
 *   - Seeded clinic with a VET-role user (read-only check)
 *
 * To run:
 *   npx playwright test --project=chromium test/e2e/business-partners.spec.ts
 */

const OWNER_EMAIL = process.env.E2E_OWNER_EMAIL ?? 'owner@happypaws.io';
const OWNER_PASSWORD = process.env.E2E_OWNER_PASSWORD ?? 'Password@1';
const VET_EMAIL = process.env.E2E_VET_EMAIL ?? 'vet@happypaws.io';
const VET_PASSWORD = process.env.E2E_VET_PASSWORD ?? 'Password@1';
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

test.describe('Business Partners — CLINIC_OWNER', () => {
  test.beforeEach(async ({ page, request }) => {
    await loginViaApi(page, request, OWNER_EMAIL, OWNER_PASSWORD);
  });

  test('navigates to business partners page', async ({ page }) => {
    await page.goto('/clinic/business-partners');
    await expect(page.getByRole('heading', { name: /business partners/i })).toBeVisible();
  });

  test('creates a CUSTOMER business partner', async ({ page }) => {
    await page.goto('/clinic/business-partners');
    await page.getByRole('button', { name: /add business partner/i }).click();
    await page.waitForURL('**/business-partners/new');

    // Select type via shadcn/Radix combobox
    await page.getByRole('combobox').click();
    await page.getByRole('option', { name: 'Customer' }).click();

    await page.getByPlaceholder('Business Partner Name').fill('Acme Pet Supplies');
    await page.getByRole('button', { name: /save/i }).click();
    await page.waitForURL('**/clinic/business-partners');

    await expect(page.getByText('Acme Pet Supplies').first()).toBeVisible();
  });

  test('creates a VET business partner with license', async ({ page }) => {
    await page.goto('/clinic/business-partners');
    await page.getByRole('button', { name: /add business partner/i }).click();
    await page.waitForURL('**/business-partners/new');

    // Select VET type via shadcn/Radix combobox
    await page.getByRole('combobox').click();
    await page.getByRole('option', { name: 'Veterinarian' }).click();

    await expect(page.getByTestId('vet-fields')).toBeVisible();
    const uniqueId = Date.now().toString().slice(-6);
    await page.getByPlaceholder('Business Partner Name').fill(`Dr. Sarah ${uniqueId}`);
    await page.getByPlaceholder('VET-0001').fill(`VET-${uniqueId}`);
    await page.getByRole('button', { name: /save/i }).click();
    await page.waitForURL('**/clinic/business-partners');

    await expect(page.getByText(`Dr. Sarah ${uniqueId}`).first()).toBeVisible();
  });

  test('creates a SUPPLIER business partner with tax ID', async ({ page }) => {
    await page.goto('/clinic/business-partners');
    await page.getByRole('button', { name: /add business partner/i }).click();
    await page.waitForURL('**/business-partners/new');

    // Select Supplier type via shadcn/Radix combobox
    await page.getByRole('combobox').click();
    await page.getByRole('option', { name: 'Supplier' }).click();

    await page.getByPlaceholder('Business Partner Name').fill('Pharma Co');

    // Tax ID is in the Tax & Address tab
    await page.getByRole('tab', { name: /tax/i }).click();
    await page.getByLabel(/tax id/i).fill('0105562000000');

    // Credit Term Days is in the Financials tab
    await page.getByRole('tab', { name: /financials/i }).click();
    await page.getByLabel(/credit term/i).fill('30');

    await page.getByRole('button', { name: /save/i }).click();
    await page.waitForURL('**/clinic/business-partners');

    await expect(page.getByText('Pharma Co').first()).toBeVisible();
  });

  test('deactivates a business partner', async ({ page }) => {
    // Create a dedicated BP for this test to avoid dependency on other tests
    await page.goto('/clinic/business-partners');
    await page.getByRole('button', { name: /add business partner/i }).click();
    await page.waitForURL('**/business-partners/new');
    await page.getByRole('combobox').click();
    await page.getByRole('option', { name: 'Customer' }).click();
    await page.getByPlaceholder('Business Partner Name').fill('Deactivate Test Co');
    await page.getByRole('button', { name: /save/i }).click();
    await page.waitForURL('**/clinic/business-partners');

    const row = page.getByRole('row', { name: /Deactivate Test Co/i });
    await expect(row.first()).toBeVisible();
    await row.first().getByRole('button', { name: /actions/i }).click();
    await page.getByRole('menuitem', { name: /deactivate/i }).click();

    // After deactivation the active list should not show this BP
    await expect(page.getByRole('row', { name: /Deactivate Test Co/i })).toHaveCount(0);
  });
});

test.describe('Business Partners — VET (read-only)', () => {
  test.beforeEach(async ({ page, request }) => {
    await loginViaApi(page, request, VET_EMAIL, VET_PASSWORD);
  });

  test('cannot see Add Business Partner button', async ({ page }) => {
    await page.goto('/clinic/business-partners');
    await expect(
      page.getByRole('button', { name: /add business partner/i }),
    ).toHaveCount(0);
  });
});
