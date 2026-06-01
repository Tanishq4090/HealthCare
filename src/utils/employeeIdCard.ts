/** Duty line on employee ID cards (preview + public share link). */
export function formatIdCardDuty(employee: {
    preferred_payment_type?: string | null;
    hourly_rate?: number | null;
    monthly_daily_rate?: number | null;
    short_term_daily_rate?: number | null;
}): string {
    const type = employee.preferred_payment_type || 'daily';
    if (type === 'hourly') {
        const rate = employee.hourly_rate ?? 0;
        return rate > 0 ? `₹${rate.toLocaleString('en-IN')}/hr` : 'Hourly Rate';
    }
    if (type === 'monthly') return 'Fixed Monthly';
    if (type === 'short_term') return 'Per Service';
    return 'Daily Rate';
}
