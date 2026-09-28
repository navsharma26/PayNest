import grpc from '@grpc/grpc-js';
import { loadWalletProto } from '@flow/proto';
import logger from '../config/logger.js';

const WALLET_GRPC_HOST = process.env.WALLET_GRPC_HOST || 'localhost:50051';

const proto = loadWalletProto();
const walletStub = new proto.flow.wallet.v1.WalletService(
  WALLET_GRPC_HOST,
  grpc.credentials.createInsecure()
);

/**
 * Invokes CheckBalance via gRPC with requestId tracing
 */
export function checkBalance(walletId, requestId) {
  return new Promise((resolve, reject) => {
    const deadline = new Date(Date.now() + 5000); // 5s deadline
    walletStub.CheckBalance({ wallet_id: walletId }, { deadline }, (err, response) => {
      if (err) {
        logger.error(`[gRPC] CheckBalance failed for ${walletId}`, {
          requestId,
          walletId,
          grpcCode: err.code,
          errorMessage: err.message,
        });
        return reject(err);
      }
      resolve(response);
    });
  });
}

/**
 * Invokes ExecuteTransfer via gRPC with requestId tracing
 */
export function executeTransfer(transferPayload, requestId) {
  return new Promise((resolve, reject) => {
    const deadline = new Date(Date.now() + 10000); // 10s deadline
    walletStub.ExecuteTransfer(transferPayload, { deadline }, (err, response) => {
      if (err) {
        logger.error(`[gRPC] ExecuteTransfer failed for ${transferPayload.transfer_id}`, {
          requestId,
          transferId: transferPayload.transfer_id,
          grpcCode: err.code,
          errorMessage: err.message,
        });
        return reject(err);
      }
      resolve(response);
    });
  });
}

export default {
  checkBalance,
  executeTransfer,
};
