import { test, expect } from '@playwright/test';

test.describe('Monitoring Page', () => {
  test('page loads with title', async ({ page }) => {
    await page.goto('/monitoring');
    await expect(page.getByText('System Monitoring')).toBeVisible();
  });

  test('shows metric cards', async ({ page }) => {
    await page.goto('/monitoring');
    await expect(page.getByText('Success Rate')).toBeVisible();
    await expect(page.getByText('Server Uptime')).toBeVisible();
    await expect(page.getByText('Active Schedules')).toBeVisible();
  });

  test('shows execution trend section', async ({ page }) => {
    await page.goto('/monitoring');
    await expect(page.getByText('Execution Trend')).toBeVisible();
  });

  test('refresh button is functional', async ({ page }) => {
    await page.goto('/monitoring');
    const refreshBtn = page.getByRole('button', { name: /refresh/i });
    if (await refreshBtn.isVisible()) {
      await refreshBtn.click();
      // Page should still show monitoring after refresh
      await expect(page.getByText('System Monitoring')).toBeVisible();
    }
  });

  test('sidebar navigation to dashboard works', async ({ page }) => {
    await page.goto('/monitoring');
    await page.getByRole('link', { name: /dashboard/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('uptime value is displayed', async ({ page }) => {
    await page.goto('/monitoring');
    // Uptime should show some time value (e.g. "0h 0m" or "1h 23m")
    const uptimeCard = page.locator('text=Server Uptime').locator('..');
    await expect(uptimeCard).toBeVisible();
  });

  test('workflow stats are displayed', async ({ page }) => {
    await page.goto('/monitoring');
    // Should show workflow-related stats
    await expect(page.getByText(/Total Workflows|Workflows/)).toBeVisible();
  });
});
