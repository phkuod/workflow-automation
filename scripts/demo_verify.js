/**
 * demo_verify.js
 *
 * Creates a 3-station demo workflow via the REST API, executes it, and
 * runs 7 structured checks that verify the full lifecycle:
 *   data persisted in SQLite → visible in UI → executed → logs written
 *
 * Usage:
 *   node scripts/demo_verify.js
 *
 * Prerequisite: backend running on http://localhost:3002
 */

const API = 'http://localhost:3002/api';
const WORKFLOW_NAME = 'Demo: 3-Station Data Pipeline';

const WORKFLOW = {
  name: WORKFLOW_NAME,
  description: 'End-to-end demo: trigger → collect (set-var + HTTP health check) → summarize (JS script)',
  status: 'active',
  definition: {
    stations: [
      {
        id: 'stn-trigger',
        name: 'Trigger',
        position: { x: 100, y: 200 },
        steps: [
          {
            id: 'stp-manual',
            name: 'Manual Start',
            type: 'trigger-manual',
            config: {},
            position: { x: 0, y: 0 }
          }
        ]
      },
      {
        id: 'stn-collect',
        name: 'Collect',
        position: { x: 420, y: 200 },
        steps: [
          {
            id: 'stp-setvar',
            name: 'Set Environment',
            type: 'set-variable',
            config: { variableName: 'environment', variableValue: 'demo-run' },
            position: { x: 0, y: 0 }
          },
          {
            id: 'stp-health',
            name: 'Health Check',
            type: 'http-request',
            config: { method: 'GET', url: 'http://localhost:3002/api/health' },
            position: { x: 0, y: 150 },
            outputVars: [{ name: 'healthData', type: 'object' }]
          }
        ]
      },
      {
        id: 'stn-summarize',
        name: 'Summarize',
        position: { x: 740, y: 200 },
        steps: [
          {
            id: 'stp-summary',
            name: 'Log Summary',
            type: 'script-js',
            config: {
              code: [
                "const env = inputData.environment || 'unknown';",
                "console.log('Demo pipeline completed. Environment:', env);",
                "console.log('Full inputData:', JSON.stringify(inputData, null, 2));",
                "return { success: true, environment: env, completedAt: new Date().toISOString() };"
              ].join('\n')
            },
            position: { x: 0, y: 0 }
          }
        ]
      }
    ],
    connections: [
      { id: 'conn-1', source: 'stn-trigger',  target: 'stn-collect' },
      { id: 'conn-2', source: 'stn-collect',  target: 'stn-summarize' }
    ]
  }
};

// ─── helpers ──────────────────────────────────────────────────────────────────

async function api(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(`${API}${path}`, opts);
  const json = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data: json };
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

let passed = 0;
let failed = 0;

function check(label, ok, detail = '') {
  const icon = ok ? '✅' : '❌';
  const tag  = ok ? 'PASS' : 'FAIL';
  const line = `  [${icon} ${tag}]  ${label.padEnd(30)}${detail}`;
  console.log(line);
  ok ? passed++ : failed++;
  return ok;
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function run() {
  console.log('\n=== Demo Case Verification ===\n');

  // 1. Backend reachable
  let reachable = false;
  try {
    const r = await api('GET', '/workflows');
    reachable = r.status === 200;
  } catch (_) { /* backend not up */ }
  if (!check('Backend reachable', reachable, reachable ? '' : '  ← start: cd backend && npm run dev')) {
    console.log('\n  Cannot continue without a running backend.\n');
    process.exit(1);
  }

  // 2. Create workflow
  const createRes = await api('POST', '/workflows', WORKFLOW);
  const id = createRes.data?.data?.id;
  check('Workflow created', !!id && createRes.status === 201, id ? `id: ${id}` : JSON.stringify(createRes.data));
  if (!id) { console.log('\n  Workflow creation failed — aborting.\n'); process.exit(1); }

  // 3. Persisted in DB (GET by id)
  const getRes = await api('GET', `/workflows/${id}`);
  const nameOk = getRes.data?.data?.name === WORKFLOW_NAME;
  check('Workflow persisted in DB', nameOk, `name: "${getRes.data?.data?.name}"`);

  // 4. Appears in list (GET all)
  const listRes = await api('GET', '/workflows');
  const inList = Array.isArray(listRes.data?.data) && listRes.data.data.some(w => w.id === id);
  check('Workflow in list', inList, `total workflows: ${listRes.data?.data?.length ?? '?'}`);

  // 5. Trigger execution
  const execRes = await api('POST', `/workflows/${id}/execute`, { triggeredBy: 'manual', inputData: {} });
  const executionId = execRes.data?.data?.id;
  check('Execution triggered', !!executionId, executionId ? `executionId: ${executionId}` : JSON.stringify(execRes.data));
  if (!executionId) { console.log('\n  Execution failed to start — aborting.\n'); process.exit(1); }

  // 6. Poll for completion (max 30 s)
  process.stdout.write('\n  Waiting for execution');
  let status = 'running';
  let attempts = 0;
  while (!['completed', 'failed', 'cancelled'].includes(status) && attempts < 30) {
    await sleep(1000);
    const poll = await api('GET', `/executions/${executionId}`);
    status = poll.data?.data?.status ?? status;
    process.stdout.write('.');
    attempts++;
  }
  console.log(` ${status}\n`);
  check('Execution completed', status === 'completed', `status: ${status}`);

  // 7. Execution logs written
  const logsRes = await api('GET', `/executions/${executionId}/logs`);
  const logs = logsRes.data?.data ?? [];
  check('Execution logs written', logs.length > 0, `${logs.length} log entries`);

  // ─── print logs ─────────────────────────────────────────────────────────────
  if (logs.length > 0) {
    console.log('\n--- Execution Logs ---');
    logs.forEach(l => {
      const level = (l.level || 'info').toUpperCase().padEnd(5);
      console.log(`  [${level}] ${l.message}`);
    });
  }

  // ─── final summary ──────────────────────────────────────────────────────────
  const total = passed + failed;
  const allOk = failed === 0;
  console.log(`\n=== Result: ${passed}/${total} checks passed ${allOk ? '✅' : '❌'} ===`);

  if (allOk) {
    console.log(`\n  Workflow "${WORKFLOW_NAME}" is live in the database.`);
    console.log('  View in Web UI:');
    console.log('    Dashboard  → http://localhost:5173');
    console.log('    Monitoring → http://localhost:5173  (Monitoring tab)');
    console.log('    API check  → http://localhost:3002/api/workflows\n');
  } else {
    console.log('\n  Some checks failed. Review the output above.\n');
    process.exit(1);
  }
}

run().catch(err => {
  console.error('\n❌ Unexpected error:', err.message);
  process.exit(1);
});
