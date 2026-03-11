const http = require('http');

const executeWorkflow = async (workflowId) => {
  const options = {
    hostname: 'localhost',
    port: 3002,
    path: `/api/workflows/${workflowId}/execute`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': 2 // length of '{}'
    }
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let responseBody = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { responseBody += chunk; });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, body: responseBody });
      });
    });

    req.on('error', (e) => { reject(e); });
    req.write('{}');
    req.end();
  });
};

async function main() {
  const ids = [
    'a996dece-3afc-441e-bb82-18c5370cc2d6', // Demo: Ping Google
    '3a9e6b1d-f3f6-469d-afda-82156dc49fc3', // Demo: Python Script
    '1de3efbd-9b8e-4f56-8d0c-24de5e85bfde'  // Demo: Mock Email
  ];

  for (const id of ids) {
    console.log(`Executing workflow ${id}...`);
    try {
      const result = await executeWorkflow(id);
      console.log(`Status: ${result.statusCode}`);
      console.log(`Result: ${result.body}\n`);
    } catch (e) {
      console.error(`Failed:`, e.message);
    }
  }
}

main();
