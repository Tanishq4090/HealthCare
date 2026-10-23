import { supabase } from '../lib/supabase';
import { logAudit } from './auditService';
import { verifyTOTPCode } from './totpService';
import type { User } from '../contexts/AuthContext';

export interface TwoFactorChallenge {
    challengeId: string;
    userId: string;
    username: string;
    name: string;
    role: string;
    hashedCode: string;
    salt: string;
    createdAt: number;
    expiresAt: number;
    attempts: number;
    targetPhone?: string;
    maskedTarget?: string;
    dispatchedVia?: 'totp' | 'sms' | 'whatsapp' | 'local_secure';
    totpSecret?: string;
}

const CHALLENGE_KEY = '99care_2fa_pending_challenge';
const EMERGENCY_ADMIN_KEY = '99CARE-SECURE-2026';

/**
 * SHA-256 helper for client-side challenge hashing
 */
async function sha256(str: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generates a cryptographically random 6-digit code
 */
function generateSecureOTP(): string {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    const codeNumber = 100000 + (array[0] % 900000);
    return codeNumber.toString();
}

/**
 * Normalizes an Indian phone number to E.164 format
 */
export function normalizePhoneNumber(raw?: string): string {
    if (!raw) return '';
    const digits = raw.replace(/\D/g, '');
    if (!digits) return '';
    if (digits.length === 10) return `+91${digits}`;
    if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
    return raw.startsWith('+') ? raw : `+${digits}`;
}

/**
 * Masks a phone number for UI display (e.g. +91 90161 16564 -> +91 90161 ••••64)
 */
export function maskPhoneFor2FA(rawPhone?: string): string {
    if (!rawPhone) return 'No Phone Configured';
    const clean = rawPhone.replace(/\D/g, '');
    if (clean.length < 10) return 'Registered Device';
    const last2 = clean.slice(-2);
    const first5 = clean.length >= 12 ? clean.slice(2, 7) : clean.slice(0, 5);
    return `+91 ${first5} ••••${last2}`;
}

/**
 * Resolves all available phone numbers for a user.
 * Returns empty array if no phone numbers are configured.
 */
export function getUserPhoneNumbers(user: User): string[] {
    const rawList = Array.isArray(user.phone_numbers) && user.phone_numbers.length > 0
        ? user.phone_numbers
        : (user.phone ? [user.phone] : []);

    const cleaned = Array.from(new Set(rawList.map(normalizePhoneNumber).filter(Boolean)));
    return cleaned;
}

/**
 * Initiates Two-Factor Authentication for an admin user.
 * If no phone numbers are configured or isBypassMode is true, requires the master emergency key directly.
 */
export async function initiateAdminTwoFactor(
    user: User,
    selectedPhone?: string,
    isBypassMode?: boolean,
    totpSecret?: string
): Promise<{
    challengeId: string;
    targetPhone: string;
    maskedPhone: string;
    availablePhones: string[];
    expiresInSeconds: number;
    devCode?: string;
    requiresBypassKey?: boolean;
    dispatchedVia?: 'totp' | 'sms' | 'whatsapp' | 'local_secure';
}> {
    const activeTotpSecret = totpSecret || user.totp_secret;

    // 1. Google Authenticator TOTP: 100% Free App Verification (zero SMS / telecom fees)
    if (activeTotpSecret) {
        const challengeId = crypto.randomUUID();
        const now = Date.now();
        const expiresAt = now + 10 * 60 * 1000;

        const challenge: TwoFactorChallenge = {
            challengeId,
            userId: user.id,
            username: user.username,
            name: user.name,
            role: user.role,
            hashedCode: '',
            salt: '',
            createdAt: now,
            expiresAt,
            attempts: 0,
            maskedTarget: 'Google Authenticator',
            dispatchedVia: 'totp',
            totpSecret: activeTotpSecret
        };

        sessionStorage.setItem(CHALLENGE_KEY, JSON.stringify(challenge));

        return {
            challengeId,
            targetPhone: '',
            maskedPhone: 'Google Authenticator App',
            availablePhones: [],
            expiresInSeconds: 600,
            devCode: undefined,
            requiresBypassKey: false,
            dispatchedVia: 'totp'
        };
    }

    const availablePhones = getUserPhoneNumbers(user);
    const requiresBypassKey = isBypassMode || availablePhones.length === 0;

    const otp = generateSecureOTP();
    const salt = crypto.randomUUID();
    const hashedCode = await sha256(`${salt}:${otp}`);
    const challengeId = crypto.randomUUID();
    const now = Date.now();
    const expiresAt = now + 10 * 60 * 1000; // 10 minutes

    let targetPhone = '';
    let dispatchedVia: 'totp' | 'sms' | 'whatsapp' | 'local_secure' = 'local_secure';

    if (!requiresBypassKey && availablePhones.length > 0) {
        targetPhone = (selectedPhone && availablePhones.includes(normalizePhoneNumber(selectedPhone)))
            ? normalizePhoneNumber(selectedPhone)
            : availablePhones[0];

        const cleanDigits = targetPhone.replace(/\D/g, '');
        const clean10 = cleanDigits.slice(-10);

        // 1. Primary: Direct Cellular SMS via Fast2SMS (delivers to native Messages app)
        try {
            const { data: smsData, error: smsError } = await supabase.functions.invoke('send-sms-otp', {
                body: {
                    phone: clean10,
                    otp,
                    purpose: 'admin_2fa_login'
                }
            });

            if (!smsError && smsData?.success) {
                dispatchedVia = 'sms';
            } else {
                console.warn('Fast2SMS dispatch note:', smsData || smsError);
            }
        } catch (smsErr) {
            console.warn('SMS dispatch error:', smsErr);
        }

        // 2. Also attempt WhatsApp delivery in parallel
        try {
            const message = `🔐 *99 Care OS Admin Security*\n\nYour 2-Factor Authentication login code is: *${otp}*\n\nValid for 10 minutes. For security, never share this code.`;
            const { error: waError } = await supabase.functions.invoke('meta-whatsapp-outbound', {
                body: {
                    recipient: cleanDigits,
                    phone: cleanDigits,
                    message,
                    type: 'admin_2fa_otp'
                }
            });

            if (!waError && dispatchedVia === 'local_secure') {
                dispatchedVia = 'whatsapp';
            }
        } catch (err) {
            console.warn('WhatsApp 2FA dispatch fallback:', err);
        }
    }

    const challenge: TwoFactorChallenge = {
        challengeId,
        userId: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        hashedCode,
        salt,
        createdAt: now,
        expiresAt,
        attempts: 0,
        targetPhone: targetPhone || undefined,
        maskedTarget: targetPhone ? maskPhoneFor2FA(targetPhone) : 'No Phone Registered',
        dispatchedVia
    };

    sessionStorage.setItem(CHALLENGE_KEY, JSON.stringify(challenge));

    // Expose devCode in non-production only if an OTP was actually generated for delivery
    const isLocal = typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

    return {
        challengeId,
        targetPhone,
        maskedPhone: challenge.maskedTarget || 'No Phone Registered',
        availablePhones,
        expiresInSeconds: 600,
        devCode: (!requiresBypassKey && isLocal) ? otp : undefined,
        requiresBypassKey,
        dispatchedVia
    };
}

/**
 * Validates the entered 6-digit OTP code or Emergency Admin Passcode
 */
export async function verifyAdminTwoFactor(
    challengeId: string,
    enteredCode: string
): Promise<{ success: boolean; error?: string }> {
    const raw = sessionStorage.getItem(CHALLENGE_KEY);
    if (!raw) {
        return { success: false, error: '2FA session expired. Please sign in again.' };
    }

    let challenge: TwoFactorChallenge;
    try {
        challenge = JSON.parse(raw);
    } catch {
        sessionStorage.removeItem(CHALLENGE_KEY);
        return { success: false, error: 'Invalid challenge data. Please sign in again.' };
    }

    if (challenge.challengeId !== challengeId) {
        return { success: false, error: 'Challenge session mismatch. Please sign in again.' };
    }

    if (Date.now() > challenge.expiresAt) {
        sessionStorage.removeItem(CHALLENGE_KEY);
        return { success: false, error: 'Verification code expired (10 min limit). Please request a new code.' };
    }

    if (challenge.attempts >= 5) {
        sessionStorage.removeItem(CHALLENGE_KEY);
        return { success: false, error: 'Too many incorrect attempts. Please sign in again.' };
    }

    const cleanCode = enteredCode.trim().toUpperCase();

    // Check emergency override passcode
    if (cleanCode === EMERGENCY_ADMIN_KEY) {
        sessionStorage.removeItem(CHALLENGE_KEY);
        await logAudit({
            entityType: 'admin' as any,
            entityId: challenge.userId,
            entityName: challenge.name,
            action: 'EDIT',
            description: `Admin emergency bypass key utilized for 2FA login by ${challenge.username}`,
            userId: challenge.userId,
            userName: challenge.name,
            userRole: challenge.role,
        });
        return { success: true };
    }

    // Verify Google Authenticator TOTP if active for this challenge
    if (challenge.totpSecret) {
        const isTotpValid = await verifyTOTPCode(challenge.totpSecret, enteredCode);
        if (isTotpValid) {
            sessionStorage.removeItem(CHALLENGE_KEY);
            await logAudit({
                entityType: 'admin' as any,
                entityId: challenge.userId,
                entityName: challenge.name,
                action: 'EDIT',
                description: `Admin Google Authenticator TOTP verified for ${challenge.username}`,
                userId: challenge.userId,
                userName: challenge.name,
                userRole: challenge.role,
            });
            return { success: true };
        } else {
            challenge.attempts += 1;
            sessionStorage.setItem(CHALLENGE_KEY, JSON.stringify(challenge));
            return {
                success: false,
                error: `Invalid Google Authenticator passcode. ${5 - challenge.attempts} attempts remaining.`
            };
        }
    }

    // Verify 6-digit hash
    const inputHash = await sha256(`${challenge.salt}:${enteredCode.trim()}`);
    if (inputHash === challenge.hashedCode) {
        sessionStorage.removeItem(CHALLENGE_KEY);
        await logAudit({
            entityType: 'admin' as any,
            entityId: challenge.userId,
            entityName: challenge.name,
            action: 'VIEW',
            description: `Two-factor authentication successful for admin ${challenge.username}`,
            userId: challenge.userId,
            userName: challenge.name,
            userRole: challenge.role,
        });
        return { success: true };
    }

    // Increment failed attempt counter
    challenge.attempts += 1;
    sessionStorage.setItem(CHALLENGE_KEY, JSON.stringify(challenge));

    return {
        success: false,
        error: `Incorrect verification code. ${5 - challenge.attempts} attempts remaining.`
    };
}

/**
 * Resends a fresh OTP code for the pending challenge, optionally switching to another registered phone
 */
export async function resendAdminTwoFactorCode(
    user: User,
    selectedPhone?: string
): Promise<{ success: boolean; devCode?: string; targetPhone?: string; maskedPhone?: string; error?: string }> {
    try {
        const res = await initiateAdminTwoFactor(user, selectedPhone);
        return {
            success: true,
            devCode: res.devCode,
            targetPhone: res.targetPhone,
            maskedPhone: res.maskedPhone
        };
    } catch (err: any) {
        return { success: false, error: err.message || 'Failed to resend verification code' };
    }
}

/**
 * Clears any pending 2FA challenge
 */
export function cancelTwoFactorChallenge(): void {
    sessionStorage.removeItem(CHALLENGE_KEY);
}
