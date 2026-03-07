import { test, expect, request as playwrightRequest } from '@playwright/test';

const API = process.env.API_URL || 'http://localhost:3001/api';

test.describe('Dashboard Page', () => {
  test('loads and redirects to /dashboard', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('displays stat cards with correct labels', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('.text-muted', { hasText: 'Total Workflows' })).toBeVisible();
    await expect(page.locator('.text-muted', { hasText: 'Active' })).toBeVisible();
    await expect(page.locator('.text-muted', { hasText: 'Paused' })).toBeVisible();
    await expect(page.locator('.text-muted', { hasText: 'Draft' })).toBeVisible();
  });

  test('displays header with title', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText('Workflow Automation')).toBeVisible();
  });

  test('shows New Workflow button', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByRole('button', { name: /new workflow/i })).toBeVisible();
  });

  test('shows Import button', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText('Import')).toBeVisible();
  });

  test('opens create modal and validates required name', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('button', { name: /new workflow/i }).click();

    // Modal is open
    await expect(page.getByText('Create New Workflow')).toBeVisible();
    await expect(page.getByPlaceholder(/Daily Report Generator/i)).toBeVisible();
    await expect(page.getByPlaceholder(/What does this workflow do/i)).toBeVisible();

    // Create button should be disabled without name
    const createBtn = page.getByRole('button', { name: /^create$/i });
    await expect(createBtn).toBeDisabled();

    // Cancel closes modal
    await page.getByRole('button', { name: /cancel/i }).click();
    await expect(page.getByText('Create New Workflow')).not.toBeVisible();
  });

  test('creates workflow and navigates to editor', async ({ page }) => {
    const name = `Dashboard Test ${Date.now()}`;
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /new workflow/i }).click();
    await page.getByPlaceholder(/Daily Report Generator/i).fill(name);
    await page.getByPlaceholder(/What does this workflow do/i).fill('Test description');
    await page.getByRole('button', { name: /^create$/i }).click();

    // Navigate to editor
    await expect(page).toHaveURL(/\/editor\//, { timeout: 10000 });
    await expect(page.getByText(name)).toBeVisible({ timeout: 10000 });

    // Cleanup via API
    const ctx = await playwrightRequest.newContext();
    const list = await ctx.get(`${API}/workflows`);
    const wfs = (await list.json()).data || [];
    for (const wf of wfs) {
      if (wf.name === name) {
        await ctx.delete(`${API}/workflows/${wf.id}`);
      }
    }
    await ctx.dispose();
  });

  test('workflow list shows correct columns', async ({ page }) => {
    // Ensure at least one workflow exists
    const ctx = await playwrightRequest.newContext();
    const createRes = await ctx.post(`${API}/workflows`, {
      data: {
        name: 'Column Test WF',
        description: 'For column test',
        definition: { stations: [] },
      },
    });
    const wf = (await createRes.json()).data;

    await page.goto('/dashboard');
    await expect(page.locator('th', { hasText: 'Name' })).toBeVisible();
    await expect(page.locator('th', { hasText: 'Status' })).toBeVisible();
    await expect(page.locator('th', { hasText: 'Stations' })).toBeVisible();
    await expect(page.locator('th', { hasText: 'Updated' })).toBeVisible();
    await expect(page.locator('th', { hasText: 'Actions' })).toBeVisible();

    // Row shows workflow
    await expect(page.locator('tr', { hasText: 'Column Test WF' })).toBeVisible();

    // Cleanup
    await ctx.delete(`${API}/workflows/${wf.id}`);
    await ctx.dispose();
  });

  test('clicking workflow row navigates to editor', async ({ page }) => {
    const ctx = await playwrightRequest.newContext();
    const createRes = await ctx.post(`${API}/workflows`, {
      data: {
        name: 'Click Test WF',
        definition: { stations: [] },
      },
    });
    const wf = (await createRes.json()).data;

    await page.goto('/dashboard');
    const row = page.locator('tr', { hasText: 'Click Test WF' }).first();
    await row.click();
    await expect(page).toHaveURL(new RegExp(`/editor/${wf.id}`));

    // Cleanup
    await ctx.delete(`${API}/workflows/${wf.id}`);
    await ctx.dispose();
  });

  test('action buttons are present in workflow row', async ({ page }) => {
    const ctx = await playwrightRequest.newContext();
    const createRes = await ctx.post(`${API}/workflows`, {
      data: {
        name: 'Actions Test WF',
        definition: { stations: [] },
      },
    });
    const wf = (await createRes.json()).data;

    await page.goto('/dashboard');
    const row = page.locator('tr', { hasText: 'Actions Test WF' }).first();
    await expect(row.getByTitle('Execute')).toBeVisible();
    await expect(row.getByTitle('Edit')).toBeVisible();
    await expect(row.getByTitle('Delete')).toBeVisible();
    await expect(row.getByTitle('Duplicate')).toBeVisible();
    await expect(row.getByTitle('Export')).toBeVisible();

    await ctx.delete(`${API}/workflows/${wf.id}`);
    await ctx.dispose();
  });

  test('toggle workflow status via action button', async ({ page }) => {
    const ctx = await playwrightRequest.newContext();
    const createRes = await ctx.post(`${API}/workflows`, {
      data: {
        name: 'Toggle Status WF',
        definition: { stations: [] },
      },
    });
    const wf = (await createRes.json()).data;

    await page.goto('/dashboard');
    const row = page.locator('tr', { hasText: 'Toggle Status WF' }).first();

    // Initially draft → click activate
    await row.getByTitle('Activate').click();
    await page.waitForTimeout(500);

    // Verify badge changed to Active
    await expect(row.getByText('Active')).toBeVisible();

    await ctx.delete(`${API}/workflows/${wf.id}`);
    await ctx.dispose();
  });

  test('delete workflow with confirmation', async ({ page }) => {
    const ctx = await playwrightRequest.newContext();
    await ctx.post(`${API}/workflows`, {
      data: {
        name: 'Delete Confirm WF',
        definition: { stations: [] },
      },
    });

    await page.goto('/dashboard');
    const row = page.locator('tr', { hasText: 'Delete Confirm WF' }).first();
    await row.getByTitle('Delete').click();

    // Confirm dialog
    await expect(page.getByText('Delete Workflow')).toBeVisible();
    await expect(page.getByText(/cannot be undone/)).toBeVisible();
    await page.getByRole('button', { name: /delete/i }).last().click();

    await expect(page.locator('tr', { hasText: 'Delete Confirm WF' })).not.toBeVisible();

    await ctx.dispose();
  });

  test('empty state shows when no workflows exist', async ({ page }) => {
    // This test verifies the empty state component renders correctly
    // by temporarily clearing all workflows, then restoring them
    const ctx = await playwrightRequest.newContext();
    const list = await ctx.get(`${API}/workflows`);
    const wfs = (await list.json()).data || [];

    // Delete all
    for (const wf of wfs) {
      await ctx.delete(`${API}/workflows/${wf.id}`);
    }

    await page.goto('/dashboard');
    await expect(page.getByText('No workflows yet')).toBeVisible();
    await expect(page.getByText('Create your first workflow')).toBeVisible();

    // Restore workflows
    for (const wf of wfs) {
      await ctx.post(`${API}/workflows`, {
        data: {
          name: wf.name,
          description: wf.description,
          definition: wf.definition,
        },
      });
    }
    await ctx.dispose();
  });
});
