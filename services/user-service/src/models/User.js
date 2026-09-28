import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const userSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      default: () => `usr_${crypto.randomUUID().replace(/-/g, '')}`,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        'Please provide a valid email address',
      ],
      index: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters long'],
      select: false, // Never return password in standard queries
    },
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      maxlength: [100, 'Full name cannot exceed 100 characters'],
    },
    kycStatus: {
      type: String,
      enum: ['PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED'],
      default: 'PENDING',
    },
    tier: {
      type: String,
      enum: ['TIER_STANDARD', 'TIER_PREMIUM', 'TIER_ENTERPRISE'],
      default: 'TIER_STANDARD',
    },
    roles: {
      type: [String],
      enum: ['USER', 'ADMIN', 'COMPLIANCE'],
      default: ['USER'],
    },
    refreshTokenHash: {
      type: String,
      select: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLoginAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    optimisticConcurrency: true,
    versionKey: '__v',
  }
);

// Pre-save hook: Hash password with bcrypt before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare plaintext candidate password with hashed password
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) {
    throw new Error('Password hash not loaded in user document');
  }
  return bcrypt.compare(candidatePassword, this.password);
};

// Generate Access and Refresh JWT Tokens
userSchema.methods.generateAuthTokens = async function () {
  const accessSecret = process.env.JWT_ACCESS_SECRET || 'flow_banking_access_jwt_secret_dev_key_2026';
  const refreshSecret = process.env.JWT_REFRESH_SECRET || 'flow_banking_refresh_jwt_secret_dev_key_2026';
  const accessExpiry = process.env.JWT_ACCESS_EXPIRY || '15m';
  const refreshExpiry = process.env.JWT_REFRESH_EXPIRY || '7d';

  const payload = {
    userId: this.userId,
    email: this.email,
    tier: this.tier,
    kycStatus: this.kycStatus,
    roles: this.roles,
  };

  const accessToken = jwt.sign(payload, accessSecret, { expiresIn: accessExpiry });
  const refreshToken = jwt.sign({ userId: this.userId }, refreshSecret, { expiresIn: refreshExpiry });

  // Store hashed refresh token in database for revocation capability
  const salt = await bcrypt.genSalt(10);
  this.refreshTokenHash = await bcrypt.hash(refreshToken, salt);
  await this.save();

  return {
    accessToken,
    refreshToken,
    expiresIn: accessExpiry,
  };
};

// Return sanitized user object safe for client consumption
userSchema.methods.toSafeObject = function () {
  return {
    userId: this.userId,
    email: this.email,
    fullName: this.fullName,
    kycStatus: this.kycStatus,
    tier: this.tier,
    roles: this.roles,
    isActive: this.isActive,
    lastLoginAt: this.lastLoginAt,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

export const User = mongoose.model('User', userSchema);
export default User;
