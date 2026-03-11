import { test, expect, request as playwrightRequest } from '@playwright/test';

const API = process.env.API_URL || 'http://localhost:3002/api';

/**
 * Full end-to-end workflow scenario:
 * Dashboard → Create → Editor → Add Steps → Save → Simulate → Execute → Executions → Delete
 */
test.describe('Full Workflow E2E Scenario', () => {
  test.describe.configure({ mode: 'serial' });

  const WF_NAME = `E2E Full Test ${Date.now()}`;
  let workflowId: string;

  // Cleanup any leftovers
  test.afterAll(async () => {
    const ctx = await playwrightRequest.newContext();
    const list = await ctx.get(`${API}/workflows`);
    const wfs = (await list.json()).data || [];
    for (const wf of wfs) {
      if (wf.name === WF_NAME) {
        await ctx.delete(`${API}/workflows/${wf.id}`);
      }
    }
    await ctx.dispose();
  });

  test('1. Create workflow from dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /new workflow/i }).click();

    await page.getByPlaceholder(/Daily Report Generator/i).fill(WF_NAME);
    await page.getByPlaceholder(/What does this workflow do/i).fill('Full E2E test workflow');
    await page.getByRole('button', { name: /^create$/i }).click();

    // Should navigate to editor
    await expect(page).toHaveURL(/\/editor\//, { timeout: 10000 });
    await expect(page.getByText(WF_NAME)).toBeVisible({ timeout: 10000 });

    // Extract workflow ID from URL
    const url = page.url();
    workflowId = url.split('/editor/')[1];
    expect(workflowId).toBeTruthy();
  });

  test('2. Editor shows stage view with empty canvas', async ({ page }) => {
    await page.goto(`/editor/${workflowId}`);
    await expect(page.getByText('Stage View')).toBeVisible();
    await expect(page.getByText(WF_NAME)).toBeVisible();
  });

  test('3. Add a stage via API then verify in editor', async ({ page }) => {
    // Use API to add a complete station with steps
    const ctx = await playwrightRequest.newContext();
    await ctx.put(`${API}/workflows/${workflowId}`, {
      data: {
        definition: {
          stations: [{
            id: 'station-e2e',
            name: 'E2E Stage',
            position: { x: 200, y: 200 },
            steps: [
              {
                id: 'step-trigger',
                name: 'Manual Trigger',
                type: 'trigger-manual',
                config: {},
                position: { x: 100, y: 100 },
                connections: ['step-script'],
              },
              {
                id: 'step-script',
                name: 'Compute',
                type: 'script-js',
                config: { code: 'output = { message: "E2E works!", value: 42 };' },
                position: { x: 100, y: 250 },
                connections: ['step-var'],
              },
              {
                id: 'step-var',
                name: 'Set Result',
                type: 'set-variable',
                config: { variableName: 'result', value: 'done' },
                position: { x: 100, y: 400 },
              },
            ],
            connections: [],
          }],
        },
      },
    });
    await ctx.dispose();

    // Verify in editor
    await page.goto(`/editor/${workflowId}`);
    await expect(page.getByText('E2E Stage')).toBeVisible();
  });

  test('4. Save workflow', async ({ page }) => {
    await page.goto(`/editor/${workflowId}`);
    await page.getByText('Save', { exact: false }).click();
    await expect(page.getByText('Workflow saved')).toBeVisible();
  });

  test('5. Simulate workflow', async ({ page }) => {
    await page.goto(`/editor/${workflowId}`);
    await page.getByText('Simulate').click();

    // Simulation panel should open
    await expect(page.getByText('Simulation')).toBeVisible({ timeout: 15000 });

    // Wait for simulation to complete
    await page.waitForTimeout(3000);
  });

  test('6. Execute workflow via API', async ({ page }) => {
    const ctx = await playwrightRequest.newContext();
    const exec = await ctx.post(`${API}/workflows/${workflowId}/execute`, {
      data: { triggeredBy: 'manual' },
    });
    const result = await exec.json();
    expect(result.success).toBeTruthy();
    expect(result.data.status).toBe('completed');
    await ctx.dispose();
  });

  test('7. Verify execution in Executions page', async ({ page }) => {
    await page.goto('/executions');
    await expect(page.getByText('Execution History')).toBeVisible();

    // Should see our workflow's execution
    const row = page.locator('tr', { hasText: WF_NAME }).first();
    await expect(row).toBeVisible({ timeout: 5000 });
    await expect(row.getByText('completed')).toBeVisible();
    await expect(row.getByText('manual')).toBeVisible();

    // Expand to see details
    await row.click();
    await page.waitForTimeout(1000);
    const expandedContent = page.locator('td[colspan]');
    await expect(expandedContent).toBeVisible({ timeout: 10000 });
  });

  test('8. Dashboard stats reflect the workflow', async ({ page }) => {
    await page.goto('/dashboard');

    // Our workflow should be in the list
    await expect(page.locator('tr', { hasText: WF_NAME })).toBeVisible();

    // Total workflows stat should be >= 1
    const totalCard = page.locator('.stat-card.stat-primary .text-3xl');
    const totalText = await totalCard.textContent();
    expect(parseInt(totalText || '0')).toBeGreaterThanOrEqual(1);
  });

  test('9. Monitoring page reflects execution data', async ({ page }) => {
    await page.goto('/monitoring');
    await expect(page.getByText('System Monitoring')).toBeVisible();
    await expect(page.getByText('Success Rate')).toBeVisible();
  });

  test('10. Delete workflow from dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    const row = page.locator('tr', { hasText: WF_NAME }).first();
    await expect(row).toBeVisible();

    await row.getByTitle('Delete').click();
    await expect(page.getByText('Delete Workflow')).toBeVisible();
    await page.getByRole('button', { name: /delete/i }).last().click();

    await expect(page.locator('tr', { hasText: WF_NAME })).not.toBeVisible();
  });
});
