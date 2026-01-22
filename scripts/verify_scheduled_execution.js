async function verify() {
  const API_URL = 'http://localhost:3001/api';
  try {
    const listRes = await fetch(`${API_URL}/workflows`);
    const list = await listRes.json();
    const wf = list.data.find(w => w.name === 'Scheduled Demo Workflow');
    
    if (!wf) {
      console.log('❌ Demo workflow not found.');
      return;
    }

    console.log(`Found Workflow: ${wf.name} (${wf.id})`);
    
    const execRes = await fetch(`${API_URL}/workflows/${wf.id}/executions`);
    const execData = await execRes.json();
    
    if (execData.data && execData.data.length > 0) {
      console.log(`✅ Success! Found ${execData.data.length} executions.`);
      execData.data.forEach((exec, i) => {
        console.log(`  [${i+1}] ID: ${exec.id}, Time: ${exec.startTime}, Status: ${exec.status}, Trigger: ${exec.triggeredBy}`);
      });
    } else {
      console.log('⏳ No executions found yet. It may take up to 60 seconds for the first run.');
      
      const schedRes = await fetch(`${API_URL}/schedules/${wf.id}`);
      const schedData = await schedRes.json();
      console.log('Current Schedule Status:', JSON.stringify(schedData.data, null, 2));
    }
  } catch (e) {
    console.error('Error during verification:', e.message);
  }
}

verify();
