# Flow - Digital Banking & Distributed Payment Ecosystem

## Architecture Overview (Phase 1)
Flow is an enterprise-grade distributed banking core and payment ecosystem built with a Node.js/Express MERN microservices architecture, gRPC inter-service communication, Apache Kafka event streaming, and an Apollo GraphQL Gateway (BFF).

```
                      +-----------------------------+
                      |   Client (React + Tailwind) |
                      +--------------+--------------+
                                     |
                                     v
                      +-----------------------------+
                      |   GraphQL Gateway (BFF)     |
                      +--------------+--------------+
                                     |
                    +----------------+----------------+
                    | (gRPC)                          | (REST)
                    v                                 v
        +-----------------------+         +-----------------------+
        |     Wallet Service    |         |      User Service     |
        |      (gRPC :50051)    |         |      (HTTP :4001)     |
        +-----------+-----------+         +-----------------------+
                    ^
                    | (gRPC / ExecuteTransfer, HoldFunds)
        +-----------+-----------+
        |  Transaction Service  | <====== (Kafka Event Bus) ======> [ Fraud Detection ]
        |      (HTTP :4003)     |                                   [  Notifications  ]
        +-----------------------+
```

## Monorepo Layout
```
PayNest/
├── client/
│   └── frontend/                    # React 18 + Tailwind CSS Digital Banking Web Client
├── gateway/
│   └── graphql-gateway/             # Apollo GraphQL BFF Gateway (bridges client to gRPC/REST)
├── packages/
│   └── proto/                       # Shared Protocol Buffer definitions & gRPC stubs
│       ├── wallet.proto             # Core banking ledger service contracts
│       ├── index.js                 # Dynamic proto loader & gRPC stub export
│       └── package.json
├── services/
│   ├── user-service/                # KYC, Profiles, Identity Management
│   ├── wallet-service/              # Core Ledger, Balances, Holds, Atomic Transfers (gRPC + HTTP)
│   ├── transaction-service/         # Transaction Orchestrator & Kafka Producer
│   ├── fraud-detection-service/     # Real-time transaction risk scoring & anomaly detection
│   └── notification-service/        # Multi-channel notification dispatcher
├── .gitignore                       # Production-grade gitignore
├── .prettierrc                      # Shared formatting standards
├── .prettierignore
├── eslint.config.mjs                # Modern ESLint flat configuration
├── docker-compose.yml               # Complete container topology (Kafka, Services, Gateway)
└── package.json                     # Root npm workspaces definition
```

## Running the Distributed Ecosystem (Phase 6)

### Prerequisites
- Docker Engine & Docker Compose v2+
- Node.js >= 20.0.0 & npm >= 10.0.0

### 1. Launch Complete Cluster with Docker Compose
```bash
docker compose up --build
```
This automatically boots:
- **Zookeeper** (`:2181`)
- **Apache Kafka** (`:9092` internal, `:29092` inter-broker)
- **MongoDB 7.0 Replica Set (`rs0`)** (`:27017`) for multi-document ACID transactions
- **Replica Initializer (`mongo-init`)**: Configures `rs.initiate()` and exits cleanly
- **User Service** (`:4001`)
- **Wallet Service** (HTTP `:4002`, gRPC `:50051`)
- **Transaction Service** (`:4003`)
- **Fraud Detection Service** (`:4004`)
- **Notification Service** (`:4005`)
- **GraphQL BFF Gateway** (`:4000/graphql`)
- **Client Frontend** (`:3000`)

### 2. Run End-to-End Verification Test Suite
```bash
npm run verify:e2e
# or directly:
bash scripts/verify-e2e.sh
```
The automated script executes:
1. Healthcheck sweep across all 6 microservices & Apollo gateway
2. Dual-account registration with bcrypt hashing and JWT issuance (Alice & Bob)
3. Real-time balance inspection via gRPC contract `CheckBalance`
4. P2P instant transfer through GraphQL mutation `sendMoney`
5. Verification of double-entry ledger debit/credit under OCC (`__v`)
6. Real-time fraud detection trigger ($65,000 anomaly blocking)
7. Inspection of Kafka event topics and 1.5% cashback loyalty points

## Web Client: React + Tailwind CSS (Phase 5)
A digital banking web interface built with React 18, Tailwind CSS, Apollo Client, and Lucide icons.

### Key Views & Capabilities
- **Real-Time Balance Vault**: Polls `myWallet` and `myRewards` via GraphQL/gRPC; breaks down available liquidity, active two-phase holds, and total book balances.
- **Send Money Flow**: Two-step validation wizard:
  - Step 1: Input recipient phone/wallet, amount, statement note, and real-time liquidity checks.
  - Step 2: 4-digit Transaction Security PIN verification before gRPC/Kafka dispatch.
  - Real-Time Error Feedback: Immediate user feedback on `FRAUD_REJECTED` (velocity / amount anomalies) or `INSUFFICIENT_FUNDS`.
  - Settlement Receipt: Displays ledger reference, remaining balance, and cashback points awarded.
- **Filterable Transaction Activity**: Interactive ledger journal with status tags (`Completed`, `Pending`, `Failed`), search filter, and monetary formatting.
- **Authentication**: JWT token management with Login and Registration forms, tier assignment, and persistent credentials.

## GraphQL BFF Gateway (Phase 4)
The Apollo Server v4 Gateway acts as the central Backend-For-Frontend (BFF) aggregating user accounts, real-time ledger balances via gRPC, money transfers, and loyalty rewards:

### Features
- **JWT Context Injection**: Authenticates `Authorization: Bearer <token>` and injects `{ user, requestId }` into resolvers.
- **Request Correlation IDs**: Every inbound request receives or generates `x-request-id`, propagating it to downstream gRPC and REST services.
- **Centralized Structured Logging**: Standardized JSON logs capturing latency, method, status, error stacks, and correlation IDs.
- **Sanitized Error Formatting**: Formats typed errors (`UNAUTHENTICATED`, `FRAUD_REJECTED`, `INSUFFICIENT_FUNDS`) while masking internals in production.

### Core Operations
```graphql
# Real-time balance and transaction history
query GetMyFinancialOverview {
  me {
    fullName
    email
    tier
    rewards {
      loyaltyPoints
      cashValueUsd
    }
  }
  myWallet {
    walletId
    currency
    availableBalance {
      formatted
    }
    lockedBalance {
      formatted
    }
    totalBalance {
      formatted
    }
  }
  transactionHistory(limit: 5) {
    transferId
    amount {
      formatted
    }
    type
    status
    transactionReference
    timestamp
  }
}

# Send money via recipient phone number (runs fraud checks, Kafka events & gRPC ledger)
mutation SendMoneyToPeer {
  sendMoney(
    recipientPhone: "+1-555-FLOW-RCVR"
    amount: 150.00
    note: "Dinner split"
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
    rewardPointsEarned
    riskScore
  }
}
```

## Kafka Event-Driven Architecture (Phase 3)
```
[ Client / Web App ]
         |
         v
[ Transaction Service ] --- (gRPC: CheckBalance) ---> [ Wallet Service ]
         |
         +--- Emits `transaction.initiated` ---> [ Kafka Broker ]
         |                                              |
         +--- Runs Real-Time Fraud Engine               |
         |    (Velocity >3/60s, Amounts, Geo Hop)       +---> [ Fraud Detection Consumer ]
         |                                              |      (Emits `transaction.flagged`)
         +--- (gRPC: ExecuteTransfer) ---> [ Wallet ]   |
         |                                              |
         +--- Emits `transaction.completed` ----------> +---> [ Notification Consumer ]
                                                        |      (Dispatches SMS / Email alerts)
                                                        |
                                                        +---> [ Rewards Consumer ]
                                                               (Calculates 1.5% cashback points)
```

### Kafka Topics
- `transaction.initiated`: Emitted by Transaction Service prior to ledger settlement.
- `transaction.completed`: Emitted after atomic double-entry balance debit/credit.
- `transaction.failed`: Emitted on insufficient funds, frozen accounts, or system aborts.
- `transaction.flagged`: Emitted by Fraud Detection Engine upon heuristic violation.
- `rewards.process`: Emitted to calculate and award loyalty points.

## gRPC Core Contract: `packages/proto/wallet.proto`
1. `CheckBalance(WalletId) returns (BalanceResponse)`
   - Atomic inspection of `available_balance`, `locked_balance`, and `total_balance`.
   - Explicit `Money` message using integer units and nanos to prevent IEEE 754 precision loss.
2. `HoldFunds(HoldRequest) returns (HoldResponse)`
   - Two-phase authorization / reservation of liquidity before settlement.
   - Guarded by distributed `idempotency_key` and configurable TTL.
3. `ExecuteTransfer(TransferRequest) returns (TransferResponse)`
   - Atomic double-entry transfer (debit source, credit destination).
   - Supports direct debit or capturing existing pre-authorized hold.
