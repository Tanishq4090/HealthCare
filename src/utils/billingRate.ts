import { computeServiceDays } from './quotationEstimate';

type QuoteRateSource = {
    complete_month_rate?: number | null;
    incomplete_month_rate?: number | null;
    duration?: string | null;
    start_date?: string | null;
} | null | undefined;

type AssignmentDates = {
    start_date?: string | null;
    end_date?: string | null;
    client_billing_rate?: number | null;
    employees?: { monthly_daily_rate?: number | null } | null;
} | null | undefined;

/** Per-day client rate from quotation (short-term → incomplete rate, else complete). */
export function applicableQuoteRatePerDay(
    quote: QuoteRateSource,
    assignment?: AssignmentDates,
): number {
    if (!quote) return 0;

    const serviceDays = computeServiceDays(
        quote.start_date || assignment?.start_date || '',
        assignment?.end_date || '',
        quote.duration || '',
    );
    const complete = Number(quote.complete_month_rate) || 0;
    const incomplete = Number(quote.incomplete_month_rate) || 0;

    if (serviceDays < 30) return incomplete || complete;
    return complete || incomplete;
}

/**
 * Rate shown on billing list / Prepare Invoice default.
 * Ignores worker payroll default (e.g. ₹800) when a quotation defines the client rate.
 */
export function resolveClientBillingRatePerDay(
    assignment: AssignmentDates,
    quote: QuoteRateSource,
): number {
    const quoteRate = applicableQuoteRatePerDay(quote, assignment);
    const stored = Number(assignment?.client_billing_rate) || 0;
    const workerDefault = Number(assignment?.employees?.monthly_daily_rate) || 0;

    if (quoteRate > 0 && (!stored || stored === workerDefault)) {
        return quoteRate;
    }
    if (stored > 0) return stored;
    return quoteRate;
}
