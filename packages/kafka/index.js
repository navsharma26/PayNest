import { Kafka, logLevel, CompressionTypes } from 'kafkajs';

/**
 * Standard Flow Banking Event Streaming Topics
 */
export const TOPICS = Object.freeze({
  TRANSACTION_INITIATED: 'transaction.initiated',
  TRANSACTION_COMPLETED: 'transaction.completed',
  TRANSACTION_FAILED: 'transaction.failed',
  TRANSACTION_FLAGGED: 'transaction.flagged',
  REWARDS_PROCESS: 'rewards.process',
});

/**
 * Factory creating a configured KafkaJS client
 * @param {object} config
 * @param {string} config.clientId - Identifier for the client
 * @param {string[]} [config.brokers] - List of broker host:port addresses
 */
export function createKafkaClient({
  clientId = 'flow-default-client',
  brokers = (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  logLevelConfig = logLevel.WARN,
} = {}) {
  return new Kafka({
    clientId,
    brokers,
    logLevel: logLevelConfig,
    retry: {
      initialRetryTime: 300,
      retries: 8,
      maxRetryTime: 30000,
      factor: 2,
    },
    connectionTimeout: 5000,
    requestTimeout: 25000,
  });
}

/**
 * Resilient Kafka Producer wrapper with automatic JSON serialization and tracing
 */
export function createProducer(kafkaClient, options = {}) {
  const producer = kafkaClient.producer({
    allowAutoTopicCreation: true,
    transactionTimeout: 30000,
    ...options,
  });

  let isConnected = false;

  return {
    raw: producer,

    async connect() {
      if (isConnected) return;
      try {
        await producer.connect();
        isConnected = true;
        console.log(`[KafkaProducer] Connected successfully (${producer._clientId || 'client'})`);
      } catch (err) {
        console.error('[KafkaProducer] Connection error:', err.message);
        throw err;
      }
    },

    /**
     * Publishes a typed JSON event to a Kafka topic
     * @param {string} topic - Destination topic from TOPICS
     * @param {object} payload - JavaScript object to serialize
     * @param {string} [key] - Partition key (e.g. transferId or walletId)
     * @param {object} [headers] - Metadata headers (e.g. traceId, correlationId)
     */
    async sendEvent(topic, payload, key = null, headers = {}) {
      if (!isConnected) {
        await this.connect();
      }

      const stringifiedValue = JSON.stringify(payload);
      const encodedHeaders = Object.entries(headers).reduce((acc, [k, v]) => {
        acc[k] = Buffer.isBuffer(v) ? v : String(v);
        return acc;
      }, {
        timestamp: String(Date.now()),
        producer: producer._clientId || 'flow-service',
      });

      try {
        const recordMetadata = await producer.send({
          topic,
          compression: CompressionTypes.GZIP,
          messages: [
            {
              key: key ? String(key) : null,
              value: stringifiedValue,
              headers: encodedHeaders,
            },
          ],
        });
        return recordMetadata;
      } catch (error) {
        console.error(`[KafkaProducer] Failed to emit to topic "${topic}":`, error.message);
        throw error;
      }
    },

    async disconnect() {
      if (!isConnected) return;
      try {
        await producer.disconnect();
        isConnected = false;
        console.log('[KafkaProducer] Disconnected.');
      } catch (err) {
        console.error('[KafkaProducer] Disconnect error:', err.message);
      }
    },
  };
}

/**
 * Resilient Kafka Consumer wrapper with automatic JSON decoding and handler execution
 */
export function createConsumer(
  kafkaClient,
  {
    groupId,
    topics = [],
    fromBeginning = false,
  }
) {
  if (!groupId) {
    throw new Error('Consumer groupId is required.');
  }

  const consumer = kafkaClient.consumer({
    groupId,
    allowAutoTopicCreation: true,
    sessionTimeout: 30000,
    heartbeatInterval: 3000,
  });

  let isConnected = false;

  return {
    raw: consumer,

    async connect() {
      if (isConnected) return;
      try {
        await consumer.connect();
        isConnected = true;
        console.log(`[KafkaConsumer] Connected as group: "${groupId}"`);
      } catch (err) {
        console.error(`[KafkaConsumer] Group "${groupId}" connection error:`, err.message);
        throw err;
      }
    },

    /**
     * Subscribes and begins consuming messages with individual error isolation
     * @param {Function} messageHandler - async (event, rawPayload) => void
     */
    async startConsuming(messageHandler) {
      if (!isConnected) {
        await this.connect();
      }

      for (const topic of topics) {
        await consumer.subscribe({ topic, fromBeginning });
        console.log(`[KafkaConsumer] Subscribed group "${groupId}" to topic: "${topic}"`);
      }

      await consumer.run({
        autoCommit: true,
        autoCommitInterval: 5000,
        eachMessage: async ({ topic, partition, message }) => {
          const rawValue = message.value ? message.value.toString() : null;
          let parsedPayload = null;

          try {
            parsedPayload = rawValue ? JSON.parse(rawValue) : null;
          } catch (parseErr) {
            console.error(`[KafkaConsumer] JSON parse error on ${topic}[${partition}]:`, parseErr.message);
            return;
          }

          const parsedHeaders = {};
          if (message.headers) {
            for (const [key, val] of Object.entries(message.headers)) {
              parsedHeaders[key] = val ? val.toString() : null;
            }
          }

          const eventContext = {
            topic,
            partition,
            offset: message.offset,
            key: message.key ? message.key.toString() : null,
            timestamp: message.timestamp,
            headers: parsedHeaders,
            data: parsedPayload,
          };

          try {
            await messageHandler(eventContext);
          } catch (handlerError) {
            console.error(
              `[KafkaConsumer] Error processing message on topic "${topic}" (offset: ${message.offset}):`,
              handlerError
            );
            // In enterprise environments, write to Dead Letter Queue (DLQ) topic here
          }
        },
      });
    },

    async disconnect() {
      if (!isConnected) return;
      try {
        await consumer.disconnect();
        isConnected = false;
        console.log(`[KafkaConsumer] Disconnected group "${groupId}".`);
      } catch (err) {
        console.error(`[KafkaConsumer] Group "${groupId}" disconnect error:`, err.message);
      }
    },
  };
}

export default {
  TOPICS,
  createKafkaClient,
  createProducer,
  createConsumer,
};
