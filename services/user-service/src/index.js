import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4001;

// Global Security & Logging Middlewares
app.use(helmet());
app.use(cors());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json());

// API Routes
app.use('/api/auth', authRoutes);

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    service: 'user-service',
    status: 'UP',
    database: mongoose.connection.readyState === 1 ? 'CONNECTED' : 'DISCONNECTED',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Centralized 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'NotFound',
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

// Centralized Error Handler
app.use((err, req, res, _next) => {
  console.error('Unhandled Application Error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.name || 'InternalServerError',
    message: err.message || 'An unexpected error occurred.',
  });
});

// Bootstrap Database and HTTP Server
async function startServer() {
  await connectDB();

  const server = app.listen(PORT, () => {
    console.log(`🚀 [user-service] HTTP Server running on http://localhost:${PORT}`);
  });

  // Graceful Shutdown
  const shutdown = async (signal) => {
    console.log(`\n🛑 Received ${signal}. Shutting down user-service gracefully...`);
    server.close(async () => {
      console.log('HTTP server closed.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer();

export default app;
