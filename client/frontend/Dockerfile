# Stage 1: Build the production bundle
FROM node:20-alpine AS builder
WORKDIR /app

# Copy root workspace manifests
COPY package*.json ./
COPY client/frontend/package*.json ./client/frontend/

# Install build dependencies
RUN npm install

# Copy frontend source files
COPY client/frontend/ ./client/frontend/

# Build static assets with Vite
WORKDIR /app/client/frontend
RUN npm run build

# Stage 2: Serve production assets via Nginx Alpine
FROM nginx:1.25-alpine AS runner
WORKDIR /usr/share/nginx/html

# Clean default nginx website
RUN rm -rf ./*

# Copy compiled SPA bundle from builder stage
COPY --from=builder /app/client/frontend/dist .

# Copy custom Nginx configuration with SPA fallback
COPY client/frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Security & non-root permissions
RUN touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid /usr/share/nginx/html /var/cache/nginx /etc/nginx/conf.d

USER nginx

EXPOSE 80

HEALTHCHECK --interval=20s --timeout=3s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:80/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
