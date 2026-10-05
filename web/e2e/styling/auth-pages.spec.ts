/**
 * Styling card — auth pages (login/signup) and authenticated pages
 * (dashboard, settings, admin) use token-based styles, show required elements,
 * and have no horizontal overflow at mobile and desktop viewports.
 */
import { test, expect } from '@playwright/test';
import { mockApi, login } from '../spec/_support';

const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'desktop', width: 1280, height: 800 },
];

for (const vp of VIEWPORTS) {
  test.describe(`auth-pages styling (${vp.name})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test('/#/login shows #email and has no horizontal overflow', async ({ page }) => {
      await mockApi(page);
      await page.goto('/#/login');
      await expect(page.locator('#email')).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });

    test('/#/signup/1 shows #email and has no horizontal overflow', async ({ page }) => {
      await mockApi(page);
      await page.goto('/#/signup/1');
      await expect(page.locator('#email')).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });

    test('/#/dashboard renders inside main.main-content after login', async ({ page }) => {
      await mockApi(page);
      await login(page);
      await page.goto('/#/dashboard');
      await expect(page.locator('main.main-content')).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });

    test('/#/settings renders inside main.main-content after login', async ({ page }) => {
      await mockApi(page);
      await login(page);
      await page.goto('/#/settings');
      await expect(page.locator('main.main-content')).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });

    test('/#/admin renders inside main.main-content after login', async ({ page }) => {
      await mockApi(page);
      await login(page);
      await page.goto('/#/admin');
      await expect(page.locator('main.main-content')).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  });
}
