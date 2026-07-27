import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export function validatePin(pin, label = 'PIN') {
  const value = String(pin ?? '').trim();
  if (!/^\d{4,8}$/.test(value)) {
    const error = new Error(`${label} harus berupa 4 hingga 8 angka`);
    error.status = 400;
    throw error;
  }
  return value;
}

export function createPinHash(pin) {
  const normalized = validatePin(pin);
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(normalized, salt, 32).toString('hex');
  return { algorithm: 'scrypt', salt, hash };
}

export function verifyPinHash(record, pin) {
  const normalizedPin = String(pin ?? '').trim();
  if (!/^\d{4,8}$/.test(normalizedPin)) return false;
  if (!record?.salt || !record?.hash || !/^[0-9a-f]+$/i.test(record.hash)) return false;
  const expected = Buffer.from(record.hash, 'hex');
  if (!expected.length) return false;
  let actual;
  try {
    actual = scryptSync(normalizedPin, record.salt, expected.length);
  } catch {
    return false;
  }
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function matchingCredentialKeys(pin, credentials = []) {
  return credentials
    .filter((credential) => verifyPinHash(credential?.hash, pin))
    .map((credential) => credential.key);
}

export class LoginLimiter {
  #records = new Map();
  #maxFailures;
  #windowMs;
  #lockMs;

  constructor({ maxFailures = 5, windowMs = 10 * 60_000, lockMs = 60_000 } = {}) {
    this.#maxFailures = maxFailures;
    this.#windowMs = windowMs;
    this.#lockMs = lockMs;
  }

  status(key, now = Date.now()) {
    const record = this.#records.get(key);
    if (!record) return { allowed: true, retryAfterMs: 0 };
    if (record.lockedUntil > now) {
      return { allowed: false, retryAfterMs: record.lockedUntil - now };
    }
    if (now - record.firstFailureAt > this.#windowMs) {
      this.#records.delete(key);
      return { allowed: true, retryAfterMs: 0 };
    }
    return { allowed: true, retryAfterMs: 0 };
  }

  fail(key, now = Date.now()) {
    let record = this.#records.get(key);
    if (!record || now - record.firstFailureAt > this.#windowMs) {
      record = { failures: 0, firstFailureAt: now, lockedUntil: 0 };
    }
    record.failures += 1;
    if (record.failures >= this.#maxFailures) record.lockedUntil = now + this.#lockMs;
    this.#records.set(key, record);
    return this.status(key, now);
  }

  success(key) {
    this.#records.delete(key);
  }
}
