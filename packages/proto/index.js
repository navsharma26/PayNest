import path from 'path';
import { fileURLToPath } from 'url';
import protoLoader from '@grpc/proto-loader';
import grpc from '@grpc/grpc-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const PROTO_PATHS = {
  wallet: path.join(__dirname, 'wallet.proto'),
};

const DEFAULT_LOADER_OPTIONS = {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
};

/**
 * Loads the wallet protobuf package definition
 */
export function loadWalletProto(options = {}) {
  const packageDefinition = protoLoader.loadSync(PROTO_PATHS.wallet, {
    ...DEFAULT_LOADER_OPTIONS,
    ...options,
  });
  return grpc.loadPackageDefinition(packageDefinition);
}

export default {
  PROTO_PATHS,
  loadWalletProto,
};
