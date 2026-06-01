type PaymentType = 'hourly' | 'daily' | 'monthly' | 'short_term';

export function normalizeEmployeePaymentType(
    preferred?: string | null,
): PaymentType {
    const raw = (preferred || 'daily').toLowerCase().trim();
    if (raw === 'hourly') return 'hourly';
    if (raw === 'monthly') return 'monthly';
    if (raw === 'short_term') return 'short_term';
    return 'daily';
}

/** True when ID card / duty line should reflect hourly pay. */
export function isHourlyEmployee(employee: {
    preferred_payment_type?: string | null;
    hourly_rate?: number | null;
}): boolean {
    const preferred = normalizeEmployeePaymentType(employee.preferred_payment_type);
    if (preferred === 'hourly') return true;
    // Hourly rate set but scheme not saved (legacy rows)
    return (employee.hourly_rate ?? 0) > 0 && preferred === 'daily';
}

/** Duty line on employee ID cards (preview + public share link). */
export function formatIdCardDuty(employee: {
    preferred_payment_type?: string | null;
    hourly_rate?: number | null;
    monthly_daily_rate?: number | null;
    short_term_daily_rate?: number | null;
}): string {
    if (isHourlyEmployee(employee)) {
        return 'Hourly Rate';
    }

    const type = normalizeEmployeePaymentType(employee.preferred_payment_type);
    if (type === 'monthly') return 'Fixed Monthly';
    if (type === 'short_term') return 'Per Service';
    return 'Daily Rate';
}
