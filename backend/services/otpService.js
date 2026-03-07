/**
 * otpService.js
 * Generates, stores, and verifies 6-digit OTPs.
 * Uses an in-memory Map — swap for Redis in production.
 */

const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;

/** @type {Map<string, { code: string, expiresAt: number, attempts: number }>} */
const otpStore = new Map();

/**
 * Generate a secure 6-digit OTP and store it against the phone number.
 * @param {string} phone - E.164 format, e.g. "+14155552671"
 * @returns {string} The generated OTP code
 */
export function generateOTP(phone) {
  // Clear any existing OTP for this number
  otpStore.delete(phone);

  const code = String(Math.floor(100000 + Math.random() * 900000));
  otpStore.set(phone, {
    code,
    expiresAt: Date.now() + OTP_EXPIRY_MS,
    attempts: 0,
  });

  // Auto-cleanup after expiry
  setTimeout(() => otpStore.delete(phone), OTP_EXPIRY_MS + 1000);

  return code;
}

/**
 * Verify a submitted OTP code against the stored one.
 * @param {string} phone - E.164 phone number
 * @param {string} submittedCode - The code submitted by the user
 * @returns {{ success: boolean, error?: string }}
 */
export function verifyOTP(phone, submittedCode) {
  const record = otpStore.get(phone);

  if (!record) {
    return { success: false, error: "No OTP found. Please request a new code." };
  }

  if (Date.now() > record.expiresAt) {
    otpStore.delete(phone);
    return { success: false, error: "Code has expired. Please request a new one." };
  }

  record.attempts += 1;

  if (record.attempts > MAX_ATTEMPTS) {
    otpStore.delete(phone);
    return { success: false, error: "Too many attempts. Please request a new code." };
  }

  if (record.code !== submittedCode.trim()) {
    return {
      success: false,
      error: `Incorrect code. ${MAX_ATTEMPTS - record.attempts} attempts remaining.`,
    };
  }

  // Valid — remove so it can't be reused
  otpStore.delete(phone);
  return { success: true };
}

/**
 * Check if a phone number has an active (non-expired) OTP pending.
 * @param {string} phone
 * @returns {boolean}
 */
export function hasActiveOTP(phone) {
  const record = otpStore.get(phone);
  return !!record && Date.now() < record.expiresAt;
}
