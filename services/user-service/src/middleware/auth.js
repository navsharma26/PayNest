import jwt from 'jsonwebtoken';
import User from '../models/User.js';

/**
 * Middleware to authenticate requests using JWT Access Tokens
 */
export async function authenticateJwt(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Authentication failed',
        message: 'Authorization header missing or format invalid. Expected: Bearer <token>',
      });
    }

    const token = authHeader.split(' ')[1];
    const accessSecret = process.env.JWT_ACCESS_SECRET || 'flow_banking_access_jwt_secret_dev_key_2026';

    let decoded;
    try {
      decoded = jwt.verify(token, accessSecret);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          error: 'TokenExpired',
          message: 'Access token has expired. Please refresh your token.',
        });
      }
      return res.status(401).json({
        success: false,
        error: 'InvalidToken',
        message: 'Access token signature or format is invalid.',
      });
    }

    // Verify user still exists and is active
    const user = await User.findOne({ userId: decoded.userId });
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'UserNotFound',
        message: 'The user associated with this token no longer exists.',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        error: 'AccountDeactivated',
        message: 'Your account has been deactivated. Please contact compliance.',
      });
    }

    // Attach user entity to request
    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication Middleware Error:', error);
    return res.status(500).json({
      success: false,
      error: 'InternalServerError',
      message: 'Failed to authenticate user.',
    });
  }
}

export default authenticateJwt;
