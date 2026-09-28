import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

/**
 * Controller handling user authentication and lifecycle
 */
export const authController = {
  /**
   * Register a new user
   * POST /api/auth/register
   */
  register: async (req, res) => {
    try {
      const { email, password, fullName, tier } = req.body;

      // 1. Validation
      if (!email || !password || !fullName) {
        return res.status(400).json({
          success: false,
          error: 'ValidationError',
          message: 'Email, password, and full name are required.',
        });
      }

      if (password.length < 8) {
        return res.status(400).json({
          success: false,
          error: 'ValidationError',
          message: 'Password must be at least 8 characters long.',
        });
      }

      // 2. Check for duplicate email
      const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
      if (existingUser) {
        return res.status(409).json({
          success: false,
          error: 'ConflictError',
          message: 'An account with this email address already exists.',
        });
      }

      // 3. Create user document
      const user = new User({
        email: email.toLowerCase().trim(),
        password,
        fullName: fullName.trim(),
        tier: tier || 'TIER_STANDARD',
      });

      // Save user (triggers bcrypt pre-save hashing)
      await user.save();

      // 4. Issue auth tokens
      const tokens = await user.generateAuthTokens();

      return res.status(201).json({
        success: true,
        message: 'User registered successfully.',
        data: {
          user: user.toSafeObject(),
          tokens,
        },
      });
    } catch (error) {
      console.error('Registration Error:', error);
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          error: 'ValidationError',
          message: error.message,
        });
      }
      return res.status(500).json({
        success: false,
        error: 'InternalServerError',
        message: 'Failed to complete registration.',
      });
    }
  },

  /**
   * Authenticate user credentials and return tokens
   * POST /api/auth/login
   */
  login: async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: 'ValidationError',
          message: 'Email and password are required.',
        });
      }

      // Explicitly select password hash
      const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');
      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'InvalidCredentials',
          message: 'Invalid email or password.',
        });
      }

      if (!user.isActive) {
        return res.status(403).json({
          success: false,
          error: 'AccountDeactivated',
          message: 'Account is deactivated. Please contact support.',
        });
      }

      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          error: 'InvalidCredentials',
          message: 'Invalid email or password.',
        });
      }

      // Update login timestamp
      user.lastLoginAt = new Date();

      // Issue tokens and rotate refresh token hash
      const tokens = await user.generateAuthTokens();

      return res.status(200).json({
        success: true,
        message: 'Login successful.',
        data: {
          user: user.toSafeObject(),
          tokens,
        },
      });
    } catch (error) {
      console.error('Login Error:', error);
      return res.status(500).json({
        success: false,
        error: 'InternalServerError',
        message: 'An error occurred during authentication.',
      });
    }
  },

  /**
   * Get current authenticated user profile
   * GET /api/auth/me
   */
  getMe: async (req, res) => {
    try {
      return res.status(200).json({
        success: true,
        data: {
          user: req.user.toSafeObject(),
        },
      });
    } catch (error) {
      console.error('Get Profile Error:', error);
      return res.status(500).json({
        success: false,
        error: 'InternalServerError',
        message: 'Failed to retrieve user profile.',
      });
    }
  },

  /**
   * Refresh Access Token using valid Refresh Token
   * POST /api/auth/refresh
   */
  refresh: async (req, res) => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          error: 'ValidationError',
          message: 'Refresh token is required in request body.',
        });
      }

      const refreshSecret = process.env.JWT_REFRESH_SECRET || 'flow_banking_refresh_jwt_secret_dev_key_2026';

      let decoded;
      try {
        decoded = jwt.verify(refreshToken, refreshSecret);
      } catch {
        return res.status(401).json({
          success: false,
          error: 'InvalidRefreshToken',
          message: 'Refresh token is expired or invalid.',
        });
      }

      const user = await User.findOne({ userId: decoded.userId }).select('+refreshTokenHash');
      if (!user || !user.refreshTokenHash) {
        return res.status(401).json({
          success: false,
          error: 'InvalidRefreshToken',
          message: 'User session has expired or token was revoked.',
        });
      }

      // Verify token matches hash in database
      const isTokenValid = await bcrypt.compare(refreshToken, user.refreshTokenHash);
      if (!isTokenValid) {
        // Token reuse detection: invalidate token family immediately
        user.refreshTokenHash = null;
        await user.save();
        return res.status(401).json({
          success: false,
          error: 'CompromisedTokenDetected',
          message: 'Security violation: Refresh token reuse detected. Please login again.',
        });
      }

      // Generate new token pair
      const tokens = await user.generateAuthTokens();

      return res.status(200).json({
        success: true,
        message: 'Tokens refreshed successfully.',
        data: {
          tokens,
        },
      });
    } catch (error) {
      console.error('Refresh Token Error:', error);
      return res.status(500).json({
        success: false,
        error: 'InternalServerError',
        message: 'Failed to refresh authentication token.',
      });
    }
  },

  /**
   * Logout user by invalidating the refresh token
   * POST /api/auth/logout
   */
  logout: async (req, res) => {
    try {
      req.user.refreshTokenHash = null;
      await req.user.save();

      return res.status(200).json({
        success: true,
        message: 'Logged out successfully.',
      });
    } catch (error) {
      console.error('Logout Error:', error);
      return res.status(500).json({
        success: false,
        error: 'InternalServerError',
        message: 'Failed to complete logout.',
      });
    }
  },
};

export default authController;
