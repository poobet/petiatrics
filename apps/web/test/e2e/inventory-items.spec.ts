import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

/**
 * E2E: Item Master — Clinic Item create/edit/deactivate flow
 *
 * Prerequisites:
 *   - App running at PLAYWRIGHT_BASE_URL (default http://localhost:3000)
 *   - Seeded clinic with a CLINIC_OWNER user (test credentials below)
 *   - Seeded clinic with a VET-role user (read-only check)
 *   - ItemCategory and UnitOfMeasure reference data seeded
 *
 * To run:
 *   npx playwright test --project=chromium test/e2e/inventory-items.spec.ts
 */

const OWNER_EMAIL = process.env.E2E_OWNER_EMAIL ?? 'owner@happypaws.io';
const OWNER_PASSWORD = process.env.E2E_OWNER_PASSWORD ?? 'Password@1';
const VET_EMAIL = process.env.E2E_VET_EMAIL ?? 'vet@happypaws.io';
const VET_PASSWORD = process.env.E2E_VET_PASSWORD ?? 'Password@1';
const SEEDED_STOCKED_CODE = 'VAX-001';
const SEEDED_STOCKED_NAME = 'Rabies Vaccine';
const API_BASE_URL = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:3001/api/v1';

function uniqueSuffix() {
  return Date.now().toString().slice(-6);
}

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

test.describe('Inventory Items — CLINIC_OWNER', () => {
  test.beforeEach(async ({ page, request }) => {
    await loginViaApi(page, request, OWNER_EMAIL, OWNER_PASSWORD);
  });

  test('navigates to inventory page', async ({ page }) => {
    await page.goto('/clinic/inventory');
    await expect(page.getByRole('heading', { name: /inventory/i })).toBeVisible();
  });

  test('creates a stocked-good item', async ({ page }) => {
    const suffix = uniqueSuffix();
    const itemCode = `E2E-DRUG-${suffix}`;
    const itemName = `E2E Test Drug ${suffix}`;

    await page.goto('/clinic/inventory/products/new');
    await expect(page.getByRole('heading', { name: /add item/i })).toBeVisible();

    // General tab: fill mandatory fields
    await page.getByLabel(/item code/i).fill(itemCode);
    await page.getByLabel(/item name/i).fill(itemName);
    await page.getByLabel(/stocked good/i).check();

    // Category selector
    const categorySelect = page.getByLabel(/category/i);
    await categorySelect.selectOption({ label: 'Medicine' });

    // Units tab: base unit
    await page.getByRole('button', { name: /units/i }).click();
    const baseUnitSelect = page.getByLabel(/base unit/i);
    await baseUnitSelect.selectOption({ label: 'Piece (pc)' });

    // Pricing tab
    await page.getByRole('button', { name: /pricing/i }).click();
    await page.getByLabel(/standard cost/i).fill('100');
    await page.getByLabel(/base selling price/i).fill('180');

    // Save
    await page.getByRole('button', { name: /create item/i }).click();
    await expect(page).toHaveURL(/\/clinic\/inventory/);
    await expect(page.locator('tbody tr').filter({ hasText: itemCode })).toContainText(itemName);
  });

  test('creates a service item', async ({ page }) => {
    const suffix = uniqueSuffix();
    const itemCode = `E2E-SVC-${suffix}`;
    const itemName = `E2E Consultation ${suffix}`;

    await page.goto('/clinic/inventory/products/new');

    await page.getByLabel(/item code/i).fill(itemCode);
    await page.getByLabel(/item name/i).fill(itemName);
    await page.getByLabel(/service/i).check();

    const categorySelect = page.getByLabel(/category/i);
    await categorySelect.selectOption({ label: 'Consultation' });

    await page.getByRole('button', { name: /units/i }).click();
    const baseUnitSelect = page.getByLabel(/base unit/i);
    await baseUnitSelect.selectOption({ label: 'Visit (visit)' });

    await page.getByRole('button', { name: /pricing/i }).click();
    await page.getByLabel(/standard cost/i).fill('0');
    await page.getByLabel(/base selling price/i).fill('500');

    await page.getByRole('button', { name: /create item/i }).click();
    await expect(page).toHaveURL(/\/clinic\/inventory/);
    await expect(page.locator('tbody tr').filter({ hasText: itemCode })).toContainText(itemName);
  });

  test('edits an existing item', async ({ page }) => {
    const editedName = `${SEEDED_STOCKED_NAME} Edited ${uniqueSuffix()}`;

    await page.goto('/clinic/inventory');
    const row = page.locator('tbody tr').filter({ hasText: SEEDED_STOCKED_CODE }).first();
    await row.getByRole('link', { name: /edit/i }).click();
    await expect(page.getByRole('heading', { name: /edit item/i })).toBeVisible();
    await expect(page.getByLabel(/item name/i)).toHaveValue(/.+/);

    await page.getByLabel(/item name/i).fill(editedName);
    await page.getByRole('button', { name: /save changes/i }).click();
    await expect(page).toHaveURL(/\/clinic\/inventory/);
    await expect(page.locator('tbody tr').filter({ hasText: SEEDED_STOCKED_CODE })).toContainText(editedName);
  });

  test('deactivates an item', async ({ page }) => {
    await page.goto('/clinic/inventory');
    const rows = page.locator('tbody tr');
    const before = await rows.count();
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: /deactivate/i }).first().click();
    await expect(rows).toHaveCount(before - 1);
  });
});

test.describe('Inventory Items — VET (read-only)', () => {
  test.beforeEach(async ({ page, request }) => {
    await loginViaApi(page, request, VET_EMAIL, VET_PASSWORD);
  });

  test('can view inventory list', async ({ page }) => {
    await page.goto('/clinic/inventory');
    await expect(page.getByRole('heading', { name: /inventory/i })).toBeVisible();
  });

  test('new item page redirects or is inaccessible to VET', async ({ page }) => {
    const response = await page.goto('/clinic/inventory/products/new');
    const status = response?.status() ?? 200;
    const saveButton = page.getByRole('button', { name: /create item/i });
    if (await saveButton.isVisible().catch(() => false)) {
      await expect(saveButton).toBeDisabled();
      return;
    }
    const isRedirected = page.url().includes('/clinic/inventory') && !page.url().includes('/new');
    expect(isRedirected || status === 403).toBeTruthy();
  });
});
