/**
 * GraphQL Gateway Type Definitions (Schema)
 * Digital Banking & Distributed Payment Ecosystem
 */

export const typeDefs = `#graphql
  enum WalletStatus {
    WALLET_STATUS_ACTIVE
    WALLET_STATUS_FROZEN
    WALLET_STATUS_SUSPENDED
    WALLET_STATUS_CLOSED
  }

  enum KycStatus {
    PENDING
    VERIFIED
    REJECTED
    SUSPENDED
  }

  enum UserTier {
    TIER_STANDARD
    TIER_PREMIUM
    TIER_ENTERPRISE
  }

  type Money {
    currency: String!
    units: String!
    nanos: Int!
    minor_units: String!
    formatted: String!
  }

  type WalletBalance {
    walletId: ID!
    userId: ID!
    currency: String!
    availableBalance: Money!
    lockedBalance: Money!
    totalBalance: Money!
    status: WalletStatus!
    lastUpdatedAt: String!
  }

  type RewardBalance {
    walletId: ID!
    loyaltyPoints: Int!
    cashValueUsd: String!
    cashbackRate: String!
  }

  type TransactionItem {
    id: ID!
    transferId: String!
    sourceWalletId: String!
    destinationWalletId: String!
    amount: Money!
    type: String!
    status: String!
    transactionReference: String!
    description: String
    timestamp: String!
  }

  type TransactionResult {
    success: Boolean!
    transferId: String!
    status: String!
    transactionReference: String!
    sourceWalletId: String!
    destinationWalletId: String!
    amountTransferred: Money!
    sourceRemainingBalance: Money
    destinationNewBalance: Money
    executedAt: String!
    rewardPointsEarned: Int
    riskScore: Int
    errorMessage: String
  }

  type User {
    id: ID!
    userId: String!
    fullName: String!
    email: String!
    kycStatus: KycStatus!
    tier: UserTier!
    wallet: WalletBalance
    rewards: RewardBalance
    transactions(limit: Int): [TransactionItem!]!
  }

  type HealthStatus {
    status: String!
    service: String!
    timestamp: String!
    walletGrpc: String!
    transactionRest: String!
  }

  type Query {
    # Returns the authenticated user's profile
    me: User

    # Retrieves real-time balance for the authenticated user's wallet via gRPC
    myWallet: WalletBalance!

    # Retrieves transaction history for the authenticated user's wallet
    transactionHistory(limit: Int): [TransactionItem!]!

    # Retrieves loyalty points & cashback balance for the authenticated user
    myRewards: RewardBalance!

    # Gateway and downstream microservices health
    health: HealthStatus!
  }

  type Mutation {
    # Send money using recipient phone identifier (orchestrated through transaction-service)
    sendMoney(
      recipientPhone: String!
      amount: Float!
      note: String
    ): TransactionResult!

    # Direct wallet-to-wallet transfer
    transferFunds(
      sourceWalletId: String
      destinationWalletId: String!
      amount: Float!
      currency: String
      description: String
    ): TransactionResult!
  }
`;

export default typeDefs;
