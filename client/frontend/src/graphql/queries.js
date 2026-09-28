import { gql } from '@apollo/client';

export const GET_MY_WALLET = gql`
  query GetMyWallet {
    myWallet {
      walletId
      userId
      currency
      availableBalance {
        units
        nanos
        minor_units
        formatted
      }
      lockedBalance {
        formatted
      }
      totalBalance {
        formatted
      }
      status
      lastUpdatedAt
    }
  }
`;

export const GET_ME = gql`
  query GetMe {
    me {
      id
      userId
      fullName
      email
      kycStatus
      tier
      rewards {
        loyaltyPoints
        cashValueUsd
        cashbackRate
      }
    }
  }
`;

export const GET_TRANSACTION_HISTORY = gql`
  query GetTransactionHistory($limit: Int) {
    transactionHistory(limit: $limit) {
      id
      transferId
      sourceWalletId
      destinationWalletId
      amount {
        formatted
        units
        nanos
      }
      type
      status
      transactionReference
      description
      timestamp
    }
  }
`;

export const GET_MY_REWARDS = gql`
  query GetMyRewards {
    myRewards {
      walletId
      loyaltyPoints
      cashValueUsd
      cashbackRate
    }
  }
`;
