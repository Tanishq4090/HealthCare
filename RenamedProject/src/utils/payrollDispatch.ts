import { supabase } from '../lib/supabase';

export const PAYSLIP_SENT_STATUS = 'Payslip Sent';

export function isSyntheticPayrollItem(item: { id?: string; _isSynthetic?: boolean }): boolean {
    return Boolean(item._isSynthetic || String(item.id || '').startsWith('synth-'));
}

export function isPayslipDispatchedStatus(status?: string | null): boolean {
    return status === PAYSLIP_SENT_STATUS || status === 'Paid' || status === 'Settled';
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
