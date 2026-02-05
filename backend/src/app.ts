import express from 'express';
import cors from 'cors';
import workflowRoutes from './routes/workflows';
import executionRoutes from './routes/executions';
import scheduleRoutes from './routes/schedules';
import metricsRoutes from './routes/metrics';
import webhookRoutes from './routes/webhooks';
import { requestLogger } from './utils/logger';

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(requestLogger);

// Routes
app.use('/api/workflows', workflowRoutes);
app.use('/api/executions', executionRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/metrics', metricsRoutes);
app.use('/api/webhooks', webhookRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ success: false, error: err.message });
});

export default app;
