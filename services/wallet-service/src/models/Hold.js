import mongoose from 'mongoose';

const holdSchema = new mongoose.Schema(
  {
    holdId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    walletId: {
      type: String,
      required: true,
      index: true,
    },
    amount: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
    },
    currency: {
      type: String,
      required: true,
      default: 'USD',
    },
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: [
        'HOLD_STATUS_ACTIVE',
        'HOLD_STATUS_RELEASED',
        'HOLD_STATUS_CAPTURED',
        'HOLD_STATUS_EXPIRED',
        'HOLD_STATUS_REJECTED',
      ],
      default: 'HOLD_STATUS_ACTIVE',
      index: true,
    },
    reason: {
      type: String,
      default: 'PRE_AUTHORIZATION',
    },
    referenceId: {
      type: String,
    },
    ttlSeconds: {
      type: Number,
      default: 300, // 5 minutes default
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    metadata: {
      type: Map,
      of: String,
      default: {},
    },
  },
  {
    timestamps: true,
    versionKey: '__v',
  }
);

export const Hold = mongoose.model('Hold', holdSchema);
export default Hold;
