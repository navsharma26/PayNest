import { createKafkaClient, createConsumer, TOPICS } from '@flow/kafka';

let consumerInstance = null;

// In-memory rewards loyalty ledger for Phase 3
const rewardsLedger = new Map(); // walletId -> totalPoints

/**
 * Calculates cashback points and updates rewards balance
 */
function processCashbackReward({ transferId, walletId, amountTransferred }) {
  const numericAmount = parseFloat(amountTransferred) || 0;
  if (numericAmount <= 0) return;

  // 1.5% cashback points calculation (15 points per $10 spent)
  const cashbackPercentage = 0.015;
  const cashbackDollars = numericAmount * cashbackPercentage;
  const pointsEarned = Math.round(cashbackDollars * 100); // 100 points = $1

  const currentPoints = rewardsLedger.get(walletId) || 0;
  const newPointsTotal = currentPoints + pointsEarned;
  rewardsLedger.set(walletId, newPointsTotal);

  console.log(`\n======================================================`);
  console.log(`🎁 [REWARDS ENGINE] Cashback Calculated!`);
  console.log(`💳 Wallet: ${walletId}`);
  console.log(`💸 Transfer Amount: $${numericAmount.toFixed(2)}`);
  console.log(`⭐ Points Earned: +${pointsEarned} Flow Points ($${cashbackDollars.toFixed(2)} value)`);
  console.log(`🏆 Total Loyalty Balance: ${newPointsTotal} Flow Points`);
  console.log(`🆔 Transfer Ref: ${transferId}`);
  console.log(`======================================================\n`);

  return {
    walletId,
    pointsEarned,
    newPointsTotal,
    cashbackDollars,
  };
}

/**
 * Starts the Rewards Kafka consumer loop
 */
export async function startRewardsConsumer() {
  const kafka = createKafkaClient({
    clientId: 'rewards-service-consumer',
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  });

  consumerInstance = createConsumer(kafka, {
    groupId: 'flow-rewards-group',
    topics: [TOPICS.REWARDS_PROCESS],
    fromBeginning: false,
  });

  try {
    await consumerInstance.connect();
    console.log('🎁 [RewardsConsumer] Listening for "rewards.process" events...');

    await consumerInstance.startConsuming(async (event) => {
      const data = event.data;
      if (!data) return;

      processCashbackReward({
        transferId: data.transferId,
        walletId: data.walletId,
        amountTransferred: data.amountTransferred,
      });
    });
  } catch (error) {
    console.error('❌ [RewardsConsumer] Startup failure:', error.message);
  }
}

export async function stopRewardsConsumer() {
  if (consumerInstance) await consumerInstance.disconnect();
}

export function getWalletRewards(walletId) {
  return rewardsLedger.get(walletId) || 0;
}

export default {
  startRewardsConsumer,
  stopRewardsConsumer,
  getWalletRewards,
};
