/**
 * Service Lifecycle Management
 * 
 * Handles creating services, assigning/releasing workers,
 * ending services with deposit settlement, and monthly billing.
 */

import { supabase } from '../lib/supabase';

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
}

// ── Fetch Services ────────────────────────────────────────

export async function getActiveServices(): Promise<ServiceWithDetails[]> {
    const { data, error } = await supabase
        .from('services')
        .select(`
            *,
            clients(client_name, phone_number),
            service_worker_assignments(
                *,
                employees(id, full_name, job_title, photo_url, status)
            )
        `)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to fetch services: ${error.message}`);
    return (data || []) as ServiceWithDetails[];
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
            )
        `)
        .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to fetch services: ${error.message}`);
    return (data || []) as ServiceWithDetails[];
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
            )
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
    total_lifetime_days?: number;
    rate_used?: number;
    true_cost?: number;
    previously_billed?: number;
    deposit?: number;
    settlement?: number;
    workers_released?: number;
    error?: string;
}

export async function endService(
    serviceId: string,
    endDate?: string
): Promise<EndServiceResult> {
    const { data, error } = await supabase.rpc('end_service', {
        p_service_id: serviceId,
        p_end_date: endDate || new Date().toISOString().split('T')[0],
    });

    if (error) throw new Error(`Failed to end service: ${error.message}`);
    return data as EndServiceResult;
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
    return data as MonthlyBillingResult;
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
