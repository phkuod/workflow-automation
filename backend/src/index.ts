import app from './app';
import { scheduler } from './services/scheduler';
import { initDatabase } from './db/database';

const PORT = process.env.PORT || 3002;

async function main() {
  // Database must be ready before accepting any requests
  await initDatabase();
  console.log('Database initialized');

  const server = app.listen(PORT, async () => {
    console.log(`🚀 Workflow Automation Backend running on http://localhost:${PORT}`);
    console.log(`📊 API endpoints:`);
    console.log(`   GET    /api/workflows          - List all workflows`);
    console.log(`   POST   /api/workflows          - Create workflow`);
    console.log(`   GET    /api/workflows/:id      - Get workflow`);
    console.log(`   PUT    /api/workflows/:id      - Update workflow`);
    console.log(`   DELETE /api/workflows/:id      - Delete workflow`);
    console.log(`   POST   /api/workflows/:id/execute  - Execute workflow`);
    console.log(`   POST   /api/workflows/:id/simulate - Simulate workflow`);
    console.log(`   GET    /api/executions         - List executions`);
    console.log(`   GET    /api/executions/:id     - Get execution`);
    console.log(`   GET    /api/executions/:id/logs - Get execution logs`);
    console.log(`   GET    /api/schedules          - List scheduled workflows`);
    console.log(`   PUT    /api/schedules/:id/pause - Pause schedule`);
    console.log(`   PUT    /api/schedules/:id/resume - Resume schedule`);
    console.log(`   ANY    /api/webhooks/:id       - Dynamic webhook endpoint`);

    // Initialize scheduler
    try {
      await scheduler.initialize();
      console.log(`⏰ Scheduler initialized`);
    } catch (error) {
      console.error('Failed to initialize scheduler:', error);
    }
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    await scheduler.shutdown();
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });

  process.on('SIGINT', async () => {
    console.log('SIGINT received. Shutting down gracefully...');
    await scheduler.shutdown();
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });
}

main().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

