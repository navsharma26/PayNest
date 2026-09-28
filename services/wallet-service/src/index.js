import express from 'express';
import grpc from '@grpc/grpc-js';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { loadWalletProto } from '@flow/proto';
import connectDB from './config/db.js';
import walletHandlers from './grpc/walletHandlers.js';
import seedDefaultWallets from './utils/seed.js';

dotenv.config();

const HTTP_PORT = process.env.HTTP_PORT || 4002;
const GRPC_PORT = process.env.GRPC_PORT || 50051;

let grpcServer = null;
let httpServer = null;

// ============================================================================
// gRPC Server Lifecycle
// ============================================================================

function startGrpcServer() {
  const proto = loadWalletProto();
  grpcServer = new grpc.Server();

  grpcServer.addService(proto.flow.wallet.v1.WalletService.service, walletHandlers);

  grpcServer.bindAsync(
    `0.0.0.0:${GRPC_PORT}`,
    grpc.ServerCredentials.createInsecure(),
    (err, boundPort) => {
      if (err) {
        console.error('❌ Failed to bind gRPC server:', err);
        return;
      }
      console.log(`⚡ [wallet-service] gRPC Server running on port ${boundPort}`);
    }
  );
}

// ============================================================================
// HTTP Server Lifecycle (Health & Metrics)
// ============================================================================

function startHttpServer() {
  const app = express();
  app.use(express.json());

  app.get('/health', (req, res) => {
    res.status(200).json({
      service: 'wallet-service',
      grpcPort: GRPC_PORT,
      status: 'UP',
      database: mongoose.connection.readyState === 1 ? 'CONNECTED' : 'DISCONNECTED',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  httpServer = app.listen(HTTP_PORT, () => {
    console.log(`🚀 [wallet-service] HTTP Healthcheck running on port ${HTTP_PORT}`);
  });
}

// ============================================================================
// Bootstrap & Graceful Shutdown
// ============================================================================

async function bootstrap() {
  await connectDB();
  await seedDefaultWallets();

  startGrpcServer();
  startHttpServer();

  const shutdown = async (signal) => {
    console.log(`\n🛑 Received ${signal}. Shutting down wallet-service gracefully...`);

    if (httpServer) {
      httpServer.close(() => console.log('HTTP health server closed.'));
    }

    if (grpcServer) {
      grpcServer.tryShutdown(() => {
        console.log('gRPC server stopped.');
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap();
