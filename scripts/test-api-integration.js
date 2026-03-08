#!/usr/bin/env node
/**
 * test-api-integration.js — Comprehensive API Integration Tests
 * Runs against a live server (Docker or local) at BASE_URL.
 *
 * Usage:
 *   node scripts/test-api-integration.js
 *   BASE_URL=http://localhost:3001 node scripts/test-api-integration.js
 */

const http = require('http');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';
let pass = 0;
let fail = 0;
const failures = [];

function log(ok, name, detail) {
  if (ok) {
    pass++;
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  } else {
    fail++;
    failures.push(name);
    console.log(`  \x1b[31m✗\x1b[0m ${name}`);
    if (detail) console.log(`    \x1b[31m${detail}\x1b[0m`);
  }
}

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(data); } catch { parsed = data; }
        resolve({ status: res.statusCode, body: parsed, raw: data });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ---------- Test Definitions ----------

const WORKFLOW_DEF = {
  stations: [
    {
      id: 'station-1',
      name: 'Test Station',
      position: { x: 100, y: 100 },
      steps: [
        {
          id: 'step-trigger',
          name: 'Manual Trigger',
          type: 'trigger-manual',
          config: {},
          position: { x: 100, y: 100 },
        },
        {
          id: 'step-js',
          name: 'JS Script',
          type: 'script-js',
          config: { code: 'output = { result: "hello", sum: 1 + 2 };' },
          position: { x: 100, y: 200 },
          connections: ['step-var'],
        },
        {
          id: 'step-var',
          name: 'Set Var',
          type: 'set-variable',
          config: { variableName: 'greeting', value: 'world' },
          position: { x: 100, y: 300 },
        },
      ],
      connections: [],
    },
  ],
};

const IF_ELSE_DEF = {
  stations: [
    {
      id: 'station-if',
      name: 'If-Else Station',
      position: { x: 100, y: 100 },
      steps: [
        {
          id: 'step-trigger',
          name: 'Trigger',
          type: 'trigger-manual',
          config: {},
          position: { x: 100, y: 100 },
          connections: ['step-if'],
        },
        {
          id: 'step-if',
          name: 'Check Value',
          type: 'if-else',
          config: { condition: 'true' },
          position: { x: 100, y: 200 },
          connections: ['step-true'],
          connectionsFalse: ['step-false'],
        },
        {
          id: 'step-true',
          name: 'True Branch',
          type: 'script-js',
          config: { code: 'output = { branch: "true" };' },
          position: { x: 50, y: 300 },
        },
        {
          id: 'step-false',
          name: 'False Branch',
          type: 'script-js',
          config: { code: 'output = { branch: "false" };' },
          position: { x: 250, y: 300 },
        },
      ],
      connections: [],
    },
  ],
};

const PYTHON_DEF = {
  stations: [
    {
      id: 'station-py',
      name: 'Python Station',
      position: { x: 100, y: 100 },
      steps: [
        {
          id: 'step-trigger',
          name: 'Trigger',
          type: 'trigger-manual',
          config: {},
          position: { x: 100, y: 100 },
          connections: ['step-py'],
        },
        {
          id: 'step-py',
          name: 'Python Script',
          type: 'script-python',
          config: { code: 'import json\nresult = {"computed": 42}\nprint(json.dumps(result))' },
          position: { x: 100, y: 200 },
        },
      ],
      connections: [],
    },
  ],
};

const INTERPOLATION_DEF = {
  stations: [
    {
      id: 'station-interp',
      name: 'Interpolation Station',
      position: { x: 100, y: 100 },
      steps: [
        {
          id: 'step-trigger',
          name: 'Trigger',
          type: 'trigger-manual',
          config: {},
          position: { x: 100, y: 100 },
          connections: ['step-src'],
        },
        {
          id: 'step-src',
          name: 'Source',
          type: 'script-js',
          config: { code: 'output = { value: "HELLO" };' },
          position: { x: 100, y: 200 },
          connections: ['step-ref'],
        },
        {
          id: 'step-ref',
          name: 'Reference',
          type: 'script-js',
          config: { code: 'output = { echoed: "${step-src.output.value}" };' },
          position: { x: 100, y: 300 },
        },
      ],
      connections: [],
    },
  ],
};

const INPUT_PARAMS_DEF = {
  inputParameters: [
    { name: 'userName', type: 'string', required: true, description: 'User name' },
    { name: 'count', type: 'number', required: false, defaultValue: 5 },
  ],
  stations: [
    {
      id: 'station-param',
      name: 'Param Station',
      position: { x: 100, y: 100 },
      steps: [
        {
          id: 'step-trigger',
          name: 'Trigger',
          type: 'trigger-manual',
          config: {},
          position: { x: 100, y: 100 },
        },
      ],
      connections: [],
    },
  ],
};

async function run() {
  console.log(`\nAPI Integration Tests — ${BASE_URL}\n`);
  console.log('═'.repeat(60));

  // ------- 1. Health -------
  console.log('\n▸ Health Check');
  {
    const r = await request('GET', '/api/health');
    log(r.status === 200 && r.body.status === 'ok', 'GET /api/health → 200');
  }

  // ------- 2. Workflow CRUD -------
  console.log('\n▸ Workflow CRUD');
  let workflowId;
  {
    const r = await request('POST', '/api/workflows', {
      name: 'Integration Test WF',
      description: 'Created by test-api-integration',
      definition: WORKFLOW_DEF,
    });
    log(r.status === 201 && r.body.success, 'POST /api/workflows → 201');
    workflowId = r.body.data?.id;
    log(!!workflowId, 'Workflow ID returned', workflowId);
  }
  {
    const r = await request('GET', '/api/workflows');
    log(r.status === 200 && r.body.success, 'GET /api/workflows → 200');
    const found = r.body.data?.some((w) => w.id === workflowId);
    log(found, 'Created workflow in list');
  }
  {
    const r = await request('GET', `/api/workflows/${workflowId}`);
    log(r.status === 200 && r.body.data?.name === 'Integration Test WF', 'GET /api/workflows/:id → correct name');
  }
  {
    const r = await request('PUT', `/api/workflows/${workflowId}`, {
      name: 'Updated WF Name',
      status: 'active',
    });
    log(r.status === 200 && r.body.data?.name === 'Updated WF Name', 'PUT /api/workflows/:id → name updated');
    log(r.body.data?.status === 'active', 'PUT /api/workflows/:id → status updated to active');
  }
  {
    const r = await request('GET', `/api/workflows/nonexistent-id-12345`);
    log(r.status === 404, 'GET /api/workflows/:id (404) → not found');
  }

  // ------- 3. Execute & Simulate -------
  console.log('\n▸ Execute & Simulate');
  let executionId;
  {
    const r = await request('POST', `/api/workflows/${workflowId}/execute`, {
      triggeredBy: 'manual',
    });
    log(r.status === 200 && r.body.success, 'POST /api/workflows/:id/execute → 200');
    executionId = r.body.data?.id;
    log(!!executionId, 'Execution ID returned');
    const status = r.body.data?.status;
    log(status === 'completed' || status === 'failed', `Execution status: ${status}`);
  }
  {
    const r = await request('POST', `/api/workflows/${workflowId}/simulate`);
    log(r.status === 200 && r.body.success, 'POST /api/workflows/:id/simulate → 200');
    log(!!r.body.data?.id, 'Simulate returns execution data');
  }

  // ------- 4. Executions -------
  console.log('\n▸ Executions');
  {
    const r = await request('GET', '/api/executions');
    log(r.status === 200 && Array.isArray(r.body.data), 'GET /api/executions → array');
  }
  if (executionId) {
    const r = await request('GET', `/api/executions/${executionId}`);
    log(r.status === 200 && r.body.data?.id === executionId, 'GET /api/executions/:id → correct ID');
  }
  if (executionId) {
    const r = await request('GET', `/api/executions/${executionId}/logs`);
    log(r.status === 200 && Array.isArray(r.body.data), 'GET /api/executions/:id/logs → array');
  }
  {
    const r = await request('GET', `/api/workflows/${workflowId}/executions`);
    log(r.status === 200 && Array.isArray(r.body.data), 'GET /api/workflows/:id/executions → array');
    log(r.body.data?.length >= 1, 'Workflow has >= 1 execution');
  }

  // ------- 5. Version Control -------
  console.log('\n▸ Version Control');
  {
    // Save a definition change to create a version
    await request('PUT', `/api/workflows/${workflowId}`, {
      definition: { ...WORKFLOW_DEF, stations: [...WORKFLOW_DEF.stations] },
    });
    const r = await request('GET', `/api/workflows/${workflowId}/versions`);
    log(r.status === 200 && Array.isArray(r.body.data), 'GET /api/workflows/:id/versions → array');
    log(r.body.data?.length >= 1, 'At least 1 version saved');
  }

  // ------- 6. Metrics -------
  console.log('\n▸ Metrics');
  {
    const r = await request('GET', '/api/metrics');
    const m = r.body.data || r.body; // metrics may be wrapped in { success, data }
    log(r.status === 200 && m.uptime !== undefined, 'GET /api/metrics → has uptime');
    log(m.workflows?.total !== undefined, 'Metrics has workflows.total');
    log(m.executions?.total !== undefined, 'Metrics has executions.total');
  }

  // ------- 7. Schedules -------
  console.log('\n▸ Schedules');
  {
    const r = await request('GET', '/api/schedules');
    log(r.status === 200 && Array.isArray(r.body.data), 'GET /api/schedules → array');
  }

  // ------- 8. Webhook -------
  console.log('\n▸ Webhook');
  {
    // Create a workflow with webhook trigger
    const webhookDef = {
      stations: [{
        id: 'station-wh',
        name: 'Webhook Station',
        position: { x: 100, y: 100 },
        steps: [{
          id: 'step-wh',
          name: 'Webhook Trigger',
          type: 'trigger-webhook',
          config: {},
          position: { x: 100, y: 100 },
        }],
        connections: [],
      }],
    };
    const create = await request('POST', '/api/workflows', {
      name: 'Webhook Test WF',
      definition: webhookDef,
    });
    const whId = create.body.data?.id;
    // Activate for webhook
    await request('PUT', `/api/workflows/${whId}`, { status: 'active' });

    const r = await request('POST', `/api/webhooks/${whId}`, { event: 'test' });
    log(r.status === 202 || r.status === 200, `POST /api/webhooks/:id → ${r.status}`);

    // Cleanup
    await request('DELETE', `/api/workflows/${whId}`);
  }

  // ------- 9. If-Else Routing -------
  console.log('\n▸ If-Else Routing');
  {
    const create = await request('POST', '/api/workflows', {
      name: 'If-Else Test',
      definition: IF_ELSE_DEF,
    });
    const ifId = create.body.data?.id;
    const exec = await request('POST', `/api/workflows/${ifId}/execute`);
    log(exec.status === 200, 'If-Else workflow executed');
    const execStatus = exec.body.data?.status;
    log(execStatus === 'completed', `If-Else execution status: ${execStatus}`);
    await request('DELETE', `/api/workflows/${ifId}`);
  }

  // ------- 10. Python Script -------
  console.log('\n▸ Python Script Execution');
  {
    const create = await request('POST', '/api/workflows', {
      name: 'Python Test',
      definition: PYTHON_DEF,
    });
    const pyId = create.body.data?.id;
    const exec = await request('POST', `/api/workflows/${pyId}/execute`);
    log(exec.status === 200, 'Python workflow executed');
    const execStatus = exec.body.data?.status;
    log(execStatus === 'completed', `Python execution status: ${execStatus}`);
    await request('DELETE', `/api/workflows/${pyId}`);
  }

  // ------- 11. Variable Interpolation -------
  console.log('\n▸ Variable Interpolation');
  {
    const create = await request('POST', '/api/workflows', {
      name: 'Interpolation Test',
      definition: INTERPOLATION_DEF,
    });
    const intId = create.body.data?.id;
    const exec = await request('POST', `/api/workflows/${intId}/execute`);
    log(exec.status === 200, 'Interpolation workflow executed');
    log(exec.body.data?.status === 'completed', 'Interpolation completed');
    await request('DELETE', `/api/workflows/${intId}`);
  }

  // ------- 12. Input Parameters -------
  console.log('\n▸ Input Parameters');
  {
    const create = await request('POST', '/api/workflows', {
      name: 'Params Test',
      definition: INPUT_PARAMS_DEF,
    });
    const pId = create.body.data?.id;

    // Execute without required param → should fail
    const fail1 = await request('POST', `/api/workflows/${pId}/execute`, {
      inputData: {},
    });
    log(fail1.status === 400 || fail1.body.data?.status === 'failed',
      'Missing required param → error/fail');

    // Execute with required param → should succeed
    const ok = await request('POST', `/api/workflows/${pId}/execute`, {
      inputData: { userName: 'testUser' },
    });
    log(ok.status === 200, 'Execute with params → 200');

    await request('DELETE', `/api/workflows/${pId}`);
  }

  // ------- 13. Delete Execution -------
  console.log('\n▸ Delete Execution');
  if (executionId) {
    const r = await request('DELETE', `/api/executions/${executionId}`);
    log(r.status === 200, `DELETE /api/executions/:id → ${r.status}`);
  }

  // ------- 14. Cleanup -------
  console.log('\n▸ Cleanup');
  {
    const r = await request('DELETE', `/api/workflows/${workflowId}`);
    log(r.status === 200 && r.body.data?.deleted, 'DELETE test workflow → cleaned up');
  }

  // ------- Results -------
  console.log('\n' + '═'.repeat(60));
  console.log(`\n  Total: ${pass + fail}  |  \x1b[32mPass: ${pass}\x1b[0m  |  \x1b[31mFail: ${fail}\x1b[0m\n`);

  if (fail > 0) {
    console.log('  Failed tests:');
    failures.forEach((f) => console.log(`    \x1b[31m- ${f}\x1b[0m`));
    console.log('');
    process.exit(1);
  } else {
    console.log('  \x1b[32mAll API integration tests passed!\x1b[0m\n');
    process.exit(0);
  }
}

run().catch((err) => {
  console.error('Test runner error:', err);
  process.exit(1);
});
