/**
 * Worker payslip / payroll calculations based on shift hours.
 *
 * Each worker has two rates:
 *   rate_10hr — daily pay for a 10-hour shift (Male ₹600, Female ₹500)
 *   rate_24hr — daily pay for a 24-hour shift (₹800 for all)
 *
 * The correct rate is selected by checking the service's hours_per_day:
 *   ≤ 10 hours  → rate_10hr
 *   > 10 hours  → rate_24hr
 */

export interface WorkerPayrollInput {
    rate_10hr?: number | null;
    rate_24hr?: number | null;
    daysWorked: number;
    /** From worker_assignments.hours_per_day — determines which rate applies. */
    hoursPerDay?: number | null;
    /** Period days still used for display context. */
    periodDays: number;
}

export interface WorkerPayrollResult {
    gross: number;
    /** The resolved daily rate used (either rate_10hr or rate_24hr). */
    dailyRateForDisplay: number;
    hoursPerDay: number | null;
    schemeLabel: string;
    earningsLine: string;
}

export function daysInCalendarMonth(ref: Date = new Date()): number {
    return new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate();
}

export function periodDaysInclusive(start: Date, end: Date): number {
    const ms = Math.abs(end.getTime() - start.getTime());
    return Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)) + 1);
}

export function resolveAssignmentHoursPerDay(hours?: number | null): number | null {
    if (hours != null && hours > 0) return hours;
    return null;
}

/**
 * Resolve which daily rate applies based on shift hours.
 * ≤ 10 hours → rate_10hr; > 10 hours → rate_24hr
 */
export function resolveWorkerDailyRate(input: Pick<WorkerPayrollInput, 'rate_10hr' | 'rate_24hr' | 'hoursPerDay'>): number {
    const hours = input.hoursPerDay ?? 0;
    if (hours > 10) {
        return input.rate_24hr || 0;
    }
    return input.rate_10hr || 0;
}

export function calculateWorkerPay(input: WorkerPayrollInput): WorkerPayrollResult {
    const daysWorked = Math.max(0, input.daysWorked);
    const hours = resolveAssignmentHoursPerDay(input.hoursPerDay);
    const daily = resolveWorkerDailyRate(input);
    const gross = daysWorked * daily;
    const shiftLabel = (hours != null && hours > 10) ? '24-hour shift' : '10-hour shift';

    return {
        gross,
        dailyRateForDisplay: daily,
        hoursPerDay: hours,
        schemeLabel: 'Daily Rate',
        earningsLine: `₹${daily.toFixed(2)}/day (${shiftLabel}) × ${daysWorked} days = ₹${gross.toFixed(2)}`,
    };
}

/** Gross pay for a stored payroll row (prefers total_amount when present). */
export function grossFromPayrollItem(item: {
    days_worked?: number;
    daily_rate?: number;
    total_amount?: number | null;
}): number {
    if (item.total_amount != null && !Number.isNaN(Number(item.total_amount))) {
        return Number(item.total_amount);
    }
    return (item.days_worked || 0) * (item.daily_rate || 0);
}

export function netFromPayrollItem(item: {
    days_worked?: number;
    daily_rate?: number;
    total_amount?: number | null;
    advance_amount?: number | null;
    deposit_received?: number | null;
    net_balance?: number | null;
}): number {
    if (item.net_balance != null && !Number.isNaN(Number(item.net_balance))) {
        return Number(item.net_balance);
    }
    const gross = grossFromPayrollItem(item);
    const advance = item.advance_amount || 0;
    const deposit = item.deposit_received || 0;
    return gross - advance - deposit;
}
