import mongoose from 'mongoose';

/**
 * Utility functions for precise monetary calculations avoiding IEEE 754 floating-point inaccuracies.
 */

/**
 * Convert a Mongoose Decimal128 or string to a Protobuf Money message object.
 * @param {string} currency - ISO 4217 Currency Code (e.g., 'USD')
 * @param {mongoose.Types.Decimal128|string|number} decimalVal - The monetary amount
 * @returns {object} Protobuf Money structure
 */
export function toMoneyMessage(currency, decimalVal) {
  if (decimalVal === null || decimalVal === undefined) {
    return {
      currency: currency || 'USD',
      units: '0',
      nanos: 0,
      minor_units: '0',
    };
  }

  const str = decimalVal.toString();
  const [wholePart = '0', fracPart = ''] = str.split('.');

  // Compute minor units (cents = whole * 100 + first 2 digits of fraction)
  const normalizedFrac2 = (fracPart + '00').slice(0, 2);
  const minorUnits = (BigInt(wholePart) * 100n + BigInt(normalizedFrac2)).toString();

  // Compute nanos (9 decimal places)
  const normalizedFrac9 = (fracPart + '000000000').slice(0, 9);
  const nanos = parseInt(normalizedFrac9, 10);

  return {
    currency: currency || 'USD',
    units: wholePart,
    nanos,
    minor_units: minorUnits,
  };
}

/**
 * Convert a Protobuf Money message to a Mongoose Decimal128.
 * @param {object} money - The Protobuf Money message
 * @returns {mongoose.Types.Decimal128}
 */
export function fromMoneyMessage(money) {
  if (!money) {
    return mongoose.Types.Decimal128.fromString('0.00');
  }

  if (money.minor_units !== undefined && money.minor_units !== null && money.minor_units !== '') {
    const minor = BigInt(money.minor_units);
    const whole = minor / 100n;
    const remainder = minor % 100n;
    const padded = remainder < 0n ? (-remainder).toString().padStart(2, '0') : remainder.toString().padStart(2, '0');
    return mongoose.Types.Decimal128.fromString(`${whole.toString()}.${padded}`);
  }

  const units = money.units ? money.units.toString() : '0';
  const nanos = money.nanos ? Number(money.nanos) : 0;
  const frac = Math.round(nanos / 10_000_000).toString().padStart(2, '0');
  return mongoose.Types.Decimal128.fromString(`${units}.${frac}`);
}

/**
 * Compares two Decimal128 values.
 * Returns -1 if a < b, 0 if a == b, 1 if a > b.
 */
export function compareDecimals(a, b) {
  const bigA = decimalToMinorBigInt(a);
  const bigB = decimalToMinorBigInt(b);

  if (bigA < bigB) return -1;
  if (bigA > bigB) return 1;
  return 0;
}

/**
 * Converts a Decimal128 or string into BigInt minor units (cents)
 */
export function decimalToMinorBigInt(decimalVal) {
  const str = decimalVal ? decimalVal.toString() : '0.00';
  const [whole = '0', frac = ''] = str.split('.');
  const frac2 = (frac + '00').slice(0, 2);
  const isNegative = whole.startsWith('-');
  const absWhole = isNegative ? whole.slice(1) : whole;
  const absResult = BigInt(absWhole) * 100n + BigInt(frac2);
  return isNegative ? -absResult : absResult;
}

/**
 * Converts BigInt minor units back to a Decimal128
 */
export function minorBigIntToDecimal(minorBigInt) {
  const isNegative = minorBigInt < 0n;
  const absVal = isNegative ? -minorBigInt : minorBigInt;
  const whole = absVal / 100n;
  const remainder = absVal % 100n;
  const padded = remainder.toString().padStart(2, '0');
  const str = `${isNegative ? '-' : ''}${whole.toString()}.${padded}`;
  return mongoose.Types.Decimal128.fromString(str);
}
