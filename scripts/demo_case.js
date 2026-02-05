
// Simple UUID generator
function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

const API_URL = 'http://localhost:3001/api';
const POLLING_INTERVAL = 1000;
const MAX_RETRIES = 30;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runDemo() {
  console.log('🚀 Starting Demo Case Execution...\n');

  try {
    // 1. Check Backend Health
    try {
      await fetch(`${API_URL}/workflows`);
      console.log('✅ Backend is accessible');
    } catch (e) {
      throw new Error(`❌ Backend is not accessible at ${API_URL}. Please start the backend service.`);
    }

    // 2. Create Workflow
    console.log('\n📝 Creating Demo Workflow...');
    const workflowId = uuidv4();
    const station1Id = uuidv4();
    const station2Id = uuidv4();
    
    // Step 1: Manual Trigger (allows passing input)
    const stepTriggerId = uuidv4();
    // Step 2: Process Data (Script)
    const stepProcessId = uuidv4();
    
    const workflow = {
      id: workflowId,
      name: `Demo Flow ${new Date().toISOString()}`,
      description: 'Automated demo verifying simulation and execution',
      definition: {
        stations: [
          {
            id: station1Id,
            name: 'Input Station',
            position: { x: 100, y: 100 },
            steps: [
              {
                id: stepTriggerId,
                name: 'Start Trigger',
                type: 'trigger-manual',
                config: {},
                position: { x: 0, y: 0 },
                outputVars: [{ name: 'initialData', type: 'string' }]
              }
            ]
          },
          {
            id: station2Id,
            name: 'Processing Station',
            position: { x: 400, y: 100 },
            steps: [
              {
                id: stepProcessId,
                name: 'Transform Data',
                type: 'script-js',
                config: {
                  code: `
                    console.log('Received input:', inputData.inputData.initialData);
                    const result = 'Processed: ' + inputData.inputData.initialData;
                    return { processed: result, timestamp: new Date().toISOString() };
                  `
                },
                position: { x: 0, y: 0 },
                inputVars: [{ name: 'initialData', source: '${initialData}' }],
                outputVars: [{ name: 'result', type: 'object' }]
              }
            ]
          }
        ],
        connections: [] 
      }
    };

    const createRes = await fetch(`${API_URL}/workflows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(workflow)
    });
    const createData = await createRes.json();
    
    if (!createData.success && !createData.data) {
        if (createData.error) throw new Error(createData.error);
    }
    
    const finalWorkflowId = createData.data ? createData.data.id : workflowId; 
    console.log(`✅ Workflow Created: ${finalWorkflowId}`);


    // 3. Simulate Workflow
    console.log('\n🧪 Simulating Workflow...');
    // Pass flat input variables that won't be overwritten by step IDs
    const simInput = {
      initialData: "Hello Simulation"
    };
    
    const simRes = await fetch(`${API_URL}/workflows/${finalWorkflowId}/simulate`, {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ inputData: simInput })
    });
    const simData = await simRes.json();
    
    if (simData.data) {
        console.log(`   Simulation ID: ${simData.data.id}`);
        console.log(`   Status: ${simData.data.status}`);
        
        await sleep(1000);
        const logsRes = await fetch(`${API_URL}/executions/${simData.data.id}/logs`);
        const logsData = await logsRes.json();
        const logs = logsData.data || [];
        console.log(`✅ Simulation Logs (${logs.length} entries):`);
        logs.forEach(log => console.log(`   [${log.level.toUpperCase()}] ${log.message}`));
    } else {
        console.error('⚠️ Simulation failed to start', simData);
    }


    // 4. Real Execution
    console.log('\n🚀 Triggering Real Execution...');
    const execInput = {
      initialData: "Hello Real World"
    };

    const execRes = await fetch(`${API_URL}/workflows/${finalWorkflowId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputData: execInput })
     });
     const execData = await execRes.json();
     
     if (execData.data) {
         const executionId = execData.data.id;
         console.log(`   Execution ID: ${executionId}`);
         
         // Poll for completion
         console.log('   Waiting for completion...');
         let status = 'pending';
         let attempts = 0;
         
         while (status !== 'completed' && status !== 'failed' && attempts < MAX_RETRIES) {
             await sleep(1000);
             const pollRes = await fetch(`${API_URL}/executions/${executionId}`);
             const pollData = await pollRes.json();
             if (pollData.data) {
                 status = pollData.data.status;
                 process.stdout.write('.');
             }
             attempts++;
         }
         console.log(`\n   Final Status: ${status}`);
         
         if (status === 'completed') {
             const finalLogsRes = await fetch(`${API_URL}/executions/${executionId}/logs`);
             const finalLogsData = await finalLogsRes.json();
             const finalLogs = finalLogsData.data || [];
             console.log(`✅ Execution Logs:`);
             finalLogs.forEach(log => console.log(`   [${log.level.toUpperCase()}] ${log.message}`));
         } else {
             console.error('❌ Execution failed or timed out.');
         }
     } else {
         console.error('⚠️ Execution failed to start', execData);
     }
     
     console.log('\n✨ Demo Complete!');

  } catch (error) {
    console.error('\n❌ Demo Failed:', error.message);
    if (error.cause) console.error(error.cause);
  }
}

runDemo();
