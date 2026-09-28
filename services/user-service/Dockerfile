# Stage 1: Dependency Pruning & Builder
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
COPY packages/ ./packages/
COPY services/user-service/ ./services/user-service/

RUN npm install --omit=dev --workspace=@flow/user-service --include-workspace-root

# Stage 2: Production Container
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache dumb-init

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/packages/ ./packages/
COPY --from=builder /app/services/user-service/ ./services/user-service/

USER node
EXPOSE 4001

HEALTHCHECK --interval=15s --timeout=3s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:4001/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "services/user-service/src/index.js"]
