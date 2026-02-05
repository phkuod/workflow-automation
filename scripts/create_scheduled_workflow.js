// Simple UUID generator for demo purposes
function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

const API_URL = 'http://localhost:3001/api';

async function createScheduledWorkflow() {
  const workflow = {
    name: 'Scheduled Demo Workflow',
    description: 'This workflow runs every minute via cron trigger',
    status: 'active',
    definition: {
      stations: [
        {
          id: uuidv4(),
          name: 'Scheduled Station',
          position: { x: 100, y: 100 },
          steps: [
            {
              id: uuidv4(),
              name: 'Every Minute Trigger',
              type: 'trigger-cron',
              config: {
                cronExpression: '* * * * *' // Run every minute
              },
              position: { x: 0, y: 0 },
              inputVars: [],
              outputVars: []
            },
            {
              id: uuidv4(),
              name: 'Log Execution',
              type: 'script-js',
                code: 'console.log("Scheduled workflow executed triggered by: " + steps["Every Minute Trigger"].output.timestamp);\nreturn { success: true, time: new Date().toISOString() };'
              },
              position: { x: 0, y: 150 },
              inputVars: [],
              outputVars: [
                { name: 'result', type: 'object' }
              ]
            }
          ]
        }
      ],
      connections: []
    }
  };

  try {
    console.log('Creating scheduled workflow...');
    const response = await fetch(`${API_URL}/workflows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(workflow)
    });
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to create workflow');
    }

    console.log('Workflow created successfully!');
    console.log('ID:', data.data.id);
    console.log('Status:', data.data.status);
    
    // Verify schedule
    console.log('\nVerifying schedule...');
    const scheduleResponse = await fetch(`${API_URL}/schedules/${data.data.id}`);
    const scheduleData = await scheduleResponse.json();
    
    if (scheduleData.success) {
      console.log('Schedule found:', scheduleData.data);
    } else {
      console.log('Schedule NOT found (might need manual refresh if hot reload didn\'t pick up)');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

createScheduledWorkflow();
