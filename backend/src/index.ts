import express from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import { connectDatabase } from './config/database.js';
import { errorHandler } from './middleware/errorHandler.js';

import authRoutes from './routes/auth.routes.js';
import sectionRoutes from './routes/section.routes.js';
import transactionRoutes from './routes/transaction.routes.js';
import uploadRoutes from './routes/upload.routes.js';
import tripRoutes from './routes/trip.routes.js';
import taxRoutes from './routes/tax.routes.js';
import investmentRoutes from './routes/investment.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import categoryRoutes from './routes/category.routes.js';

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/sections', sectionRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/tax', taxRoutes);
app.use('/api/investments', investmentRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/categories', categoryRoutes);

app.use(errorHandler);

async function startServer() {
  await connectDatabase();
  
  app.listen(config.port, '0.0.0.0', () => {
    console.log(`🚀 Server running on http://localhost:${config.port}`);
    console.log(`📊 Environment: ${config.nodeEnv}`);
  });
}

startServer().catch(console.error);

export default app;
