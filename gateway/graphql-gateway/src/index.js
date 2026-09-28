import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { typeDefs } from './schema/typeDefs.js';
import { resolvers } from './schema/resolvers.js';
import correlationIdMiddleware from './middleware/correlationId.js';
import { extractAuthContext } from './middleware/auth.js';
import logger from './config/logger.js';

dotenv.config();

const PORT = process.env.PORT || 4000;
const NODE_ENV = process.env.NODE_ENV || 'development';

/**
 * Centralized GraphQL Error Formatter
 * Sanitizes stack traces, standardizes domain codes, and binds requestId
 */
function formatGraphQLError(formattedError, error) {
  const originalError = error.originalError || error;
  const requestId = formattedError.extensions?.requestId;

  logger.error('GraphQL Execution Error', {
    requestId,
    message: formattedError.message,
    path: formattedError.path,
    code: formattedError.extensions?.code,
    originalError: originalError.message,
  });

  // Mask internal error details in production
  if (NODE_ENV === 'production' && !formattedError.extensions?.code) {
    return {
      message: 'An internal server error occurred. Please contact support with the requestId.',
      extensions: {
        code: 'INTERNAL_SERVER_ERROR',
        requestId,
      },
    };
  }

  return {
    message: formattedError.message,
    locations: formattedError.locations,
    path: formattedError.path,
    extensions: {
      code: formattedError.extensions?.code || 'INTERNAL_SERVER_ERROR',
      requestId,
      details: formattedError.extensions?.details,
    },
  };
}

async function startGateway() {
  const app = express();

  // Global Security & Correlation Middlewares
  app.use(
    helmet({
      contentSecurityPolicy: false, // Allows Apollo Sandbox & GraphQL Playground
      crossOriginEmbedderPolicy: false,
    })
  );
  app.use(cors());
  app.use(express.json());
  app.use(correlationIdMiddleware);

  // Initialize Apollo Server v4
  const apolloServer = new ApolloServer({
    typeDefs,
    resolvers,
    formatError: formatGraphQLError,
    introspection: true,
  });

  await apolloServer.start();

  // Mount Apollo middleware with Request Context injection
  app.use(
    '/graphql',
    expressMiddleware(apolloServer, {
      context: async ({ req }) => {
        const authContext = extractAuthContext(req);
        return {
          ...authContext,
          req,
        };
      },
    })
  );

  // Health and Status API
  app.get('/health', (req, res) => {
    res.status(200).json({
      service: 'graphql-gateway',
      status: 'UP',
      endpoint: '/graphql',
      requestId: req.requestId,
      timestamp: new Date().toISOString(),
    });
  });

  const server = app.listen(PORT, () => {
    logger.info(`🚀 [graphql-gateway] Operational on http://localhost:${PORT}/graphql`);
    logger.info(`📊 Sandbox Playground active at http://localhost:${PORT}/graphql`);
  });

  const shutdown = async (signal) => {
    logger.info(`Received ${signal}. Shutting down GraphQL Gateway...`);
    await apolloServer.stop();
    server.close(() => {
      logger.info('GraphQL Gateway server terminated cleanly.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startGateway().catch((err) => {
  logger.error('Fatal gateway initialization error', { error: err.message, stack: err.stack });
  process.exit(1);
});

export default startGateway;
