import mongoose from 'mongoose';
import grpc from '@grpc/grpc-js';
import Wallet from '../models/Wallet.js';
import Hold from '../models/Hold.js';
import LedgerJournal from '../models/LedgerJournal.js';
import {
  toMoneyMessage,
  fromMoneyMessage,
  decimalToMinorBigInt,
  minorBigIntToDecimal,
} from '../utils/money.js';

/**
 * Checks if the current MongoDB deployment supports replica set multi-document transactions.
 */
let supportsTransactions = null;
async function checkTransactionSupport() {
  if (supportsTransactions !== null) return supportsTransactions;
  try {
    const isMaster = await mongoose.connection.db.admin().command({ isMaster: 1 });
    supportsTransactions = Boolean(isMaster.setName);
  } catch {
    supportsTransactions = false;
  }
  return supportsTransactions;
}

export const walletHandlers = {
  /**
   * CheckBalance retrieves real-time ledger balance for a given wallet.
   */
  CheckBalance: async (call, callback) => {
    try {
      const { wallet_id } = call.request;

      if (!wallet_id) {
        return callback({
          code: grpc.status.INVALID_ARGUMENT,
          message: 'wallet_id is required',
        });
      }

      let wallet = await Wallet.findOne({ walletId: wallet_id });
      if (!wallet) {
        // Auto-provision initial starter wallet with $1,000.00 for seamless user onboarding
        wallet = await Wallet.create({
          walletId: wallet_id,
          userId: call.request.user_id || wallet_id.replace(/^wal_/, ''),
          currency: 'USD',
          availableBalance: mongoose.Types.Decimal128.fromString('1000.00'),
          lockedBalance: mongoose.Types.Decimal128.fromString('0.00'),
          status: 'WALLET_STATUS_ACTIVE',
        });
        console.log(`✨ [wallet-service] Auto-provisioned starter wallet for: ${wallet_id}`);
      }

      const totalBalanceDecimal = wallet.totalBalance;

      return callback(null, {
        wallet_id: wallet.walletId,
        user_id: wallet.userId,
        currency: wallet.currency,
        available_balance: toMoneyMessage(wallet.currency, wallet.availableBalance),
        locked_balance: toMoneyMessage(wallet.currency, wallet.lockedBalance),
        total_balance: toMoneyMessage(wallet.currency, totalBalanceDecimal),
        status: wallet.status,
        last_updated_at: wallet.lastUpdatedAt ? wallet.lastUpdatedAt.getTime() : Date.now(),
      });
    } catch (error) {
      console.error('CheckBalance Error:', error);
      return callback({
        code: grpc.status.INTERNAL,
        message: `Failed to check balance: ${error.message}`,
      });
    }
  },

  /**
   * HoldFunds reserves an authorized amount against a wallet balance prior to settlement (Two-Phase Authorization).
   * Implements strict ACID transaction with Optimistic Concurrency Control (__v check).
   */
  HoldFunds: async (call, callback) => {
    const {
      hold_id,
      wallet_id,
      amount,
      idempotency_key,
      reason,
      reference_id,
      ttl_seconds,
      metadata,
    } = call.request;

    if (!hold_id || !wallet_id || !amount || !idempotency_key) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'hold_id, wallet_id, amount, and idempotency_key are required',
      });
    }

    try {
      // 1. Idempotency Check: Return existing hold if previously processed
      const existingHold = await Hold.findOne({ idempotencyKey: idempotency_key });
      if (existingHold) {
        const wallet = await Wallet.findOne({ walletId: existingHold.walletId });
        return callback(null, {
          hold_id: existingHold.holdId,
          wallet_id: existingHold.walletId,
          status: existingHold.status,
          held_amount: toMoneyMessage(existingHold.currency, existingHold.amount),
          remaining_available_balance: toMoneyMessage(
            wallet ? wallet.currency : 'USD',
            wallet ? wallet.availableBalance : '0.00'
          ),
          created_at: existingHold.createdAt ? existingHold.createdAt.getTime() : Date.now(),
          expires_at: existingHold.expiresAt ? existingHold.expiresAt.getTime() : Date.now(),
          error_message: '',
        });
      }

      const hasTxSupport = await checkTransactionSupport();
      const session = hasTxSupport ? await mongoose.startSession() : null;

      if (session) {
        session.startTransaction({
          readConcern: { level: 'snapshot' },
          writeConcern: { w: 'majority' },
        });
      }

      try {
        // 2. Fetch target wallet within session
        const query = Wallet.findOne({ walletId: wallet_id });
        if (session) query.session(session);
        const wallet = await query;

        if (!wallet) {
          if (session) await session.abortTransaction();
          return callback({
            code: grpc.status.NOT_FOUND,
            message: `Wallet ${wallet_id} not found`,
          });
        }

        if (wallet.status !== 'WALLET_STATUS_ACTIVE') {
          if (session) await session.abortTransaction();
          return callback(null, {
            hold_id,
            wallet_id,
            status: 'HOLD_STATUS_REJECTED',
            held_amount: toMoneyMessage(wallet.currency, '0.00'),
            remaining_available_balance: toMoneyMessage(wallet.currency, wallet.availableBalance),
            created_at: Date.now(),
            expires_at: 0,
            error_message: `Wallet is in state ${wallet.status}, cannot hold funds`,
          });
        }

        const holdMinor = decimalToMinorBigInt(fromMoneyMessage(amount));
        const availMinor = decimalToMinorBigInt(wallet.availableBalance);

        // 3. Balance verification
        if (availMinor < holdMinor) {
          if (session) await session.abortTransaction();
          return callback(null, {
            hold_id,
            wallet_id,
            status: 'HOLD_STATUS_REJECTED',
            held_amount: toMoneyMessage(wallet.currency, '0.00'),
            remaining_available_balance: toMoneyMessage(wallet.currency, wallet.availableBalance),
            created_at: Date.now(),
            expires_at: 0,
            error_message: 'Insufficient available funds for hold reservation',
          });
        }

        // 4. Optimistic Concurrency Control (OCC) Atomic Update
        // Ensures both the document version (__v) matches and balance condition holds
        const currentVersion = wallet.__v;
        const newAvailDecimal = minorBigIntToDecimal(availMinor - holdMinor);
        const newLockedDecimal = minorBigIntToDecimal(
          decimalToMinorBigInt(wallet.lockedBalance) + holdMinor
        );

        const updateConditions = {
          walletId: wallet_id,
          __v: currentVersion,
          availableBalance: { $gte: fromMoneyMessage(amount) },
        };

        const updateOptions = { new: true };
        if (session) updateOptions.session = session;

        const updatedWallet = await Wallet.findOneAndUpdate(
          updateConditions,
          {
            $set: {
              availableBalance: newAvailDecimal,
              lockedBalance: newLockedDecimal,
              lastUpdatedAt: new Date(),
            },
            $inc: { __v: 1 },
          },
          updateOptions
        );

        if (!updatedWallet) {
          if (session) await session.abortTransaction();
          return callback(null, {
            hold_id,
            wallet_id,
            status: 'HOLD_STATUS_REJECTED',
            held_amount: toMoneyMessage(wallet.currency, '0.00'),
            remaining_available_balance: toMoneyMessage(wallet.currency, wallet.availableBalance),
            created_at: Date.now(),
            expires_at: 0,
            error_message: 'Concurrency conflict: Wallet was modified concurrently. Retry operation.',
          });
        }

        // 5. Persist Hold Document
        const ttl = ttl_seconds ? Number(ttl_seconds) : 300;
        const expiresAt = new Date(Date.now() + ttl * 1000);

        const hold = new Hold({
          holdId: hold_id,
          walletId: wallet_id,
          amount: fromMoneyMessage(amount),
          currency: wallet.currency,
          idempotencyKey: idempotency_key,
          status: 'HOLD_STATUS_ACTIVE',
          reason: reason || 'PRE_AUTHORIZATION',
          referenceId: reference_id || '',
          ttlSeconds: ttl,
          expiresAt,
          metadata: metadata || {},
        });

        await hold.save(session ? { session } : {});

        if (session) await session.commitTransaction();

        return callback(null, {
          hold_id,
          wallet_id,
          status: 'HOLD_STATUS_ACTIVE',
          held_amount: toMoneyMessage(wallet.currency, hold.amount),
          remaining_available_balance: toMoneyMessage(
            wallet.currency,
            updatedWallet.availableBalance
          ),
          created_at: hold.createdAt ? hold.createdAt.getTime() : Date.now(),
          expires_at: expiresAt.getTime(),
          error_message: '',
        });
      } catch (txnError) {
        if (session) await session.abortTransaction();
        throw txnError;
      } finally {
        if (session) session.endSession();
      }
    } catch (error) {
      console.error('HoldFunds Error:', error);
      return callback({
        code: grpc.status.INTERNAL,
        message: `HoldFunds failed: ${error.message}`,
      });
    }
  },

  /**
   * ExecuteTransfer atomically debits a source wallet and credits a destination wallet.
   * Leverages MongoDB multi-document ACID transactions with Optimistic Concurrency Control (__v).
   */
  ExecuteTransfer: async (call, callback) => {
    const {
      transfer_id,
      source_wallet_id,
      destination_wallet_id,
      amount,
      idempotency_key,
      hold_id,
      description,
      metadata,
    } = call.request;

    // 1. Input Validation
    if (
      !transfer_id ||
      !source_wallet_id ||
      !destination_wallet_id ||
      !amount ||
      !idempotency_key
    ) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message:
          'transfer_id, source_wallet_id, destination_wallet_id, amount, and idempotency_key are required',
      });
    }

    if (source_wallet_id === destination_wallet_id) {
      return callback(null, {
        transfer_id,
        status: 'TRANSFER_STATUS_FAILED_INTERNAL_ERROR',
        source_wallet_id,
        destination_wallet_id,
        amount_transferred: toMoneyMessage('USD', '0.00'),
        fee_amount: toMoneyMessage('USD', '0.00'),
        source_available_balance: toMoneyMessage('USD', '0.00'),
        destination_available_balance: toMoneyMessage('USD', '0.00'),
        executed_at: Date.now(),
        transaction_reference: '',
        error_code: 'ERR_SAME_SOURCE_AND_DEST',
        error_message: 'Source and destination wallets cannot be identical.',
      });
    }

    try {
      // 2. Idempotency Check: Return existing journal entry if request already executed
      const existingJournal = await LedgerJournal.findOne({ idempotencyKey: idempotency_key });
      if (existingJournal) {
        return callback(null, {
          transfer_id: existingJournal.transferId,
          status: existingJournal.status,
          source_wallet_id: existingJournal.sourceWalletId,
          destination_wallet_id: existingJournal.destinationWalletId,
          amount_transferred: toMoneyMessage(existingJournal.currency, existingJournal.amount),
          fee_amount: toMoneyMessage(existingJournal.currency, existingJournal.feeAmount),
          source_available_balance: toMoneyMessage(
            existingJournal.currency,
            existingJournal.sourceBalanceAfter
          ),
          destination_available_balance: toMoneyMessage(
            existingJournal.currency,
            existingJournal.destinationBalanceAfter
          ),
          executed_at: existingJournal.createdAt
            ? existingJournal.createdAt.getTime()
            : Date.now(),
          transaction_reference: existingJournal.transactionReference,
          error_code: '',
          error_message: '',
        });
      }

      const hasTxSupport = await checkTransactionSupport();
      const session = hasTxSupport ? await mongoose.startSession() : null;

      if (session) {
        session.startTransaction({
          readConcern: { level: 'snapshot' },
          writeConcern: { w: 'majority' },
        });
      }

      try {
        // 3. Query source and destination wallets within session
        const srcQuery = Wallet.findOne({ walletId: source_wallet_id });
        const dstQuery = Wallet.findOne({ walletId: destination_wallet_id });
        if (session) {
          srcQuery.session(session);
          dstQuery.session(session);
        }

        const [sourceWallet, destWallet] = await Promise.all([srcQuery, dstQuery]);

        if (!sourceWallet || !destWallet) {
          if (session) await session.abortTransaction();
          return callback({
            code: grpc.status.NOT_FOUND,
            message: `Source wallet (${source_wallet_id}) or destination wallet (${destination_wallet_id}) not found`,
          });
        }

        if (
          sourceWallet.status !== 'WALLET_STATUS_ACTIVE' ||
          destWallet.status !== 'WALLET_STATUS_ACTIVE'
        ) {
          if (session) await session.abortTransaction();
          return callback(null, {
            transfer_id,
            status: 'TRANSFER_STATUS_FAILED_ACCOUNT_FROZEN',
            source_wallet_id,
            destination_wallet_id,
            amount_transferred: toMoneyMessage(sourceWallet.currency, '0.00'),
            fee_amount: toMoneyMessage(sourceWallet.currency, '0.00'),
            source_available_balance: toMoneyMessage(
              sourceWallet.currency,
              sourceWallet.availableBalance
            ),
            destination_available_balance: toMoneyMessage(
              destWallet.currency,
              destWallet.availableBalance
            ),
            executed_at: Date.now(),
            transaction_reference: '',
            error_code: 'ERR_ACCOUNT_INACTIVE',
            error_message: 'One or both accounts are frozen or inactive',
          });
        }

        const transferMinor = decimalToMinorBigInt(fromMoneyMessage(amount));
        if (transferMinor <= 0n) {
          if (session) await session.abortTransaction();
          return callback({
            code: grpc.status.INVALID_ARGUMENT,
            message: 'Transfer amount must be greater than zero',
          });
        }

        let holdRecord = null;

        // 4. Debit validation: Pre-authorized hold vs Direct balance debit
        if (hold_id) {
          const holdQuery = Hold.findOne({
            holdId: hold_id,
            walletId: source_wallet_id,
            status: 'HOLD_STATUS_ACTIVE',
          });
          if (session) holdQuery.session(session);
          holdRecord = await holdQuery;

          if (!holdRecord) {
            if (session) await session.abortTransaction();
            return callback(null, {
              transfer_id,
              status: 'TRANSFER_STATUS_FAILED_INTERNAL_ERROR',
              source_wallet_id,
              destination_wallet_id,
              amount_transferred: toMoneyMessage(sourceWallet.currency, '0.00'),
              fee_amount: toMoneyMessage(sourceWallet.currency, '0.00'),
              source_available_balance: toMoneyMessage(
                sourceWallet.currency,
                sourceWallet.availableBalance
              ),
              destination_available_balance: toMoneyMessage(
                destWallet.currency,
                destWallet.availableBalance
              ),
              executed_at: Date.now(),
              transaction_reference: '',
              error_code: 'ERR_HOLD_NOT_FOUND',
              error_message: `Active hold ${hold_id} not found for source wallet`,
            });
          }

          // Mark hold as captured
          holdRecord.status = 'HOLD_STATUS_CAPTURED';
          await holdRecord.save(session ? { session } : {});
        } else {
          // Direct debit: verify source available liquidity
          const sourceAvailMinor = decimalToMinorBigInt(sourceWallet.availableBalance);
          if (sourceAvailMinor < transferMinor) {
            if (session) await session.abortTransaction();
            return callback(null, {
              transfer_id,
              status: 'TRANSFER_STATUS_FAILED_INSUFFICIENT_FUNDS',
              source_wallet_id,
              destination_wallet_id,
              amount_transferred: toMoneyMessage(sourceWallet.currency, '0.00'),
              fee_amount: toMoneyMessage(sourceWallet.currency, '0.00'),
              source_available_balance: toMoneyMessage(
                sourceWallet.currency,
                sourceWallet.availableBalance
              ),
              destination_available_balance: toMoneyMessage(
                destWallet.currency,
                destWallet.availableBalance
              ),
              executed_at: Date.now(),
              transaction_reference: '',
              error_code: 'ERR_INSUFFICIENT_FUNDS',
              error_message: 'Source wallet has insufficient available balance for transfer.',
            });
          }
        }

        // 5. Atomic Multi-Document Updates with OCC (__v check)
        const srcVersion = sourceWallet.__v;
        const dstVersion = destWallet.__v;

        // Calculate updated balances
        let srcUpdateSet;
        if (hold_id) {
          const lockedMinor = decimalToMinorBigInt(sourceWallet.lockedBalance);
          srcUpdateSet = {
            lockedBalance: minorBigIntToDecimal(lockedMinor - transferMinor),
            lastUpdatedAt: new Date(),
          };
        } else {
          const availMinor = decimalToMinorBigInt(sourceWallet.availableBalance);
          srcUpdateSet = {
            availableBalance: minorBigIntToDecimal(availMinor - transferMinor),
            lastUpdatedAt: new Date(),
          };
        }

        const dstAvailMinor = decimalToMinorBigInt(destWallet.availableBalance);
        const dstUpdateSet = {
          availableBalance: minorBigIntToDecimal(dstAvailMinor + transferMinor),
          lastUpdatedAt: new Date(),
        };

        const srcOptions = { new: true };
        const dstOptions = { new: true };
        if (session) {
          srcOptions.session = session;
          dstOptions.session = session;
        }

        // Apply OCC on Source Wallet
        const updatedSource = await Wallet.findOneAndUpdate(
          {
            walletId: source_wallet_id,
            __v: srcVersion,
            ...(hold_id ? {} : { availableBalance: { $gte: fromMoneyMessage(amount) } }),
          },
          {
            $set: srcUpdateSet,
            $inc: { __v: 1 },
          },
          srcOptions
        );

        if (!updatedSource) {
          if (session) await session.abortTransaction();
          return callback(null, {
            transfer_id,
            status: 'TRANSFER_STATUS_FAILED_INTERNAL_ERROR',
            source_wallet_id,
            destination_wallet_id,
            amount_transferred: toMoneyMessage(sourceWallet.currency, '0.00'),
            fee_amount: toMoneyMessage(sourceWallet.currency, '0.00'),
            source_available_balance: toMoneyMessage(
              sourceWallet.currency,
              sourceWallet.availableBalance
            ),
            destination_available_balance: toMoneyMessage(
              destWallet.currency,
              destWallet.availableBalance
            ),
            executed_at: Date.now(),
            transaction_reference: '',
            error_code: 'ERR_OCC_CONFLICT_SOURCE',
            error_message: 'Concurrent modification detected on source wallet. Transaction aborted.',
          });
        }

        // Apply OCC on Destination Wallet
        const updatedDest = await Wallet.findOneAndUpdate(
          {
            walletId: destination_wallet_id,
            __v: dstVersion,
          },
          {
            $set: dstUpdateSet,
            $inc: { __v: 1 },
          },
          dstOptions
        );

        if (!updatedDest) {
          if (session) await session.abortTransaction();
          return callback(null, {
            transfer_id,
            status: 'TRANSFER_STATUS_FAILED_INTERNAL_ERROR',
            source_wallet_id,
            destination_wallet_id,
            amount_transferred: toMoneyMessage(sourceWallet.currency, '0.00'),
            fee_amount: toMoneyMessage(sourceWallet.currency, '0.00'),
            source_available_balance: toMoneyMessage(
              sourceWallet.currency,
              sourceWallet.availableBalance
            ),
            destination_available_balance: toMoneyMessage(
              destWallet.currency,
              destWallet.availableBalance
            ),
            executed_at: Date.now(),
            transaction_reference: '',
            error_code: 'ERR_OCC_CONFLICT_DEST',
            error_message: 'Concurrent modification detected on destination wallet. Transaction aborted.',
          });
        }

        // 6. Record Double-Entry Journal within the same transaction
        const txnRef = `TXN_REF_${Date.now()}_${transfer_id.replace(/^tx_/, '').slice(0, 8)}`;
        const journal = new LedgerJournal({
          transferId: transfer_id,
          sourceWalletId: source_wallet_id,
          destinationWalletId: destination_wallet_id,
          amount: fromMoneyMessage(amount),
          currency: sourceWallet.currency,
          idempotencyKey: idempotency_key,
          holdId: hold_id || undefined,
          status: 'TRANSFER_STATUS_SUCCESS',
          sourceBalanceAfter: updatedSource.availableBalance,
          destinationBalanceAfter: updatedDest.availableBalance,
          transactionReference: txnRef,
          description: description || 'Electronic Transfer',
          metadata: metadata || {},
        });

        await journal.save(session ? { session } : {});

        // 7. Commit multi-document transaction
        if (session) await session.commitTransaction();

        return callback(null, {
          transfer_id,
          status: 'TRANSFER_STATUS_SUCCESS',
          source_wallet_id,
          destination_wallet_id,
          amount_transferred: toMoneyMessage(sourceWallet.currency, journal.amount),
          fee_amount: toMoneyMessage(sourceWallet.currency, journal.feeAmount),
          source_available_balance: toMoneyMessage(
            sourceWallet.currency,
            updatedSource.availableBalance
          ),
          destination_available_balance: toMoneyMessage(
            destWallet.currency,
            updatedDest.availableBalance
          ),
          executed_at: journal.createdAt ? journal.createdAt.getTime() : Date.now(),
          transaction_reference: txnRef,
          error_code: '',
          error_message: '',
        });
      } catch (txnError) {
        if (session) await session.abortTransaction();
        throw txnError;
      } finally {
        if (session) session.endSession();
      }
    } catch (error) {
      console.error('ExecuteTransfer Error:', error);
      return callback({
        code: grpc.status.INTERNAL,
        message: `ExecuteTransfer failed: ${error.message}`,
      });
    }
  },
};

export default walletHandlers;
