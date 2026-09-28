import { gql } from '@apollo/client';

export const SEND_MONEY = gql`
  mutation SendMoney($recipientPhone: String!, $amount: Float!, $note: String) {
    sendMoney(recipientPhone: $recipientPhone, amount: $amount, note: $note) {
      success
      transferId
      status
      transactionReference
      sourceWalletId
      destinationWalletId
      amountTransferred {
        formatted
      }
      sourceRemainingBalance {
        formatted
      }
      destinationNewBalance {
        formatted
      }
      executedAt
      rewardPointsEarned
      riskScore
      errorMessage
    }
  }
`;

export const TRANSFER_FUNDS = gql`
  mutation TransferFunds(
    $sourceWalletId: String
    $destinationWalletId: String!
    $amount: Float!
    $currency: String
    $description: String
  ) {
    transferFunds(
      sourceWalletId: $sourceWalletId
      destinationWalletId: $destinationWalletId
      amount: $amount
      currency: $currency
      description: $description
    ) {
      success
      transferId
      status
      transactionReference
      amountTransferred {
        formatted
      }
      sourceRemainingBalance {
        formatted
      }
      executedAt
      errorMessage
    }
  }
`;
