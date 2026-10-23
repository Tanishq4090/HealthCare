import { supabase } from '../lib/supabase';
import { logAudit } from './auditService';
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
    maskedTarget?: string;
    dispatchedVia?: 'whatsapp' | 'local_secure';
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
 * Masks a phone number (e.g. +91 98765 43210 -> +91 98*** **210)
 */
function maskPhoneFor2FA(rawPhone?: string): string {
    if (!rawPhone) return '+91 ••••• ••••';
    const clean = rawPhone.replace(/\D/g, '');
    if (clean.length < 10) return 'Registered Admin Phone';
    const last3 = clean.slice(-3);
    const first2 = clean.slice(0, 2);
    return `+91 ${first2}••• •••${last3}`;
}

/**
 * Initiates Two-Factor Authentication for an admin user.
 * Generates a challenge and attempts WhatsApp delivery if a phone number is registered.
 */
export async function initiateAdminTwoFactor(
    user: User,
    adminPhone?: string
): Promise<{
    challengeId: string;
    maskedPhone: string;
    expiresInSeconds: number;
    devCode?: string; // Provided during local testing or fallback
}> {
    const otp = generateSecureOTP();
    const salt = crypto.randomUUID();
    const hashedCode = await sha256(`${salt}:${otp}`);
    const challengeId = crypto.randomUUID();
    const now = Date.now();
    const expiresAt = now + 10 * 60 * 1000; // 10 minutes

    const targetPhone = adminPhone || '+919987654321';
    let dispatchedVia: 'whatsapp' | 'local_secure' = 'local_secure';

    // Attempt WhatsApp delivery if running against live Supabase
    try {
        const message = `🔐 *99 Care OS Admin Security*\n\nYour 2-Factor Authentication login code is: *${otp}*\n\nValid for 10 minutes. For security, never share this code.`;
        const { error: waError } = await supabase.functions.invoke('meta-whatsapp-outbound', {
            body: {
                recipient: targetPhone.replace(/\D/g, ''),
                phone: targetPhone.replace(/\D/g, ''),
                message,
                type: 'admin_2fa_otp'
            }
        });

        if (!waError) {
            dispatchedVia = 'whatsapp';
        }
    } catch (err) {
        console.warn('WhatsApp 2FA dispatch fallback:', err);
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
        maskedTarget: maskPhoneFor2FA(targetPhone),
        dispatchedVia
    };

    sessionStorage.setItem(CHALLENGE_KEY, JSON.stringify(challenge));

    // Expose devCode in non-production or for admin demo
    const isLocal = typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

    return {
        challengeId,
        maskedPhone: challenge.maskedTarget || 'Registered Device',
        expiresInSeconds: 600,
        devCode: isLocal ? otp : undefined
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
 * Resends a fresh OTP code for the pending challenge
 */
export async function resendAdminTwoFactorCode(user: User): Promise<{ success: boolean; devCode?: string; error?: string }> {
    try {
        const res = await initiateAdminTwoFactor(user);
        return { success: true, devCode: res.devCode };
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
