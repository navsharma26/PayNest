import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { evaluateTransactionRisk } from './engine/riskEvaluator.js';
import { startFraudConsumer, stopFraudConsumer } from './consumers/fraudConsumer.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4004;

app.use(helmet());
app.use(cors());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json());

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({
    service: 'fraud-detection-service',
    status: 'UP',
    heuristicsEngine: {
      velocityWindowSeconds: 60,
      velocityThreshold: 3,
      amountAnomalyThreshold: 10000,
      impossibleTravelSpeedKmh: 900,
    },
    timestamp: new Date().toISOString(),
  });
});

// Synchronous evaluation endpoint (for in-line transfer pipeline checks)
app.post('/api/v1/fraud/evaluate', (req, res) => {
  try {
    const { transferId, sourceWalletId, destinationWalletId, amount, metadata } = req.body;

    if (!sourceWalletId || !destinationWalletId || amount === undefined) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'sourceWalletId, destinationWalletId, and amount are required.',
      });
    }

    const evaluation = evaluateTransactionRisk({
      transferId: transferId || `sim_${Date.now()}`,
      sourceWalletId,
      destinationWalletId,
      amount,
      metadata: {
        ...metadata,
        clientIp: req.ip,
      },
    });

    return res.status(200).json({
      success: true,
      data: evaluation,
    });
  } catch (error) {
    console.error('Fraud Evaluation Error:', error);
    return res.status(500).json({
      success: false,
      error: 'InternalError',
      message: error.message,
    });
  }
});

// Start Server & Kafka Consumer
async function bootstrap() {
  const server = app.listen(PORT, () => {
    console.log(`🛡️ [fraud-detection-service] HTTP Server running on http://localhost:${PORT}`);
  });

  // Start background Kafka consumer
  startFraudConsumer().catch((err) => {
    console.warn('⚠️ [fraud-detection-service] Kafka Consumer deferred or connecting in background:', err.message);
  });

  const shutdown = async (signal) => {
    console.log(`\n🛑 Received ${signal}. Stopping fraud-detection-service...`);
    await stopFraudConsumer();
    server.close(() => {
      console.log('HTTP server closed.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap();

export default app;
