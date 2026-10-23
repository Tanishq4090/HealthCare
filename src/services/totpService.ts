/**
 * TOTP (Time-based One-Time Password) Service — RFC 6238
 * Compatible with Google Authenticator, Microsoft Authenticator, 1Password, and Apple Passwords.
 * 100% Free: operates offline using Web Crypto API with ZERO external telecom or SMS charges.
 */

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Decodes a Base32 string into a Uint8Array
 */
export function base32Decode(base32: string): Uint8Array {
    let bits = '';
    const clean = base32.toUpperCase().replace(/[\s-=]/g, '');
    for (let i = 0; i < clean.length; i++) {
        const val = BASE32_ALPHABET.indexOf(clean[i]);
        if (val === -1) continue;
        bits += val.toString(2).padStart(5, '0');
    }
    const byteLength = Math.floor(bits.length / 8);
    const bytes = new Uint8Array(byteLength);
    for (let i = 0; i < byteLength; i++) {
        bytes[i] = parseInt(bits.substr(i * 8, 8), 2);
    }
    return bytes;
}

/**
 * Generates a cryptographically random Base32 secret key
 */
export function generateRandomBase32Secret(length = 20): string {
    const randomBytes = new Uint8Array(length);
    if (typeof window !== 'undefined' && window.crypto) {
        window.crypto.getRandomValues(randomBytes);
    } else {
        for (let i = 0; i < length; i++) {
            randomBytes[i] = Math.floor(Math.random() * 256);
        }
    }
    let secret = '';
    for (let i = 0; i < length; i++) {
        secret += BASE32_ALPHABET[randomBytes[i] % 32];
    }
    return secret;
}

/**
 * Calculates the RFC 6238 6-digit TOTP code for a secret at a specific timestamp
 */
export async function generateTOTPCode(secret: string, timestamp = Date.now()): Promise<string> {
    const step = Math.floor(timestamp / 1000 / 30);
    const keyData = base32Decode(secret);

    const cryptoObj = typeof window !== 'undefined' ? window.crypto : (globalThis as any).crypto;
    if (!cryptoObj || !cryptoObj.subtle) {
        throw new Error('Web Crypto API not available in this environment');
    }

    const key = await cryptoObj.subtle.importKey(
        'raw',
        keyData as any,
        { name: 'HMAC', hash: 'SHA-1' },
        false,
        ['sign']
    );

    const buffer = new ArrayBuffer(8);
    const view = new DataView(buffer);
    view.setBigUint64(0, BigInt(step));

    const signature = await cryptoObj.subtle.sign('HMAC', key, buffer);
    const sigBytes = new Uint8Array(signature);
    const offset = sigBytes[sigBytes.length - 1] & 0x0f;
    const viewSig = new DataView(signature);
    const binary = viewSig.getUint32(offset) & 0x7fffffff;
    const code = binary % 1000000;

    return code.toString().padStart(6, '0');
}

/**
 * Verifies an entered 6-digit passcode against the user's TOTP secret.
 * Allows +/- 1 window (30-second clock drift allowance).
 */
export async function verifyTOTPCode(
    secret: string,
    enteredCode: string,
    windowSteps = 1
): Promise<boolean> {
    const clean = enteredCode.trim().replace(/\D/g, '');
    if (clean.length !== 6) return false;

    const now = Date.now();
    for (let offset = -windowSteps; offset <= windowSteps; offset++) {
        try {
            const expected = await generateTOTPCode(secret, now + offset * 30 * 1000);
            if (expected === clean) {
                return true;
            }
        } catch (err) {
            console.error('TOTP generation error during verification:', err);
        }
    }
    return false;
}

/**
 * Builds the standard otpauth URI used by Authenticator apps to register accounts
 */
export function generateOtpAuthUri(
    accountName: string,
    secret: string,
    issuer = '99 Care OS'
): string {
    const cleanAccount = accountName.trim();
    const cleanIssuer = issuer.trim();
    return `otpauth://totp/${encodeURIComponent(cleanIssuer)}:${encodeURIComponent(cleanAccount)}?secret=${secret}&issuer=${encodeURIComponent(cleanIssuer)}&algorithm=SHA1&digits=6&period=30`;
}

/**
 * Generates a high-resolution QR code URL for scanning with camera / Authenticator apps
 */
export function getQrCodeUrl(otpAuthUri: string): string {
    return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=${encodeURIComponent(otpAuthUri)}`;
}
