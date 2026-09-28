import { v4 as uuidv4 } from 'uuid';
import { _requireAuth } from '../middleware/auth.js';
import { checkBalance } from '../services/walletClient.js';
import { sendMoneyViaOrchestrator, getRewards } from '../services/transactionClient.js';
import logger from '../config/logger.js';

// Phone-to-wallet directory (Simulated DNS / Directory lookup for Phase 4)
const PHONE_DIRECTORY = new Map([
  ['+1-555-FLOW-RCVR', 'wal_dest_002'],
  ['+1-555-FLOW-SNDR', 'wal_master_001'],
  ['+15555550199', 'wal_dest_002'],
  ['555-0199', 'wal_dest_002'],
]);

function formatMoney(units, nanos, currency = 'USD') {
  const numUnits = parseInt(units || '0', 10);
  const cents = Math.round((nanos || 0) / 10_000_000);
  const sign = currency === 'USD' ? '$' : `${currency} `;
  return `${sign}${numUnits.toLocaleString('en-US')}.${cents.toString().padStart(2, '0')}`;
}

export const resolvers = {
  Money: {
    formatted: (parent) => {
      return formatMoney(parent.units, parent.nanos, parent.currency);
    },
  },

  Query: {
    health: () => ({
      status: 'UP',
      service: 'graphql-gateway',
      timestamp: new Date().toISOString(),
      walletGrpc: process.env.WALLET_GRPC_HOST || 'localhost:50051',
      transactionRest: process.env.TRANSACTION_SERVICE_URL || 'http://localhost:4003',
    }),

    me: async (_, __, context) => {
      // In dev sandbox, fallback to Jane Doe if unauthenticated
      const user = context.user || {
        id: 'usr_01HXYZ1234567890',
        userId: 'usr_01HXYZ1234567890',
        fullName: 'Jane Doe',
        email: 'jane.doe@flowbank.io',
        kycStatus: 'VERIFIED',
        tier: 'TIER_PREMIUM',
        walletId: 'wal_master_001',
      };

      return {
        id: user.userId,
        userId: user.userId,
        fullName: user.fullName || 'Jane Doe',
        email: user.email,
        kycStatus: user.kycStatus,
        tier: user.tier,
        walletId: user.walletId,
      };
    },

    myWallet: async (_, __, context) => {
      const user = context.user || {
        userId: 'usr_01HXYZ1234567890',
        walletId: 'wal_master_001',
      };

      const walletId = user.walletId || 'wal_master_001';

      logger.info('Resolving myWallet via gRPC', {
        requestId: context.requestId,
        walletId,
      });

      const grpcRes = await checkBalance(walletId, context.requestId);

      return {
        walletId: grpcRes.wallet_id,
        userId: grpcRes.user_id,
        currency: grpcRes.currency,
        availableBalance: grpcRes.available_balance,
        lockedBalance: grpcRes.locked_balance,
        totalBalance: grpcRes.total_balance,
        status: grpcRes.status,
        lastUpdatedAt: new Date(Number(grpcRes.last_updated_at)).toISOString(),
      };
    },

    transactionHistory: async (_, { limit = 10 }, context) => {
      const user = context.user || { walletId: 'wal_master_001' };
      const walletId = user.walletId || 'wal_master_001';

      // Seeded realistic ledger transaction history for Phase 4
      return [
        {
          id: 'tx_hist_01',
          transferId: 'tx_01HXYZ9991',
          sourceWalletId: walletId,
          destinationWalletId: 'wal_dest_002',
          amount: { currency: 'USD', units: '250', nanos: 0, minor_units: '25000', formatted: '$250.00' },
          type: 'DEBIT',
          status: 'SETTLED',
          transactionReference: 'TXN_REF_17112001_8812',
          description: 'Payment to Bob Smith',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          id: 'tx_hist_02',
          transferId: 'tx_01HXYZ9992',
          sourceWalletId: 'wal_dest_002',
          destinationWalletId: walletId,
          amount: { currency: 'USD', units: '1200', nanos: 500000000, minor_units: '120050', formatted: '$1,200.50' },
          type: 'CREDIT',
          status: 'SETTLED',
          transactionReference: 'TXN_REF_17111802_4491',
          description: 'Payroll Direct Deposit',
          timestamp: new Date(Date.now() - 86400000).toISOString(),
        },
      ].slice(0, limit);
    },

    myRewards: async (_, __, context) => {
      const user = context.user || { walletId: 'wal_master_001' };
      const walletId = user.walletId || 'wal_master_001';

      const rewardsData = await getRewards(walletId, context.requestId);

      return {
        walletId,
        loyaltyPoints: rewardsData.loyaltyPoints,
        cashValueUsd: rewardsData.cashValueUsd,
        cashbackRate: '1.5% Premium',
      };
    },
  },

  User: {
    wallet: async (parent, _, context) => {
      const walletId = parent.walletId || 'wal_master_001';
      try {
        const grpcRes = await checkBalance(walletId, context.requestId);
        return {
          walletId: grpcRes.wallet_id,
          userId: grpcRes.user_id,
          currency: grpcRes.currency,
          availableBalance: grpcRes.available_balance,
          lockedBalance: grpcRes.locked_balance,
          totalBalance: grpcRes.total_balance,
          status: grpcRes.status,
          lastUpdatedAt: new Date(Number(grpcRes.last_updated_at)).toISOString(),
        };
      } catch (err) {
        logger.error('Failed to resolve User.wallet', { walletId, error: err.message });
        return null;
      }
    },
    rewards: async (parent, _, context) => {
      const walletId = parent.walletId || 'wal_master_001';
      const data = await getRewards(walletId, context.requestId);
      return {
        walletId,
        loyaltyPoints: data.loyaltyPoints,
        cashValueUsd: data.cashValueUsd,
        cashbackRate: '1.5% Premium',
      };
    },
    transactions: async (_, { limit = 5 }, context) => {
      return resolvers.Query.transactionHistory(null, { limit }, context);
    },
  },

  Mutation: {
    sendMoney: async (_, { recipientPhone, amount, note }, context) => {
      const user = context.user || {
        userId: 'usr_01HXYZ1234567890',
        walletId: 'wal_master_001',
      };

      if (amount <= 0) {
        const err = new Error('Transfer amount must be strictly greater than $0.00');
        err.extensions = { code: 'BAD_USER_INPUT', requestId: context.requestId };
        throw err;
      }

      // 1. Resolve recipient phone to destination wallet ID
      const cleanedPhone = recipientPhone.trim();
      const destinationWalletId = PHONE_DIRECTORY.get(cleanedPhone) || 'wal_dest_002';

      logger.info('Resolving sendMoney mutation', {
        requestId: context.requestId,
        sourceWalletId: user.walletId,
        recipientPhone: cleanedPhone,
        destinationWalletId,
        amount,
      });

      // 2. Forward to Transaction Orchestrator (executes gRPC balance check, Kafka events, fraud check, ledger debit)
      const orchestratorResult = await sendMoneyViaOrchestrator(
        {
          sourceWalletId: user.walletId || 'wal_master_001',
          destinationWalletId,
          amount,
          currency: 'USD',
          idempotencyKey: `idemp_${uuidv4().replace(/-/g, '')}`,
          description: note || `Transfer to ${cleanedPhone}`,
          metadata: {
            recipientPhone: cleanedPhone,
            channel: 'GRAPHQL_GATEWAY',
            callerUserId: user.userId,
            requestId: context.requestId,
          },
        },
        context.requestId
      );

      // 3. Compute cashback points earned
      const pointsEarned = Math.round(amount * 0.015 * 100);

      return {
        success: true,
        transferId: orchestratorResult.transferId,
        status: orchestratorResult.status,
        transactionReference: orchestratorResult.transactionReference,
        sourceWalletId: orchestratorResult.sourceWalletId,
        destinationWalletId: orchestratorResult.destinationWalletId,
        amountTransferred: orchestratorResult.amountTransferred,
        sourceRemainingBalance: orchestratorResult.sourceRemainingBalance,
        destinationNewBalance: orchestratorResult.destinationNewBalance,
        executedAt: new Date(Number(orchestratorResult.executedAt)).toISOString(),
        rewardPointsEarned: pointsEarned,
        riskScore: orchestratorResult.riskEvaluation?.riskScore || 10,
        errorMessage: null,
      };
    },

    transferFunds: async (
      _,
      { sourceWalletId, destinationWalletId, amount, currency = 'USD', description },
      context
    ) => {
      const user = context.user || { walletId: 'wal_master_001' };
      const source = sourceWalletId || user.walletId || 'wal_master_001';

      const result = await sendMoneyViaOrchestrator(
        {
          sourceWalletId: source,
          destinationWalletId,
          amount,
          currency,
          idempotencyKey: `idemp_${uuidv4().replace(/-/g, '')}`,
          description: description || 'Wallet-to-Wallet Direct Transfer',
          metadata: {
            channel: 'GRAPHQL_GATEWAY',
            requestId: context.requestId,
          },
        },
        context.requestId
      );

      return {
        success: true,
        transferId: result.transferId,
        status: result.status,
        transactionReference: result.transactionReference,
        sourceWalletId: result.sourceWalletId,
        destinationWalletId: result.destinationWalletId,
        amountTransferred: result.amountTransferred,
        sourceRemainingBalance: result.sourceRemainingBalance,
        destinationNewBalance: result.destinationNewBalance,
        executedAt: new Date(Number(result.executedAt)).toISOString(),
        rewardPointsEarned: Math.round(amount * 0.015 * 100),
        riskScore: result.riskEvaluation?.riskScore || 10,
        errorMessage: null,
      };
    },
  },
};

export default resolvers;
