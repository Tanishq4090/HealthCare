/**
 * Utility for phone number privacy masking and role-based access.
 * Masks numbers by default as requested: e.g., 95370•••75.
 * Only administrators and staff with 'view_phones' access can view numbers in full.
 */

/**
 * Formats/masks a phone number.
 * Example 10-digit: 9537012375 -> 95370•••75
 * Example with country code: +91 9537012375 -> +91 95370•••75
 *
 * @param phone The raw phone number string
 * @param canViewFull If true, returns the raw unmasked phone number
 */
export function maskPhoneNumber(
    phone: string | null | undefined,
    canViewFull: boolean = false
): string {
    if (!phone) return '';
    const trimmed = String(phone).trim();
    if (!trimmed) return '';

    // If authorized, return original phone number
    if (canViewFull) return trimmed;

    // Extract raw digits
    const digitsOnly = trimmed.replace(/\D/g, '');
    if (!digitsOnly) return '••••••';

    let prefix = '';
    let core10 = digitsOnly;

    if (trimmed.startsWith('+')) {
        prefix = '+';
    }

    // Handle 12-digit Indian numbers starting with 91
    if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
        prefix = trimmed.startsWith('+') ? '+91 ' : '91 ';
        core10 = digitsOnly.slice(2);
    } else if (digitsOnly.length > 10) {
        // Other country codes
        const extra = digitsOnly.length - 10;
        prefix = (trimmed.startsWith('+') ? '+' : '') + digitsOnly.slice(0, extra) + ' ';
        core10 = digitsOnly.slice(extra);
    }

    // Standard 10-digit mobile number: first 5 digits + ••• + last 2 digits (e.g. 95370•••75)
    if (core10.length === 10) {
        const masked = `${core10.slice(0, 5)}•••${core10.slice(8)}`;
        return prefix ? `${prefix}${masked}` : masked;
    }

    // For numbers with 6 to 9 digits:
    if (core10.length >= 6) {
        const startLen = Math.min(4, Math.floor(core10.length / 2));
        const masked = `${core10.slice(0, startLen)}•••${core10.slice(-2)}`;
        return prefix ? `${prefix}${masked}` : masked;
    }

    // Very short numbers
    return `${prefix}••••••`;
}

/**
 * Returns safe click-to-call tel: URL if authorized, or undefined if masked
 */
export function getSafeTelLink(
    phone: string | null | undefined,
    canViewFull: boolean = false
): string | undefined {
    if (!canViewFull || !phone) return undefined;
    const trimmed = String(phone).trim();
    const digits = trimmed.replace(/\D/g, '');
    if (!digits) return undefined;

    if (trimmed.startsWith('+')) return `tel:${trimmed}`;
    if (digits.length === 10) return `tel:+91${digits}`;
    return `tel:+${digits}`;
}

/**
 * Returns safe WhatsApp web/chat URL if authorized, or undefined if masked
 */
export function getSafeWhatsAppLink(
    phone: string | null | undefined,
    text: string = '',
    canViewFull: boolean = false
): string | undefined {
    if (!canViewFull || !phone) return undefined;
    const digits = String(phone).replace(/\D/g, '');
    if (!digits) return undefined;

    const fullDigits = digits.length === 10 ? `91${digits}` : digits;
    const query = text ? `?text=${encodeURIComponent(text)}` : '';
    return `https://wa.me/${fullDigits}${query}`;
}
