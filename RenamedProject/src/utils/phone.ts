/** Strip non-digits; 10-digit Indian numbers become 91XXXXXXXXXX */
export function normalizePhoneDigits(phone: string): string {
    const digits = (phone || '').replace(/\D/g, '');
    if (digits.length === 10) return `91${digits}`;
    return digits;
}

/** Last 10 digits for comparison (Indian mobile) */
export function phoneLast10(phone: string): string {
    return (phone || '').replace(/\D/g, '').slice(-10);
}

/** True when both resolve to the same 10-digit mobile */
export function phonesMatch(
    a: string | null | undefined,
    b: string | null | undefined
): boolean {
    const a10 = phoneLast10(a || '');
    const b10 = phoneLast10(b || '');
    return a10.length === 10 && b10.length === 10 && a10 === b10;
}
