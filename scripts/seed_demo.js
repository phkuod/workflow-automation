const http = require('http');

const workflows = [
  // Test Case 1: Simple HTTP Request (Local)
  {
    name: "Demo: Ping Local Health API",
    description: "A simple workflow that makes an HTTP GET request to the local health endpoint.",
    status: "active",
    definition: {
      stations: [
        {
          id: "station-1",
          name: "Trigger Station",
          steps: [
            { id: "step-1", name: "Manual Trigger", type: "trigger-manual", config: {} }
          ]
        },
        {
          id: "station-2",
          name: "Action Station",
          steps: [
            {
              id: "step-2",
              name: "HTTP GET Local",
              type: "http-request", // fixed to match engine
              config: { method: "GET", url: "http://localhost:3002/api/health" }
            }
          ]
        }
      ],
      connections: [{ id: "conn-1", source: "station-1", target: "station-2" }]
    }
  },
  // Test Case 2: Python Script Execution
  {
    name: "Demo: Python Script",
    description: "Executes a simple Python script locally.",
    status: "active",
    definition: {
      stations: [
         {
          id: "station-1",
          name: "Trigger Station",
          steps: [{ id: "step-1", name: "Manual Trigger", type: "trigger-manual", config: {} }]
        },
        {
          id: "station-2",
          name: "Script Runner",
          steps: [
            {
              id: "step-2",
              name: "Run Python",
              type: "script-python", // fixed type
              config: {
                code: "print('Hello from Python in offline Docker!')\nimport json\nprint(json.dumps({'message': 'Success'}))"
              }
            }
          ]
        }
      ],
      connections: [{ id: "conn-1", source: "station-1", target: "station-2" }]
    }
  }
];

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
      res.on('end', () => resolve({ statusCode: res.statusCode, body }));
    });
    req.on('error', reject); req.write(data); req.end();
  });
};

async function main() {
  console.log("Seeding offline demo workflows...");
  for (const workflow of workflows) {
    try {
      const result = await postData(workflow);
      console.log(`Created '${workflow.name}' - Status: ${result.statusCode}`);
    } catch (e) {
      console.error(`Failed to create '${workflow.name}':`, e.message);
    }
  }
}
main();
