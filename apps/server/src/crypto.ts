/**
 * @file apps/server/src/crypto.ts
 * Cryptographic helpers for Deliverect Generic Picking webhook verification and deduplication.
 */

import crypto from 'crypto';

export interface HmacVerificationResult {
  isValid: boolean;
  headerNameFound?: string;
  signatureReceived?: string;
  signatureComputed?: string;
  error?: string;
}

/**
 * Calculates SHA-256 hash of the exact raw body string/buffer.
 */
export function hashRawBody(rawBody: string | Buffer): string {
  return crypto.createHash('sha256').update(rawBody).digest('hex');
}

/**
 * Verifies hex HMAC-SHA256 of the exact raw body.
 * Tolerant of configurable header names:
 * Default: 'x-deliverect-hmac-sha256'
 * Also accepts: 'x-server-authorization-hmac-sha256' or custom headers.
 */
export function verifyDeliverectHmac(
  rawBody: string | Buffer,
  headers: Record<string, string | string[] | undefined>,
  secret: string,
  preferredHeader: string = 'x-deliverect-hmac-sha256'
): HmacVerificationResult {
  const normalizedPreferred = preferredHeader.toLowerCase();
  const alternateHeader = 'x-server-authorization-hmac-sha256';

  // Normalize header keys in headers object to lowercase
  const lowerHeaders: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === 'string') {
      lowerHeaders[key.toLowerCase()] = value;
    } else if (Array.isArray(value) && value.length > 0) {
      lowerHeaders[key.toLowerCase()] = value[0];
    }
  }

  const signatureHeader = lowerHeaders[normalizedPreferred] || lowerHeaders[alternateHeader];
  const headerKeyFound = lowerHeaders[normalizedPreferred]
    ? normalizedPreferred
    : lowerHeaders[alternateHeader]
    ? alternateHeader
    : undefined;

  if (!signatureHeader) {
    return {
      isValid: false,
      error: `Missing HMAC signature header (looked for '${preferredHeader}' and '${alternateHeader}')`,
    };
  }

  try {
    const computedSignature = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    // Constant-time comparison to prevent timing attacks
    const sigBuffer = Buffer.from(signatureHeader.trim().toLowerCase(), 'hex');
    const compBuffer = Buffer.from(computedSignature.toLowerCase(), 'hex');

    if (sigBuffer.length !== compBuffer.length) {
      return {
        isValid: false,
        headerNameFound: headerKeyFound,
        signatureReceived: signatureHeader,
        signatureComputed: computedSignature,
        error: 'HMAC signature length mismatch',
      };
    }

    const isValid = crypto.timingSafeEqual(sigBuffer, compBuffer);

    return {
      isValid,
      headerNameFound: headerKeyFound,
      signatureReceived: signatureHeader,
      signatureComputed: computedSignature,
      error: isValid ? undefined : 'HMAC signature mismatch',
    };
  } catch (err: any) {
    return {
      isValid: false,
      headerNameFound: headerKeyFound,
      signatureReceived: signatureHeader,
      error: `HMAC calculation error: ${err.message}`,
    };
  }
}
