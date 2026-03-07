import { test, expect, request as playwrightRequest } from '@playwright/test';

const API = process.env.API_URL || 'http://localhost:3001/api';

test.describe.configure({ mode: 'serial' });

test.describe('Editor Page', () => {
  let workflowId: string;

  const WORKFLOW_DEF = {
    stations: [
      {
        id: 'station-1',
        name: 'Stage One',
        position: { x: 200, y: 200 },
        steps: [
          {
            id: 'step-1',
            name: 'Manual Trigger',
            type: 'trigger-manual',
            config: {},
            position: { x: 100, y: 100 },
            connections: ['step-2'],
          },
          {
            id: 'step-2',
            name: 'JS Script',
            type: 'script-js',
            config: { code: 'output = { msg: "hello" };' },
            position: { x: 100, y: 250 },
          },
        ],
        connections: [],
      },
    ],
  };

  test.beforeAll(async () => {
    const ctx = await playwrightRequest.newContext();
    const res = await ctx.post(`${API}/workflows`, {
      data: {
        name: 'Editor Test WF',
        description: 'Workflow for editor tests',
        definition: WORKFLOW_DEF,
      },
    });
    const body = await res.json();
    workflowId = body.data.id;
    await ctx.dispose();
  });

  test.afterAll(async () => {
    const ctx = await playwrightRequest.newContext();
    await ctx.delete(`${API}/workflows/${workflowId}`);
    await ctx.dispose();
  });

  test('loads editor with workflow name', async ({ page }) => {
    await page.goto(`/editor/${workflowId}`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Editor Test WF')).toBeVisible({ timeout: 10000 });
  });

  test('displays toolbar buttons', async ({ page }) => {
    await page.goto(`/editor/${workflowId}`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Editor Test WF')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Save', { exact: false })).toBeVisible();
    await expect(page.getByText('Simulate')).toBeVisible();
    await expect(page.getByText('Add Stage')).toBeVisible();
    await expect(page.getByText('Params')).toBeVisible();
  });

  test('shows Stage View indicator by default', async ({ page }) => {
    await page.goto(`/editor/${workflowId}`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Editor Test WF')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Stage View')).toBeVisible();
  });

  test('shows workflow status dropdown', async ({ page }) => {
    await page.goto(`/editor/${workflowId}`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Editor Test WF')).toBeVisible({ timeout: 10000 });
    const select = page.locator('select.form-select');
    await expect(select).toBeVisible();
    await expect(select.locator('option')).toHaveCount(3);
  });

  test('version history button opens panel', async ({ page }) => {
    await page.goto(`/editor/${workflowId}`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Editor Test WF')).toBeVisible({ timeout: 10000 });
    await page.getByTitle('Version History').click();
    await expect(page.getByRole('heading', { name: 'Version History' })).toBeVisible();
  });

  test('params button opens input parameters panel', async ({ page }) => {
    await page.goto(`/editor/${workflowId}`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Editor Test WF')).toBeVisible({ timeout: 10000 });
    await page.getByText('Params').click();
    await expect(page.getByRole('heading', { name: 'Input Parameters' })).toBeVisible();
  });

  test('save workflow shows success toast', async ({ page }) => {
    await page.goto(`/editor/${workflowId}`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Editor Test WF')).toBeVisible({ timeout: 10000 });
    await page.getByText('Save', { exact: false }).click();
    await expect(page.getByText('Workflow saved')).toBeVisible({ timeout: 5000 });
  });

  test('simulate opens simulation panel', async ({ page }) => {
    await page.goto(`/editor/${workflowId}`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Editor Test WF')).toBeVisible({ timeout: 10000 });
    await page.getByText('Simulate').click();
    await expect(page.getByText('Simulation')).toBeVisible({ timeout: 15000 });
  });

  test('stage canvas renders station node', async ({ page }) => {
    await page.goto(`/editor/${workflowId}`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Editor Test WF')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Stage One')).toBeVisible({ timeout: 10000 });
  });

  test('double-click station enters step view', async ({ page }) => {
    await page.goto(`/editor/${workflowId}`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Editor Test WF')).toBeVisible({ timeout: 10000 });

    const stageNode = page.getByText('Stage One');
    await stageNode.dblclick();

    await expect(page.getByText('Step View')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Back to Stages')).toBeVisible();
    // Step nodes are visible on canvas (may appear multiple times in node label + subtitle)
    await expect(page.getByText('Manual Trigger').first()).toBeVisible();
    await expect(page.getByText('JS Script').first()).toBeVisible();
  });

  test('back to stages button works', async ({ page }) => {
    await page.goto(`/editor/${workflowId}`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Editor Test WF')).toBeVisible({ timeout: 10000 });

    const stageNode = page.getByText('Stage One');
    await stageNode.dblclick();
    await expect(page.getByText('Step View')).toBeVisible({ timeout: 5000 });

    await page.getByText('Back to Stages').click();
    await expect(page.getByText('Stage View')).toBeVisible();
  });

  test('back arrow navigates to dashboard', async ({ page }) => {
    await page.goto(`/editor/${workflowId}`);
    // Click the back arrow (first ghost button)
    await page.locator('button.btn-ghost.btn-icon').first().click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('not found state for invalid workflow', async ({ page }) => {
    await page.goto('/editor/nonexistent-id-xyz');
    await expect(page.getByText('Workflow not found')).toBeVisible();
    await expect(page.getByText('Back to Dashboard')).toBeVisible();
  });
});
