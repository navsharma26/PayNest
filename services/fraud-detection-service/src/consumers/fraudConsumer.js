import {
  createKafkaClient,
  createConsumer,
  createProducer,
  TOPICS,
} from '@flow/kafka';
import { evaluateTransactionRisk } from '../engine/riskEvaluator.js';

let consumerInstance = null;
let producerInstance = null;

/**
 * Initializes and starts the Kafka fraud detection consumer loop
 */
export async function startFraudConsumer() {
  const kafka = createKafkaClient({
    clientId: 'fraud-detection-service',
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  });

  producerInstance = createProducer(kafka);
  consumerInstance = createConsumer(kafka, {
    groupId: 'flow-fraud-detection-group',
    topics: [TOPICS.TRANSACTION_INITIATED],
    fromBeginning: false,
  });

  try {
    await producerInstance.connect();
    await consumerInstance.connect();

    console.log('🛡️ [FraudConsumer] Listening for "transaction.initiated" events...');

    await consumerInstance.startConsuming(async (event) => {
      const transactionData = event.data;
      if (!transactionData) return;

      console.log(
        `🔍 [FraudConsumer] Evaluating risk for transfer: ${transactionData.transferId} ($${transactionData.amount})`
      );

      const evaluation = evaluateTransactionRisk(transactionData);

      if (evaluation.decision === 'FLAGGED' || evaluation.decision === 'REJECT') {
        console.warn(
          `🚨 [FraudConsumer] ALERT: Transaction ${transactionData.transferId} ${evaluation.decision}! ` +
            `Risk Score: ${evaluation.riskScore}/100. Reasons: ` +
            evaluation.triggeredRules.map((r) => r.rule).join(', ')
        );

        // Emit transaction.flagged event to Kafka
        await producerInstance.sendEvent(
          TOPICS.TRANSACTION_FLAGGED,
          {
            ...evaluation,
            sourceEvent: event.topic,
            timestamp: Date.now(),
          },
          transactionData.transferId,
          {
            traceId: event.headers.traceId || transactionData.transferId,
            riskDecision: evaluation.decision,
          }
        );
      } else {
        console.log(
          `✅ [FraudConsumer] Transaction ${transactionData.transferId} passed risk checks (Score: ${evaluation.riskScore}/100)`
        );
      }
    });
  } catch (error) {
    console.error('❌ [FraudConsumer] Consumer startup failure:', error.message);
  }
}

/**
 * Graceful shutdown for Kafka consumer & producer
 */
export async function stopFraudConsumer() {
  if (consumerInstance) await consumerInstance.disconnect();
  if (producerInstance) await producerInstance.disconnect();
}

export default {
  startFraudConsumer,
  stopFraudConsumer,
};
