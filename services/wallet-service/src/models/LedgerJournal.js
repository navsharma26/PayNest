import mongoose from 'mongoose';

const ledgerJournalSchema = new mongoose.Schema(
  {
    transferId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    sourceWalletId: {
      type: String,
      required: true,
      index: true,
    },
    destinationWalletId: {
      type: String,
      required: true,
      index: true,
    },
    amount: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
    },
    feeAmount: {
      type: mongoose.Schema.Types.Decimal128,
      default: () => mongoose.Types.Decimal128.fromString('0.00'),
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
    holdId: {
      type: String,
      index: true,
    },
    status: {
      type: String,
      enum: [
        'TRANSFER_STATUS_SUCCESS',
        'TRANSFER_STATUS_PENDING',
        'TRANSFER_STATUS_FAILED',
      ],
      default: 'TRANSFER_STATUS_SUCCESS',
      index: true,
    },
    sourceBalanceAfter: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
    },
    destinationBalanceAfter: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
    },
    transactionReference: {
      type: String,
      required: true,
      unique: true,
    },
    description: {
      type: String,
      default: 'Electronic Balance Transfer',
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

export const LedgerJournal = mongoose.model('LedgerJournal', ledgerJournalSchema);
export default LedgerJournal;
