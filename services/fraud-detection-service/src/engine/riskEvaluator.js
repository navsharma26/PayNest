/**
 * Production Risk Heuristics Engine for Flow Banking
 * Evaluates transaction velocity, monetary anomalies, and impossible travel / geographical jumps.
 */

// In-memory sliding window cache for user/wallet transaction history (Phase 3 baseline)
const walletVelocityStore = new Map(); // walletId -> [timestampMs]
const walletLocationStore = new Map(); // walletId -> { country, city, lat, lng, timestampMs }

/**
 * Calculates Great-Circle distance between two coordinates in kilometers using Haversine formula
 */
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Evaluates comprehensive fraud and anomaly risk heuristics for a transaction
 * @param {object} transactionData
 * @param {string} transactionData.transferId
 * @param {string} transactionData.sourceWalletId
 * @param {string} transactionData.destinationWalletId
 * @param {number|string} transactionData.amount
 * @param {object} [transactionData.metadata] - Geo info, IP, device headers
 * @returns {object} Evaluation result with riskScore, decision, and triggeredRules
 */
export function evaluateTransactionRisk(transactionData) {
  const {
    transferId,
    sourceWalletId,
    destinationWalletId,
    amount,
    metadata = {},
  } = transactionData;

  const now = Date.now();
  let riskScore = 0;
  const triggeredRules = [];

  const numericAmount = parseFloat(
    typeof amount === 'object' && amount.units
      ? `${amount.units}.${(amount.nanos || 0).toString().slice(0, 2)}`
      : amount
  ) || 0;

  // =========================================================================
  // Heuristic 1: Velocity Check (> 3 transactions within 60s)
  // =========================================================================
  const windowMs = 60 * 1000;
  let timestamps = walletVelocityStore.get(sourceWalletId) || [];
  // Prune timestamps older than 60 seconds
  timestamps = timestamps.filter((ts) => now - ts < windowMs);

  if (timestamps.length >= 3) {
    riskScore += 45;
    triggeredRules.push({
      rule: 'VELOCITY_SPIKE',
      severity: 'HIGH',
      description: `Velocity limit exceeded: ${timestamps.length + 1} transactions in <60 seconds.`,
    });
  }

  // Record this transaction in velocity window
  timestamps.push(now);
  walletVelocityStore.set(sourceWalletId, timestamps);

  // =========================================================================
  // Heuristic 2: Large Monetary Amount Anomalies
  // =========================================================================
  if (numericAmount >= 50000) {
    riskScore += 55;
    triggeredRules.push({
      rule: 'CRITICAL_HIGH_VALUE_ANOMALY',
      severity: 'CRITICAL',
      description: `Transaction amount $${numericAmount.toLocaleString()} exceeds critical threshold ($50,000).`,
    });
  } else if (numericAmount >= 10000) {
    riskScore += 35;
    triggeredRules.push({
      rule: 'LARGE_VALUE_ANOMALY',
      severity: 'HIGH',
      description: `Transaction amount $${numericAmount.toLocaleString()} exceeds warning threshold ($10,000).`,
    });
  } else if (numericAmount >= 5000) {
    riskScore += 15;
    triggeredRules.push({
      rule: 'ELEVATED_VALUE_CAUTION',
      severity: 'MEDIUM',
      description: `Transaction amount $${numericAmount.toLocaleString()} requires elevated vigilance.`,
    });
  }

  // =========================================================================
  // Heuristic 3: Geographical Jump & Impossible Travel Check
  // =========================================================================
  const currentLocation = {
    country: metadata.country || 'US',
    city: metadata.city || 'New York',
    lat: metadata.lat !== undefined ? parseFloat(metadata.lat) : 40.7128,
    lng: metadata.lng !== undefined ? parseFloat(metadata.lng) : -74.006,
    timestampMs: now,
  };

  const lastLocation = walletLocationStore.get(sourceWalletId);
  if (lastLocation) {
    const elapsedHours = (now - lastLocation.timestampMs) / (1000 * 60 * 60);

    // If country suddenly switched in under 2 hours
    if (lastLocation.country !== currentLocation.country && elapsedHours < 2) {
      riskScore += 50;
      triggeredRules.push({
        rule: 'IMPOSSIBLE_TRAVEL_COUNTRY_HOP',
        severity: 'CRITICAL',
        description: `Country jumped from ${lastLocation.country} to ${currentLocation.country} in ${(elapsedHours * 60).toFixed(0)} minutes.`,
      });
    } else if (lastLocation.lat && currentLocation.lat && elapsedHours > 0) {
      const distanceKm = calculateHaversineDistance(
        lastLocation.lat,
        lastLocation.lng,
        currentLocation.lat,
        currentLocation.lng
      );
      const calculatedSpeedKmh = distanceKm / elapsedHours;

      // Commercial passenger aircraft travels ~800-900 km/h max
      if (calculatedSpeedKmh > 900 && distanceKm > 300) {
        riskScore += 50;
        triggeredRules.push({
          rule: 'IMPOSSIBLE_TRAVEL_SPEED',
          severity: 'CRITICAL',
          description: `Impossible travel speed: ${calculatedSpeedKmh.toFixed(0)} km/h across ${distanceKm.toFixed(0)} km in ${(elapsedHours * 60).toFixed(0)} minutes.`,
        });
      }
    }
  }

  // Update latest location store
  walletLocationStore.set(sourceWalletId, currentLocation);

  // =========================================================================
  // Heuristic 4: Same Source / Destination self-loop protection
  // =========================================================================
  if (sourceWalletId === destinationWalletId) {
    riskScore += 100;
    triggeredRules.push({
      rule: 'SELF_LOOP_TRANSACTION',
      severity: 'CRITICAL',
      description: 'Transaction source and destination wallets are identical.',
    });
  }

  // Cap risk score between 0 and 100
  const normalizedScore = Math.min(Math.max(riskScore, 0), 100);

  // Determine final risk decision
  let decision = 'PASS';
  if (normalizedScore >= 70) {
    decision = 'REJECT';
  } else if (normalizedScore >= 35) {
    decision = 'FLAGGED';
  }

  return {
    evaluationId: `eval_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    transferId,
    sourceWalletId,
    destinationWalletId,
    amount: numericAmount,
    riskScore: normalizedScore,
    decision,
    triggeredRules,
    evaluatedAt: new Date().toISOString(),
  };
}

export default {
  evaluateTransactionRisk,
};
