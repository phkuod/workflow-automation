const http = require('http');

function apiCall(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    const req = http.request({
      hostname: 'localhost', port: 3002, path, method,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, (res) => {
      let chunks = '';
      res.on('data', d => chunks += d);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(chunks) }));
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  console.log('=== E2E Test: Web POST Data to External System ===\n');

  // Step 1: Create workflow
  console.log('1. Creating "Web POST Integration Test" workflow...');
  const createRes = await apiCall('POST', '/api/workflows', {
    name: 'Web POST Integration Test',
    description: 'Tests POSTing data to an external system (jsonplaceholder) and verifying the response',
    status: 'active',
    definition: {
      stations: [
        {
          id: 'station-prepare',
          name: 'Prepare & Send',
          steps: [
            {
              id: 'step-trigger', name: 'Start Test', type: 'trigger-manual',
              config: {}, position: { x: 0, y: 0 }, inputVars: [], outputVars: []
            },
            {
              id: 'step-build-payload', name: 'Build POST Payload', type: 'script-js',
              config: {
                code: [
                  "console.log('=== Building POST Payload ===');",
                  "var payload = {",
                  "  title: 'Workflow Automation Test',",
                  "  body: 'This POST was sent by the workflow engine at ' + new Date().toISOString(),",
                  "  userId: 1",
                  "};",
                  "console.log('Payload:', JSON.stringify(payload));",
                  "return { payload: payload };"
                ].join('\n')
              },
              position: { x: 0, y: 100 }, inputVars: [], outputVars: [], timeout: 30000
            },
            {
              id: 'step-post', name: 'POST to External API', type: 'http-request',
              config: {
                url: 'https://jsonplaceholder.typicode.com/posts',
                method: 'POST',
                headers: '{"Content-Type": "application/json"}',
                body: '{"title":"Workflow Automation Test","body":"Sent by workflow engine","userId":1}'
              },
              position: { x: 0, y: 200 }, inputVars: [], outputVars: [], timeout: 30000
            }
          ],
          position: { x: 0, y: 100 }
        },
        {
          id: 'station-verify',
          name: 'Verify Response',
          steps: [
            {
              id: 'step-validate-response', name: 'Validate POST Response', type: 'script-js',
              config: {
                code: [
                  "console.log('=== Validating POST Response ===');",
                  "var postResult = steps['POST to External API'] && steps['POST to External API'].output;",
                  "console.log('HTTP Status:', postResult ? postResult.status : 'N/A');",
                  "console.log('Response Data:', JSON.stringify(postResult ? postResult.data : null));",
                  "",
                  "var errors = [];",
                  "if (!postResult) { errors.push('No response from POST step'); }",
                  "else {",
                  "  if (postResult.status !== 201 && postResult.status !== 200) {",
                  "    errors.push('Expected status 200 or 201, got ' + postResult.status);",
                  "  }",
                  "  if (!postResult.data) { errors.push('No response body'); }",
                  "  else {",
                  "    if (!postResult.data.id) errors.push('Response missing id field');",
                  "    if (postResult.data.title !== 'Workflow Automation Test') {",
                  "      errors.push('Title mismatch: ' + postResult.data.title);",
                  "    }",
                  "  }",
                  "}",
                  "",
                  "var passed = errors.length === 0;",
                  "console.log('Validation:', passed ? 'PASSED' : 'FAILED');",
                  "if (!passed) console.error('Errors:', errors.join('; '));",
                  "",
                  "return {",
                  "  testResult: passed ? 'PASS' : 'FAIL',",
                  "  httpStatus: postResult ? postResult.status : null,",
                  "  responseId: postResult && postResult.data ? postResult.data.id : null,",
                  "  errors: errors",
                  "};"
                ].join('\n')
              },
              position: { x: 0, y: 0 }, inputVars: [], outputVars: [], timeout: 30000
            },
            {
              id: 'step-summary', name: 'Test Summary', type: 'script-js',
              config: {
                code: [
                  "console.log('=== Test Summary ===');",
                  "var validation = steps['Validate POST Response'] && steps['Validate POST Response'].output;",
                  "var postResult = steps['POST to External API'] && steps['POST to External API'].output;",
                  "",
                  "var summary = {",
                  "  testName: 'Web POST Integration Test',",
                  "  timestamp: new Date().toISOString(),",
                  "  targetUrl: 'https://jsonplaceholder.typicode.com/posts',",
                  "  method: 'POST',",
                  "  httpStatus: validation ? validation.httpStatus : 'N/A',",
                  "  responseId: validation ? validation.responseId : 'N/A',",
                  "  result: validation ? validation.testResult : 'ERROR',",
                  "  errors: validation ? validation.errors : ['No validation data']",
                  "};",
                  "",
                  "console.log('Test:', summary.testName);",
                  "console.log('Target:', summary.targetUrl);",
                  "console.log('Method:', summary.method);",
                  "console.log('HTTP Status:', summary.httpStatus);",
                  "console.log('Response ID:', summary.responseId);",
                  "console.log('Result:', summary.result);",
                  "if (summary.errors.length > 0) console.error('Errors:', summary.errors.join('; '));",
                  "",
                  "return summary;"
                ].join('\n')
              },
              position: { x: 0, y: 100 }, inputVars: [], outputVars: [], timeout: 30000
            }
          ],
          position: { x: 400, y: 100 }
        }
      ],
      variables: {}
    }
  });

  const workflowId = createRes.body.data.id;
  console.log('   Created workflow:', workflowId);

  // Step 2: Execute workflow
  console.log('\n2. Executing workflow...');
  const execRes = await apiCall('POST', '/api/workflows/' + workflowId + '/execute');
  const execId = execRes.body.data.id;
  console.log('   Execution ID:', execId);

  // Step 3: Wait and poll for completion
  console.log('   Waiting for completion...');
  let execution;
  for (let i = 0; i < 15; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const check = await apiCall('GET', '/api/executions/' + execId);
    execution = check.body.data;
    if (execution.status !== 'running') break;
  }

  // Step 4: Show results
  console.log('\n3. Execution Result:');
  console.log('   Status:', execution.status);
  const successRate = execution.success_rate ?? execution.successRate ?? 0;
  console.log('   Success Rate:', successRate + '%');

  // Step 5: Show execution logs
  console.log('\n4. Execution Logs:');
  const logsRes = await apiCall('GET', '/api/executions/' + execId + '/logs');
  if (logsRes.body.data) {
    logsRes.body.data.forEach(function(log) {
      console.log('   [' + log.level + '] ' + log.message);
    });
  }

  // Step 6: Check final step output for test result
  console.log('\n5. Test Verdict:');
  if (execution.result) {
    const result = typeof execution.result === 'string' ? JSON.parse(execution.result) : execution.result;
    const stations = result.stations || [];
    for (const station of stations) {
      for (const step of station.steps) {
        if (step.stepName === 'Test Summary' && step.output) {
          console.log('   Result: ' + step.output.result);
          console.log('   HTTP Status: ' + step.output.httpStatus);
          console.log('   Response ID: ' + step.output.responseId);
          if (step.output.errors && step.output.errors.length > 0) {
            console.log('   Errors: ' + step.output.errors.join('; '));
          }
        }
      }
    }
  }

  // Final pass/fail
  const passed = execution.status === 'completed';
  console.log('\n' + (passed ? '✅ TEST PASSED' : '❌ TEST FAILED') + ' - Web POST to external system');
  process.exit(passed ? 0 : 1);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
