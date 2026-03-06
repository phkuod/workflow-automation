import { test, expect, request as playwrightRequest } from '@playwright/test';

// Run sequentially — later tests depend on state created by earlier ones
test.describe.configure({ mode: 'serial' });

const API = 'http://localhost:3001/api';
const WORKFLOW_NAME = 'Demo Workflow';

test.describe('Demo: Frontend & Backend Integration', () => {

  // Clean up any leftover "Demo Workflow" from previous runs
  test.beforeAll(async () => {
    const ctx = await playwrightRequest.newContext();
    const res = await ctx.get(`${API}/workflows`);
    const body = await res.json();
    const existing = body.data?.filter((w: { name: string }) => w.name === WORKFLOW_NAME) ?? [];
    for (const w of existing) {
      await ctx.delete(`${API}/workflows/${w.id}`);
    }
    await ctx.dispose();
  });

  test('1. Dashboard loads and connects to backend', async ({ page }) => {
    await page.goto('/');

    // Redirects to dashboard
    await expect(page).toHaveURL(/\/dashboard/);

    // Main title visible
    await expect(page.getByText('Workflow Automation')).toBeVisible();

    // Stat cards rendered — confirms backend responded
    await expect(page.locator('div.text-muted', { hasText: 'Total Workflows' })).toBeVisible();
    await expect(page.locator('div.text-muted', { hasText: 'Active' })).toBeVisible();
    await expect(page.locator('div.text-muted', { hasText: 'Paused' })).toBeVisible();
    await expect(page.locator('div.text-muted', { hasText: 'Draft' })).toBeVisible();
  });

  test('2. Create workflow → auto-navigates to editor', async ({ page }) => {
    await page.goto('/dashboard');

    // Open create modal
    await page.getByRole('button', { name: /new workflow/i }).click();
    await page.getByPlaceholder(/e\.g\., Daily Report Generator/i).fill(WORKFLOW_NAME);
    await page.getByPlaceholder(/What does this workflow do/i).fill('A demo workflow created by Playwright');
    await page.getByRole('button', { name: /^create$/i }).click();

    // App navigates to editor immediately after creation
    await expect(page).toHaveURL(/\/editor\//);
    await expect(page.getByText(WORKFLOW_NAME)).toBeVisible();
    await expect(page.getByRole('button', { name: /save/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /simulate/i })).toBeVisible();
  });

  test('3. Workflow appears in dashboard list', async ({ page }) => {
    await page.goto('/dashboard');

    // The workflow created in test 2 should be in the list
    const row = page.locator('tr', { hasText: WORKFLOW_NAME }).first();
    await expect(row).toBeVisible();

    // Click row to open editor
    await row.click();
    await expect(page).toHaveURL(/\/editor\//);
    await expect(page.getByText(WORKFLOW_NAME)).toBeVisible();
  });

  test('4. Monitoring page shows backend metrics', async ({ page }) => {
    await page.goto('/monitoring');

    await expect(page.getByText('System Monitoring')).toBeVisible();

    // Metric cards — exact labels from MonitoringPage.tsx
    await expect(page.getByText('Success Rate')).toBeVisible();
    await expect(page.getByText('Server Uptime')).toBeVisible();
    await expect(page.getByText('Active Schedules')).toBeVisible();
    await expect(page.getByText('Execution Trend')).toBeVisible();
  });

  test('5. Backend API responds correctly', async ({ request }) => {
    const response = await request.get(`${API}/workflows`);
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body).toHaveProperty('success', true);
    expect(Array.isArray(body.data)).toBeTruthy();

    // Workflow created in test 2 should be present
    const names = body.data.map((w: { name: string }) => w.name);
    expect(names).toContain(WORKFLOW_NAME);
  });

  test('6. Delete demo workflow (cleanup)', async ({ page }) => {
    await page.goto('/dashboard');

    const row = page.locator('tr', { hasText: WORKFLOW_NAME }).first();
    await expect(row).toBeVisible();

    // Click the last button in the row (trash / delete icon)
    await row.getByRole('button').last().click();

    // Confirm deletion dialog
    await page.getByRole('button', { name: /delete/i }).last().click();

    // Row should disappear
    await expect(page.locator('tr', { hasText: WORKFLOW_NAME })).not.toBeVisible();
  });

});
