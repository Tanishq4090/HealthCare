import { supabase } from '../lib/supabase';

export const PAYSLIP_SENT_STATUS = 'Paid';

export function isSyntheticPayrollItem(item: { id?: string; _isSynthetic?: boolean }): boolean {
    return Boolean(item._isSynthetic || String(item.id || '').startsWith('synth-'));
}

export function isPayslipDispatchedStatus(status?: string | null): boolean {
    return status === PAYSLIP_SENT_STATUS || status === 'Paid' || status === 'Settled';
}

export interface PayrollBalanceBreakdown {
    totalGross: number;
    paidAmount: number;
    advanceAmount: number;
    totalPaid: number;
    remainingDue: number;
    isFullyPaid: boolean;
    isPartiallyPaid: boolean;
    displayStatus: 'Paid' | 'Partially Paid' | 'Pending Payment' | 'Sent';
}

export function computePayrollBalance(item: any): PayrollBalanceBreakdown {
    const totalGross = Number(item.total_amount != null ? item.total_amount : ((item.days_worked || 0) * (item.daily_rate || 0)));
    const advanceAmount = Number(item.advance_amount || 0);
    
    // If status is marked 'Paid' or 'Settled' and paid_amount wasn't explicitly recorded, assume totalGross was paid
    let paidAmount = Number(item.paid_amount || 0);
    if ((item.status === 'Paid' || item.status === 'Settled') && paidAmount === 0 && totalGross > 0) {
        paidAmount = Math.max(0, totalGross - advanceAmount);
    }
    
    const totalPaid = paidAmount + advanceAmount;
    const remainingDue = Math.max(0, totalGross - totalPaid);
    const isFullyPaid = remainingDue <= 0 && (totalPaid > 0 || item.status === 'Paid' || item.status === 'Settled');
    const isPartiallyPaid = !isFullyPaid && paidAmount > 0 && remainingDue > 0;

    let displayStatus: 'Paid' | 'Partially Paid' | 'Pending Payment' | 'Sent' = 'Pending Payment';
    if (isFullyPaid) {
        displayStatus = 'Paid';
    } else if (isPartiallyPaid) {
        displayStatus = 'Partially Paid';
    } else if (item.status === 'Sent') {
        displayStatus = 'Sent';
    }

    return {
        totalGross,
        paidAmount,
        advanceAmount,
        totalPaid,
        remainingDue,
        isFullyPaid,
        isPartiallyPaid,
        displayStatus,
    };
}

/** Toggle worker payment status between Paid, Partially Paid, and Pending Payment */
export async function toggleWorkerPaidStatus(
    item: any,
    currentStatus?: string
): Promise<{ newStatus: string; paidAmount: number; remainingDue: number }> {
    const balance = computePayrollBalance(item);
    const isCurrentlyPaid = balance.isFullyPaid;
    
    // If currently fully paid, toggle back to pending (0 paid)
    // If currently pending or partially paid, pay off the remaining balance!
    const newPaidAmount = isCurrentlyPaid ? 0 : Math.max(0, balance.totalGross - balance.advanceAmount);
    const newNetBalance = isCurrentlyPaid ? Math.max(0, balance.totalGross - balance.advanceAmount) : 0;
    const newStatus = isCurrentlyPaid ? 'Pending Payment' : 'Paid';

    const payload: any = {
        status: newStatus,
        paid_amount: newPaidAmount,
        net_balance: newNetBalance,
        paid_through_date: isCurrentlyPaid ? null : new Date().toISOString().split('T')[0],
        updated_at: new Date().toISOString(),
    };

    if (!isSyntheticPayrollItem(item) && item.id) {
        const { error } = await supabase.from('payroll').update(payload).eq('id', item.id);
        if (error) throw error;
        return { newStatus, paidAmount: newPaidAmount, remainingDue: newNetBalance };
    }

    if (item.assignment_id) {
        const { data: existing } = await supabase
            .from('payroll')
            .select('id')
            .eq('assignment_id', item.assignment_id)
            .maybeSingle();

        if (existing?.id) {
            const { error } = await supabase.from('payroll').update(payload).eq('id', existing.id);
            if (error) throw error;
            return { newStatus, paidAmount: newPaidAmount, remainingDue: newNetBalance };
        }

        const { error } = await supabase
            .from('payroll')
            .insert({
                worker: item.worker,
                worker_id: item.worker_id ?? null,
                assignment_id: item.assignment_id,
                client_name: item.client_name || item.client || 'N/A',
                days_worked: item.days_worked ?? 0,
                advance_amount: item.advance_amount ?? 0,
                deposit_received: item.deposit_received ?? 0,
                period_start: item.start_date || item.period_start || null,
                period_end: item.end_date || item.period_end || null,
                service_month: item.month || item.service_month || null,
                daily_rate: item.daily_rate ?? 0,
                total_amount: item.total_amount ?? balance.totalGross,
                net_balance: newNetBalance,
                paid_amount: newPaidAmount,
                paid_through_date: isCurrentlyPaid ? null : new Date().toISOString().split('T')[0],
                payslip_type: 'worker',
                payroll_type: 'payslip',
                status: newStatus,
            });

        if (error) throw error;
        return { newStatus, paidAmount: newPaidAmount, remainingDue: newNetBalance };
    }

    return { newStatus, paidAmount: newPaidAmount, remainingDue: newNetBalance };
}

/** Persist WhatsApp payslip dispatch — upserts DB row so list badge leaves "Pending". */
export async function markPayslipDispatched(
    item: Record<string, any>,
    totals: {
        netBalance: number;
        totalEarning: number;
        dailyRate?: number;
        workerPhone?: string;
    },
): Promise<string | null> {
    const payload = {
        status: PAYSLIP_SENT_STATUS,
        net_balance: totals.netBalance,
        total_amount: totals.totalEarning,
        daily_rate: totals.dailyRate ?? item.daily_rate ?? 0,
        worker_phone: totals.workerPhone ?? item.worker_phone ?? null,
        payroll_type: item.payroll_type || 'payslip',
        payslip_type: 'worker',
        updated_at: new Date().toISOString(),
    };

    const applyUpdate = async (id: string) => {
        const { error } = await supabase.from('payroll').update(payload).eq('id', id);
        if (error) throw error;
        return id;
    };

    if (!isSyntheticPayrollItem(item) && item.id) {
        return applyUpdate(item.id);
    }

    if (item.assignment_id) {
        const { data: existing } = await supabase
            .from('payroll')
            .select('id')
            .eq('assignment_id', item.assignment_id)
            .maybeSingle();

        if (existing?.id) {
            return applyUpdate(existing.id);
        }

        const { data: inserted, error } = await supabase
            .from('payroll')
            .insert({
                worker: item.worker,
                worker_id: item.worker_id ?? null,
                assignment_id: item.assignment_id,
                client_name: item.client_name || item.client || 'N/A',
                days_worked: item.days_worked ?? 0,
                advance_amount: item.advance_amount ?? 0,
                deposit_received: item.deposit_received ?? 0,
                period_start: item.start_date || item.period_start || null,
                period_end: item.end_date || item.period_end || null,
                service_month: item.month || item.service_month || null,
                ...payload,
            })
            .select('id')
            .single();

        if (error) throw error;
        return inserted?.id ?? null;
    }

    const clientName = item.client_name || item.client || 'N/A';
    const { data: byWorker } = await supabase
        .from('payroll')
        .select('id')
        .eq('worker', item.worker)
        .eq('client_name', clientName)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (byWorker?.id) {
        return applyUpdate(byWorker.id);
    }

    const { data: inserted, error } = await supabase
        .from('payroll')
        .insert({
            worker: item.worker,
            worker_id: item.worker_id ?? null,
            client_name: clientName,
            days_worked: item.days_worked ?? 0,
            advance_amount: item.advance_amount ?? 0,
            deposit_received: item.deposit_received ?? 0,
            period_start: item.period_start || null,
            period_end: item.period_end || null,
            service_month: item.month || item.service_month || null,
            ...payload,
        })
        .select('id')
        .single();

    if (error) throw error;
    return inserted?.id ?? null;
}
