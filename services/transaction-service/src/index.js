import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { initiateTransfer } from './orchestrator/transferOrchestrator.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4003;

app.use(helmet());
app.use(cors());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json());

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({
    service: 'transaction-service',
    status: 'UP',
    kafkaStatus: 'CONFIGURED',
    walletGrpcTarget: process.env.WALLET_GRPC_HOST || 'localhost:50051',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

/**
 * POST /api/v1/transactions/transfer
 * REST endpoint initiating money transfer workflow:
 * 1. Balance check via gRPC
 * 2. Kafka transaction.initiated
 * 3. Fraud Risk Engine evaluation
 * 4. Ledger debit/credit via gRPC
 * 5. Kafka transaction.completed & rewards.process
 */
app.post('/api/v1/transactions/transfer', async (req, res) => {
  try {
    const {
      sourceWalletId,
      destinationWalletId,
      amount,
      currency,
      description,
      metadata,
    } = req.body;

    if (!sourceWalletId || !destinationWalletId || !amount) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'sourceWalletId, destinationWalletId, and amount are required.',
      });
    }

    const idempotencyKey =
      req.headers['x-idempotency-key'] ||
      req.body.idempotencyKey ||
      undefined;

    const receipt = await initiateTransfer({
      sourceWalletId,
      destinationWalletId,
      amount,
      currency,
      idempotencyKey,
      description,
      metadata: {
        ...metadata,
        clientIp: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    return res.status(200).json(receipt);
  } catch (error) {
    console.error('[TransactionService API] Transfer error:', error.message);
    return res.status(error.status || 500).json({
      success: false,
      error: error.name || 'TransferExecutionFailed',
      message: error.message,
      details: error.details || undefined,
    });
  }
});

const server = app.listen(PORT, () => {
  console.log(`🚀 [transaction-service] HTTP Server running on http://localhost:${PORT}`);
});

const shutdown = (signal) => {
  console.log(`\n🛑 Received ${signal}. Shutting down transaction-service...`);
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;
