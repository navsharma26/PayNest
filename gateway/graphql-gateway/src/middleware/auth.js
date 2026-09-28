import jwt from 'jsonwebtoken';
import logger from '../config/logger.js';

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'flow_banking_access_jwt_secret_dev_key_2026';

/**
 * Extracts and verifies JWT credentials from request headers
 * Injects authenticated user payload into Apollo context
 */
export function extractAuthContext(req) {
  const authHeader = req.headers.authorization || '';
  const requestId = req.requestId;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      user: null,
      token: null,
      requestId,
    };
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_ACCESS_SECRET);
    return {
      user: {
        userId: decoded.userId,
        email: decoded.email,
        tier: decoded.tier || 'TIER_STANDARD',
        kycStatus: decoded.kycStatus || 'VERIFIED',
        roles: decoded.roles || ['USER'],
        // Default master wallet mapping for Jane Doe or generated wallet
        walletId: decoded.walletId || (decoded.userId === 'usr_01HXYZ1234567890' ? 'wal_master_001' : `wal_${decoded.userId}`),
      },
      token,
      requestId,
    };
  } catch (err) {
    logger.warn('Invalid or expired JWT in GraphQL Gateway request', {
      requestId,
      errorName: err.name,
      errorMessage: err.message,
    });

    return {
      user: null,
      token: null,
      authError: err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN',
      requestId,
    };
  }
}

/**
 * Assertion helper ensuring resolver is accessed by an authenticated user
 */
export function requireAuth(context) {
  if (!context.user) {
    const error = new Error('You must be authenticated to perform this operation.');
    error.extensions = {
      code: 'UNAUTHENTICATED',
      http: { status: 401 },
      requestId: context.requestId,
    };
    throw error;
  }
  return context.user;
}

export const _requireAuth = requireAuth;

export default {
  extractAuthContext,
  requireAuth,
  _requireAuth,
};
