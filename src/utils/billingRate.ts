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

export function numberToWordsINR(num: number): string {
    if (!num || num === 0) return 'Zero';
    num = Math.round(num);
    const single = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const double = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    
    const formatTens = (n: number) => {
        if (n < 10) return single[n];
        if (n < 20) return double[n - 10];
        return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + single[n % 10] : '');
    };

    let word = '';
    const crore = Math.floor(num / 10000000);
    num %= 10000000;
    const lakh = Math.floor(num / 100000);
    num %= 100000;
    const thousand = Math.floor(num / 1000);
    num %= 1000;
    const hundred = Math.floor(num / 100);
    num %= 100;

    if (crore > 0) word += formatTens(crore) + ' Crore ';
    if (lakh > 0) word += formatTens(lakh) + ' Lakh ';
    if (thousand > 0) word += formatTens(thousand) + ' Thousand ';
    if (hundred > 0) word += formatTens(hundred) + ' Hundred ';
    
    if (num > 0) {
        if (word !== '') word += 'And ';
        word += formatTens(num);
    }
    
    return word.trim();
}

/**
 * Calculates client billable days based on verified attendance of assigned workers.
 * Multi-Worker Service Delivery Rule:
 * - On any date, if ANY assigned worker is Present / On Duty -> 1.0 day billed to client.
 * - Else if ALL workers were not full present, but AT LEAST ONE worked a Half Day -> 0.5 day billed to client.
 * - Else if ALL workers were Absent on that date -> 0.0 days billed to client.
 * - If no logs exist for that date in active period -> 1.0 day default.
 */
export function calculateClientServiceDaysFromAttendance(
    startDateStr: string,
    endDateStr: string,
    attendanceRecords: Array<{ worker_id?: string; employee_id?: string; duty_date?: string; date?: string; status?: string; is_half_day?: boolean; is_absent?: boolean }>
): number {
    if (!startDateStr || !endDateStr) return 0;
    const start = new Date(`${startDateStr}T00:00:00`);
    const end = new Date(`${endDateStr}T00:00:00`);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return 0;

    const recordsByDate = new Map<string, Array<any>>();
    for (const r of attendanceRecords) {
        const dStr = (r.duty_date || r.date || '').split('T')[0];
        if (!dStr) continue;
        if (!recordsByDate.has(dStr)) recordsByDate.set(dStr, []);
        recordsByDate.get(dStr)!.push(r);
    }

    let totalServiceDays = 0;
    const cur = new Date(start);
    while (cur <= end) {
        const y = cur.getFullYear();
        const m = String(cur.getMonth() + 1).padStart(2, '0');
        const d = String(cur.getDate()).padStart(2, '0');
        const dateKey = `${y}-${m}-${d}`;

        const dayRecords = recordsByDate.get(dateKey) || [];
        if (dayRecords.length === 0) {
            // If attendance records were supplied for this service, days with no attendance logs mean no worker attended
            totalServiceDays += (attendanceRecords.length > 0 ? 0.0 : 1.0);
        } else {
            const hasFullPresent = dayRecords.some(r => 
                !r.is_half_day && 
                r.status !== 'Half Day' && 
                r.status !== 'half_day' && 
                !r.is_absent && 
                r.status !== 'Absent' && 
                r.status !== 'absent' &&
                (r.status === 'Present' || r.status === 'present' || r.status === 'On Duty' || r.status === 'Completed')
            );

            if (hasFullPresent) {
                totalServiceDays += 1.0;
            } else {
                const hasHalfDay = dayRecords.some(r => 
                    (r.is_half_day || r.status === 'Half Day' || r.status === 'half_day') &&
                    !r.is_absent &&
                    r.status !== 'Absent' &&
                    r.status !== 'absent'
                );

                if (hasHalfDay) {
                    totalServiceDays += 0.5;
                } else {
                    const allAbsent = dayRecords.every(r => 
                        r.is_absent || 
                        r.status === 'Absent' || 
                        r.status === 'absent'
                    );
                    if (allAbsent) {
                        totalServiceDays += 0.0;
                    } else {
                        totalServiceDays += 0.0;
                    }
                }
            }
        }

        cur.setDate(cur.getDate() + 1);
    }

    return totalServiceDays;
}
