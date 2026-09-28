import { createKafkaClient, createConsumer, TOPICS } from '@flow/kafka';

let consumerInstance = null;

/**
 * Dispatches simulated high-priority multi-channel notifications (SMS & Email)
 */
function sendNotification({ channel, recipient, subject, body, metadata }) {
  const timestamp = new Date().toISOString();
  console.log(`\n======================================================`);
  console.log(`📨 [DISPATCH][${channel}] to: ${recipient}`);
  console.log(`⏰ Time: ${timestamp}`);
  console.log(`📝 Subject: ${subject}`);
  console.log(`💬 Message: ${body}`);
  if (metadata) {
    console.log(`🏷️ Metadata:`, JSON.stringify(metadata));
  }
  console.log(`======================================================\n`);
}

/**
 * Starts the Kafka consumer loop for notifications
 */
export async function startNotificationConsumer() {
  const kafka = createKafkaClient({
    clientId: 'notification-service-consumer',
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  });

  consumerInstance = createConsumer(kafka, {
    groupId: 'flow-notification-group',
    topics: [
      TOPICS.TRANSACTION_COMPLETED,
      TOPICS.TRANSACTION_FAILED,
      TOPICS.TRANSACTION_FLAGGED,
    ],
    fromBeginning: false,
  });

  try {
    await consumerInstance.connect();
    console.log('📢 [NotificationConsumer] Listening for transaction events...');

    await consumerInstance.startConsuming(async (event) => {
      const { topic, data } = event;
      if (!data) return;

      if (topic === TOPICS.TRANSACTION_COMPLETED) {
        const units = data.amount?.units || '0';
        const formattedAmount = `$${units}.${((data.amount?.nanos || 0) / 1e7).toFixed(0).padStart(2, '0')}`;

        // 1. Alert Sender via SMS & Email
        sendNotification({
          channel: 'EMAIL',
          recipient: `${data.sourceWalletId}@flowbank.io`,
          subject: `Payment Successful: Sent ${formattedAmount}`,
          body: `Your payment of ${formattedAmount} to wallet ${data.destinationWalletId} has settled. Ledger Ref: ${data.transactionReference}.`,
          metadata: { transferId: data.transferId, remainingBalance: data.sourceRemainingBalance },
        });

        sendNotification({
          channel: 'SMS',
          recipient: `+1-555-FLOW-SNDR`,
          subject: 'Debit Alert',
          body: `Flow Alert: ${formattedAmount} debited. Ref: ${data.transactionReference}. Remaining: $${data.sourceRemainingBalance?.units || '0'}.`,
        });

        // 2. Alert Receiver
        sendNotification({
          channel: 'SMS',
          recipient: `+1-555-FLOW-RCVR`,
          subject: 'Credit Alert',
          body: `Flow Alert: ${formattedAmount} credited from ${data.sourceWalletId}. Ref: ${data.transactionReference}.`,
        });
      } else if (topic === TOPICS.TRANSACTION_FLAGGED) {
        sendNotification({
          channel: 'EMAIL',
          recipient: `${data.sourceWalletId}@flowbank.io`,
          subject: '⚠️ Security Notice: Unusual Account Activity Flagged',
          body: `A transfer request of $${data.amount} was flagged by our real-time security engine (Risk score: ${data.riskScore}/100). If this was not you, lock your account immediately.`,
          metadata: { transferId: data.transferId, rules: data.triggeredRules },
        });
      } else if (topic === TOPICS.TRANSACTION_FAILED) {
        sendNotification({
          channel: 'EMAIL',
          recipient: `${data.sourceWalletId}@flowbank.io`,
          subject: '❌ Payment Unsuccessful',
          body: `Your transfer of $${data.amount} could not be completed. Reason: ${data.reason || data.errorMessage || 'Settlement error'}.`,
        });
      }
    });
  } catch (error) {
    console.error('❌ [NotificationConsumer] Startup error:', error.message);
  }
}

export async function stopNotificationConsumer() {
  if (consumerInstance) await consumerInstance.disconnect();
}

export default {
  startNotificationConsumer,
  stopNotificationConsumer,
};
