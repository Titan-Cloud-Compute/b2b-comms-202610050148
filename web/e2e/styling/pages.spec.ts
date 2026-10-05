/**
 * Styling card — feature pages use the shared token-based page primitives
 * on desktop and mobile (no browser-default serif headings, no horizontal overflow).
 */
import { test, expect } from '@playwright/test';
import { mockApi, login } from '../spec/_support';

const PAGES = [
  'vendor/profile', 'admin/customers', 'channels', 'orders',
  'invoices', 'settings/notifications', 'admin/audit-log',
];
const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 390, height: 844 },
];

for (const vp of VIEWPORTS) {
  test.describe(`styling: pages (${vp.name})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test.beforeEach(async ({ page }) => {
      await mockApi(page);
      await login(page);
    });

    for (const path of PAGES) {
      test(`/${path} uses .page primitives`, async ({ page }) => {
        await page.goto(`/#/${path}`);
        const h1 = page.locator('.page .page-header h1');
        await expect(h1).toBeVisible();
        const font = await h1.evaluate(el => getComputedStyle(el).fontFamily);
        expect(font).not.toContain('Times');
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        );
        expect(overflow).toBeLessThanOrEqual(0);
      });
    }
  });
}
