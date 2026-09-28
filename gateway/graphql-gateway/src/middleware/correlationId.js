import { v4 as uuidv4 } from 'uuid';
import logger from '../config/logger.js';

/**
 * Express middleware to propagate or assign distributed correlation IDs (x-request-id)
 */
export function correlationIdMiddleware(req, res, next) {
  const incomingId = req.headers['x-request-id'];
  const requestId = incomingId && typeof incomingId === 'string' && incomingId.trim() !== ''
    ? incomingId.trim()
    : `req_${uuidv4().replace(/-/g, '')}`;

  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);

  const startTime = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - startTime;
    logger.info('HTTP Request processed', {
      requestId,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      durationMs,
      userAgent: req.headers['user-agent'],
    });
  });

  next();
}

export default correlationIdMiddleware;
