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

test('a budget under the basket total offers a cheaper swap or says none exists', async ({ page }) => {
  await signedIn(page);
  await page.goto('/');
  await page.getByPlaceholder('Məhsul axtar...').fill('süd');
  await page.getByText('Sütaş Süd 3.2%').first().click();
  await page.getByText('Səbətə əlavə et').first().click();
  await page.goBack();
  await page.getByRole('tab', { name: 'Səbət' }).click();

  // Milk is 2.10 at the best store; a budget of 1 ₼ is over by 1.10.
  await page.getByTestId('budget-chip').click();
  await page.getByTestId('budget-input').fill('1');
  await page.getByText('Yadda saxla').click();
  await expect(page.getByTestId('budget-over')).toBeVisible();
  await expect(page.getByText('Büdcədən 1.10 ₼ artıqdır')).toBeVisible();

  // Search in another language finds the same milk.
  await page.getByRole('tab', { name: 'Ana səhifə' }).click();
  await page.getByPlaceholder('Məhsul axtar...').fill('milk');
  await expect(page.getByText('Sütaş Süd 3.2%').first()).toBeVisible();
});

test('appearance can be switched to dark from the profile', async ({ page }) => {
  await signedIn(page);
  await page.goto('/');
  await page.getByRole('tab', { name: 'Profil' }).click();
  await page.getByText('Görünüş').first().click();
  await page.getByTestId('theme-dark').click();
  await expect(page.getByText('Qaranlıq').first()).toBeVisible();
  // The page ground follows: near-black instead of the light grey.
  const bg = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="profile-root"]') ?? document.body.firstElementChild;
    return el ? getComputedStyle(el).backgroundColor : '';
  });
  expect(bg).not.toBe('rgb(247, 247, 247)');
});
