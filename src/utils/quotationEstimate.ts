/** Parse "1 day", "2 weeks", "1 month" into approximate calendar days. */
export function parseDurationDays(durationText: string): number | null {
    const t = (durationText || '').trim().toLowerCase();
    if (!t) return null;
    if (t.includes('open')) return null;

    const m = t.match(/^(\d+(?:\.\d+)?)\s*(day|days|week|weeks|month|months)$/);
    if (!m) return null;

    const n = parseFloat(m[1]);
    const unit = m[2];
    if (unit.startsWith('day')) return Math.max(1, Math.ceil(n));
    if (unit.startsWith('week')) return Math.max(1, Math.ceil(n * 7));
    if (unit.startsWith('month')) return Math.max(1, Math.ceil(n * 30));
    return null;
}

/** Inclusive service days from dates, duration text, or default full month (30). */
export function computeServiceDays(
    startDate: string,
    endDate: string,
    durationValue: string,
): number {
    if (startDate && endDate) {
        const start = new Date(`${startDate}T00:00:00`);
        const end = new Date(`${endDate}T00:00:00`);
        if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end >= start) {
            const days = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
            return Math.max(1, days);
        }
    }

    const fromDuration = parseDurationDays(durationValue);
    if (fromDuration != null) return fromDuration;

    return 30;
}

export interface QuotationEstimateResult {
    total: number;
    serviceDays: number;
    isShortTerm: boolean;
    label: string;
    detail: string;
}

/** Short assignments (< 30 days) use incomplete month rate × days; else complete rate × days. */
export function computeQuotationEstimate(
    completeMonthRate: number,
    incompleteMonthRate: number,
    startDate: string,
    endDate: string,
    durationValue: string,
): QuotationEstimateResult {
    const serviceDays = computeServiceDays(startDate, endDate, durationValue);
    const isShortTerm = serviceDays < 30;
    const ratePerDay = isShortTerm ? incompleteMonthRate : completeMonthRate;
    const total = ratePerDay > 0 ? Math.round(ratePerDay * serviceDays) : 0;

    return {
        total,
        serviceDays,
        isShortTerm,
        label: isShortTerm ? 'Estimated service total' : 'Estimated monthly total',
        detail:
            ratePerDay > 0
                ? `${serviceDays} day${serviceDays !== 1 ? 's' : ''} × ₹${ratePerDay.toLocaleString('en-IN')}/day`
                : '',
    };
}
