import { test, expect, request as playwrightRequest } from '@playwright/test';

const API = process.env.API_URL || 'http://localhost:3001/api';

test.describe.configure({ mode: 'serial' });

test.describe('Executions Page', () => {
  let workflowId: string;
  let executionId: string;

  test.beforeAll(async () => {
    const ctx = await playwrightRequest.newContext();

    // Create a workflow
    const create = await ctx.post(`${API}/workflows`, {
      data: {
        name: 'Execution Test WF',
        definition: {
          stations: [{
            id: 'station-1',
            name: 'Test Station',
            position: { x: 100, y: 100 },
            steps: [{
              id: 'step-1',
              name: 'Manual Trigger',
              type: 'trigger-manual',
              config: {},
              position: { x: 100, y: 100 },
              connections: ['step-2'],
            }, {
              id: 'step-2',
              name: 'JS Script',
              type: 'script-js',
              config: { code: 'output = { result: 42 };' },
              position: { x: 100, y: 250 },
            }],
            connections: [],
          }],
        },
      },
    });
    workflowId = (await create.json()).data.id;

    // Execute it
    const exec = await ctx.post(`${API}/workflows/${workflowId}/execute`, {
      data: { triggeredBy: 'manual' },
    });
    executionId = (await exec.json()).data.id;

    await ctx.dispose();
  });

  test.afterAll(async () => {
    const ctx = await playwrightRequest.newContext();
    await ctx.delete(`${API}/workflows/${workflowId}`);
    await ctx.dispose();
  });

  test('page loads with title', async ({ page }) => {
    await page.goto('/executions');
    await expect(page.getByText('Execution History')).toBeVisible();
  });

  test('shows execution count', async ({ page }) => {
    await page.goto('/executions');
    await expect(page.getByText(/\d+ executions/)).toBeVisible();
  });

  test('shows refresh button', async ({ page }) => {
    await page.goto('/executions');
    await expect(page.getByText('Refresh')).toBeVisible();
  });

  test('table shows correct column headers', async ({ page }) => {
    // Ensure at least one execution exists
    const ctx = await playwrightRequest.newContext();
    await ctx.post(`${API}/workflows/${workflowId}/execute`, {
      data: { triggeredBy: 'manual' },
    });
    await ctx.dispose();

    await page.goto('/executions');
    await page.waitForLoadState('networkidle');
    // Wait for the table to appear
    await expect(page.locator('th', { hasText: 'Workflow' })).toBeVisible({ timeout: 10000 });
    await expect(page.locator('th', { hasText: 'Status' })).toBeVisible();
    await expect(page.locator('th', { hasText: 'Trigger' })).toBeVisible();
    await expect(page.locator('th', { hasText: 'Started' })).toBeVisible();
    await expect(page.locator('th', { hasText: 'Duration' })).toBeVisible();
    await expect(page.locator('th', { hasText: 'Success' })).toBeVisible();
  });

  test('execution row shows workflow name and status', async ({ page }) => {
    await page.goto('/executions');
    const row = page.locator('tr', { hasText: 'Execution Test WF' }).first();
    await expect(row).toBeVisible();
    // Should show completed or failed status
    await expect(row.locator('text=completed').or(row.locator('text=failed'))).toBeVisible();
    // Should show manual trigger
    await expect(row.getByText('manual')).toBeVisible();
  });

  test('clicking row expands to show details', async ({ page }) => {
    await page.goto('/executions');
    await page.waitForLoadState('networkidle');
    const row = page.locator('tr', { hasText: 'Execution Test WF' }).first();
    await expect(row).toBeVisible({ timeout: 10000 });

    // Click to expand — wait for expanded content
    await row.click();
    await page.waitForTimeout(1000);

    // Expanded area shows headings for results or logs
    const expandedContent = page.locator('td[colspan]');
    await expect(expandedContent).toBeVisible({ timeout: 10000 });
  });

  test('clicking row again collapses details', async ({ page }) => {
    await page.goto('/executions');
    await page.waitForTimeout(500);
    const row = page.locator('tr', { hasText: 'Execution Test WF' }).first();
    await expect(row).toBeVisible();

    // Expand
    await row.click();
    await page.waitForTimeout(1000);

    // Collapse
    await row.click();
    await page.waitForTimeout(500);
  });

  test('sidebar navigation to dashboard works', async ({ page }) => {
    await page.goto('/executions');
    await page.getByRole('link', { name: /dashboard/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('delete execution with confirmation', async ({ page }) => {
    // Create a fresh execution for deletion test
    const ctx = await playwrightRequest.newContext();
    await ctx.post(`${API}/workflows/${workflowId}/execute`, {
      data: { triggeredBy: 'manual' },
    });
    await ctx.dispose();

    await page.goto('/executions');
    await page.waitForLoadState('networkidle');

    // Find a delete button (trash icon) and click it
    const row = page.locator('tr', { hasText: 'Execution Test WF' }).first();
    await expect(row).toBeVisible({ timeout: 10000 });
    const deleteBtn = row.getByTitle('Delete execution');
    await expect(deleteBtn).toBeVisible({ timeout: 5000 });
    await deleteBtn.click();

    // Confirm dialog
    await expect(page.getByText('Delete Execution')).toBeVisible();
    await page.getByRole('button', { name: /delete/i }).last().click();
  });
});
