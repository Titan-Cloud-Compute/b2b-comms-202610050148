/**
 * Styling card — the seven story pages render inside the shared layout shell
 * (sidebar + top bar, main.main-content) and the sidebar shows Vendor / Customer nav groups.
 */
import { test, expect } from '@playwright/test';
import { mockApi, login } from '../spec/_support';

const PAGES: Array<[string, string]> = [
  ['vendor/profile', 'vendor-profile-screen'],
  ['admin/customers', 'admin-customers-screen'],
  ['channels', 'channels-screen'],
  ['orders', 'orders-screen'],
  ['invoices', 'invoices-screen'],
  ['settings/notifications', 'settings-notifications-screen'],
  ['admin/audit-log', 'admin-audit-log-screen'],
];

test.describe('styling: shared shell', () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page);
    await login(page);
  });

  for (const [path, testid] of PAGES) {
    test(`/${path} renders inside main.main-content`, async ({ page }) => {
      await page.goto(`/#/${path}`);
      await expect(page.locator(`main.main-content [data-testid="${testid}"]`)).toBeVisible();
      await expect(page.locator('aside.sidebar')).toHaveCount(1);
    });
  }

  test('sidebar shows Vendor and Customer groups, no Workspace group', async ({ page }) => {
    await page.goto('/#/channels');
    const labels = page.locator('.nav-group-label');
    await expect(labels.filter({ hasText: /^\s*Vendor\s*$/ })).toHaveCount(1);
    await expect(labels.filter({ hasText: /^\s*Customer\s*$/ })).toHaveCount(1);
    await expect(labels.filter({ hasText: /^\s*Workspace\s*$/ })).toHaveCount(0);
  });
});
