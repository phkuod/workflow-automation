const http = require('http');

function apiCall(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    const req = http.request({
      hostname: 'localhost', port: 3001, path, method,
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
  // Workflow 1: Data Processing Pipeline
  console.log('Updating Workflow 1: Data Processing Pipeline...');
  await apiCall('PUT', '/api/workflows/e9421427-ae5e-48e4-8655-d928a52f1de2', {
    definition: {
      stations: [{
        id: "c796b637-6e90-4238-bd67-1429d7b4c53e",
        name: "Data Ingestion",
        steps: [
          {
            id: "step-start", name: "Start Pipeline", type: "trigger-manual",
            config: {}, position: { x: 0, y: 0 }, inputVars: [], outputVars: []
          },
          {
            id: "step-fetch", name: "Fetch User Data", type: "http-request",
            config: { url: "https://jsonplaceholder.typicode.com/users", method: "GET", body: "" },
            position: { x: 0, y: 100 }, inputVars: [], outputVars: [], timeout: 30000
          },
          {
            id: "step-transform", name: "Transform Data", type: "script-js",
            config: {
              code: [
                "console.log('=== Transform Data Step Started ===');",
                "var httpOutput = steps['Fetch User Data'] && steps['Fetch User Data'].output;",
                "console.log('HTTP step status:', httpOutput ? httpOutput.status : 'no output');",
                "console.log('Raw data type:', typeof(httpOutput ? httpOutput.data : null));",
                "var users = httpOutput ? httpOutput.data : [];",
                "console.log('Received', users.length, 'users from API');",
                "var summary = users.map(function(u) {",
                "  return { name: u.name, email: u.email, city: u.address ? u.address.city : 'N/A' };",
                "});",
                "console.log('Transformed', summary.length, 'user records');",
                "console.log('Sample user:', summary[0]);",
                "return { count: summary.length, users: summary };"
              ].join("\n")
            },
            position: { x: 0, y: 200 }, inputVars: [], outputVars: [], timeout: 30000
          },
          {
            id: "step-log", name: "Log Completion", type: "script-js",
            config: {
              code: [
                "console.log('=== Log Completion Step Started ===');",
                "var transform = steps['Transform Data'] && steps['Transform Data'].output;",
                "console.log('Received from Transform Data:', transform);",
                "var count = transform ? transform.count : 0;",
                "console.log('User count:', count);",
                "var msg = 'Pipeline completed: Processed ' + count + ' users';",
                "console.log('Final message:', msg);",
                "return { message: msg, timestamp: new Date().toISOString() };"
              ].join("\n")
            },
            position: { x: 0, y: 300 }, inputVars: [], outputVars: [], timeout: 30000
          }
        ],
        position: { x: 0, y: 100 }
      }],
      variables: {}
    }
  });
  console.log('  Done');

  // Workflow 2: Scheduled Daily Report
  console.log('Updating Workflow 2: Scheduled Daily Report...');
  await apiCall('PUT', '/api/workflows/6e4e0165-8f92-477e-a8f6-aaddf8ad30f6', {
    definition: {
      stations: [
        {
          id: "station-report-gen", name: "Report Generation",
          steps: [
            {
              id: "step-cron", name: "Daily 8AM Schedule", type: "trigger-cron",
              config: { cronExpression: "0 8 * * *" },
              position: { x: 0, y: 0 }, inputVars: [], outputVars: []
            },
            {
              id: "step-generate", name: "Generate Report", type: "script-js",
              config: {
                code: [
                  "console.log('=== Generate Report Step Started ===');",
                  "var today = new Date().toISOString().split('T')[0];",
                  "console.log('Report date:', today);",
                  "var totalOrders = Math.floor(Math.random() * 100) + 50;",
                  "var revenue = (Math.random() * 10000 + 5000).toFixed(2);",
                  "var newCustomers = Math.floor(Math.random() * 20) + 5;",
                  "console.log('Generated metrics:');",
                  "console.log('  Total Orders:', totalOrders);",
                  "console.log('  Revenue: $' + revenue);",
                  "console.log('  New Customers:', newCustomers);",
                  "return {",
                  "  date: today,",
                  "  title: 'Daily Summary Report',",
                  "  metrics: { totalOrders: totalOrders, revenue: revenue, newCustomers: newCustomers },",
                  "  status: 'generated'",
                  "};"
                ].join("\n")
              },
              position: { x: 0, y: 100 }, inputVars: [], outputVars: [], timeout: 30000
            },
            {
              id: "step-format", name: "Format Email Body", type: "script-js",
              config: {
                code: [
                  "console.log('=== Format Email Body Step Started ===');",
                  "var report = steps['Generate Report'] && steps['Generate Report'].output;",
                  "console.log('Received report data:', report);",
                  "if (!report) {",
                  "  console.error('No report data received from previous step!');",
                  "  return { body: 'No report data' };",
                  "}",
                  "var body = 'Daily Summary - ' + report.date + ' | Orders: ' + report.metrics.totalOrders + ' | Revenue: $' + report.metrics.revenue + ' | New Customers: ' + report.metrics.newCustomers;",
                  "console.log('Formatted email body:', body);",
                  "console.log('Email subject:', 'Daily Report - ' + report.date);",
                  "return { emailBody: body, subject: 'Daily Report - ' + report.date };"
                ].join("\n")
              },
              position: { x: 0, y: 200 }, inputVars: [], outputVars: [], timeout: 30000
            }
          ],
          position: { x: 0, y: 100 }
        },
        {
          id: "station-delivery", name: "Email Delivery",
          steps: [
            {
              id: "step-email", name: "Email Report to Team", type: "action-email",
              config: {
                to: "team@example.com",
                subject: "Daily Summary Report",
                body: "See attached report summary."
              },
              position: { x: 0, y: 0 }, inputVars: [], outputVars: [], timeout: 30000
            }
          ],
          position: { x: 400, y: 100 }
        }
      ],
      variables: {}
    }
  });
  console.log('  Done');

  // Workflow 3: Webhook Order Processor
  console.log('Updating Workflow 3: Webhook Order Processor...');
  await apiCall('PUT', '/api/workflows/59f45335-b981-418f-9534-a9a31d1b3cf5', {
    definition: {
      stations: [
        {
          id: "station-intake", name: "Order Intake",
          steps: [
            {
              id: "step-webhook", name: "Receive Order", type: "trigger-webhook",
              config: {}, position: { x: 0, y: 0 }, inputVars: [], outputVars: []
            },
            {
              id: "step-validate", name: "Validate Order", type: "script-js",
              config: {
                code: [
                  "console.log('=== Validate Order Step Started ===');",
                  "var trigger = steps['Receive Order'] && steps['Receive Order'].output;",
                  "console.log('Trigger output:', trigger);",
                  "var order = (trigger && trigger.body) || {};",
                  "console.log('Order payload:', order);",
                  "var errors = [];",
                  "if (!order.orderId) errors.push('Missing orderId');",
                  "if (!order.amount || order.amount <= 0) errors.push('Invalid amount');",
                  "if (!order.customerEmail) errors.push('Missing customerEmail');",
                  "var isValid = errors.length === 0;",
                  "var isHighValue = (order.amount || 0) > 500;",
                  "console.log('Validation result: ' + (isValid ? 'VALID' : 'INVALID'));",
                  "if (errors.length > 0) console.warn('Validation errors: ' + errors.join(', '));",
                  "if (isHighValue) console.log('HIGH VALUE order detected: $' + order.amount);",
                  "return {",
                  "  isValid: isValid,",
                  "  errors: errors,",
                  "  orderId: order.orderId || 'UNKNOWN',",
                  "  amount: order.amount || 0,",
                  "  isHighValue: isHighValue",
                  "};"
                ].join("\n")
              },
              position: { x: 0, y: 100 }, inputVars: [], outputVars: [], timeout: 30000
            }
          ],
          position: { x: 0, y: 100 }
        },
        {
          id: "station-routing", name: "Order Routing",
          steps: [
            {
              id: "step-check-valid", name: "Check Order Valid", type: "if-else",
              config: {
                condition: "${step-validate.output.isValid} === true",
                thenLabel: "Process Order",
                elseLabel: "Reject Order"
              },
              position: { x: 0, y: 0 }, inputVars: [], outputVars: [], timeout: 30000
            },
            {
              id: "step-check-value", name: "Check High Value", type: "if-else",
              config: {
                condition: "${step-validate.output.isHighValue} === true",
                thenLabel: "Priority Processing",
                elseLabel: "Standard Processing"
              },
              position: { x: 0, y: 100 }, inputVars: [], outputVars: [], timeout: 30000
            },
            {
              id: "step-log-result", name: "Log Order Result", type: "script-js",
              config: {
                code: [
                  "console.log('=== Log Order Result Step Started ===');",
                  "var validation = steps['Validate Order'] && steps['Validate Order'].output;",
                  "var checkValid = steps['Check Order Valid'] && steps['Check Order Valid'].output;",
                  "var checkValue = steps['Check High Value'] && steps['Check High Value'].output;",
                  "console.log('Validation result:', validation);",
                  "console.log('Check Valid branch:', checkValid ? checkValid.branch : 'N/A');",
                  "console.log('Check High Value branch:', checkValue ? checkValue.branch : 'N/A');",
                  "var msg = validation && validation.isValid",
                  "  ? 'Order ' + validation.orderId + ' accepted ($' + validation.amount + ')'",
                  "  : 'Order rejected: ' + (validation ? validation.errors.join(', ') : 'no data');",
                  "console.log('Final result:', msg);",
                  "return {",
                  "  orderId: validation ? validation.orderId : 'UNKNOWN',",
                  "  isValid: checkValid ? checkValid.branch : 'unknown',",
                  "  priority: checkValue ? checkValue.branch : 'unknown',",
                  "  message: msg",
                  "};"
                ].join("\n")
              },
              position: { x: 0, y: 200 }, inputVars: [], outputVars: [], timeout: 30000
            }
          ],
          position: { x: 400, y: 100 }
        }
      ],
      variables: {}
    }
  });
  console.log('  Done');

  // Execute (not simulate) to generate real execution logs, then check logs
  console.log('\n=== Executing workflows and checking logs ===\n');

  // Execute Workflow 1
  var e1 = await apiCall('POST', '/api/workflows/e9421427-ae5e-48e4-8655-d928a52f1de2/execute');
  var execId1 = e1.body.data.id;
  // Wait for execution
  await new Promise(r => setTimeout(r, 3000));
  var logs1 = await apiCall('GET', '/api/executions/' + execId1 + '/logs');
  console.log('1. Data Processing Pipeline - Execution:', execId1);
  if (logs1.body.data) {
    logs1.body.data.forEach(function(log) {
      console.log('  [' + log.level + '] ' + log.message);
    });
  }

  // Execute Workflow 2
  var e2 = await apiCall('POST', '/api/workflows/6e4e0165-8f92-477e-a8f6-aaddf8ad30f6/execute');
  var execId2 = e2.body.data.id;
  await new Promise(r => setTimeout(r, 2000));
  var logs2 = await apiCall('GET', '/api/executions/' + execId2 + '/logs');
  console.log('\n2. Scheduled Daily Report - Execution:', execId2);
  if (logs2.body.data) {
    logs2.body.data.forEach(function(log) {
      console.log('  [' + log.level + '] ' + log.message);
    });
  }

  // Execute Workflow 3
  var e3 = await apiCall('POST', '/api/workflows/59f45335-b981-418f-9534-a9a31d1b3cf5/execute');
  var execId3 = e3.body.data.id;
  await new Promise(r => setTimeout(r, 2000));
  var logs3 = await apiCall('GET', '/api/executions/' + execId3 + '/logs');
  console.log('\n3. Webhook Order Processor - Execution:', execId3);
  if (logs3.body.data) {
    logs3.body.data.forEach(function(log) {
      console.log('  [' + log.level + '] ' + log.message);
    });
  }
}

main().catch(console.error);
