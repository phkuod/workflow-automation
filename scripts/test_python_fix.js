const http = require('http');

const pythonWorkflow = {
  name: "Demo: Python Script (Fixed)",
  description: "Executes a simple Python script.",
  status: "active",
  definition: {
    stations: [
      {
        id: "station-1",
        name: "Trigger Station",
        steps: [
          {
            id: "step-1",
            name: "Manual Trigger",
            type: "trigger-manual",
            config: {}
          }
        ]
      },
      {
        id: "station-2",
        name: "Script Runner",
        steps: [
          {
            id: "step-2",
            name: "Run Python",
            type: "script-python", // FIXED type
            config: {
              code: "print('Hello from Python in Docker!')\nimport json\nprint(json.dumps({'message': 'Success'}))"
            }
          }
        ]
      }
    ],
    connections: [
      {
        id: "conn-1",
        source: "station-1",
        target: "station-2"
      }
    ]
  }
};

const postData = async (workflow) => {
  const data = JSON.stringify(workflow);
  const options = {
    hostname: 'localhost',
    port: 3002,
    path: '/api/workflows',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
  };
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => body += c);
      res.on('end', () => resolve({ statusCode: res.statusCode, body: JSON.parse(body) }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
};

const executeWorkflow = async (id) => {
  const options = {
    hostname: 'localhost',
    port: 3002,
    path: `/api/workflows/${id}/execute`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': 2 }
  };
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => body += c);
      res.on('end', () => resolve({ statusCode: res.statusCode, body }));
    });
    req.on('error', reject);
    req.write('{}');
    req.end();
  });
};

async function main() {
  try {
    console.log("Creating fixed Python workflow...");
    const createRes = await postData(pythonWorkflow);
    if (!createRes.body.success) {
      throw new Error(`Failed to create: ${JSON.stringify(createRes.body)}`);
    }
    const id = createRes.body.data.id;
    console.log(`Created ID: ${id}`);
    
    console.log("Executing workflow...");
    const execRes = await executeWorkflow(id);
    console.log(`Execution Status: ${execRes.statusCode}`);
    console.log(`Execution Output: ${execRes.body}`);
  } catch (err) {
    console.error(err);
  }
}

main();
