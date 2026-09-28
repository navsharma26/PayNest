import mongoose from 'mongoose';
import Wallet from '../models/Wallet.js';

/**
 * Seeds baseline default wallets if empty (for local dev / demo flows)
 */
export async function seedDefaultWallets() {
  try {
    const count = await Wallet.countDocuments();
    if (count === 0) {
      console.log('🌱 [wallet-service] Seeding initial test wallets into MongoDB...');

      await Wallet.create([
        {
          walletId: 'wal_master_001',
          userId: 'usr_01HXYZ1234567890',
          currency: 'USD',
          availableBalance: mongoose.Types.Decimal128.fromString('25450.00'),
          lockedBalance: mongoose.Types.Decimal128.fromString('1500.00'),
          status: 'WALLET_STATUS_ACTIVE',
        },
        {
          walletId: 'wal_dest_002',
          userId: 'usr_02BABC9876543210',
          currency: 'USD',
          availableBalance: mongoose.Types.Decimal128.fromString('8200.00'),
          lockedBalance: mongoose.Types.Decimal128.fromString('0.00'),
          status: 'WALLET_STATUS_ACTIVE',
        },
      ]);

      console.log('✅ [wallet-service] Initial test wallets seeded successfully.');
    }
  } catch (error) {
    console.error('⚠️ [wallet-service] Seeding error:', error.message);
  }
}

export default seedDefaultWallets;
