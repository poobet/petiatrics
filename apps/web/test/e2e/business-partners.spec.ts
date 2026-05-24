import { test, expect } from '@playwright/test';

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

const OWNER_EMAIL = process.env.E2E_OWNER_EMAIL ?? 'owner@test.clinic';
const OWNER_PASSWORD = process.env.E2E_OWNER_PASSWORD ?? 'OwnerP@ss1';
const VET_EMAIL = process.env.E2E_VET_EMAIL ?? 'vet@test.clinic';
const VET_PASSWORD = process.env.E2E_VET_PASSWORD ?? 'VetP@ss1';

test.describe('Business Partners — CLINIC_OWNER', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.locator('#identifier').fill(OWNER_EMAIL);
    await page.locator('#password').fill(OWNER_PASSWORD);
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/clinic\/dashboard/);
  });

  test('navigates to business partners page', async ({ page }) => {
    await page.getByRole('link', { name: /business partners/i }).click();
    await expect(page).toHaveURL(/\/clinic\/business-partners/);
    await expect(page.getByRole('heading', { name: /business partners/i })).toBeVisible();
  });

  test('creates a CUSTOMER business partner', async ({ page }) => {
    await page.goto('/clinic/business-partners');
    await page.getByRole('button', { name: /add business partner/i }).click();

    await page.getByLabel(/name/i).fill('Acme Pet Supplies');
    await page.getByRole('combobox').selectOption('CUSTOMER');
    await page.getByRole('button', { name: /save/i }).click();

    await expect(page.getByText('Acme Pet Supplies')).toBeVisible();
  });

  test('creates a VET business partner with license', async ({ page }) => {
    await page.goto('/clinic/business-partners');
    await page.getByRole('button', { name: /add business partner/i }).click();

    await page.getByLabel(/name/i).fill('Dr. Sarah');
    await page.getByRole('combobox').selectOption('VET');
    await expect(page.getByTestId('vet-fields')).toBeVisible();
    await page.getByLabel(/veterinary license/i).fill('VET-0042');
    await page.getByRole('button', { name: /save/i }).click();

    await expect(page.getByText('Dr. Sarah')).toBeVisible();
  });

  test('creates a SUPPLIER business partner with tax ID', async ({ page }) => {
    await page.goto('/clinic/business-partners');
    await page.getByRole('button', { name: /add business partner/i }).click();

    await page.getByLabel(/name/i).fill('Pharma Co');
    await page.getByRole('combobox').selectOption('SUPPLIER');
    await expect(page.getByTestId('supplier-fields')).toBeVisible();
    await page.getByLabel(/tax id/i).fill('0105562000000');
    await page.getByLabel(/credit term/i).fill('30');
    await page.getByRole('button', { name: /save/i }).click();

    await expect(page.getByText('Pharma Co')).toBeVisible();
  });

  test('deactivates a business partner', async ({ page }) => {
    await page.goto('/clinic/business-partners');
    // Assumes 'Acme Pet Supplies' exists from prior test or seed
    const row = page.getByRole('row', { name: /Acme Pet Supplies/i });
    await row.getByRole('button').click();
    await page.getByRole('menuitem', { name: /deactivate/i }).click();

    // After deactivation it should either disappear (active-only view) or show as Inactive
    await expect(row).toHaveCount(0);
  });
});

test.describe('Business Partners — VET (read-only)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.locator('#identifier').fill(VET_EMAIL);
    await page.locator('#password').fill(VET_PASSWORD);
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/clinic\/dashboard/);
  });

  test('cannot see Add Business Partner button', async ({ page }) => {
    await page.goto('/clinic/business-partners');
    await expect(
      page.getByRole('button', { name: /add business partner/i }),
    ).toHaveCount(0);
  });
});
