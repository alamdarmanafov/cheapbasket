import { expect, test } from '@playwright/test';
import { mockBackend, onboardedOnly, signedIn } from './mock';

test.beforeEach(async ({ page }) => {
  await mockBackend(page);
});

test('without an account the tabs send you to sign in', async ({ page }) => {
  await onboardedOnly(page);
  await page.goto('/');
  await expect(page).toHaveURL(/\/auth/);
});

test('search → product → basket → compare names the cheapest store', async ({ page }) => {
  await signedIn(page);
  await page.goto('/');

  // The catalogue arrived: a search finds the milk.
  await page.getByPlaceholder('Məhsul axtar...').fill('süd');
  const row = page.getByText('Sütaş Süd 3.2%').first();
  await expect(row).toBeVisible();
  await row.click();

  // Product page (a stack screen, no tab bar): add to basket, then back to the tabs.
  await page.getByText('Səbətə əlavə et').first().click();
  await page.goBack();

  // Basket tab: the line is there, compare runs and names Araz (2.10 is the lowest).
  await page.getByRole('tab', { name: 'Səbət' }).click();
  await expect(page.getByText('Sütaş Süd 3.2%').first()).toBeVisible();
  await page.getByText('Qiymətləri müqayisə et').click();
  await expect(page.getByText('Ən sərfəli seçim')).toBeVisible();
  await expect(page.getByText('Araz').first()).toBeVisible();
});

test('a product priced at one store says so', async ({ page }) => {
  await signedIn(page);
  await page.goto('/');
  await page.getByPlaceholder('Məhsul axtar...').fill('yumurta');
  await expect(page.getByText('yalnız Araz')).toBeVisible();
});
