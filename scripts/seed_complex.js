const http = require('http');

const complexWorkflow = {
  name: "Local Service Health Monitor (Offline Complex Demo)",
  description: "A comprehensive workflow that triggers via Cron, fetches local DB stats via API, processes with Python, waits, and logs internally.",
  status: "active",
  definition: {
    stations: [
      {
        id: "station-trigger",
        name: "Schedule Trigger",
        steps: [
          {
            id: "step-cron",
            name: "Run every 5 minutes",
            type: "trigger-cron",
            config: { cronExpression: "*/5 * * * *" }
          }
        ]
      },
      {
        id: "station-fetch",
        name: "Data Fetching Stage",
        steps: [
          {
            id: "step-fetch-api",
            name: "Fetch Local Workflows Data",
            type: "http-request",
            config: {
              method: "GET",
              url: "http://localhost:3002/api/workflows"
            },
            outputVars: [
              { name: "api_response", type: "object" }
            ]
          }
        ]
      },
      {
        id: "station-process",
        name: "Python Processing",
        steps: [
          {
            id: "step-python-logic",
            name: "Analyze Data",
            type: "script-python",
            config: {
              code: "import json\nimport sys\n# Mock analysis representing data processing\nresult = {'status': 'ok', 'message': 'Internal API responded correctly. Data parsed. No external network needed.'}\nprint(json.dumps(result))"
            }
          },
          {
            id: "step-wait",
            name: "Cool Down Period",
            type: "wait",
            config: { duration: 3, unit: "seconds" }
          }
        ]
      },
      {
         id: "station-notify",
         name: "Internal Logging Stage",
         steps: [
           {
             id: "step-if-else",
             name: "Check Status",
             type: "if-else",
             config: { condition: "true" }
           },
           {
             id: "step-js-logger",
             name: "Log to System",
             type: "script-js",
             config: {
               code: "console.log('OFFLINE WORKFLOW COMPLETED:', inputData);\nreturn { success: true, log: 'Workflow executed safely within intranet boundaries.' };"
             }
           }
         ]
      }
    ],
    connections: [
      { id: "conn-1", source: "station-trigger", target: "station-fetch" },
      { id: "conn-2", source: "station-fetch", target: "station-process" },
      { id: "conn-3", source: "station-process", target: "station-notify" }
    ]
  }
};

const postData = async (workflow) => {
  const data = JSON.stringify(workflow);
  const options = {
    hostname: 'localhost', port: 3002, path: '/api/workflows', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
  };
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => body += c);
      res.on('end', () => resolve({ statusCode: res.statusCode, body: JSON.parse(body) }));
    });
    req.on('error', reject); req.write(data); req.end();
  });
};

const executeWorkflow = async (id) => {
  const options = {
    hostname: 'localhost', port: 3002, path: `/api/workflows/${id}/execute`, method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': 2 }
  };
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => body += c);
      res.on('end', () => resolve({ statusCode: res.statusCode, body }));
    });
    req.on('error', reject); req.write('{}'); req.end();
  });
};

async function main() {
  try {
    console.log("Creating Offline Complex Workflow...");
    const createRes = await postData(complexWorkflow);
    if (!createRes.body.success) {
      throw new Error(`Failed to create: ${JSON.stringify(createRes.body)}`);
    }
    const id = createRes.body.data.id;
    console.log(`Created Offline Complex Workflow ID: ${id}`);
    
    console.log("\nExecuting workflow immediately for testing...");
    const execRes = await executeWorkflow(id);
    console.log(`Execution Status: ${execRes.statusCode}`);
    console.log(`Execution Output: ${execRes.body}`);

    console.log("\n(Note: The workflow will now rely completely on localhost endpoints and internal scripts!)");
  } catch (err) {
    console.error(err);
  }
}

main();
