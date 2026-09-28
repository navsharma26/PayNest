import { v4 as uuidv4 } from 'uuid';
import grpc from '@grpc/grpc-js';
import { loadWalletProto } from '@flow/proto';
import { createKafkaClient, createProducer, TOPICS } from '@flow/kafka';

const WALLET_GRPC_HOST = process.env.WALLET_GRPC_HOST || 'localhost:50051';
const FRAUD_SERVICE_URL = process.env.FRAUD_SERVICE_URL || 'http://localhost:4004';

// Initialize gRPC Client to Wallet Service
const proto = loadWalletProto();
const walletClient = new proto.flow.wallet.v1.WalletService(
  WALLET_GRPC_HOST,
  grpc.credentials.createInsecure()
);

// Initialize Kafka Producer
const kafka = createKafkaClient({
  clientId: 'transaction-service',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
});
const producer = createProducer(kafka);

// Connect Kafka producer asynchronously
producer.connect().catch((err) => {
  console.warn('⚠️ [TransactionOrchestrator] Kafka Producer deferred connect:', err.message);
});

// Promisified gRPC Helpers
function checkWalletBalance(walletId) {
  return new Promise((resolve, reject) => {
    walletClient.CheckBalance({ wallet_id: walletId }, (err, response) => {
      if (err) return reject(err);
      resolve(response);
    });
  });
}

function executeWalletTransfer(transferPayload) {
  return new Promise((resolve, reject) => {
    walletClient.ExecuteTransfer(transferPayload, (err, response) => {
      if (err) return reject(err);
      resolve(response);
    });
  });
}

/**
 * Executes fraud check against the Fraud Detection Service
 */
async function evaluateFraud(transferData) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);

    const res = await fetch(`${FRAUD_SERVICE_URL}/api/v1/fraud/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(transferData),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const json = await res.json();
      return json.data;
    }
  } catch (err) {
    console.warn(`[TransactionOrchestrator] Fraud service unreachable (${err.message}). Using defensive fallback.`);
  }

  // Defensive fallback rule: High value transfers >$25k flagged if fraud engine offline
  const numAmount = parseFloat(transferData.amount);
  return {
    riskScore: numAmount > 25000 ? 75 : 10,
    decision: numAmount > 25000 ? 'REJECT' : 'PASS',
    triggeredRules: numAmount > 25000 ? [{ rule: 'FALLBACK_HIGH_VALUE_EXCEEDED' }] : [],
  };
}

/**
 * Orchestrates the full money transfer pipeline:
 * 1. Verify sender balance via gRPC
 * 2. Emit transaction.initiated to Kafka
 * 3. Run fraud risk check
 * 4. Execute atomic double-entry transfer via gRPC
 * 5. Emit transaction.completed (and rewards.process) to Kafka
 */
export async function initiateTransfer({
  sourceWalletId,
  destinationWalletId,
  amount,
  currency = 'USD',
  idempotencyKey,
  description,
  metadata = {},
}) {
  const transferId = `tx_${uuidv4().replace(/-/g, '')}`;
  const effectiveIdempotencyKey = idempotencyKey || uuidv4();

  const numAmount = parseFloat(amount);
  const minorUnits = Math.round(numAmount * 100);
  const units = Math.floor(numAmount);
  const nanos = Math.round((numAmount - units) * 1e9);

  // -------------------------------------------------------------------------
  // STEP 1: Verify sender balance via gRPC
  // -------------------------------------------------------------------------
  console.log(`[Transaction] 1/4 Checking sender balance for wallet: ${sourceWalletId}...`);
  let senderBalance;
  try {
    senderBalance = await checkWalletBalance(sourceWalletId);
  } catch (err) {
    throw new Error(`Failed to check sender wallet balance: ${err.message}`);
  }

  if (senderBalance.status !== 'WALLET_STATUS_ACTIVE') {
    throw new Error(`Source wallet is in inactive status: ${senderBalance.status}`);
  }

  const availableMinor = BigInt(senderBalance.available_balance.minor_units);
  if (availableMinor < BigInt(minorUnits)) {
    throw new Error(
      `Insufficient available balance ($${(Number(availableMinor) / 100).toFixed(2)}) for transfer of $${numAmount.toFixed(2)}`
    );
  }

  // -------------------------------------------------------------------------
  // STEP 2: Emit transaction.initiated event to Kafka
  // -------------------------------------------------------------------------
  const transactionInitiatedPayload = {
    transferId,
    sourceWalletId,
    destinationWalletId,
    amount: numAmount,
    currency,
    idempotencyKey: effectiveIdempotencyKey,
    metadata,
    initiatedAt: Date.now(),
  };

  try {
    await producer.sendEvent(
      TOPICS.TRANSACTION_INITIATED,
      transactionInitiatedPayload,
      transferId,
      { traceId: transferId }
    );
    console.log(`[Transaction] 2/4 Emitted "transaction.initiated" for ${transferId}`);
  } catch (err) {
    console.warn('[Transaction] Kafka emit failed, proceeding with in-line flow:', err.message);
  }

  // -------------------------------------------------------------------------
  // STEP 3: Run Fraud Check
  // -------------------------------------------------------------------------
  console.log(`[Transaction] 3/4 Running real-time fraud evaluation for ${transferId}...`);
  const fraudResult = await evaluateFraud({
    transferId,
    sourceWalletId,
    destinationWalletId,
    amount: numAmount,
    metadata,
  });

  if (fraudResult.decision === 'REJECT') {
    // Emit transaction.failed
    await producer
      .sendEvent(
        TOPICS.TRANSACTION_FAILED,
        {
          transferId,
          sourceWalletId,
          destinationWalletId,
          amount: numAmount,
          reason: 'FRAUD_REJECTED',
          details: fraudResult.triggeredRules,
          timestamp: Date.now(),
        },
        transferId
      )
      .catch(() => {});

    const error = new Error('Transfer blocked by Fraud Risk Engine');
    error.status = 403;
    error.details = fraudResult;
    throw error;
  }

  // -------------------------------------------------------------------------
  // STEP 4: Execute Ledger Transfer via gRPC
  // -------------------------------------------------------------------------
  console.log(`[Transaction] 4/4 Executing ledger debit/credit via gRPC for ${transferId}...`);
  const transferPayload = {
    transfer_id: transferId,
    source_wallet_id: sourceWalletId,
    destination_wallet_id: destinationWalletId,
    amount: {
      currency,
      units: units.toString(),
      nanos,
      minor_units: minorUnits.toString(),
    },
    idempotency_key: effectiveIdempotencyKey,
    description: description || 'P2P Instant Transfer',
    metadata: {
      ...metadata,
      riskScore: String(fraudResult.riskScore),
    },
  };

  const grpcResponse = await executeWalletTransfer(transferPayload);

  if (grpcResponse.status !== 'TRANSFER_STATUS_SUCCESS') {
    // Emit transaction.failed
    await producer
      .sendEvent(
        TOPICS.TRANSACTION_FAILED,
        {
          transferId,
          sourceWalletId,
          destinationWalletId,
          amount: numAmount,
          reason: grpcResponse.error_code || grpcResponse.status,
          errorMessage: grpcResponse.error_message,
          timestamp: Date.now(),
        },
        transferId
      )
      .catch(() => {});

    const error = new Error(grpcResponse.error_message || 'Ledger transfer failed');
    error.status = 400;
    error.grpcStatus = grpcResponse.status;
    throw error;
  }

  // -------------------------------------------------------------------------
  // STEP 5: Emit transaction.completed & rewards.process to Kafka
  // -------------------------------------------------------------------------
  const completedPayload = {
    transferId: grpcResponse.transfer_id,
    status: grpcResponse.status,
    sourceWalletId: grpcResponse.source_wallet_id,
    destinationWalletId: grpcResponse.destination_wallet_id,
    amount: grpcResponse.amount_transferred,
    fee: grpcResponse.fee_amount,
    sourceRemainingBalance: grpcResponse.source_available_balance,
    destinationNewBalance: grpcResponse.destination_available_balance,
    transactionReference: grpcResponse.transaction_reference,
    executedAt: grpcResponse.executed_at,
    metadata: {
      ...metadata,
      riskScore: fraudResult.riskScore,
    },
  };

  try {
    await producer.sendEvent(
      TOPICS.TRANSACTION_COMPLETED,
      completedPayload,
      grpcResponse.transfer_id,
      { traceId: transferId }
    );
    console.log(`[Transaction] ✅ Emitted "transaction.completed" for ${transferId}`);

    // Emit rewards processing event
    await producer.sendEvent(
      TOPICS.REWARDS_PROCESS,
      {
        transferId: grpcResponse.transfer_id,
        walletId: sourceWalletId,
        amountTransferred: numAmount,
        currency,
        timestamp: Date.now(),
      },
      sourceWalletId
    );
  } catch (err) {
    console.warn('[Transaction] Kafka completion emit error:', err.message);
  }

  return {
    success: true,
    transferId: grpcResponse.transfer_id,
    status: grpcResponse.status,
    transactionReference: grpcResponse.transaction_reference,
    sourceWalletId: grpcResponse.source_wallet_id,
    destinationWalletId: grpcResponse.destination_wallet_id,
    amountTransferred: grpcResponse.amount_transferred,
    sourceRemainingBalance: grpcResponse.source_available_balance,
    destinationNewBalance: grpcResponse.destination_available_balance,
    executedAt: grpcResponse.executed_at,
    riskEvaluation: {
      riskScore: fraudResult.riskScore,
      decision: fraudResult.decision,
    },
  };
}

export default {
  initiateTransfer,
};
