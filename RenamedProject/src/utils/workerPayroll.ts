/**
 * Worker payslip / payroll calculations by preferred_payment_type.
 *
 * - daily:     gross = daily_rate × days_worked
 * - hourly:    gross = hourly_rate × hours_per_day (from assignment) × days_worked
 * - monthly:   implied_daily = monthly_salary ÷ period_days; gross = implied_daily × days_worked
 * - short_term: gross = flat per-service fee (ignores days)
 */

export type WorkerPaymentScheme = 'hourly' | 'daily' | 'monthly' | 'short_term';

export interface WorkerPayrollInput {
    preferred_payment_type?: string | null;
    monthly_daily_rate?: number | null;
    short_term_daily_rate?: number | null;
    hourly_rate?: number | null;
    daysWorked: number;
    /** Calendar days in the payslip period (assignment span or pay period). */
    periodDays: number;
    /** From worker_assignments.hours_per_day — required for hourly. */
    hoursPerDay?: number | null;
}

export interface WorkerPayrollResult {
    gross: number;
    /** Shown on payslip as "rate/day" (derived for monthly & hourly). */
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

export function calculateWorkerPay(input: WorkerPayrollInput): WorkerPayrollResult {
    const scheme = (input.preferred_payment_type || 'daily') as WorkerPaymentScheme;
    const daysWorked = Math.max(0, input.daysWorked);
    const periodDays = Math.max(1, input.periodDays);
    const hours = resolveAssignmentHoursPerDay(input.hoursPerDay);

    switch (scheme) {
        case 'hourly': {
            const hourly = input.hourly_rate || 0;
            const h = hours ?? 0;
            const dailyEquiv = hourly * h;
            const gross = daysWorked * h * hourly;
            return {
                gross,
                dailyRateForDisplay: dailyEquiv,
                hoursPerDay: h,
                schemeLabel: 'Hourly',
                earningsLine:
                    h > 0
                        ? `₹${hourly.toFixed(2)}/hr × ${h}h/day × ${daysWorked} days = ₹${gross.toFixed(2)}`
                        : `Set shift hours on assignment (hourly worker)`,
            };
        }
        case 'monthly': {
            const monthly = input.monthly_daily_rate || 0;
            const impliedDaily = monthly / periodDays;
            const gross = impliedDaily * daysWorked;
            return {
                gross,
                dailyRateForDisplay: impliedDaily,
                hoursPerDay: hours,
                schemeLabel: 'Fixed Monthly',
                earningsLine: `₹${monthly.toFixed(2)}/mo ÷ ${periodDays} days × ${daysWorked} days = ₹${gross.toFixed(2)}`,
            };
        }
        case 'short_term': {
            const flat = input.short_term_daily_rate || 0;
            return {
                gross: flat,
                dailyRateForDisplay: flat,
                hoursPerDay: hours,
                schemeLabel: 'Per Service',
                earningsLine: `Per service fee: ₹${flat.toFixed(2)}`,
            };
        }
        default: {
            const daily = input.monthly_daily_rate || 0;
            const gross = daysWorked * daily;
            return {
                gross,
                dailyRateForDisplay: daily,
                hoursPerDay: hours,
                schemeLabel: 'Daily Rate',
                earningsLine: `₹${daily.toFixed(2)}/day × ${daysWorked} days = ₹${gross.toFixed(2)}`,
            };
        }
    }
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
