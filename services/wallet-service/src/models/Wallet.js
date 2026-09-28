import mongoose from 'mongoose';
import { decimalToMinorBigInt, minorBigIntToDecimal } from '../utils/money.js';

const walletSchema = new mongoose.Schema(
  {
    walletId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    currency: {
      type: String,
      required: true,
      default: 'USD',
      uppercase: true,
      minlength: 3,
      maxlength: 3,
    },
    availableBalance: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
      default: () => mongoose.Types.Decimal128.fromString('0.00'),
    },
    lockedBalance: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
      default: () => mongoose.Types.Decimal128.fromString('0.00'),
    },
    status: {
      type: String,
      enum: [
        'WALLET_STATUS_ACTIVE',
        'WALLET_STATUS_FROZEN',
        'WALLET_STATUS_SUSPENDED',
        'WALLET_STATUS_CLOSED',
      ],
      default: 'WALLET_STATUS_ACTIVE',
      index: true,
    },
    lastUpdatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    optimisticConcurrency: true, // Enables OCC based on __v
    versionKey: '__v',
  }
);

// Virtual for calculating the total book ledger balance (available + locked)
walletSchema.virtual('totalBalance').get(function () {
  const availMinor = decimalToMinorBigInt(this.availableBalance);
  const lockMinor = decimalToMinorBigInt(this.lockedBalance);
  return minorBigIntToDecimal(availMinor + lockMinor);
});

export const Wallet = mongoose.model('Wallet', walletSchema);
export default Wallet;
