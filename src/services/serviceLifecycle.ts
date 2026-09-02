/**
 * Service Lifecycle Management
 * 
 * Handles creating services, assigning/releasing workers,
 * ending services with deposit settlement, and monthly billing.
 */

import { supabase } from '../lib/supabase';
import { calculateClientServiceDaysFromAttendance } from '../utils/billingRate';

// ── Types ─────────────────────────────────────────────────

export interface Service {
    id: string;
    client_id: string;
    lead_id: string | null;
    service_type: string | null;
    hours_per_day: number;
    start_date: string;
    end_date: string | null;
    status: 'active' | 'ended';
    deposit_amount: number;
    deposit_status: 'pending' | 'collected' | 'settled';
    complete_month_daily_rate: number;
    incomplete_month_daily_rate: number;
    notes: string | null;
    legacy_assignment_id: string | null;
    created_at: string;
    updated_at: string;
}

export interface ServiceWorkerAssignment {
    id: string;
    service_id: string;
    employee_id: string;
    start_date: string;
    end_date: string | null;
    created_at: string;
    updated_at: string;
}

export interface ServiceBill {
    id: string;
    service_id: string;
    period_start: string;
    period_end: string;
    total_days: number;
    daily_rate_used: number;
    amount: number;
    type: 'recurring' | 'final';
    deposit_applied: number;
    deposit_settled: boolean;
    settlement_amount: number;
    notes: string | null;
    created_at: string;
}

export interface ServiceWithDetails extends Service {
    clients?: { client_name: string; phone_number: string | null };
    service_worker_assignments?: (ServiceWorkerAssignment & {
        employees?: { id: string; full_name: string; job_title: string; photo_url: string | null; status: string };
    })[];
    service_bills?: ServiceBill[];
}

async function enrichServicesWithPayments(services: any[]): Promise<ServiceWithDetails[]> {
    if (!services || services.length === 0) return [];
    try {
        const [paymentsRes, quotesRes, leadsRes] = await Promise.all([
            supabase.from('payments').select('client_name, amount, payment_type').eq('payment_type', 'deposit'),
            supabase.from('crm_quotations').select('lead_id, complete_month_rate, incomplete_month_rate, deposit').order('created_at', { ascending: false }),
            supabase.from('crm_leads').select('id, complete_month_daily_rate, incomplete_month_daily_rate'),
        ]);

        const depositMap = new Map<string, number>();
        if (paymentsRes.data) {
            for (const p of paymentsRes.data) {
                const name = (p.client_name || '').trim().toLowerCase();
                if (name) {
                    depositMap.set(name, (depositMap.get(name) || 0) + (p.amount || 0));
                }
            }
        }

        const quotesMap = new Map<string, any>();
        if (quotesRes.data) {
            for (const q of quotesRes.data) {
                if (q.lead_id && !quotesMap.has(q.lead_id)) {
                    quotesMap.set(q.lead_id, q);
                }
            }
        }

        const leadsMap = new Map<string, any>();
        if (leadsRes.data) {
            for (const l of leadsRes.data) {
                if (l.id) leadsMap.set(l.id, l);
            }
        }

        return services.map(s => {
            const clientName = (s.clients?.client_name || '').trim().toLowerCase();
            const collectedDeposit = depositMap.get(clientName) || 0;
            const quote = quotesMap.get(s.client_id) || quotesMap.get(s.lead_id || '');
            const lead = leadsMap.get(s.client_id) || leadsMap.get(s.lead_id || '');

            const depositAmt = (s.deposit_amount && s.deposit_amount > 0) 
                ? s.deposit_amount 
                : (quote?.deposit || collectedDeposit);

            const depositStatus = depositAmt > 0 ? 'collected' : (s.deposit_status || 'pending');

            // Resolve agreed daily rates
            const cmRate = (quote?.complete_month_rate && quote.complete_month_rate > 0)
                ? quote.complete_month_rate
                : (lead?.complete_month_daily_rate && lead.complete_month_daily_rate > 0)
                    ? lead.complete_month_daily_rate
                    : s.complete_month_daily_rate;

            const imRate = (quote?.incomplete_month_rate && quote.incomplete_month_rate > 0)
                ? quote.incomplete_month_rate
                : (lead?.incomplete_month_daily_rate && lead.incomplete_month_daily_rate > 0)
                    ? lead.incomplete_month_daily_rate
                    : s.incomplete_month_daily_rate;

            return {
                ...s,
                deposit_amount: depositAmt,
                deposit_status: depositStatus,
                complete_month_daily_rate: cmRate || 0,
                incomplete_month_daily_rate: imRate || 0,
            };
        });
    } catch {
        return services as ServiceWithDetails[];
    }
}

export async function getActiveServices(): Promise<ServiceWithDetails[]> {
    const { data, error } = await supabase
        .from('services')
        .select(`
            *,
            clients(client_name, phone_number),
            service_worker_assignments(
                *,
                employees(id, full_name, job_title, photo_url, status)
            ),
            service_bills(*)
        `)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to fetch services: ${error.message}`);
    const valid = (data || []).filter(s => (s.service_worker_assignments || []).length > 0);
    return enrichServicesWithPayments(valid);
}

export async function getAllServices(): Promise<ServiceWithDetails[]> {
    const { data, error } = await supabase
        .from('services')
        .select(`
            *,
            clients(client_name, phone_number),
            service_worker_assignments(
                *,
                employees(id, full_name, job_title, photo_url, status)
            ),
            service_bills(*)
        `)
        .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to fetch services: ${error.message}`);
    return enrichServicesWithPayments(data || []);
}

export async function getServiceById(serviceId: string): Promise<ServiceWithDetails | null> {
    const { data, error } = await supabase
        .from('services')
        .select(`
            *,
            clients(client_name, phone_number),
            service_worker_assignments(
                *,
                employees(id, full_name, job_title, photo_url, status)
            ),
            service_bills(*)
        `)
        .eq('id', serviceId)
        .single();

    if (error) return null;
    return data as ServiceWithDetails;
}

// ── Create Service ────────────────────────────────────────

export interface CreateServiceInput {
    client_id: string;
    lead_id?: string;
    service_type?: string;
    hours_per_day?: number;
    start_date: string;
    end_date?: string;
    deposit_amount?: number;
    complete_month_daily_rate: number;
    incomplete_month_daily_rate: number;
    notes?: string;
}

export async function createService(input: CreateServiceInput): Promise<Service> {
    const { data, error } = await supabase
        .from('services')
        .insert({
            client_id: input.client_id,
            lead_id: input.lead_id || input.client_id,
            service_type: input.service_type || null,
            hours_per_day: input.hours_per_day || 10,
            start_date: input.start_date,
            end_date: input.end_date || null,
            deposit_amount: input.deposit_amount || 0,
            deposit_status: (input.deposit_amount && input.deposit_amount > 0) ? 'collected' : 'pending',
            complete_month_daily_rate: input.complete_month_daily_rate,
            incomplete_month_daily_rate: input.incomplete_month_daily_rate,
            notes: input.notes || null,
        })
        .select()
        .single();

    if (error) throw new Error(`Failed to create service: ${error.message}`);
    return data as Service;
}

// ── Assign Worker to Service ──────────────────────────────

export async function assignWorkerToService(
    serviceId: string,
    employeeId: string,
    startDate: string
): Promise<ServiceWorkerAssignment> {
    const { data, error } = await supabase
        .from('service_worker_assignments')
        .insert({
            service_id: serviceId,
            employee_id: employeeId,
            start_date: startDate,
        })
        .select()
        .single();

    if (error) throw new Error(`Failed to assign worker: ${error.message}`);

    // Update employee status
    await supabase.from('employees')
        .update({ status: 'assigned', updated_at: new Date().toISOString() })
        .eq('id', employeeId);

    return data as ServiceWorkerAssignment;
}

// ── Release Worker (calls RPC) ────────────────────────────

export interface ReleaseWorkerResult {
    success: boolean;
    assignment_id?: string;
    days_counted?: number;
    payroll_id?: string;
    error?: string;
}

export async function releaseWorker(
    assignmentId: string,
    releaseDate?: string
): Promise<ReleaseWorkerResult> {
    const { data, error } = await supabase.rpc('release_worker', {
        p_assignment_id: assignmentId,
        p_release_date: releaseDate || new Date().toISOString().split('T')[0],
    });

    if (error) throw new Error(`Failed to release worker: ${error.message}`);
    return data as ReleaseWorkerResult;
}

// ── End Service (calls RPC) ───────────────────────────────

export interface EndServiceResult {
    success: boolean;
    service_id?: string;
    client_id?: string;
    client_name?: string;
    client_phone?: string;
    total_lifetime_days?: number;
    calendar_days?: number;
    rate_used?: number;
    rate_tier?: 'incomplete_month' | 'complete_month';
    tier_reason?: string;
    is_incomplete_month?: boolean;
    true_cost?: number;
    previously_billed?: number;
    deposit?: number;
    settlement?: number;
    workers_released?: number;
    invoice_number?: string;
    invoice_pdf_url?: string;
    error?: string;
}

export async function endService(
    serviceId: string,
    endDate?: string
): Promise<EndServiceResult> {
    const effectiveEndDate = endDate || new Date().toISOString().split('T')[0];

    // 1. Fetch service details with worker assignments and client info
    const { data: service, error: svcError } = await supabase
        .from('services')
        .select(`
            id,
            client_id,
            start_date,
            end_date,
            status,
            complete_month_daily_rate,
            incomplete_month_daily_rate,
            deposit_amount,
            service_type,
            hours_per_day,
            clients (id, client_name, phone_number),
            service_worker_assignments (
                id,
                employee_id,
                start_date,
                end_date
            )
        `)
        .eq('id', serviceId)
        .single();

    if (svcError || !service) {
        throw new Error(`Failed to find service: ${svcError?.message || 'Not found'}`);
    }

    // 2. Auto-release active workers and mark service ended in DB via RPC
    const { data: rpcData, error: rpcError } = await supabase.rpc('end_service', {
        p_service_id: serviceId,
        p_end_date: effectiveEndDate,
    });
    if (rpcError) throw new Error(`Failed to end service: ${rpcError.message}`);

    // 3. Compute verified working days strictly from multi-worker attendance
    const workerIds = (service.service_worker_assignments || [])
        .map((a: any) => a.employee_id)
        .filter(Boolean);

    let verifiedDays = 0;
    if (workerIds.length > 0 && service.start_date) {
        const { data: attRecords } = await supabase
            .from('attendance')
            .select('worker_id, duty_date, status, is_half_day, is_absent')
            .in('worker_id', workerIds)
            .gte('duty_date', service.start_date.split('T')[0])
            .lte('duty_date', effectiveEndDate);

        if (attRecords && attRecords.length > 0) {
            verifiedDays = calculateClientServiceDaysFromAttendance(
                service.start_date.split('T')[0],
                effectiveEndDate,
                attRecords
            );
        }
    }

    // Fallback if no attendance records exist at all
    if (verifiedDays <= 0) {
        verifiedDays = rpcData?.total_lifetime_days || 1;
    }

    // 3. Compute calendar lifetime days as well as verified attendance days
    const startDateStr = service.start_date ? service.start_date.split('T')[0] : effectiveEndDate;
    const dStart = new Date(`${startDateStr}T00:00:00`);
    const dEnd = new Date(`${effectiveEndDate}T00:00:00`);
    const calendarDays = (!isNaN(dStart.getTime()) && !isNaN(dEnd.getTime()) && dEnd >= dStart)
        ? Math.round((dEnd.getTime() - dStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
        : verifiedDays;

    // 30-Day Threshold Rule:
    // If service ended before completing 30 days (< 30 days), charge the incomplete month daily rate.
    // If service ran 30 or more days (>= 30 days), charge the standard complete month daily rate.
    const isIncompleteMonth = calendarDays < 30 || verifiedDays < 30;

    // Fetch lead and quotation rates as fallback to ensure incomplete rate is accurately captured
    const [leadRateRes, quoteRateRes] = await Promise.all([
        supabase.from('crm_leads')
            .select('complete_month_daily_rate, incomplete_month_daily_rate, estimated_value_monthly')
            .eq('id', service.client_id)
            .maybeSingle(),
        supabase.from('crm_quotations')
            .select('complete_month_rate, incomplete_month_rate')
            .eq('lead_id', service.client_id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
    ]);

    const completeDailyRate = Number(service.complete_month_daily_rate)
        || Number(leadRateRes.data?.complete_month_daily_rate)
        || Number(quoteRateRes.data?.complete_month_rate)
        || (leadRateRes.data?.estimated_value_monthly ? Math.round(Number(leadRateRes.data.estimated_value_monthly) / 30) : 500);

    const incompleteDailyRate = Number(service.incomplete_month_daily_rate)
        || Number(leadRateRes.data?.incomplete_month_daily_rate)
        || Number(quoteRateRes.data?.incomplete_month_rate)
        || (completeDailyRate > 0 ? completeDailyRate * 2 : 1000)
        || (service.hours_per_day === 24 ? 2000 : 1000);

    const rateUsed = isIncompleteMonth ? incompleteDailyRate : completeDailyRate;
    const rateTier: 'incomplete_month' | 'complete_month' = isIncompleteMonth ? 'incomplete_month' : 'complete_month';
    const tierReason = isIncompleteMonth
        ? `Service ended before 30 days (< 30 days) — billed at incomplete month daily rate of ₹${rateUsed.toLocaleString('en-IN')}/day`
        : `Service completed 30+ days (≥ 30 days) — billed at complete month daily rate of ₹${rateUsed.toLocaleString('en-IN')}/day`;

    const trueCost = verifiedDays * rateUsed;

    // Previously billed (exclude any final settlement bills)
    const { data: prevBills } = await supabase
        .from('service_bills')
        .select('id, amount, type')
        .eq('service_id', serviceId)
        .neq('type', 'final');

    const previouslyBilled = (prevBills || []).reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
    const depositAmount = Number(service.deposit_amount) || 0;
    const totalAlreadyPaid = previouslyBilled + depositAmount;
    const settlement = trueCost - totalAlreadyPaid;

    // 4. Generate the Final Settlement Tax Invoice
    let invoiceNumber = '';
    let invoicePdfUrl = '';

    try {
        const clientName = (service.clients as any)?.client_name || 'Client';
        const clientPhone = (service.clients as any)?.phone_number || '';
        
        let clientAddress = '';
        let serviceCategory = service.service_type || 'Old Age Care';
        try {
            const [leadRes, consentRes] = await Promise.all([
                supabase.from('crm_leads').select('notes, service_interest').eq('id', service.client_id).maybeSingle(),
                supabase.from('client_consents').select('address, service_category, offered_time').eq('lead_id', service.client_id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
            ]);
            if (consentRes.data?.address) clientAddress = consentRes.data.address;
            else if (leadRes.data?.notes) {
                const locMatch = leadRes.data.notes.match(/^Location:\s*(.+)$/im);
                if (locMatch) clientAddress = locMatch[1].trim();
            }
            if (consentRes.data?.service_category) serviceCategory = consentRes.data.service_category;
            else if (leadRes.data?.service_interest) serviceCategory = leadRes.data.service_interest;
        } catch {}

        const invResp = await supabase.functions.invoke('generate-invoice', {
            body: {
                lead_id: service.client_id,
                manual_invoice: true,
                client_name: clientName,
                client_phone: clientPhone,
                client_address: clientAddress,
                service_name: serviceCategory,
                service_hours: service.hours_per_day ? String(service.hours_per_day) : '24',
                start_date: service.start_date ? service.start_date.split('T')[0] : effectiveEndDate,
                end_date: effectiveEndDate,
                days: verifiedDays,
                rate_per_day: rateUsed,
                deposit_collected: depositAmount,
                previously_billed: previouslyBilled,
                invoice_date: effectiveEndDate,
            }
        });

        if (invResp.data?.success) {
            invoiceNumber = invResp.data.invoice_number || '';
            invoicePdfUrl = invResp.data.public_url || '';
        }
    } catch (genErr) {
        console.error('Final invoice generation error:', genErr);
    }

    // 5. Update or insert the final bill record in service_bills with invoice info
    const netFinalBillAmount = Math.max(0, trueCost - previouslyBilled);
    const finalBillNotes = JSON.stringify({
        invoice_number: invoiceNumber || `INV-F${Math.floor(1000 + Math.random() * 9000)}`,
        invoice_pdf_url: invoicePdfUrl,
        status: settlement <= 0 ? 'settled' : 'pending',
        type: 'final_settlement',
        gross_amount: trueCost,
        previously_billed: previouslyBilled,
        net_amount: netFinalBillAmount,
        deposit: depositAmount,
        settlement_amount: settlement,
        refund_amount: settlement < 0 ? Math.abs(settlement) : 0,
        verified_days: verifiedDays,
        calendar_days: calendarDays,
        rate_used: rateUsed,
        rate_tier: rateTier,
        tier_reason: tierReason,
        is_incomplete_month: isIncompleteMonth,
        generated_at: new Date().toISOString()
    });

    const { data: finalBill } = await supabase
        .from('service_bills')
        .select('id')
        .eq('service_id', serviceId)
        .eq('type', 'final')
        .maybeSingle();

    if (finalBill?.id) {
        await supabase
            .from('service_bills')
            .update({
                total_days: verifiedDays,
                daily_rate_used: rateUsed,
                amount: netFinalBillAmount,
                deposit_applied: depositAmount,
                deposit_settled: true,
                settlement_amount: settlement,
                notes: finalBillNotes,
                period_end: effectiveEndDate
            })
            .eq('id', finalBill.id);
    } else {
        await supabase
            .from('service_bills')
            .insert({
                service_id: serviceId,
                period_start: service.start_date ? service.start_date.split('T')[0] : effectiveEndDate,
                period_end: effectiveEndDate,
                total_days: verifiedDays,
                daily_rate_used: rateUsed,
                amount: netFinalBillAmount,
                type: 'final',
                deposit_applied: depositAmount,
                deposit_settled: true,
                settlement_amount: settlement,
                notes: finalBillNotes
            });
    }

    // 6. Synchronize workers' payroll records: cap period_end at effectiveEndDate and mark type 'final'
    try {
        const { data: servicePayrolls } = await supabase
            .from('payroll')
            .select('id, worker_id, period_start, period_end, days_worked, daily_rate')
            .eq('service_id', serviceId);

        if (servicePayrolls && servicePayrolls.length > 0) {
            for (const p of servicePayrolls) {
                if (p.period_end && p.period_end > effectiveEndDate) {
                    await supabase
                        .from('payroll')
                        .update({
                            period_end: effectiveEndDate,
                            type: 'final'
                        })
                        .eq('id', p.id);
                }
            }
        }
    } catch (paySyncErr) {
        console.error('Failed to sync worker payroll dates on service end:', paySyncErr);
    }

    return {
        success: true,
        service_id: serviceId,
        client_id: service.client_id,
        client_name: (service.clients as any)?.client_name || 'Client',
        client_phone: (service.clients as any)?.phone_number || '',
        total_lifetime_days: verifiedDays,
        calendar_days: calendarDays,
        rate_used: rateUsed,
        rate_tier: rateTier,
        tier_reason: tierReason,
        is_incomplete_month: isIncompleteMonth,
        true_cost: trueCost,
        previously_billed: previouslyBilled,
        deposit: depositAmount,
        settlement: settlement,
        workers_released: rpcData?.workers_released || (service.service_worker_assignments?.length || 0),
        invoice_number: invoiceNumber,
        invoice_pdf_url: invoicePdfUrl
    };
}

// ── Generate Monthly Billing (calls RPC) ──────────────────

export interface MonthlyBillingResult {
    success: boolean;
    bills_created?: number;
    payslips_created?: number;
    period?: string;
    error?: string;
}

export async function generateMonthlyBilling(
    monthStart: string,
    monthEnd: string
): Promise<MonthlyBillingResult> {
    const { data, error } = await supabase.rpc('generate_monthly_billing', {
        p_month_start: monthStart,
        p_month_end: monthEnd,
    });

    if (error) throw new Error(`Failed to generate billing: ${error.message}`);

    // Automatic Deduplication Safeguard:
    // If a service already had an existing recorded/paid bill for this cycle, remove any unneeded duplicate rows
    try {
        const { data: bills } = await supabase
            .from('service_bills')
            .select('id, service_id, period_end, created_at, notes, type')
            .eq('period_end', monthEnd)
            .eq('type', 'recurring')
            .order('created_at', { ascending: false });

        if (bills && bills.length > 0) {
            // Sort so bills with paid status or PDF attachments are prioritized
            const sortedBills = [...bills].sort((a, b) => {
                let aPriority = 0;
                let bPriority = 0;
                try {
                    const pA = a.notes ? JSON.parse(a.notes) : {};
                    if (pA.status === 'paid') aPriority += 2;
                    if (pA.invoice_pdf_url) aPriority += 1;
                } catch {}
                try {
                    const pB = b.notes ? JSON.parse(b.notes) : {};
                    if (pB.status === 'paid') bPriority += 2;
                    if (pB.invoice_pdf_url) bPriority += 1;
                } catch {}
                return bPriority - aPriority;
            });

            const seenServiceIds = new Set<string>();
            const duplicatesToDelete: string[] = [];

            for (const b of sortedBills) {
                if (seenServiceIds.has(b.service_id)) {
                    duplicatesToDelete.push(b.id);
                } else {
                    seenServiceIds.add(b.service_id);
                }
            }

            if (duplicatesToDelete.length > 0) {
                await supabase.from('service_bills').delete().in('id', duplicatesToDelete);
            }
        }

        // Attendance Reconciliation:
        // Synchronize client billable days based on multi-worker attendance reality
        await syncClientBillsWithAttendance(monthStart, monthEnd);
    } catch (cleanErr) {
        console.warn('Billing deduplication/attendance safeguard note:', cleanErr);
    }

    return data as MonthlyBillingResult;
}

export async function syncClientBillsWithAttendance(monthStart: string, monthEnd: string) {
    try {
        const { data: services } = await supabase
            .from('services')
            .select(`
                id,
                start_date,
                end_date,
                complete_month_daily_rate,
                service_worker_assignments (
                    id,
                    employee_id,
                    start_date,
                    end_date
                )
            `)
            .eq('status', 'active');

        if (!services || services.length === 0) return;

        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

        for (const svc of services) {
            const workerIds = (svc.service_worker_assignments || [])
                .map((a: any) => a.employee_id)
                .filter(Boolean);

            const startStr = svc.start_date && svc.start_date > monthStart ? svc.start_date.split('T')[0] : monthStart;
            let effectiveEndStr = svc.end_date && svc.end_date < monthEnd ? svc.end_date.split('T')[0] : monthEnd;
            if (effectiveEndStr > todayStr) {
                effectiveEndStr = todayStr;
            }

            if (workerIds.length > 0 && effectiveEndStr >= startStr) {
                const { data: attRecords } = await supabase
                    .from('attendance')
                    .select('worker_id, duty_date, status, is_half_day, is_absent')
                    .in('worker_id', workerIds)
                    .gte('duty_date', startStr)
                    .lte('duty_date', effectiveEndStr);

                const actualDays = (attRecords && attRecords.length > 0)
                    ? calculateClientServiceDaysFromAttendance(startStr, effectiveEndStr, attRecords)
                    : 0;
                const rate = svc.complete_month_daily_rate || 500;
                const newAmount = actualDays * rate;

                const { data: currentBills } = await supabase
                    .from('service_bills')
                    .select('id, notes')
                    .eq('service_id', svc.id)
                    .eq('type', 'recurring')
                    .gte('period_end', monthStart);

                for (const b of currentBills || []) {
                    let isPaid = false;
                    try {
                        const n = b.notes ? JSON.parse(b.notes) : {};
                        if (n.status === 'paid') isPaid = true;
                    } catch {}

                    if (!isPaid) {
                        await supabase
                            .from('service_bills')
                            .update({
                                total_days: actualDays,
                                amount: newAmount,
                            })
                            .eq('id', b.id);
                    }
                }
            }
        }
    } catch (e) {
        console.warn('Sync client bills attendance error:', e);
    }
}

// ── Get Service Bills ─────────────────────────────────────

export async function getServiceBills(serviceId: string): Promise<ServiceBill[]> {
    const { data, error } = await supabase
        .from('service_bills')
        .select('*')
        .eq('service_id', serviceId)
        .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to fetch bills: ${error.message}`);
    return (data || []) as ServiceBill[];
}

// ── Record Service Invoice (Unified across CRM & Finance) ──

export interface RecordServiceInvoiceParams {
    serviceId: string;
    clientId?: string;
    periodStart: string;
    periodEnd: string;
    totalDays: number;
    dailyRateUsed: number;
    amount: number;
    invoiceNumber: string;
    invoicePdfUrl: string;
    type?: 'recurring' | 'final';
}

export async function recordServiceInvoice(params: RecordServiceInvoiceParams): Promise<ServiceBill | null> {
    try {
        const metadata = {
            invoice_number: params.invoiceNumber,
            invoice_pdf_url: params.invoicePdfUrl,
            status: 'pending',
            generated_at: new Date().toISOString(),
        };

        // Check if an existing bill exists for this service and matching period
        const { data: existingBills } = await supabase
            .from('service_bills')
            .select('id, notes, amount, total_days')
            .eq('service_id', params.serviceId)
            .eq('period_start', params.periodStart)
            .eq('period_end', params.periodEnd)
            .limit(1);

        let bill: any = null;

        if (existingBills && existingBills.length > 0) {
            const existing = existingBills[0];
            let existingNotes: any = {};
            try { existingNotes = existing.notes ? JSON.parse(existing.notes) : {}; } catch {}

            const mergedNotes = {
                ...existingNotes,
                invoice_number: params.invoiceNumber,
                invoice_pdf_url: params.invoicePdfUrl,
                generated_at: new Date().toISOString(),
                status: existingNotes.status === 'paid' ? 'paid' : 'pending',
            };

            const { data: updatedBill, error: updateError } = await supabase
                .from('service_bills')
                .update({
                    total_days: params.totalDays,
                    daily_rate_used: params.dailyRateUsed,
                    amount: params.amount,
                    notes: JSON.stringify(mergedNotes),
                })
                .eq('id', existing.id)
                .select()
                .single();

            if (updateError) console.error('Failed to update service_bill record:', updateError);
            bill = updatedBill;
        } else {
            const { data: insertedBill, error: billError } = await supabase
                .from('service_bills')
                .insert({
                    service_id: params.serviceId,
                    period_start: params.periodStart,
                    period_end: params.periodEnd,
                    total_days: params.totalDays,
                    daily_rate_used: params.dailyRateUsed,
                    amount: params.amount,
                    type: params.type || 'recurring',
                    deposit_applied: 0,
                    deposit_settled: false,
                    notes: JSON.stringify(metadata),
                })
                .select()
                .single();

            if (billError) console.error('Failed to insert service_bill record:', billError);
            bill = insertedBill;
        }

        // Also update legacy worker_assignments / crm_leads if client_id is present
        if (params.clientId) {
            await supabase
                .from('worker_assignments')
                .update({
                    final_invoice_generated: true,
                    invoice_pdf_url: params.invoicePdfUrl,
                    final_invoice_number: params.invoiceNumber,
                    client_billing_rate: params.dailyRateUsed,
                })
                .eq('client_id', params.clientId);

            await supabase
                .from('crm_leads')
                .update({ pipeline_stage: 'Monthly Billing' })
                .eq('id', params.clientId);
        }

        return bill as ServiceBill;
    } catch (err) {
        console.error('Error recording service invoice:', err);
        return null;
    }
}

// ── Mark Service Bill Paid ────────────────────────────────

export interface MarkServiceBillPaidParams {
    billId?: string;
    serviceId?: string;
    clientName: string;
    amount: number;
    paymentMethod: string;
    transactionRef?: string;
    paymentDate?: string;
}

export async function markServiceBillPaid(params: MarkServiceBillPaidParams): Promise<boolean> {
    try {
        const txnRef = params.transactionRef?.trim() || `${params.paymentMethod.toUpperCase().replace(/\s+/g, '')}-${crypto.randomUUID().replace(/-/g, '').substring(0, 8).toUpperCase()}`;
        const payDate = params.paymentDate ? new Date(params.paymentDate).toISOString() : new Date().toISOString();

        // 1. Record in payments table
        await supabase.from('payments').insert({
            client_name: params.clientName,
            amount: params.amount,
            payment_type: 'service',
            transaction_ref: txnRef,
            payment_date: payDate,
            recorded_by: 'admin',
        });

        // 2. Update service_bills note metadata if billId is provided
        if (params.billId) {
            const { data: bill } = await supabase
                .from('service_bills')
                .select('notes')
                .eq('id', params.billId)
                .single();

            let notesObj: any = {};
            try {
                notesObj = bill?.notes ? JSON.parse(bill.notes) : {};
            } catch {
                notesObj = {};
            }

            notesObj.status = 'paid';
            notesObj.paid_at = new Date().toISOString();
            notesObj.payment_method = params.paymentMethod;
            notesObj.transaction_ref = txnRef;

            await supabase
                .from('service_bills')
                .update({ notes: JSON.stringify(notesObj) })
                .eq('id', params.billId);
        }

        return true;
    } catch (err) {
        console.error('Error marking service bill paid:', err);
        return false;
    }
}
