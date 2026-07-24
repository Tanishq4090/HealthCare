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

/** Inclusive calendar days between two YYYY-MM-DD values (both ends counted). */
export function computeInclusiveDaysFromDates(startDate: string, endDate: string): number | null {
    if (!startDate || !endDate) return null;
    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T00:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return null;
    return Math.max(1, Math.floor((end.getTime() - start.getTime()) / 86400000) + 1);
}

export function formatDurationLabel(days: number): string {
    return days === 1 ? '1 day' : `${days} days`;
}

/** Inclusive service days from dates, duration text, or default full month (30). */
export function computeServiceDays(
    startDate: string,
    endDate: string,
    durationValue: string,
): number {
    const fromDuration = parseDurationDays(durationValue);
    if (fromDuration != null) return fromDuration;

    const fromDates = computeInclusiveDaysFromDates(startDate, endDate);
    if (fromDates != null) return fromDates;

    return 30;
}

export function getLatestQuotation(lead: { crm_quotations?: { created_at: string }[] } | null): any | null {
    const quotes = lead?.crm_quotations;
    if (!quotes?.length) return null;
    return [...quotes].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )[0];
}

/** Service days for a lead from latest quote or notes duration. */
export function getLeadServiceDays(lead: any): number {
    const quote = getLatestQuotation(lead);
    if (quote) {
        return computeServiceDays(quote.start_date || '', '', quote.duration || '');
    }
    const durMatch = lead?.notes?.match(/Duration:\s*(.+)/i);
    if (durMatch?.[1]) {
        const fromNotes = parseDurationDays(durMatch[1].trim());
        if (fromNotes != null) return fromNotes;
    }
    return 30;
}

export function isShortTermService(serviceDays: number): boolean {
    return serviceDays < 30;
}

export function getLeadValueLabel(serviceDays: number): string {
    return isShortTermService(serviceDays) ? 'Service value' : 'Monthly value';
}

export function formatLeadValueDisplay(amount: number, serviceDays: number): string {
    if (!amount) return isShortTermService(serviceDays) ? '₹0' : '₹0/mo';
    const formatted = amount.toLocaleString('en-IN');
    return isShortTermService(serviceDays)
        ? `₹${formatted} (${serviceDays}d)`
        : `₹${formatted}/mo`;
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
