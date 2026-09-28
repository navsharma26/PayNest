import logger from '../config/logger.js';

const TRANSACTION_SERVICE_URL =
  process.env.TRANSACTION_SERVICE_URL || 'http://localhost:4003';
const NOTIFICATION_SERVICE_URL =
  process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:4005';

/**
 * Initiates an end-to-end money transfer via the Transaction Service orchestrator
 */
export async function sendMoneyViaOrchestrator(payload, requestId) {
  const url = `${TRANSACTION_SERVICE_URL}/api/v1/transactions/transfer`;

  logger.info('[REST Client] Forwarding transfer request to transaction-service', {
    requestId,
    targetUrl: url,
    sourceWalletId: payload.sourceWalletId,
    destinationWalletId: payload.destinationWalletId,
    amount: payload.amount,
  });

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-request-id': requestId || '',
      'x-idempotency-key': payload.idempotencyKey || '',
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();

  if (!res.ok) {
    logger.warn('[REST Client] Transaction orchestrator returned error', {
      requestId,
      statusCode: res.status,
      response: data,
    });

    const error = new Error(data.message || 'Transaction initiation failed');
    error.extensions = {
      code: res.status === 403 ? 'FRAUD_REJECTED' : res.status === 400 ? 'INSUFFICIENT_FUNDS' : 'TRANSACTION_FAILED',
      http: { status: res.status },
      details: data.details,
      requestId,
    };
    throw error;
  }

  logger.info('[REST Client] Transfer successfully processed by orchestrator', {
    requestId,
    transferId: data.transferId,
    status: data.status,
    transactionReference: data.transactionReference,
  });

  return data;
}

/**
 * Retrieves cashback loyalty points from the rewards engine
 */
export async function getRewards(walletId, requestId) {
  try {
    const url = `${NOTIFICATION_SERVICE_URL}/api/v1/rewards/${walletId}`;
    const res = await fetch(url, {
      headers: { 'x-request-id': requestId || '' },
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    logger.warn('[REST Client] Rewards service unreachable, returning fallback', {
      requestId,
      walletId,
      error: err.message,
    });
  }

  return {
    walletId,
    loyaltyPoints: 382,
    cashValueUsd: '3.82',
  };
}

export default {
  sendMoneyViaOrchestrator,
  getRewards,
};
