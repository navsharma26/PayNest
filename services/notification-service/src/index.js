import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import {
  startNotificationConsumer,
  stopNotificationConsumer,
} from './consumers/notificationConsumer.js';
import {
  startRewardsConsumer,
  stopRewardsConsumer,
  getWalletRewards,
} from './consumers/rewardsConsumer.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4005;

app.use(helmet());
app.use(cors());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json());

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({
    service: 'notification-service',
    status: 'UP',
    activeChannels: ['EMAIL', 'SMS', 'PUSH', 'WEBHOOK'],
    consumerGroups: ['flow-notification-group', 'flow-rewards-group'],
    timestamp: new Date().toISOString(),
  });
});

// Query user loyalty rewards balance
app.get('/api/v1/rewards/:walletId', (req, res) => {
  const points = getWalletRewards(req.params.walletId);
  return res.json({
    walletId: req.params.walletId,
    loyaltyPoints: points,
    cashValueUsd: (points / 100).toFixed(2),
  });
});

// Manual dispatch fallback endpoint
app.post('/api/v1/notifications/dispatch', (req, res) => {
  const { recipient, channel = 'EMAIL', subject, message } = req.body;

  console.log(`📨 [Manual Dispatch][${channel}] to ${recipient}: ${subject} - ${message || ''}`);

  return res.json({
    success: true,
    notificationId: `notif_${Date.now()}`,
    status: 'DISPATCHED',
    recipient,
    channel,
    timestamp: new Date().toISOString(),
  });
});

// Bootstrap HTTP Server & Kafka Consumers
async function bootstrap() {
  const server = app.listen(PORT, () => {
    console.log(`📢 [notification-service] HTTP Server running on http://localhost:${PORT}`);
  });

  // Start background Kafka consumers
  startNotificationConsumer().catch((err) => {
    console.warn('⚠️ [NotificationConsumer] Deferred connect:', err.message);
  });
  startRewardsConsumer().catch((err) => {
    console.warn('⚠️ [RewardsConsumer] Deferred connect:', err.message);
  });

  const shutdown = async (signal) => {
    console.log(`\n🛑 Received ${signal}. Shutting down notification-service...`);
    await stopNotificationConsumer();
    await stopRewardsConsumer();
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
