import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileText, CheckCircle2, AlertCircle, Building, Send, Edit3, X, Globe, QrCode, History, Search, Download, Loader2, Bot, ShieldCheck, Copy } from 'lucide-react';

const RupeeIcon = ({ className }: { className?: string }) => (
    <span className={`font-bold leading-none flex items-center justify-center ${className || ''}`} style={{ fontFamily: 'system-ui, sans-serif' }}>₹</span>
);
import { toast } from 'sonner';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { resolveClientBillingRatePerDay, numberToWordsINR, calculateClientAttendanceSummary, calculateClientServiceDaysFromAttendance, type ClientAttendanceSummary } from '../utils/billingRate';
import ServicesPanel from '../components/hr/ServicesPanel';
import { recordServiceInvoice, markServiceBillPaid } from '../services/serviceLifecycle';
import { generateAndUploadInvoicePdf } from '../utils/generateInvoicePdf';

type ManualInvoiceForm = {
    clientName: string;
    phone: string;
    address: string;
    serviceName: string;
    startDate: string;
    endDate: string;
    customDays: string;
    ratePerDay: string;
    depositCollected: string;
    serviceHours: '10' | '24';
    billingMode: 'ongoing' | 'settle_deposit_and_end';
};

type ClientMatch = {
    id: string;
    name: string;
    phone: string;
    source: 'clients' | 'crm_leads';
    stage?: string;
};

const formatInputDate = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const todayInputDate = () => formatInputDate(new Date());

const addDaysInputDate = (dateStr: string, days: number) => {
    const date = dateStr ? new Date(`${dateStr}T00:00:00`) : new Date();
    date.setDate(date.getDate() + days);
    return formatInputDate(date);
};

const inclusiveDays = (startDate: string, endDate: string) => {
    if (!startDate || !endDate) return 0;
    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T00:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;
    return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
};


const normalizePhoneDigits = (phone: string) => phone.replace(/\D/g, '');
const phoneLast10 = (phone: string) => normalizePhoneDigits(phone).slice(-10);

const parseManualInvoiceNotes = (notes?: string | null) => {
    const parsed: Record<string, string> = {};
    (notes || '').split('\n').forEach(line => {
        const idx = line.indexOf(':');
        if (idx === -1) return;
        parsed[line.slice(0, idx).trim().toLowerCase()] = line.slice(idx + 1).trim();
    });
    return parsed;
};

const buildManualInvoiceNotes = (form: ManualInvoiceForm, extras: Record<string, string | number> = {}) => {
    const lines = [
        `Manual Invoice: true`,
        `Service: ${form.serviceName.trim()}`,
        `Shift: ${form.serviceHours}`,
        `Location: ${form.address.trim()}`,
        `Start Date: ${form.startDate}`,
        `End Date: ${form.endDate}`,
        `Rate Per Day: ${Number(form.ratePerDay) || 0}`,
        `Deposit Collected: ${Number(form.depositCollected || 0)}`,
        `Billing Mode: ${form.billingMode || 'ongoing'}`,
        `Deposit Settled: ${form.billingMode === 'settle_deposit_and_end' ? 'true' : 'false'}`,
        ...Object.entries(extras).map(([key, value]) => `${key}: ${value}`),
    ];
    return lines.join('\n');
};

const manualInvoiceInitialForm = (): ManualInvoiceForm => ({
    clientName: '',
    phone: '',
    address: '',
    serviceName: '',
    startDate: todayInputDate(),
    endDate: todayInputDate(),
    customDays: '1',
    ratePerDay: '800',
    depositCollected: '0',
    serviceHours: '10',
    billingMode: 'ongoing',
});


export default function Billing() {
    const [searchParams, setSearchParams] = useSearchParams();
    const currentMonthYear = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
    const [activeTab, setActiveTab] = useState<'deposits' | 'monthly' | 'history'>((searchParams.get('tab') as any) || 'deposits');

    // Sync active tab and search query with URL parameters (?tab=monthly, deposits, history & search=...)
    useEffect(() => {
        const tabParam = searchParams.get('tab') as any;
        if (tabParam && ['deposits', 'monthly', 'history'].includes(tabParam) && tabParam !== activeTab) {
            setActiveTab(tabParam);
        }
        const searchParam = searchParams.get('search');
        if (searchParam !== null) {
            setHistorySearch(searchParam);
        }
    }, [searchParams]);
    const [historySubTab, setHistorySubTab] = useState<'deposit' | 'service'>('deposit');
    const [selectedMonth, setSelectedMonth] = useState<string>(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });
    const [historySearch, setHistorySearch] = useState<string>(() => searchParams.get('search') || '');
    const [loadingInvoicePaymentId, setLoadingInvoicePaymentId] = useState<string | null>(null);
    const [payments, setPayments] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const [deposits, setDeposits] = useState<any[]>([]);
    const [depositFilter, setDepositFilter] = useState<'all' | 'held' | 'pending' | 'settled'>('all');
    const [depositSearch, setDepositSearch] = useState('');
    const [monthlyBills, setMonthlyBills] = useState<any[]>([]);

    // Deposit Collect Modal State
    const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
    const [activeDepositId, setActiveDepositId] = useState<any | null>(null);
    const [depositMethod, setDepositMethod] = useState('Online');
    const [depositDate, setDepositDate] = useState<string>(todayInputDate());

    // Service Bill Collection Modal State
    const [servicesRefreshKey, setServicesRefreshKey] = useState(0);
    const [isRecordCollectionOpen, setIsRecordCollectionOpen] = useState(false);
    const [collectionTarget, setCollectionTarget] = useState<{
        service: any;
        bill: any;
        clientName: string;
        invoiceNo: string;
        period: string;
        amount: number;
    } | null>(null);
    const [collectionAmount, setCollectionAmount] = useState<number>(0);
    const [collectionMethod, setCollectionMethod] = useState<'UPI' | 'Cash' | 'Online Transfer' | 'Cheque'>('UPI');
    const [collectionRef, setCollectionRef] = useState<string>('');
    const [collectionDate, setCollectionDate] = useState<string>(todayInputDate());
    const [isSubmittingCollection, setIsSubmittingCollection] = useState(false);

    // Edit Monthly Bill Modal State
    const [isEditBillModalOpen, setIsEditBillModalOpen] = useState(false);
    const [editingBill, setEditingBill] = useState<any>(null);

    // AI WhatsApp Agent State
    const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);
    const [agentTargetBill, setAgentTargetBill] = useState<any>(null);
    const [agentDraftLang, setAgentDraftLang] = useState<'English' | 'Hindi' | 'Hinglish'>('Hinglish');
    const [agentDraftText, setAgentDraftText] = useState('');

    const [invoiceDepositAmount, setInvoiceDepositAmount] = useState('');
    const [invoiceStartDate, setInvoiceStartDate] = useState('');
    const [invoiceEndDate, setInvoiceEndDate] = useState('');
    const [isInvoiceOngoing, setIsInvoiceOngoing] = useState(false);
    const [invoiceDueDate, setInvoiceDueDate] = useState('');

    // Invoice Modal State
    const [isInvoiceOpen, setIsInvoiceOpen] = useState(false);
    const [invoiceData, setInvoiceData] = useState<any>(null);

    // Client Invoice Generator State
    const [isClientInvoiceOpen, setIsClientInvoiceOpen] = useState(false);
    const [clientInvoiceBill, setClientInvoiceBill] = useState<any>(null);
    const [ciDays, setCiDays] = useState<number>(1);
    const [ciRate, setCiRate] = useState<number>(0);
    const [ciDeposit, setCiDeposit] = useState<number>(0);
    const [ciSettleDeposit, setCiSettleDeposit] = useState(false);
    const [ciEndService, setCiEndService] = useState(false);
    const [ciStartDate, setCiStartDate] = useState('');
    const [ciEndDate, setCiEndDate] = useState('');
    const [ciAttendanceVerified, setCiAttendanceVerified] = useState(true);
    const [ciAttendanceSummary, setCiAttendanceSummary] = useState<ClientAttendanceSummary | null>(null);
    const [isCiLoadingAttendance, setIsCiLoadingAttendance] = useState(false);

    const handleCiDaysChange = (newDays: number) => {
        setCiDays(newDays);
        if (!ciAttendanceVerified || !ciAttendanceSummary || (ciAttendanceSummary.halfDayDates?.length === 0 && ciAttendanceSummary.absentDates?.length === 0)) {
            const calDays = ciAttendanceSummary?.totalCalendarDays || 1;
            const diff = Math.max(0, calDays - newDays);
            const halfDaysCount = Math.round(diff / 0.5);
            const fullDaysCount = Math.max(0, calDays - halfDaysCount);
            setCiAttendanceSummary(prev => ({
                totalCalendarDays: calDays,
                fullDays: fullDaysCount,
                halfDays: halfDaysCount,
                absentDays: 0,
                effectiveDays: newDays,
                halfDayDates: [],
                absentDates: [],
                fullDayDates: [],
            }));
        }
    };

    const fetchClientInvoiceAttendance = async (startStr: string, endStr: string, targetBill?: any) => {
        const bill = targetBill || clientInvoiceBill;
        if (!bill || !startStr || !endStr) return;

        setIsCiLoadingAttendance(true);
        try {
            const rawService = bill.rawService || bill.rawAssignment;
            const clientId = bill.rawAssignment?.client_id || rawService?.client_id;

            let workerIds: string[] = (rawService?.service_worker_assignments || [])
                .map((a: any) => a.employee_id || a.worker_id)
                .filter(Boolean);

            if (rawService?.legacy_assignment_id && rawService?.worker_assignments) {
                const legacy = rawService.worker_assignments.find((w: any) => w.id === rawService.legacy_assignment_id);
                if (legacy?.employee_id) workerIds.push(legacy.employee_id);
            }
            if (bill.rawAssignment?.employee_id) {
                workerIds.push(bill.rawAssignment.employee_id);
            }

            // Only fallback to worker_assignments if no workers are found on the service, and only active ones
            if (workerIds.length === 0 && clientId) {
                const { data: wAssignments } = await supabase
                    .from('worker_assignments')
                    .select('employee_id')
                    .eq('client_id', clientId)
                    .eq('assignment_status', 'active');
                if (wAssignments) {
                    wAssignments.forEach((a: any) => {
                        if (a.employee_id) workerIds.push(a.employee_id);
                    });
                }
            }

            workerIds = Array.from(new Set(workerIds)).filter(Boolean);

            if (workerIds.length === 0) {
                const d1 = new Date(startStr);
                const d2 = new Date(endStr);
                const calDays = (!isNaN(d1.getTime()) && !isNaN(d2.getTime()) && d2 >= d1)
                    ? Math.max(1, Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)) + 1)
                    : 1;

                const existingDays = bill?.total_days !== undefined ? Number(bill.total_days) : (bill?.days ? parseFloat(bill.days) : undefined);
                const finalDays = (existingDays !== undefined && !isNaN(existingDays) && existingDays > 0) ? existingDays : calDays;
                const diff = Math.max(0, calDays - finalDays);
                const halfDaysCount = Math.round(diff / 0.5);
                const fullDaysCount = Math.max(0, calDays - halfDaysCount);

                setCiAttendanceSummary({
                    totalCalendarDays: calDays,
                    fullDays: fullDaysCount,
                    halfDays: halfDaysCount,
                    absentDays: 0,
                    effectiveDays: finalDays,
                    halfDayDates: [],
                    absentDates: [],
                    fullDayDates: [],
                });
                setCiDays(finalDays);
                setCiAttendanceVerified(false);
                return;
            }

            const { data, error } = await supabase
                .from('attendance')
                .select('worker_id, duty_date, status, is_half_day, is_absent')
                .in('worker_id', workerIds)
                .gte('duty_date', startStr)
                .lte('duty_date', endStr);

            if (error) throw error;

            const summary = calculateClientAttendanceSummary(startStr, endStr, data || []);
            setCiAttendanceSummary(summary);
            setCiDays(summary.effectiveDays);
            setCiAttendanceVerified(Boolean(data && data.length > 0));
        } catch (err) {
            console.error('Error fetching client invoice attendance:', err);
            const d1 = new Date(startStr);
            const d2 = new Date(endStr);
            const calDays = (!isNaN(d1.getTime()) && !isNaN(d2.getTime()) && d2 >= d1)
                ? Math.max(1, Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)) + 1)
                : 1;

            const existingDays = bill?.total_days !== undefined ? Number(bill.total_days) : (bill?.days ? parseFloat(bill.days) : undefined);
            const finalDays = (existingDays !== undefined && !isNaN(existingDays) && existingDays > 0) ? existingDays : calDays;
            const diff = Math.max(0, calDays - finalDays);
            const halfDaysCount = Math.round(diff / 0.5);
            const fullDaysCount = Math.max(0, calDays - halfDaysCount);

            setCiAttendanceSummary({
                totalCalendarDays: calDays,
                fullDays: fullDaysCount,
                halfDays: halfDaysCount,
                absentDays: 0,
                effectiveDays: finalDays,
                halfDayDates: [],
                absentDates: [],
                fullDayDates: [],
            });
            setCiDays(finalDays);
            setCiAttendanceVerified(false);
        } finally {
            setIsCiLoadingAttendance(false);
        }
    };

    // Manual Client Invoice State
    const [isManualInvoiceOpen, setIsManualInvoiceOpen] = useState(false);
    const [manualInvoiceForm, setManualInvoiceForm] = useState<ManualInvoiceForm>(() => manualInvoiceInitialForm());
    const [manualDuplicateMatches, setManualDuplicateMatches] = useState<ClientMatch[]>([]);
    const [isDuplicateChoiceOpen, setIsDuplicateChoiceOpen] = useState(false);
    const [isManualInvoiceGenerating, setIsManualInvoiceGenerating] = useState(false);

    const fetchBillingData = async () => {
        setIsLoading(true);
        try {
            // Run all queries in parallel for fast loading
            const [assignmentsResult, leadsResult, quotesResult, servicePaymentsResult, manualLeadsResult, servicesResult] = await Promise.all([
                supabase
                    .from('worker_assignments')
                    .select(`
                        id,
                        employee_id,
                        start_date,
                        end_date,
                        deposit_amount,
                        deposit_paid,
                        advance_paid,
                        client_billing_rate,
                        deposit_invoice_sent,
                        invoice_pdf_url,
                        assigned_at,
                        final_invoice_generated,
                        final_invoice_number,
                        hours_per_day,
                        assignment_status,
                        notes,
                        clients (client_name, phone_number, id),
                        employees (id, full_name, job_title, phone, rate_10hr, rate_24hr)
                    `)
                    .neq('assignment_status', 'cancelled')
                    .order('assigned_at', { ascending: false }),
                supabase.from('crm_leads').select('id, estimated_value_monthly, notes, assigned_worker_role'),
                supabase
                    .from('crm_quotations')
                    .select('lead_id, complete_month_rate, incomplete_month_rate, duration, start_date, deposit')
                    .order('created_at', { ascending: true }),
                supabase.from('payments').select('client_name').eq('payment_type', 'service'),
                supabase
                    .from('crm_leads')
                    .select('id, name, phone, whatsapp_number, source, status, pipeline_stage, estimated_value_monthly, created_at, notes')
                    .eq('pipeline_stage', 'Monthly Billing')
                    .is('deleted_at', null),
                supabase
                    .from('services')
                    .select('id, client_id, service_type, start_date, end_date, status, deposit_amount, deposit_status, created_at, notes, legacy_assignment_id, clients(id, client_name, phone_number)')
                    .order('created_at', { ascending: false }),
            ]);

            const { data, error } = assignmentsResult;
            if (error) throw error;
            if (manualLeadsResult.error) throw manualLeadsResult.error;

            let leadsMap: Record<string, number> = {};
            let activeLeadIds = new Set<string>();
            const leadsMetaMap: Record<string, { notes?: string, role?: string }> = {};
            if (leadsResult.data) {
                leadsResult.data.forEach((l: any) => {
                    activeLeadIds.add(l.id);
                    if (l.estimated_value_monthly) leadsMap[l.id] = l.estimated_value_monthly;
                    leadsMetaMap[l.id] = { notes: l.notes, role: l.assigned_worker_role };
                });
            }

            let quotesMap: Record<string, any> = {};
            if (quotesResult.data) {
                quotesResult.data.forEach((q: any) => { quotesMap[q.lead_id] = q; });
            }

            const paidClients = new Set<string>();
            if (servicePaymentsResult.data) {
                servicePaymentsResult.data.forEach((p: any) => { if (p.client_name) paidClients.add(p.client_name); });
            }

            if (data) {
                // Filter data to only include active assignments where the client has a corresponding active lead in the CRM
                const activeAssignments = data.filter(asgn => {
                    const clientId = (asgn as any).clients?.id;
                    return clientId && activeLeadIds.has(clientId);
                });

                // Fetch paid service clients BEFORE building state so status is correct on first render
                try {
                    const { data: servicePayments } = await supabase
                        .from('payments')
                        .select('client_name')
                        .eq('payment_type', 'service');
                    if (servicePayments) {
                        servicePayments.forEach((p: any) => { if (p.client_name) paidClients.add(p.client_name); });
                    }
                } catch (err) {
                    console.warn('Could not fetch service payments:', err);
                }

                // Helper to format clean care service name
                const formatServiceName = (type?: string, notes?: string, leadRole?: string) => {
                    if (type && type !== 'date_range' && type !== 'open_ended' && type !== 'one_day' && type.trim() !== '') {
                        return type;
                    }
                    if (leadRole) return leadRole;
                    if (notes) {
                        const match = notes.match(/Service:\s*([^\n\r]+)/i);
                        if (match && match[1]?.trim()) return match[1].trim();
                    }
                    return 'Home Care Service';
                };

                const allSvcs = servicesResult.data || [];
                const asgns = data || [];
                const asgnsByClient: Record<string, any[]> = {};
                for (const a of asgns) {
                    const cId = (a as any).clients?.id || (a as any).client_id;
                    if (!cId) continue;
                    if (!asgnsByClient[cId]) asgnsByClient[cId] = [];
                    asgnsByClient[cId].push(a);
                }

                // Group services by client
                const svcsByClient: Record<string, any[]> = {};
                for (const s of allSvcs) {
                    const cId = s.client_id;
                    if (!cId || !activeLeadIds.has(cId)) continue;
                    if (!svcsByClient[cId]) svcsByClient[cId] = [];
                    svcsByClient[cId].push(s);
                }

                const mappedDeposits: any[] = [];
                const processedClientIds = new Set<string>();

                // 1. Process clients with services in services table
                for (const [cId, clientSvcs] of Object.entries(svcsByClient)) {
                    processedClientIds.add(cId);
                    const clientAsgns = asgnsByClient[cId] || [];
                    const activeSvc = clientSvcs.find(s => s.status === 'active');
                    const endedSvcs = clientSvcs.filter(s => s.status !== 'active');

                    // Build previous deposits list for this client - only including cycles that had an actual deposit
                    const previousDeposits = endedSvcs
                        .filter(s => (s.deposit_amount && s.deposit_amount > 0) || s.deposit_status === 'collected' || s.deposit_status === 'settled')
                        .map(s => {
                            const matchingAsgn = clientAsgns.find(a => 
                                (s.start_date && a.start_date?.startsWith(s.start_date)) || a.id === s.legacy_assignment_id
                            ) || clientAsgns.find(a => a.invoice_pdf_url && a.assignment_status === 'completed');

                            const leadMeta = leadsMetaMap[cId];
                            const serviceName = formatServiceName(s.service_type, s.notes || leadMeta?.notes, leadMeta?.role);
                            const depositAmt = s.deposit_amount || matchingAsgn?.deposit_amount || 0;
                            return {
                                service_name: serviceName,
                                amount: `₹${depositAmt}`,
                                numeric_amount: Number(depositAmt) || 0,
                                date: new Date(s.start_date || s.created_at || matchingAsgn?.assigned_at || new Date()).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
                                status: s.deposit_status === 'settled' ? 'Settled on Final Bill' : 'Paid',
                                invoice_pdf_url: matchingAsgn?.invoice_pdf_url || null
                            };
                        });

                    if (activeSvc) {
                        const matchingAsgn = clientAsgns.find(a => a.assignment_status === 'active' && a.invoice_pdf_url)
                            || clientAsgns.find(a => a.assignment_status === 'active')
                            || clientAsgns[0];
                        const leadMeta = leadsMetaMap[cId];
                        const depositAmt = activeSvc.deposit_amount 
                            || matchingAsgn?.deposit_amount 
                            || quotesMap[cId]?.deposit 
                            || leadMeta?.quoted_monthly_rate 
                            || leadMeta?.estimated_value_monthly 
                            || (hasInvoiceSent ? 15000 : 0);
                        const isPaid = activeSvc.deposit_status === 'collected';
                        const hasInvoiceSent = !!matchingAsgn?.deposit_invoice_sent;
                        const depStatus = isPaid ? 'Paid' : (hasInvoiceSent ? 'Invoice Sent' : 'Pending Invoice');
                        const serviceName = formatServiceName(activeSvc.service_type, activeSvc.notes || leadMeta?.notes, leadMeta?.role);

                        // Only include real deposits (deposit amount > 0, paid, invoice sent, or previous deposits exist)
                        if (Number(depositAmt) > 0 || isPaid || hasInvoiceSent || previousDeposits.length > 0) {
                            mappedDeposits.push({
                                id: matchingAsgn?.id || activeSvc.id,
                                assignment_id: matchingAsgn?.id,
                                service_id: activeSvc.id,
                                client_id: cId,
                                client: (activeSvc as any).clients?.client_name || matchingAsgn?.clients?.client_name || 'Unknown',
                                service_name: serviceName,
                                client_phone: (activeSvc as any).clients?.phone_number || matchingAsgn?.clients?.phone_number || '+91 9016116564',
                                amount: `₹${depositAmt}`,
                                numeric_amount: Number(depositAmt) || 0,
                                status: depStatus,
                                is_active_cycle: true,
                                date: new Date(activeSvc.start_date || activeSvc.created_at || matchingAsgn?.assigned_at || new Date()).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
                                invoice_no: "",
                                invoice_pdf_url: matchingAsgn?.invoice_pdf_url || null,
                                previous_deposits: previousDeposits
                            });
                        }
                    }

                    // Always map ended services that had deposits so they appear in Settled / Historical
                    for (const s of endedSvcs) {
                        const matchingAsgn = clientAsgns.find(a => (s.start_date && a.start_date?.startsWith(s.start_date)) || a.id === s.legacy_assignment_id)
                            || clientAsgns.find(a => a.invoice_pdf_url && a.assignment_status === 'completed');
                        const leadMeta = leadsMetaMap[cId];
                        const serviceName = formatServiceName(s.service_type, s.notes || leadMeta?.notes, leadMeta?.role);
                        const depositAmt = s.deposit_amount 
                            || matchingAsgn?.deposit_amount 
                            || quotesMap[cId]?.deposit 
                            || leadMeta?.quoted_monthly_rate 
                            || leadMeta?.estimated_value_monthly 
                            || 0;
                        if (Number(depositAmt) > 0 || s.deposit_status === 'collected' || s.deposit_status === 'settled') {
                            mappedDeposits.push({
                                id: s.id,
                                assignment_id: matchingAsgn?.id,
                                service_id: s.id,
                                client_id: cId,
                                client: (s as any).clients?.client_name || matchingAsgn?.clients?.client_name || 'Unknown',
                                service_name: serviceName,
                                client_phone: (s as any).clients?.phone_number || matchingAsgn?.clients?.phone_number || '+91 9016116564',
                                amount: `₹${depositAmt}`,
                                numeric_amount: Number(depositAmt) || 0,
                                status: s.deposit_status === 'settled' ? 'Settled' : 'Paid',
                                is_active_cycle: false,
                                date: new Date(s.start_date || s.created_at || matchingAsgn?.assigned_at || new Date()).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
                                invoice_no: "",
                                invoice_pdf_url: matchingAsgn?.invoice_pdf_url || (matchingAsgn as any)?.final_invoice_url || null,
                                previous_deposits: []
                            });
                        }
                    }
                }

                // 2. Add legacy client assignments that have no record in services table
                for (const asgn of activeAssignments) {
                    const cId = (asgn as any).clients?.id;
                    if (!cId || processedClientIds.has(cId)) continue;
                    processedClientIds.add(cId);

                    const leadMeta = leadsMetaMap[cId];
                    const hasInvoiceSent = !!asgn.deposit_invoice_sent;
                    const depositAmt = asgn.deposit_amount 
                        || quotesMap[cId]?.deposit 
                        || leadMeta?.quoted_monthly_rate 
                        || leadMeta?.estimated_value_monthly 
                        || (hasInvoiceSent ? 15000 : 0);
                    const isPaid = asgn.deposit_paid && asgn.deposit_paid > 0;
                    const depStatus = isPaid ? 'Paid' : (hasInvoiceSent ? 'Invoice Sent' : 'Pending Invoice');
                    const serviceName = formatServiceName(asgn.notes, leadMeta?.notes, leadMeta?.role);

                    // Only include if depositAmt > 0 or isPaid or hasInvoiceSent
                    if (Number(depositAmt) > 0 || isPaid || hasInvoiceSent) {
                        mappedDeposits.push({
                            id: asgn.id,
                            assignment_id: asgn.id,
                            service_id: null,
                            client_id: cId,
                            client: (asgn as any).clients?.client_name || 'Unknown',
                            service_name: serviceName,
                            client_phone: (asgn as any).clients?.phone_number || '+91 9016116564',
                            amount: `₹${depositAmt}`,
                            numeric_amount: Number(depositAmt) || 0,
                            status: depStatus,
                            is_active_cycle: asgn.assignment_status === 'active',
                            date: new Date(asgn.assigned_at || asgn.start_date || new Date()).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
                            invoice_no: "",
                            invoice_pdf_url: asgn.invoice_pdf_url || null,
                            previous_deposits: []
                        });
                    }
                }

                // 3. Add manual invoice leads with settled deposits (e.g. prayag raj)
                for (const lead of (manualLeadsResult.data || [])) {
                    if (processedClientIds.has(lead.id)) continue;
                    const info = parseManualInvoiceNotes(lead.notes);
                    const depositAmt = Number(info['deposit collected'] || 0);
                    if (depositAmt > 0) {
                        processedClientIds.add(lead.id);
                        mappedDeposits.push({
                            id: `manual-dep-${lead.id}`,
                            assignment_id: null,
                            service_id: null,
                            client_id: lead.id,
                            client: lead.name || 'Manual Client',
                            service_name: formatServiceName(info.service, lead.notes),
                            client_phone: lead.whatsapp_number || lead.phone || '',
                            amount: `₹${depositAmt}`,
                            numeric_amount: depositAmt,
                            status: 'Settled',
                            is_active_cycle: false,
                            date: new Date(info['start date'] || lead.created_at || Date.now()).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
                            invoice_no: info['invoice no'] || '',
                            invoice_pdf_url: info['invoice pdf'] || null,
                            previous_deposits: []
                        });
                    }
                }

                // Sort: active cycles first, then by date descending
                mappedDeposits.sort((a, b) => {
                    if (a.is_active_cycle && !b.is_active_cycle) return -1;
                    if (!a.is_active_cycle && b.is_active_cycle) return 1;
                    return new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime();
                });

                setDeposits(mappedDeposits);

                const assignedClientIds = new Set(activeAssignments.map(asgn => (asgn as any).clients?.id).filter(Boolean));

                // Build monthly bills with correct status in one pass — no second update needed
                const assignmentBills = activeAssignments.map(asgn => {
                    const clientId = (asgn as any).clients?.id;
                    const clientName = (asgn as any).clients?.client_name || 'Unknown';
                    const quote = quotesMap[clientId];
                    const billingRate = resolveClientBillingRatePerDay(asgn as any, quote);
                    let status: string;
                    if (paidClients.has(clientName)) {
                        status = 'Paid';
                    } else if (asgn.final_invoice_generated) {
                        status = 'Sent';
                    } else {
                        status = 'Draft';
                    }
                    return {
                        id: asgn.id,
                        client_id: clientId,
                        client: clientName,
                        client_phone: (asgn as any).clients?.phone_number || '+91 9016116564',
                        amount: `₹${billingRate}/day`,
                        attendanceVerified: true,
                        status,
                        month: new Date(asgn.assigned_at).toLocaleString('default', { month: 'long' }),
                        invoice_no: asgn.final_invoice_number || "",
                        invoice_pdf_url: asgn.invoice_pdf_url || "",
                        rawAssignment: { ...asgn, _quote: quote }
                    };
                });

                const manualBills = (manualLeadsResult.data || [])
                    .filter((lead: any) => !assignedClientIds.has(lead.id))
                    .filter((lead: any) => {
                        const source = (lead.source || '').toLowerCase();
                        const notes = (lead.notes || '').toLowerCase();
                        return source.includes('manual invoice') || notes.includes('manual invoice: true');
                    })
                    .map((lead: any) => {
                        const info = parseManualInvoiceNotes(lead.notes);
                        const rate = Number(info['rate per day'] || 0);
                        const payable = Number(info['amount payable'] || lead.estimated_value_monthly || 0);
                        return {
                            id: `manual-${lead.id}`,
                            client_id: lead.id,
                            client: lead.name || 'Manual Client',
                            client_phone: lead.whatsapp_number || lead.phone || '',
                            amount: rate ? `₹${rate}/day` : `₹${payable}`,
                            attendanceVerified: true,
                            status: lead.status === 'Paid' ? 'Paid' : 'Sent',
                            month: new Date(lead.created_at || Date.now()).toLocaleString('default', { month: 'long' }),
                            invoice_no: info['invoice no'] || '',
                            invoice_pdf_url: info['invoice pdf'] || '',
                            rawAssignment: {
                                isManualInvoice: true,
                                client_billing_rate: rate,
                                deposit_amount: Number(info['deposit collected'] || 0),
                                start_date: info['start date'] || '',
                                end_date: info['end date'] || '',
                                service_name: info.service || '',
                            },
                        };
                    });

                setMonthlyBills([...manualBills, ...assignmentBills]);
            }
        } catch (err: any) {
            console.error('Error fetching billing data:', err);
            toast.error('Failed to load billing records');
        } finally {
            setIsLoading(false);
        }
    };

    /** Save client rate/day from Prepare Invoice so the billing list stays in sync. */
    const persistClientBillingRate = async (bill: any, ratePerDay: number) => {
        const rate = Math.max(0, Number(ratePerDay) || 0);
        if (!bill?.id || rate <= 0) return;

        const amountLabel = `₹${rate.toLocaleString('en-IN')}/day`;
        const isManual = bill.rawAssignment?.isManualInvoice || String(bill.id).startsWith('manual-');

        if (!isManual) {
            const { error } = await supabase
                .from('worker_assignments')
                .update({ client_billing_rate: rate })
                .eq('id', bill.id);
            if (error) throw error;
        }

        setMonthlyBills(prev =>
            prev.map(b =>
                b.id === bill.id
                    ? {
                          ...b,
                          amount: amountLabel,
                          rawAssignment: b.rawAssignment
                              ? { ...b.rawAssignment, client_billing_rate: rate }
                              : b.rawAssignment,
                      }
                    : b,
            ),
        );
    };

    const commitClientInvoiceDraft = async () => {
        if (!clientInvoiceBill) return;
        await persistClientBillingRate(clientInvoiceBill, ciRate);
        setInvoiceStartDate(ciStartDate);
        setInvoiceEndDate(ciEndDate);

        try {
            const billId = clientInvoiceBill.bill_id || clientInvoiceBill.id;
            const serviceId = clientInvoiceBill.service_id;
            const totalGross = ciDays * ciRate;
            const depApplied = ciSettleDeposit ? ciDeposit : 0;
            const netPayable = Math.max(0, totalGross - depApplied);

            if (billId && typeof billId === 'string' && !billId.startsWith('manual-') && !billId.startsWith('asgn-')) {
                await supabase
                    .from('service_bills')
                    .update({
                        total_days: ciDays,
                        daily_rate_used: ciRate,
                        deposit_applied: depApplied,
                        deposit_settled: ciSettleDeposit,
                        amount: netPayable,
                    })
                    .eq('id', billId);
            }

            if (serviceId && ciEndService) {
                await supabase
                    .from('services')
                    .update({
                        status: 'ended',
                        deposit_status: 'settled',
                        end_date: ciEndDate || new Date().toISOString().split('T')[0],
                    })
                    .eq('id', serviceId);
            }
        } catch (err) {
            console.warn('Could not sync draft to service_bills:', err);
        }
    };

    const fetchPayments = async () => {
        setIsLoading(true);
        try {
            const [paymentsRes, leadsRes, assignmentsRes] = await Promise.all([
                supabase
                    .from('payments')
                    .select('*')
                    .order('payment_date', { ascending: false }),
                supabase
                    .from('crm_leads')
                    .select('id, name, notes, phone'),
                supabase
                    .from('worker_assignments')
                    .select('id, client_id, invoice_pdf_url')
            ]);
            
            if (paymentsRes.error) throw paymentsRes.error;
            const paymentsData = paymentsRes.data || [];
            const leadsData = leadsRes.data || [];
            const assignmentsData = assignmentsRes.data || [];

            const enriched = paymentsData.map(p => {
                let lead = null;
                if (p.transaction_ref && p.transaction_ref.startsWith('MANUAL-DEP-')) {
                    const hex = p.transaction_ref.replace('MANUAL-DEP-', '').toLowerCase();
                    lead = leadsData.find(l => l.id.toLowerCase().startsWith(hex));
                }
                if (!lead && p.client_name) {
                    lead = leadsData.find(l => l.name?.trim().toLowerCase() === p.client_name?.trim().toLowerCase());
                }

                let serviceInvoiceUrl: string | null = null;
                let depositInvoiceUrl: string | null = null;

                if (lead?.notes) {
                    const match = lead.notes.match(/Invoice PDF:\s*(https:\/\/[^\s\n\r]+)/i);
                    if (match && match[1]) {
                        if (match[1].includes('/DEP-')) {
                            depositInvoiceUrl = match[1];
                        } else {
                            serviceInvoiceUrl = match[1];
                        }
                    }
                }
                if (lead) {
                    const asgn = assignmentsData.find(a => a.client_id === lead.id && a.invoice_pdf_url);
                    if (asgn?.invoice_pdf_url) {
                        if (asgn.invoice_pdf_url.includes('/DEP-')) {
                            depositInvoiceUrl = asgn.invoice_pdf_url;
                        } else if (!serviceInvoiceUrl) {
                            serviceInvoiceUrl = asgn.invoice_pdf_url;
                        }
                    }
                }

                return {
                    ...p,
                    matched_lead_id: lead?.id,
                    cached_service_url: serviceInvoiceUrl,
                    cached_deposit_url: depositInvoiceUrl,
                };
            });

            setPayments(enriched);
        } catch (err: any) {
            console.error('Error fetching payments:', err);
            toast.error('Failed to load payment history');
        } finally {
            setIsLoading(false);
        }
    };

    const handleViewPaymentInvoice = async (payment: any) => {
        const isDeposit = historySubTab === 'deposit'
            ? true
            : historySubTab === 'service'
                ? false
                : (payment.payment_type === 'deposit' || 
                   (!payment.payment_type && ['ONLINE', 'UPI', 'CHEQUE', 'CASH', 'MANUAL-DEP', 'DEP'].some(prefix => payment.transaction_ref?.toUpperCase().startsWith(prefix))));

        const leadId = payment.matched_lead_id;
        if (!leadId) {
            toast.error(`No associated client record found for "${payment.client_name || 'this client'}".`);
            return;
        }

        setLoadingInvoicePaymentId(payment.id);
        try {
            // 1. If viewing Deposit History, prioritize DEP- invoices
            if (isDeposit) {
                if (payment.cached_deposit_url) {
                    window.open(payment.cached_deposit_url, '_blank');
                    return;
                }

                // Check storage bucket for existing DEP-*.pdf
                const { data: files, error } = await supabase.storage.from('invoices').list(leadId);
                if (error) throw error;
                const pdfFiles = (files || []).filter(f => f.name.endsWith('.pdf'));
                const existingDepFile = pdfFiles.find(f => f.name.toUpperCase().startsWith('DEP-'));

                if (existingDepFile) {
                    const { data: pubData } = supabase.storage.from('invoices').getPublicUrl(`${leadId}/${existingDepFile.name}`);
                    const finalUrl = `${pubData.publicUrl}?t=${Date.now()}`;
                    setPayments(prev => prev.map(p => p.id === payment.id ? { ...p, cached_deposit_url: finalUrl } : p));
                    window.open(finalUrl, '_blank');
                    return;
                }

                // If no DEP-*.pdf exists, generate an official Security Deposit Receipt & Invoice PDF on the fly!
                const refSuffix = (payment.transaction_ref || '')
                    .replace(/^MANUAL-DEP-|^DEP-|^UPI-|^CASH-|^ONLINE-TRANSFER-/, '')
                    .replace(/[^A-Za-z0-9]/g, '')
                    .slice(0, 8)
                    .toUpperCase() || leadId.slice(0, 8).toUpperCase();

                const invNumber = `DEP-${refSuffix}`;
                const depositAmt = parseFloat(payment.amount || 0);
                const payDate = payment.payment_date ? payment.payment_date.split('T')[0] : new Date().toISOString().split('T')[0];

                const { data: leadData } = await supabase.from('crm_leads').select('name, phone, whatsapp_number, notes').eq('id', leadId).maybeSingle();
                const notesStr = leadData?.notes || '';
                const sMatch = notesStr.match(/^Service:\s*(.+)$/im);
                const serviceCategory = sMatch ? sMatch[1].trim() : 'Healthcare Service';
                const lMatch = notesStr.match(/^Location:\s*(.+)$/im);
                const clientAddress = lMatch ? lMatch[1].trim() : '';

                const newDepUrl = await generateAndUploadInvoicePdf({
                    clientId: leadId,
                    clientName: payment.client_name || leadData?.name || 'Client',
                    clientPhone: leadData?.phone || leadData?.whatsapp_number || undefined,
                    clientAddress: clientAddress || undefined,
                    invoiceNumber: invNumber,
                    invoiceDate: payDate,
                    dueDate: payDate,
                    serviceName: `Security Deposit — ${serviceCategory}`,
                    servicePeriod: 'Security Deposit Received',
                    days: 1,
                    ratePerDay: depositAmt,
                    grossAmount: depositAmt,
                    previouslyBilled: 0,
                    depositCollected: 0,
                    settlementAmount: depositAmt,
                    isFinalSettlement: false,
                    isDeposit: true,
                });

                setPayments(prev => prev.map(p => p.id === payment.id ? { ...p, cached_deposit_url: newDepUrl } : p));
                window.open(newDepUrl, '_blank');
                return;
            }

            // 2. If viewing Service Invoice History, prioritize INV- invoices
            if (payment.cached_service_url) {
                window.open(payment.cached_service_url, '_blank');
                return;
            }

            const { data: files, error } = await supabase.storage.from('invoices').list(leadId);
            if (error) throw error;
            const pdfFiles = (files || []).filter(f => f.name.endsWith('.pdf'));
            const invFile = pdfFiles.find(f => f.name.toUpperCase().startsWith('INV-')) || pdfFiles[0];

            if (invFile) {
                const { data: pubData } = supabase.storage.from('invoices').getPublicUrl(`${leadId}/${invFile.name}`);
                const finalUrl = `${pubData.publicUrl}?t=${Date.now()}`;
                setPayments(prev => prev.map(p => p.id === payment.id ? { ...p, cached_service_url: finalUrl } : p));
                window.open(finalUrl, '_blank');
                return;
            }

            toast.info(`No service invoice PDF found for ${payment.client_name}.`);
        } catch (err: any) {
            console.error('Error viewing invoice PDF:', err);
            toast.error('Could not load invoice PDF');
        } finally {
            setLoadingInvoicePaymentId(null);
        }
    };

    const handleCopyRef = (ref: string, e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(ref);
        toast.success(`Copied Reference ID: ${ref}`);
    };

    const [loadingDepositDocId, setLoadingDepositDocId] = useState<string | null>(null);

    const handleOpenDepositDoc = async (docUrl?: string | null, clientId?: string | null, docId?: string) => {
        if (docUrl) {
            window.open(docUrl, '_blank');
            return;
        }
        if (!clientId) {
            toast.info('No document attached.');
            return;
        }
        if (docId) setLoadingDepositDocId(docId);
        try {
            const { data: files } = await supabase.storage.from('invoices').list(clientId);
            const pdfFiles = (files || []).filter(f => f.name.endsWith('.pdf'));
            if (pdfFiles.length > 0) {
                // Find most appropriate invoice or deposit PDF (prefer settlement invoice, then deposit)
                const target = pdfFiles.find(f => f.name.startsWith('INV-')) || pdfFiles[0];
                const { data: pubData } = supabase.storage.from('invoices').getPublicUrl(`${clientId}/${target.name}`);
                window.open(`${pubData.publicUrl}?t=${Date.now()}`, '_blank');
                return;
            }
            toast.info('No invoice or deposit document found in storage.');
        } catch (err) {
            console.error('Error fetching document from storage:', err);
            toast.error('Could not load invoice document.');
        } finally {
            if (docId) setLoadingDepositDocId(null);
        }
    };

    useEffect(() => {
        // Close any open modals when switching tabs
        setIsClientInvoiceOpen(false);
        setClientInvoiceBill(null);
        setIsAgentModalOpen(false);
        setIsManualInvoiceOpen(false);
        setIsDuplicateChoiceOpen(false);
        if (activeTab === 'history') {
            fetchPayments();
        } else {
            fetchBillingData();
        }
    }, [activeTab]);



    const handleGenerateDepositInvoice = async (id: string, clientName: string) => {
        // This function is no longer used — deposit invoices are generated
        // via the "Prepare Invoice" button which opens the AI WhatsApp Agent modal.
        // Keeping as a no-op to avoid breaking any lingering references.
        console.warn('[Billing] handleGenerateDepositInvoice called but is deprecated. Use openAgentModal instead.');
    };

    const sendDepositCollectionAlert = async (deposit: any, amount: number) => {
        let phoneDigits = (deposit.client_phone || '').replace(/\D/g, '');
        if (phoneDigits.length === 10) phoneDigits = `91${phoneDigits}`;
        if (!phoneDigits) throw new Error('No phone number found for this client.');

        const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
        const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
        const firstName = deposit.client?.split(/\s+/)[0] || 'there';
        const formattedAmount = `₹${amount.toLocaleString('en-IN')}`;

        const resp = await fetch(`${SUPABASE_URL}/functions/v1/meta-whatsapp-outbound`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'apikey': SUPABASE_ANON_KEY,
            },
            body: JSON.stringify({
                phone: phoneDigits,
                leadId: deposit.client_id,
                message: `Deposit payment received from ${deposit.client}: ${formattedAmount}`,
                useTemplate: true,
                templateName: 'deposit_invoice_alert',
                templateParams: [firstName],
            }),
        });

        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || data.success === false) {
            throw new Error(data.error || `WhatsApp dispatch failed: HTTP ${resp.status}`);
        }
    };

    const handleCollectDeposit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (activeDepositId) {
            const deposit = deposits.find(d => d.id === activeDepositId);
            if (!deposit) return;

            setIsLoading(true);
            const depositAmount = parseFloat(deposit.amount.replace(/[^\d.-]/g, ''));
            try {
                const depositDateISO = depositDate
                    ? (depositDate.includes('T') ? new Date(depositDate).toISOString() : new Date(`${depositDate}T12:00:00`).toISOString())
                    : new Date().toISOString();

                // 1. Record in Payments table
                const { error: payError } = await supabase.from('payments').insert([{
                    amount: depositAmount,
                    client_name: deposit.client,
                    recorded_by: 'admin',
                    transaction_ref: `${depositMethod.toUpperCase()}-${crypto.randomUUID().replace(/-/g, '').substring(0, 8).toUpperCase()}`,
                    payment_date: depositDateISO,
                    payment_type: 'deposit'
                }]);

                if (payError) throw payError;

                // 2. Persist paid status to worker_assignments so it survives page reload
                const { error: assignError } = await supabase
                    .from('worker_assignments')
                    .update({ deposit_paid: depositAmount })
                    .eq('id', activeDepositId);

                if (assignError) throw assignError;

                // 3. Move CRM lead to Active Client stage & update service deposit
                if (deposit.client_id) {
                    await supabase
                        .from('crm_leads')
                        .update({ pipeline_stage: 'Active Client' })
                        .eq('id', deposit.client_id)
                        .eq('pipeline_stage', 'Deposit Pending'); // only advance if still in Deposit Pending

                    if (deposit.service_id) {
                        await supabase
                            .from('services')
                            .update({
                                deposit_amount: depositAmount,
                                deposit_status: 'collected',
                            })
                            .eq('id', deposit.service_id);
                    } else if (deposit.client_id) {
                        await supabase
                            .from('services')
                            .update({
                                deposit_amount: depositAmount,
                                deposit_status: 'collected',
                            })
                            .eq('status', 'active')
                            .or(`client_id.eq.${deposit.client_id},lead_id.eq.${deposit.client_id}`);
                    }
                }

                // 4. Update local UI immediately
                setDeposits(prev => prev.map(d => (d.id === activeDepositId || (deposit.service_id && d.service_id === deposit.service_id)) ? { ...d, status: 'Paid' } : d));

                try {
                    await sendDepositCollectionAlert(deposit, depositAmount);
                    toast.success(`Deposit marked as paid via ${depositMethod}. Client notified on WhatsApp.`);
                } catch (alertError: any) {
                    console.warn('Deposit alert failed:', alertError);
                    toast.warning(`Deposit recorded, but WhatsApp alert failed: ${alertError.message}`);
                }
            } catch (err: any) {
                console.error('Error recording deposit:', err);
                toast.error('Failed to record payment in database');
            } finally {
                setIsLoading(false);
            }
        }
        setIsDepositModalOpen(false);
    };

    const handleConfirmCollection = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!collectionTarget || collectionTarget.amount <= 0) {
            toast.error('Invalid collection target');
            return;
        }

        setIsSubmittingCollection(true);
        try {
            const prefix = collectionMethod === 'Online Transfer' ? 'ONLINE-TRANSFER' : collectionMethod.toUpperCase().replace(/\s+/g, '-');
            const finalTxnRef = collectionRef || `${prefix}-${crypto.randomUUID().replace(/-/g, '').substring(0, 8).toUpperCase()}`;

            const paymentDateISO = collectionDate
                ? (collectionDate.includes('T') ? new Date(collectionDate).toISOString() : new Date(`${collectionDate}T12:00:00`).toISOString())
                : new Date().toISOString();

            const success = await markServiceBillPaid({
                billId: collectionTarget.bill?.id,
                serviceId: collectionTarget.service.id,
                clientName: collectionTarget.clientName,
                amount: Number(collectionTarget.amount),
                paymentMethod: collectionMethod,
                transactionRef: finalTxnRef,
                paymentDate: paymentDateISO,
            });

            if (!success) throw new Error('Failed to record payment in database');

            toast.success(`Payment of ₹${Number(collectionTarget.amount).toLocaleString('en-IN')} recorded for ${collectionTarget.clientName}!`);
            setIsRecordCollectionOpen(false);
            setCollectionTarget(null);
            setServicesRefreshKey(k => k + 1);
            fetchBillingData();
        } catch (err: any) {
            console.error('Error recording payment collection:', err);
            toast.error(err.message || 'Failed to record payment');
        } finally {
            setIsSubmittingCollection(false);
        }
    };

    const handleAction = async (action: string, clientName: string, id: number) => {
        if (action === 'Record Monthly Payment') {
            const bill = monthlyBills.find(b => b.id === id);
            if (!bill) return;

            // Guard: check if already paid to prevent double recording
            const { data: existing } = await supabase
                .from('payments')
                .select('id')
                .eq('client_name', clientName)
                .eq('payment_type', 'service')
                .limit(1);
            
            if (existing && existing.length > 0) {
                toast.error('Payment already recorded for this client.');
                setMonthlyBills(prev => prev.map(b => b.id === id ? { ...b, status: 'Paid' } : b));
                return;
            }

            setIsLoading(true);
            try {
                const txnId = `TXN-${crypto.randomUUID().replace(/-/g, '').substring(0, 9).toUpperCase()}`;
                
                // 1. Record in Payments table
                const { error: payError } = await supabase.from('payments').insert([{
                    amount: parseFloat(bill.amount.replace(/[^\d.-]/g, '')),
                    client_name: clientName,
                    recorded_by: 'admin',
                    transaction_ref: txnId,
                    payment_date: new Date().toISOString(),
                    payment_type: 'service'
                }]);

                if (payError) throw payError;

                setMonthlyBills(prev => prev.map(b => b.id === id ? { ...b, status: 'Paid' } : b));
                toast.success(`Payment gathered for ${clientName}. Transaction ID: ${txnId} logged.`);
            } catch (err: any) {
                console.error('Error recording payment:', err);
                toast.error('Failed to log payment to history');
            } finally {
                setIsLoading(false);
            }
        }
    };

    const handleSaveBill = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingBill) return;
        try {
            const { error } = await supabase
                .from('worker_assignments')
                .update({ client_billing_rate: parseFloat(editingBill.amount.replace(/[^\d.-]/g, '')) || 0 })
                .eq('id', editingBill.id);
            if (error) throw error;
            setMonthlyBills(prev => prev.map(b => b.id === editingBill.id ? editingBill : b));
            toast.success(`Bill for ${editingBill.client} updated successfully.`);
            setIsEditBillModalOpen(false);
        } catch (err: any) {
            console.error('Error saving bill:', err);
            toast.error('Failed to save bill changes to database.');
        }
    };

    // AI WhatsApp Agent Logic
    const generateWhatsappDraft = (bill: any, lang: string) => {
        if (!bill) return '';
        const link = `https://99care.org/pay/${bill.invoice_no || Math.floor(Math.random() * 1000) + 100}`;
        if (lang === 'Hinglish') return `Hello ${bill.client} team, aapka ${bill.month} mahine ka bill generate ho gaya hai. Total amount: ${bill.amount}. Is link par click karke QR code scan karein aur payment complete karein. 📄✅👇\n${link}`;
        if (lang === 'Hindi') return `Namaste ${bill.client}, aapka ${bill.month} mahine ka bil jama karne ke liye taiyar hai. Kul rashi: ${bill.amount}. Kripya is link dwara QR code scan karein aur bhugtan karein:\n${link}`;
        return `Hi ${bill.client}, your monthly invoice for ${bill.month} has been auto-generated. Total amount due: ${bill.amount}. Please click the link below to view the bill and scan the QR code to process your payment:\n${link}`;
    };

    const getBillPayableAmount = (bill: any): number => {
        if (!bill) return 0;
        if (bill.isDepositMode) {
            const dep = invoiceDepositAmount || (typeof bill.amount === 'string' ? bill.amount.replace(/[^0-9.]/g, '') : bill.amount) || '15000';
            return Number(dep) || 15000;
        }
        if (bill.totalAmount && Number(bill.totalAmount) > 0) {
            return Number(bill.totalAmount);
        }
        if (bill.amount) {
            const num = typeof bill.amount === 'string' ? parseFloat(bill.amount.replace(/[^0-9.]/g, '')) : Number(bill.amount);
            if (!isNaN(num) && num > 0) return num;
        }
        if (bill.total_days && bill.daily_rate_used) {
            return Number(bill.total_days) * Number(bill.daily_rate_used);
        }
        if (bill.days && bill.rate) {
            return Number(bill.days) * Number(bill.rate);
        }
        if (invoiceDepositAmount && Number(invoiceDepositAmount) > 0) {
            return Number(invoiceDepositAmount);
        }
        return 0;
    };

    const openInvoiceModal = (bill: any) => {
        const isMonthly = !!bill.month;
        const prefix = isMonthly ? 'INV-M' : 'INV-D';
        const billToProcess = { ...bill, invoice_no: bill.invoice_no || `${prefix}${Math.floor(Math.random() * 1000) + 100}` };
        setAgentTargetBill(billToProcess);
        
        const amountNum = getBillPayableAmount(billToProcess);
        setInvoiceDepositAmount(amountNum.toString());

        setInvoiceData({
            clientName: bill.client,
            phone: bill.client_phone || '+91 9016116564',
            service: isMonthly ? `Monthly Service - ${bill.month}` : 'Security Deposit',
            amount: amountNum,
            totalAmount: amountNum,
            date: new Date().toISOString(),
            invoiceNumber: billToProcess.invoice_no
        });
        
        setAgentDraftText(generateWhatsappDraft(billToProcess, agentDraftLang));
        setIsInvoiceOpen(true);
    };

    const openAgentModal = (bill: any) => {
        const billToProcess = { ...bill, invoice_no: bill.invoice_no || `INV-M${Math.floor(Math.random() * 1000) + 100}` };
        setAgentTargetBill(billToProcess);
        const amountNum = getBillPayableAmount(billToProcess);
        const resolvedAmount = (billToProcess.isDepositMode && (!amountNum || amountNum === 0)) ? 15000 : amountNum;
        setInvoiceDepositAmount(resolvedAmount.toString());

        if (!invoiceDueDate) {
            setInvoiceDueDate(addDaysInputDate(todayInputDate(), 2));
        }
        if (!invoiceStartDate) {
            setInvoiceStartDate(todayInputDate());
        }

        if (billToProcess.isDepositMode) {
            setAgentDraftText(`Hello ${billToProcess.client}, your security deposit invoice has been prepared. Please review the details attached.`);
        } else {
            setAgentDraftText(generateWhatsappDraft(billToProcess, agentDraftLang));
        }
        setIsAgentModalOpen(true);
    };

    useEffect(() => {
        if (agentTargetBill) {
            setAgentDraftText(generateWhatsappDraft(agentTargetBill, agentDraftLang));
        }
    }, [agentDraftLang, agentTargetBill]);

    const handleDispatchMessage = async () => {
        if (!agentTargetBill) return;

        if (agentTargetBill.isDepositMode) {
            setIsAgentModalOpen(false);
            const toastId = toast.loading(`Generating PDF and dispatching to ${agentTargetBill.client}...`);
            try {
                const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
                const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
                
                const formatDateStr = (dateStr: string) => {
                    if (!dateStr) return '';
                    const [y, m, d] = dateStr.split('-');
                    return `${d}/${m}/${y}`;
                };

                const formattedPeriod = (invoiceStartDate && !isInvoiceOngoing && invoiceEndDate)
                    ? `${formatDateStr(invoiceStartDate)} To ${formatDateStr(invoiceEndDate)}`
                    : invoiceStartDate
                        ? `${formatDateStr(invoiceStartDate)} To Ongoing`
                        : 'Ongoing';

                const depositVal = Number(invoiceDepositAmount || agentTargetBill.amount?.replace(/[^0-9.]/g, '')) || 15000;
                const invResp = await fetch(`${SUPABASE_URL}/functions/v1/generate-invoice`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                    },
                    body: JSON.stringify({
                        lead_id: agentTargetBill.client_id,
                        deposit_amount: depositVal,
                        service_period: formattedPeriod,
                        invoice_date: todayInputDate(),
                        due_date: invoiceDueDate,
                        is_deposit: true
                    })
                });

                if (!invResp.ok) {
                    const err = await invResp.text();
                    throw new Error(`Failed to generate invoice: ${err}`);
                }

                const invData = await invResp.json();
                const invoicePdfUrl = invData.public_url;
                
                toast.loading("Sending via WhatsApp...", { id: toastId });

                let phoneDigits = '';
                if (agentTargetBill.client_phone) {
                    phoneDigits = agentTargetBill.client_phone.replace(/\D/g, '');
                    if (phoneDigits.length === 10) phoneDigits = `91${phoneDigits}`;
                }
                if (!phoneDigits) throw new Error(`No phone number on file for ${agentTargetBill.client}. Please update the client's contact details.`);

                const waResp = await fetch(`${SUPABASE_URL}/functions/v1/meta-whatsapp-outbound`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                        'apikey': SUPABASE_ANON_KEY,
                    },
                    body: JSON.stringify({
                        phone: phoneDigits,
                        message: agentDraftText,
                        leadId: agentTargetBill.client_id,
                        sendInvoicePdf: true,
                        invoicePdfUrl: invoicePdfUrl,
                        useTemplate: true,
                        templateName: 'deposit_request',
                        templateParams: [agentTargetBill.client, String(invoiceDepositAmount || agentTargetBill.amount?.replace(/[^0-9.]/g, '') || '')]
                    })
                });

                if (!waResp.ok) throw new Error(await waResp.text());

                const depositVal = Number(invoiceDepositAmount || agentTargetBill.amount?.replace(/[^0-9.]/g, '')) || 15000;
                const targetAsgnId = agentTargetBill.assignment_id || agentTargetBill.id;
                if (targetAsgnId) {
                    await supabase
                        .from('worker_assignments')
                        .update({
                            deposit_amount: depositVal,
                            deposit_invoice_sent: true,
                            invoice_pdf_url: invoicePdfUrl
                        })
                        .eq('id', targetAsgnId);
                }

                if (agentTargetBill.client_id) {
                    await supabase
                        .from('worker_assignments')
                        .update({
                            deposit_amount: depositVal,
                            deposit_invoice_sent: true,
                            invoice_pdf_url: invoicePdfUrl
                        })
                        .eq('client_id', agentTargetBill.client_id)
                        .eq('assignment_status', 'active');

                    await supabase
                        .from('services')
                        .update({
                            deposit_amount: depositVal,
                            deposit_status: 'pending'
                        })
                        .or(`client_id.eq.${agentTargetBill.client_id},lead_id.eq.${agentTargetBill.client_id}`)
                        .eq('status', 'active');

                    await supabase
                        .from('crm_leads')
                        .update({ 
                            deposit_amount: depositVal,
                            pipeline_stage: 'Deposit Pending' 
                        })
                        .eq('id', agentTargetBill.client_id);
                }

                toast.success(`Deposit Invoice dispatched to ${agentTargetBill.client}!`, { id: toastId, duration: 4000 });
                
                setDeposits(prev => prev.map(d => (d.id === agentTargetBill.id || d.client_id === agentTargetBill.client_id) ? { ...d, status: 'Invoice Sent', invoice_pdf_url: invoicePdfUrl, amount: `₹${depositVal}`, numeric_amount: depositVal } : d));

            } catch (error: any) {
                console.error('Dispatch error:', error);
                toast.error(error.message || 'Failed to dispatch invoice', { id: toastId });
            }
            return;
        }

        // Monthly Billing: Generate PDF + send client_monthly_invoice template
        setIsAgentModalOpen(false);
        const billToastId = toast.loading(`Generating invoice for ${agentTargetBill.client}...`);
        try {
            const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
            const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
            const formatDateStr = (ds: string) => { if (!ds) return ''; const [y, m, d] = ds.split('-'); return `${d}/${m}/${y}`; };
            const startDate = invoiceStartDate || agentTargetBill.startDate || '';
            const endDate = invoiceEndDate || agentTargetBill.endDate || '';
            const formattedPeriod = (startDate && endDate)
                ? `${formatDateStr(startDate)} To ${formatDateStr(endDate)}`
                : 'As agreed';
            const ratePerDay = Number(agentTargetBill.rate ?? invoiceData?.rate ?? 0);
            const serviceDays = Number(agentTargetBill.days ?? invoiceData?.days ?? 1);
            const depositCollected = Number(
                agentTargetBill.depositCollected ?? invoiceData?.depositCollected ?? ciDeposit ?? 0,
            );
            const payableAmount = getBillPayableAmount(agentTargetBill);
            const netPayable = payableAmount > 0
                ? payableAmount
                : Number(agentTargetBill.totalAmount ?? agentTargetBill.amount?.toString().replace(/[^0-9.]/g, '') ?? 0);

            if (ratePerDay > 0 && !agentTargetBill.rawAssignment?.isManualInvoice) {
                await persistClientBillingRate(agentTargetBill, ratePerDay);
            }

            const useStructuredInvoice = ratePerDay > 0 && startDate && endDate;
            // 1. Generate PDF
            const invResp = await fetch(`${SUPABASE_URL}/functions/v1/generate-invoice`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
                body: JSON.stringify(
                    useStructuredInvoice
                        ? {
                              lead_id: agentTargetBill.client_id,
                              manual_invoice: true,
                              rate_per_day: ratePerDay,
                              start_date: startDate,
                              end_date: endDate,
                              deposit_collected: depositCollected,
                              service_period: formattedPeriod,
                              invoice_date: todayInputDate(),
                              due_date: invoiceDueDate,
                              invoice_number: agentTargetBill.invoice_no,
                              is_deposit: false,
                              client_name: agentTargetBill.client,
                              client_phone: agentTargetBill.client_phone,
                              client_address: agentTargetBill.client_address,
                              service_name: agentTargetBill.service_category || agentTargetBill.rawAssignment?.service_name || 'Old Age Care',
                              service_hours: agentTargetBill.shift_duration || '24',
                          }
                        : {
                              lead_id: agentTargetBill.client_id,
                              deposit_amount: netPayable,
                              service_period: formattedPeriod,
                              invoice_date: todayInputDate(),
                              due_date: invoiceDueDate,
                              invoice_number: agentTargetBill.invoice_no,
                              is_deposit: false,
                              client_name: agentTargetBill.client,
                              client_phone: agentTargetBill.client_phone,
                              client_address: agentTargetBill.client_address,
                              service_name: agentTargetBill.service_category || agentTargetBill.rawAssignment?.service_name || 'Old Age Care',
                              service_hours: agentTargetBill.shift_duration || '24',
                          },
                ),
            });
            const invRespText = await invResp.text();
            if (!invResp.ok) throw new Error(invRespText);
            const invData = JSON.parse(invRespText);
            if (invData.error) throw new Error(`Invoice generation failed: ${invData.error}`);
            const invoicePdfUrl = invData.public_url;
            if (!invoicePdfUrl) throw new Error('Invoice generated but no PDF URL returned');
            toast.loading('Sending via WhatsApp...', { id: billToastId });
            // 2. Send client_monthly_invoice template
            let phoneDigits = agentTargetBill.client_phone?.replace(/\D/g, '') || '';
            if (phoneDigits.length === 10) phoneDigits = `91${phoneDigits}`;
            if (!phoneDigits) throw new Error(`No phone number on file for ${agentTargetBill.client}. Please update the client's contact details.`);
            const waResp = await fetch(`${SUPABASE_URL}/functions/v1/meta-whatsapp-outbound`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'apikey': SUPABASE_ANON_KEY },
                body: JSON.stringify({
                    phone: phoneDigits,
                    leadId: agentTargetBill.client_id,
                    useTemplate: true,
                    templateName: 'client_monthly_invoice',
                    templateParams: [agentTargetBill.client || 'there', String(netPayable)],
                    sendInvoicePdf: true,
                    invoicePdfUrl: invoicePdfUrl,
                })
            });
            const waData = await waResp.json();
            if (!waData.success) throw new Error(waData.error || 'WhatsApp dispatch failed');
            // 3. Persist to unified service_bills ledger
            const targetServiceId = agentTargetBill.rawAssignment?.id || agentTargetBill.id;
            if (targetServiceId) {
                await recordServiceInvoice({
                    serviceId: targetServiceId,
                    clientId: agentTargetBill.client_id,
                    periodStart: startDate,
                    periodEnd: endDate,
                    totalDays: serviceDays,
                    dailyRateUsed: ratePerDay,
                    amount: netPayable,
                    invoiceNumber: agentTargetBill.invoice_no || `INV-C${Math.floor(Math.random() * 9000) + 1000}`,
                    invoicePdfUrl: invoicePdfUrl,
                    type: 'recurring',
                });
            }

            // Also update legacy assignment table
            await supabase
                .from('worker_assignments')
                .update({
                    final_invoice_generated: true,
                    invoice_pdf_url: invoicePdfUrl,
                    final_invoice_number: agentTargetBill.invoice_no || undefined,
                    ...(ratePerDay > 0 ? { client_billing_rate: ratePerDay } : {}),
                })
                .eq('id', agentTargetBill.id);

            // 4. Move lead to Monthly Billing stage in CRM
            if (agentTargetBill.client_id) {
                await supabase
                    .from('crm_leads')
                    .update({ pipeline_stage: 'Monthly Billing' })
                    .eq('id', agentTargetBill.client_id);
            }
            setMonthlyBills(prev =>
                prev.map(b =>
                    b.id === agentTargetBill.id
                        ? {
                              ...b,
                              status: 'Sent',
                              invoice_pdf_url: invoicePdfUrl,
                              amount: ratePerDay > 0 ? `₹${ratePerDay.toLocaleString('en-IN')}/day` : b.amount,
                              rawAssignment: b.rawAssignment
                                  ? { ...b.rawAssignment, client_billing_rate: ratePerDay || b.rawAssignment.client_billing_rate }
                                  : b.rawAssignment,
                          }
                        : b,
                ),
            );
            toast.success(`Invoice sent to ${agentTargetBill.client} on WhatsApp! ✅`, { id: billToastId, duration: 4000 });
        } catch (err: any) {
            toast.error(err.message || 'Failed to send invoice', { id: billToastId });
        }
    };

    const resetManualInvoice = () => {
        setManualInvoiceForm(manualInvoiceInitialForm());
        setManualDuplicateMatches([]);
        setIsDuplicateChoiceOpen(false);
        setIsManualInvoiceOpen(false);
    };

    const updateManualInvoiceForm = (patch: Partial<ManualInvoiceForm>) => {
        setManualInvoiceForm(prev => ({ ...prev, ...patch }));
    };

    const findManualInvoiceMatches = async (phone: string): Promise<ClientMatch[]> => {
        const last10 = phoneLast10(phone);
        if (last10.length < 10) return [];

        const [clientsResult, leadsResult] = await Promise.all([
            supabase.from('clients').select('id, client_name, phone_number'),
            supabase.from('crm_leads').select('id, name, phone, whatsapp_number, pipeline_stage').is('deleted_at', null),
        ]);

        if (clientsResult.error) throw clientsResult.error;
        if (leadsResult.error) throw leadsResult.error;

        const byId = new Map<string, ClientMatch>();
        (clientsResult.data || []).forEach((client: any) => {
            if (phoneLast10(client.phone_number || '') !== last10) return;
            byId.set(client.id, {
                id: client.id,
                name: client.client_name || 'Existing Client',
                phone: client.phone_number || '',
                source: 'clients',
            });
        });

        (leadsResult.data || []).forEach((lead: any) => {
            const leadPhone = lead.whatsapp_number || lead.phone || '';
            if (phoneLast10(leadPhone) !== last10 || byId.has(lead.id)) return;
            byId.set(lead.id, {
                id: lead.id,
                name: lead.name || 'Existing Lead',
                phone: leadPhone,
                source: 'crm_leads',
                stage: lead.pipeline_stage,
            });
        });

        return Array.from(byId.values());
    };

    const validateManualInvoiceForm = () => {
        const f = manualInvoiceForm;
        const calcDays = inclusiveDays(f.startDate, f.endDate);
        const days = f.customDays !== undefined && f.customDays !== '' ? parseFloat(f.customDays) || 0 : calcDays;
        const phoneDigits = normalizePhoneDigits(f.phone);
        const rate = Number(f.ratePerDay);
        const deposit = Number(f.depositCollected || 0);

        if (!f.clientName.trim()) return 'Client name is required.';
        if (phoneDigits.length < 10) return 'Enter a valid client phone number.';
        if (!f.address.trim()) return 'Full address is required.';
        if (!f.serviceName.trim()) return 'Service name is required.';
        if (!f.startDate || !f.endDate) return 'Start date and end date are required.';
        if (days <= 0) return 'Days of service must be greater than 0.';
        if (!Number.isFinite(rate) || rate <= 0) return 'Client rate/day must be greater than 0.';
        if (!Number.isFinite(deposit) || deposit < 0) return 'Deposit already collected cannot be negative.';
        return '';
    };

    const ensureManualInvoiceClient = async (mode: 'new' | 'link', match?: ClientMatch) => {
        const f = manualInvoiceForm;
        const phoneDigits = normalizePhoneDigits(f.phone);
        const normalizedPhone = phoneDigits.length === 10 ? `91${phoneDigits}` : phoneDigits;
        const calcDays = inclusiveDays(f.startDate, f.endDate);
        const days = f.customDays !== undefined && f.customDays !== '' ? parseFloat(f.customDays) || 0 : calcDays;
        const grossAmount = days * Number(f.ratePerDay);
        const notes = buildManualInvoiceNotes(f, { 'Days': days });

        let leadId = match?.id || '';

        if (mode === 'new' || !leadId) {
            const { data: lead, error } = await supabase
                .from('crm_leads')
                .insert([{
                    name: f.clientName.trim(),
                    phone: f.phone.trim(),
                    whatsapp_number: normalizedPhone || f.phone.trim(),
                    source: mode === 'new' && match ? 'Manual Invoice (Independent)' : 'Manual Invoice',
                    status: 'Invoice Generated',
                    pipeline_stage: 'Monthly Billing',
                    estimated_value_monthly: grossAmount,
                    notes,
                }])
                .select('id')
                .single();
            if (error) throw error;
            leadId = lead.id;
        } else {
            const { data: existingLead, error: lookupError } = await supabase
                .from('crm_leads')
                .select('id')
                .eq('id', leadId)
                .maybeSingle();
            if (lookupError) throw lookupError;

            const leadPayload = {
                name: f.clientName.trim(),
                phone: f.phone.trim(),
                whatsapp_number: normalizedPhone || f.phone.trim(),
                source: 'Manual Invoice',
                status: 'Invoice Generated',
                pipeline_stage: 'Monthly Billing',
                estimated_value_monthly: grossAmount,
                notes,
            };

            if (existingLead) {
                const { error } = await supabase
                    .from('crm_leads')
                    .update(leadPayload)
                    .eq('id', leadId);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('crm_leads')
                    .insert([{ id: leadId, ...leadPayload }]);
                if (error) throw error;
            }
        }

        const { error: clientError } = await supabase
            .from('clients')
            .upsert({
                id: leadId,
                client_name: f.clientName.trim(),
                phone_number: f.phone.trim(),
                created_at: new Date().toISOString(),
            }, { onConflict: 'id' });
        if (clientError) {
            console.warn('Non-fatal error upserting clients:', clientError);
        }

        try {
            await supabase.from('client_consents').insert([{
                lead_id: leadId,
                phone: normalizedPhone || f.phone.trim(),
                relative_name: f.clientName.trim(),
                patient_name: f.clientName.trim(),
                contact_number: f.phone.trim(),
                address: f.address.trim(),
                service_start_date: f.startDate,
                service_category: f.serviceName.trim(),
                offered_time: f.serviceHours === '24' ? '24 Hours (Live-in)' : '10 Hours',
                terms_accepted: true,
            }]);
        } catch (consentErr) {
            console.warn('Non-fatal error inserting client_consents:', consentErr);
        }

        return { leadId, normalizedPhone };
    };

    const generateManualInvoice = async (mode: 'new' | 'link', match?: ClientMatch) => {
        const validationError = validateManualInvoiceForm();
        if (validationError) {
            toast.error(validationError);
            return;
        }

        setIsManualInvoiceGenerating(true);
        const toastId = toast.loading('Generating manual invoice...');
        try {
            const { leadId, normalizedPhone } = await ensureManualInvoiceClient(mode, match);
            const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
            const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
            const isEndAndSettle = manualInvoiceForm.billingMode === 'settle_deposit_and_end';
            const calcDays = inclusiveDays(manualInvoiceForm.startDate, manualInvoiceForm.endDate);
            const days = manualInvoiceForm.customDays !== undefined && manualInvoiceForm.customDays !== '' ? parseFloat(manualInvoiceForm.customDays) || 0 : calcDays;
            const grossAmount = days * Number(manualInvoiceForm.ratePerDay);
            const depositCollected = Number(manualInvoiceForm.depositCollected || 0);
            const depositToApply = isEndAndSettle ? depositCollected : 0;
            const netAmount = Math.max(0, grossAmount - depositToApply);

            const invResp = await fetch(`${SUPABASE_URL}/functions/v1/generate-invoice`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                },
                body: JSON.stringify({
                    lead_id: leadId,
                    manual_invoice: true,
                    client_name: manualInvoiceForm.clientName.trim(),
                    client_phone: manualInvoiceForm.phone.trim(),
                    client_address: manualInvoiceForm.address.trim(),
                    service_name: manualInvoiceForm.serviceName.trim(),
                    service_hours: manualInvoiceForm.serviceHours,
                    start_date: manualInvoiceForm.startDate,
                    end_date: manualInvoiceForm.endDate,
                    days: days,
                    total_days: days,
                    rate_per_day: Number(manualInvoiceForm.ratePerDay),
                    deposit_collected: depositToApply,
                    invoice_date: todayInputDate(),
                    due_date: addDaysInputDate(todayInputDate(), 3),
                }),
            });

            const invText = await invResp.text();
            if (!invResp.ok) throw new Error(invText);
            const invData = JSON.parse(invText);
            if (invData.error) throw new Error(invData.error);
            if (!invData.public_url) throw new Error('Invoice generated but no PDF URL returned.');

            toast.loading('Sending invoice on WhatsApp...', { id: toastId });
            const waResp = await fetch(`${SUPABASE_URL}/functions/v1/meta-whatsapp-outbound`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                    'apikey': SUPABASE_ANON_KEY,
                },
                body: JSON.stringify({
                    phone: normalizedPhone,
                    leadId,
                    useTemplate: true,
                    templateName: 'client_monthly_invoice',
                    templateParams: [manualInvoiceForm.clientName.trim(), String(netAmount)],
                    sendInvoicePdf: true,
                    invoicePdfUrl: invData.public_url,
                }),
            });
            const waData = await waResp.json();
            if (!waData.success) throw new Error(waData.error || 'WhatsApp dispatch failed.');

            const finalNotes = buildManualInvoiceNotes(manualInvoiceForm, {
                'Gross Amount': grossAmount,
                'Deposit Applied': depositToApply,
                'Amount Payable': netAmount,
                'Invoice No': invData.invoice_number || '',
                'Invoice PDF': invData.public_url,
            });

            const { error: invoiceMetaError } = await supabase
                .from('crm_leads')
                .update({
                    notes: finalNotes,
                    estimated_value_monthly: netAmount,
                    status: isEndAndSettle ? 'Service Ended' : 'Invoice Generated',
                    pipeline_stage: 'Monthly Billing',
                })
                .eq('id', leadId);
            if (invoiceMetaError) throw invoiceMetaError;

            // 1. Ensure service record exists in services table for this client
            const { data: existingSvc } = await supabase
                .from('services')
                .select('id')
                .eq('client_id', leadId)
                .maybeSingle();

            const svcStatus = isEndAndSettle ? 'ended' : 'active';
            const depStatus = isEndAndSettle ? 'settled' : (depositCollected > 0 ? 'collected' : 'pending');

            let serviceId = existingSvc?.id;
            if (!serviceId) {
                const { data: newSvc, error: svcErr } = await supabase
                    .from('services')
                    .insert([{
                        client_id: leadId,
                        lead_id: leadId,
                        service_type: manualInvoiceForm.serviceName || 'Old Age Care',
                        hours_per_day: manualInvoiceForm.serviceHours === '24' ? 24 : 10,
                        start_date: manualInvoiceForm.startDate || format(new Date(), 'yyyy-MM-dd'),
                        end_date: manualInvoiceForm.endDate || null,
                        status: svcStatus,
                        deposit_amount: depositCollected,
                        deposit_status: depStatus,
                        complete_month_daily_rate: Number(manualInvoiceForm.ratePerDay) || 500,
                        incomplete_month_daily_rate: Number(manualInvoiceForm.ratePerDay) || 1000,
                        notes: finalNotes,
                    }])
                    .select('id')
                    .single();
                if (!svcErr && newSvc) {
                    serviceId = newSvc.id;
                }
            } else {
                await supabase
                    .from('services')
                    .update({
                        deposit_amount: depositCollected,
                        deposit_status: depStatus,
                        complete_month_daily_rate: Number(manualInvoiceForm.ratePerDay) || 500,
                        status: svcStatus,
                        end_date: manualInvoiceForm.endDate || null,
                    })
                    .eq('id', serviceId);
            }

            // 2. Persist to unified service_bills ledger (type: 'recurring' or 'final')
            if (serviceId) {
                const billNotes = JSON.stringify({
                    invoice_number: invData.invoice_number || '',
                    invoice_pdf_url: invData.public_url,
                    status: 'pending',
                    gross_amount: grossAmount,
                    deposit: depositToApply,
                    net_amount: netAmount,
                    service_type: manualInvoiceForm.serviceName,
                    rate_per_day: Number(manualInvoiceForm.ratePerDay),
                    days: days,
                    source: 'manual_invoice',
                    billing_mode: manualInvoiceForm.billingMode,
                });

                await supabase
                    .from('service_bills')
                    .insert([{
                        service_id: serviceId,
                        period_start: manualInvoiceForm.startDate,
                        period_end: manualInvoiceForm.endDate,
                        total_days: days,
                        daily_rate_used: Number(manualInvoiceForm.ratePerDay),
                        amount: netAmount,
                        deposit_applied: depositToApply,
                        deposit_settled: isEndAndSettle,
                        type: isEndAndSettle ? 'final' : 'recurring',
                        notes: billNotes,
                    }]);
            }

            // 3. Record collected deposit in payments table so it appears in Deposit Collection History
            if (depositCollected > 0) {
                const depositRef = `MANUAL-DEP-${leadId.slice(0, 8).toUpperCase()}`;
                const { data: existingDeposit } = await supabase
                    .from('payments')
                    .select('id')
                    .eq('transaction_ref', depositRef)
                    .limit(1);

                if (!existingDeposit || existingDeposit.length === 0) {
                    await supabase.from('payments').insert([{
                        amount: depositCollected,
                        client_name: manualInvoiceForm.clientName.trim(),
                        recorded_by: 'admin',
                        transaction_ref: depositRef,
                        payment_date: new Date().toISOString(),
                        payment_type: 'deposit',
                    }]);
                }
            }

            setMonthlyBills(prev => [{
                id: `manual-${leadId}`,
                client_id: leadId,
                client: manualInvoiceForm.clientName.trim(),
                client_phone: manualInvoiceForm.phone.trim(),
                amount: `₹${Number(manualInvoiceForm.ratePerDay)}/day`,
                attendanceVerified: true,
                status: 'Sent',
                month: currentMonthYear.split(' ')[0],
                invoice_no: invData.invoice_number || '',
                invoice_pdf_url: invData.public_url,
                rawAssignment: {},
            }, ...prev]);

            toast.success('Manual invoice generated and sent on WhatsApp.', { id: toastId, duration: 4000 });
            window.open(invData.public_url, '_blank');
            resetManualInvoice();
            setServicesRefreshKey(k => k + 1);
            fetchBillingData();
        } catch (err: any) {
            console.error('Manual invoice generation failed:', err);
            toast.error(err.message || 'Failed to generate manual invoice.', { id: toastId });
        } finally {
            setIsManualInvoiceGenerating(false);
        }
    };
    const handlePreviewManualInvoice = () => {
        const validationError = validateManualInvoiceForm();
        if (validationError) {
            toast.error(validationError);
            return;
        }

        const isEndAndSettle = manualInvoiceForm.billingMode === 'settle_deposit_and_end';
        const invoiceNo = `INV-M${Math.floor(Math.random() * 9000) + 1000}`;
        const calcDays = inclusiveDays(manualInvoiceForm.startDate, manualInvoiceForm.endDate);
        const days = manualInvoiceForm.customDays !== undefined && manualInvoiceForm.customDays !== '' 
            ? parseFloat(manualInvoiceForm.customDays) || 0 
            : calcDays;
        const rate = Number(manualInvoiceForm.ratePerDay) || 800;
        const deposit = Number(manualInvoiceForm.depositCollected) || 0;
        const depositToApply = isEndAndSettle ? deposit : 0;
        const gross = days * rate;
        const netBalance = gross - depositToApply;
        const isRefund = netBalance < 0;
        const refundAmount = Math.abs(netBalance);
        const payable = Math.max(0, netBalance);

        const formatDateStr = (ds: string) => {
            if (!ds) return '';
            const [y, m, d] = ds.split('-');
            return `${d}/${m}/${y}`;
        };
        const formattedPeriod = (manualInvoiceForm.startDate && manualInvoiceForm.endDate)
            ? `${formatDateStr(manualInvoiceForm.startDate)} To ${formatDateStr(manualInvoiceForm.endDate)}`
            : 'As agreed';
        const rawShift = (manualInvoiceForm.serviceHours || '24').toString().replace(/\D/g, '') || '24';
        const shiftTitle = `${rawShift}-HOUR SHIFT`;
        const serviceTitle = (manualInvoiceForm.serviceName || 'OLD AGE CARE').trim().toUpperCase();
        const itemDescription = `${shiftTitle} (${serviceTitle}) — ${days} DAY${days !== 1 ? 'S' : ''} (${formattedPeriod})`;

        const targetBill = {
            id: `manual-preview-${Date.now()}`,
            client: manualInvoiceForm.clientName.trim(),
            client_phone: manualInvoiceForm.phone.trim(),
            client_address: manualInvoiceForm.address.trim(),
            service_category: manualInvoiceForm.serviceName.trim(),
            shift_duration: manualInvoiceForm.serviceHours,
            invoice_no: invoiceNo,
            amount: isRefund ? `₹${refundAmount} (Refund)` : payable.toString(),
            totalAmount: isRefund ? 0 : payable,
            depositCollected: depositToApply,
            days: days,
            rate: rate,
            startDate: manualInvoiceForm.startDate,
            endDate: manualInvoiceForm.endDate,
            isManual: true,
            isRefund: isRefund,
            refundAmount: refundAmount,
        };

        setAgentTargetBill(targetBill);
        setInvoiceData({
            clientName: manualInvoiceForm.clientName.trim(),
            phone: manualInvoiceForm.phone.trim(),
            address: manualInvoiceForm.address.trim(),
            service: itemDescription,
            amount: isRefund ? 0 : payable,
            totalAmount: isRefund ? 0 : payable,
            depositCollected: depositToApply,
            date: new Date().toISOString(),
            invoiceNumber: invoiceNo,
            days: days,
            rate: rate,
            startDate: manualInvoiceForm.startDate,
            endDate: manualInvoiceForm.endDate,
            service_name: manualInvoiceForm.serviceName.trim(),
            service_hours: manualInvoiceForm.serviceHours,
            isRefund: isRefund,
            refundAmount: refundAmount,
        });
        setAgentDraftText(generateWhatsappDraft(targetBill, agentDraftLang));
        setInvoiceDepositAmount(payable.toString());
        setIsInvoiceOpen(true);
    };

    const handleManualInvoiceGenerate = async () => {
        const validationError = validateManualInvoiceForm();
        if (validationError) {
            toast.error(validationError);
            return;
        }

        try {
            const matches = await findManualInvoiceMatches(manualInvoiceForm.phone);
            if (matches.length > 0) {
                await generateManualInvoice('link', matches[0]);
            } else {
                await generateManualInvoice('new');
            }
        } catch (err: any) {
            toast.error(err.message || 'Failed to generate manual invoice.');
        }
    };

    const handleDirectPreviewBill = (service: any, bill: any) => {
        let noteData: any = {};
        if (bill?.notes) {
            try { noteData = JSON.parse(bill.notes); } catch {}
        }

        const clientName = service.clients?.client_name || service.client_name || 'Client';
        const clientPhone = service.clients?.phone_number || service.client_phone || '';
        const days = Number(bill.total_days) || Number(noteData.days) || 1;
        const rate = Number(bill.daily_rate_used) || Number(noteData.rate_per_day) || Number(service.complete_month_daily_rate) || 800;
        const gross = Number(noteData.gross_amount) || (days * rate);
        const deposit = Number(bill.deposit_applied) !== undefined && !isNaN(Number(bill.deposit_applied))
            ? Number(bill.deposit_applied)
            : (Number(noteData.deposit) || 0);
        const net = Number(bill.amount) !== undefined && !isNaN(Number(bill.amount))
            ? Number(bill.amount)
            : (Number(noteData.net_amount) || Math.max(0, gross - deposit));
        const invNo = bill.invoice_number || noteData.invoice_number || `INV-${Math.floor(1000 + Math.random() * 9000)}`;
        const isRefund = net <= 0 && deposit > gross;
        const refundAmount = Math.max(0, deposit - gross);

        const sDate = bill.period_start ? bill.period_start.split('T')[0] : (service.start_date?.split('T')[0] || '');
        const eDate = bill.period_end ? bill.period_end.split('T')[0] : (service.end_date?.split('T')[0] || '');
        const formatDateStr = (ds: string) => {
            if (!ds) return '';
            const [y, m, d] = ds.split('-');
            return `${d}/${m}/${y}`;
        };
        const formattedPeriod = (sDate && eDate) ? `${formatDateStr(sDate)} To ${formatDateStr(eDate)}` : 'As agreed';
        const rawShift = (service.hours_per_day || 24).toString();
        const serviceCategory = (service.service_type || 'Old Age Care').toUpperCase();
        const itemDescription = `${rawShift}-HOUR SHIFT (${serviceCategory}) — ${days} DAY${days !== 1 ? 'S' : ''} (${formattedPeriod})`;

        const targetBill = {
            ...bill,
            client: clientName,
            client_phone: clientPhone,
            client_address: noteData.client_address || '',
            invoice_no: invNo,
            amount: isRefund ? `₹${refundAmount} (Refund)` : net.toString(),
            totalAmount: isRefund ? 0 : net,
            depositCollected: deposit,
            days: days,
            rate: rate,
            startDate: sDate,
            endDate: eDate,
            isRefund: isRefund,
            refundAmount: refundAmount,
            invoice_pdf_url: noteData.invoice_pdf_url || '',
        };

        setAgentTargetBill(targetBill);
        setInvoiceData({
            clientName: clientName,
            phone: clientPhone,
            address: noteData.client_address || '',
            service: itemDescription,
            amount: isRefund ? 0 : net,
            totalAmount: isRefund ? 0 : net,
            depositCollected: deposit,
            date: bill.created_at || new Date().toISOString(),
            invoiceNumber: invNo,
            days: days,
            rate: rate,
            startDate: sDate,
            endDate: eDate,
            service_name: service.service_type || 'Old Age Care',
            service_hours: rawShift,
            isRefund: isRefund,
            refundAmount: refundAmount,
        });
        setAgentDraftText(generateWhatsappDraft(targetBill, agentDraftLang));
        setInvoiceDepositAmount(net.toString());
        setIsInvoiceOpen(true);
    };

    const heldDeposits = deposits.filter(d => d.status === 'Paid' && d.is_active_cycle);
    const totalHeldAmount = heldDeposits.reduce((sum, d) => sum + (d.numeric_amount || parseFloat(String(d.amount).replace(/[^\d.-]/g, '') || '0') || 0), 0);

    const pendingDeposits = deposits.filter(d => d.status === 'Pending Invoice' || d.status === 'Invoice Sent');
    const totalPendingAmount = pendingDeposits.reduce((sum, d) => sum + (d.numeric_amount || parseFloat(String(d.amount).replace(/[^\d.-]/g, '') || '0') || 0), 0);

    const settledDeposits = deposits.filter(d => d.status === 'Settled' || !d.is_active_cycle);
    const totalSettledAmount = settledDeposits.reduce((sum, d) => sum + (d.numeric_amount || parseFloat(String(d.amount).replace(/[^\d.-]/g, '') || '0') || 0), 0);

    const filteredDeposits = deposits.filter(dep => {
        const q = depositSearch.trim().toLowerCase();
        if (q) {
            const clientMatch = dep.client?.toLowerCase().includes(q);
            const serviceMatch = dep.service_name?.toLowerCase().includes(q);
            const amountMatch = dep.amount?.toLowerCase().includes(q);
            if (!clientMatch && !serviceMatch && !amountMatch) return false;
        }
        if (depositFilter === 'held') {
            return dep.status === 'Paid' && dep.is_active_cycle;
        }
        if (depositFilter === 'pending') {
            return dep.status === 'Pending Invoice' || dep.status === 'Invoice Sent';
        }
        if (depositFilter === 'settled') {
            return dep.status === 'Settled' || !dep.is_active_cycle;
        }
        return true;
    });

    return (
        <div className="p-4 sm:p-6 lg:p-8 flex flex-col space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 font-['Plus_Jakarta_Sans']">Finance & Billing</h1>
                    <p className="text-slate-500 mt-1">Manage deposits, monthly billing cycles, and payment collections.</p>
                </div>

                <div className="flex items-center p-1 bg-slate-100 rounded-lg shrink-0">
                    <button
                        onClick={() => setActiveTab('deposits')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'deposits' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                    >
                        Deposit Entries
                    </button>
                    <button
                        onClick={() => setActiveTab('monthly')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'monthly' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                    >
                        Monthly Billing
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'history' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                    >
                        Collection History
                    </button>
                </div>
            </div>

            {activeTab === 'deposits' ? (
                    /* Deposit Entry View */
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col">
                        {/* Header + Stats */}
                        <div className="p-5 border-b border-slate-200 bg-slate-50 flex flex-col gap-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div>
                                    <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                        <ShieldCheck className="w-5 h-5 text-indigo-600" /> Security Deposit Management
                                    </h2>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        Track client security deposits in reserve, dispatch deposit bills, and view settlement history.
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full font-semibold border border-emerald-200">
                                        Auto-Receipt Logs Active
                                    </span>
                                </div>
                            </div>

                            {/* Summary Metrics Bar */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs flex items-center justify-between">
                                    <div>
                                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">In Reserve (Held)</div>
                                        <div className="text-lg font-black text-indigo-700">₹{totalHeldAmount.toLocaleString('en-IN')}</div>
                                    </div>
                                    <div className="text-xs font-semibold text-slate-500 bg-indigo-50 px-2 py-1 rounded-md border border-indigo-100">
                                        {heldDeposits.length} clients
                                    </div>
                                </div>

                                <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs flex items-center justify-between">
                                    <div>
                                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Pending Collection</div>
                                        <div className="text-lg font-black text-amber-600">₹{totalPendingAmount.toLocaleString('en-IN')}</div>
                                    </div>
                                    <div className="text-xs font-semibold text-slate-500 bg-amber-50 px-2 py-1 rounded-md border border-amber-100">
                                        {pendingDeposits.length} pending
                                    </div>
                                </div>

                                <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs flex items-center justify-between">
                                    <div>
                                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Settled / Historical</div>
                                        <div className="text-lg font-black text-teal-700">₹{totalSettledAmount.toLocaleString('en-IN')}</div>
                                    </div>
                                    <div className="text-xs font-semibold text-teal-700 bg-teal-50 px-2 py-1 rounded-md border border-teal-100">
                                        {settledDeposits.length} settled
                                    </div>
                                </div>
                            </div>

                            {/* Search & Filter Toolbar */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-200/70">
                                {/* Filter Pills */}
                                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                                    <button
                                        onClick={() => setDepositFilter('all')}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                                            depositFilter === 'all'
                                                ? 'bg-slate-900 text-white shadow-xs'
                                                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                                        }`}
                                    >
                                        All Deposits ({deposits.length})
                                    </button>
                                    <button
                                        onClick={() => setDepositFilter('held')}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                                            depositFilter === 'held'
                                                ? 'bg-indigo-600 text-white shadow-xs'
                                                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                                        }`}
                                    >
                                        In Reserve ({heldDeposits.length})
                                    </button>
                                    <button
                                        onClick={() => setDepositFilter('pending')}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                                            depositFilter === 'pending'
                                                ? 'bg-amber-600 text-white shadow-xs'
                                                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                                        }`}
                                    >
                                        Pending Action ({pendingDeposits.length})
                                    </button>
                                    <button
                                        onClick={() => setDepositFilter('settled')}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                                            depositFilter === 'settled'
                                                ? 'bg-teal-600 text-white shadow-xs'
                                                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                                        }`}
                                    >
                                        Settled / History ({settledDeposits.length})
                                    </button>
                                </div>

                                {/* Search Bar */}
                                <div className="relative min-w-[220px]">
                                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                    <input
                                        type="text"
                                        placeholder="Search client or service..."
                                        value={depositSearch}
                                        onChange={(e) => setDepositSearch(e.target.value)}
                                        className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                                    />
                                    {depositSearch && (
                                        <button
                                            onClick={() => setDepositSearch('')}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                                        >
                                            ✕
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Cards Container */}
                        <div className="flex-1 overflow-auto p-4 space-y-3">
                            {filteredDeposits.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-center">
                                    <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mb-3">
                                        <ShieldCheck className="w-7 h-7 text-slate-400" />
                                    </div>
                                    <h3 className="text-base font-bold text-slate-900 mb-1">No Security Deposits Found</h3>
                                    <p className="text-xs text-slate-500 max-w-sm">
                                        {depositSearch ? `No deposit records matching "${depositSearch}".` : 'No security deposits found in this category.'}
                                    </p>
                                    {depositSearch && (
                                        <button
                                            onClick={() => setDepositSearch('')}
                                            className="mt-3 px-3 py-1.5 text-xs text-primary font-semibold hover:underline"
                                        >
                                            Clear search filter
                                        </button>
                                    )}
                                </div>
                            ) : (
                                filteredDeposits.map(dep => (
                                    <div key={`${dep.service_id || dep.id}-${dep.date}`} className="p-4 rounded-xl border border-slate-200 flex flex-col gap-3 hover:shadow-xs transition-shadow bg-white">
                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
                                                    dep.is_active_cycle ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-500'
                                                }`}>
                                                    <RupeeIcon className="w-6 h-6 text-xl" />
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                                                        {dep.client}
                                                        {dep.service_name && (
                                                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                                                                {dep.service_name}
                                                            </span>
                                                        )}
                                                        {dep.is_active_cycle ? (
                                                            <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 uppercase">
                                                                Current Service
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 uppercase">
                                                                Ended Service
                                                            </span>
                                                        )}
                                                    </h3>
                                                    <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
                                                        <span className="font-bold text-slate-900 text-base">{dep.amount}</span>
                                                        <span>•</span>
                                                        <span>{dep.date}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3 flex-wrap">
                                                <span className={`px-3 py-1 text-xs font-semibold rounded-full flex items-center gap-1 ${
                                                    dep.status === 'Paid' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                                                    dep.status === 'Invoice Sent' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                                                    dep.status === 'Settled' ? 'bg-teal-100 text-teal-800 border border-teal-200' :
                                                    'bg-amber-100 text-amber-800 border border-amber-200'
                                                }`}>
                                                    {dep.status === 'Paid' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                                                    {dep.status === 'Paid' ? 'In Reserve (Collected)' :
                                                     dep.status === 'Invoice Sent' ? 'Invoice Dispatched' :
                                                     dep.status === 'Settled' ? 'Settled on Final Bill' : 'Deposit Unbilled'}
                                                </span>

                                                {dep.status === 'Pending Invoice' && (
                                                    <button onClick={() => openAgentModal({ ...dep, isDepositMode: true })} className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-2 cursor-pointer">
                                                        <FileText className="w-4 h-4" /> Prepare Invoice
                                                    </button>
                                                )}

                                                {(dep.status === 'Invoice Sent' || dep.status === 'Paid' || dep.status === 'Settled') && (
                                                    <>
                                                        {(dep.invoice_pdf_url || dep.status === 'Settled') && (
                                                            <button 
                                                                onClick={() => handleOpenDepositDoc(dep.invoice_pdf_url, dep.client_id, dep.id)} 
                                                                disabled={loadingDepositDocId === dep.id}
                                                                className="px-3 py-2 border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                                            >
                                                                {loadingDepositDocId === dep.id ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <FileText className="w-4 h-4 text-primary" />} View PDF
                                                            </button>
                                                        )}
                                                        {dep.status === 'Invoice Sent' && (
                                                            <>
                                                                <button onClick={() => openAgentModal({ ...dep, isDepositMode: true })} className="px-3 py-2 border border-blue-200 text-blue-700 bg-blue-50 text-sm font-medium rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-1.5 cursor-pointer">
                                                                    <Send className="w-4 h-4" /> Resend Invoice
                                                                </button>
                                                                <button onClick={() => { setActiveDepositId(dep.id); setDepositDate(todayInputDate()); setIsDepositModalOpen(true); }} className="px-3 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 text-sm font-medium rounded-lg hover:bg-emerald-100 transition-colors flex items-center gap-1.5 cursor-pointer">
                                                                    <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Record Collection
                                                                </button>
                                                            </>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {dep.previous_deposits && dep.previous_deposits.length > 0 && (
                                            <div className="pt-2.5 border-t border-slate-100 flex flex-col gap-2">
                                                <div className="text-[11px] font-bold tracking-wider uppercase text-slate-500 flex items-center gap-1.5">
                                                    <History className="w-3.5 h-3.5 text-slate-400" />
                                                    <span>Previous Service Deposit History</span>
                                                </div>
                                                <div className="space-y-1.5">
                                                    {dep.previous_deposits.map((prev: any, idx: number) => (
                                                        <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50 border border-slate-200/80 rounded-lg px-3 py-2 text-xs">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <span className="font-semibold text-slate-800">{prev.service_name}</span>
                                                                <span className="text-slate-400">•</span>
                                                                <span className="font-bold text-slate-700">{prev.amount}</span>
                                                                <span className="text-slate-400">•</span>
                                                                <span className="text-slate-500">{prev.date}</span>
                                                                <span className="px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 font-semibold text-[10px] border border-teal-200">
                                                                    {prev.status}
                                                                </span>
                                                            </div>
                                                            <button
                                                                onClick={() => handleOpenDepositDoc(prev.invoice_pdf_url, dep.client_id, `${dep.id}-${idx}`)}
                                                                disabled={loadingDepositDocId === `${dep.id}-${idx}`}
                                                                className="text-primary hover:text-primary/80 font-medium flex items-center gap-1 text-xs cursor-pointer disabled:opacity-50"
                                                            >
                                                                {loadingDepositDocId === `${dep.id}-${idx}` ? <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" /> : <FileText className="w-3.5 h-3.5 text-primary" />} View Final Bill / Receipt
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                ) : activeTab === 'monthly' ? (
                /* Unified Services & Monthly Billing Lifecycle View */
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col min-h-0">
                    <ServicesPanel
                        key={servicesRefreshKey}
                        isEmbedded
                        onOpenManualInvoice={() => {
                            setManualInvoiceForm(manualInvoiceInitialForm());
                            setManualDuplicateMatches([]);
                            setIsDuplicateChoiceOpen(false);
                            setIsManualInvoiceOpen(true);
                        }}
                        onPreviewInvoice={(service, bill) => {
                            handleDirectPreviewBill(service, bill);
                        }}
                        onPrepareInvoice={async (service, bill) => {
                            const activeWorker = (service.service_worker_assignments || []).find(a => !a.end_date) || (service.service_worker_assignments || [])[0];
                            
                            let clientAddress = '';
                            let clientServiceName = service.service_type || 'Old Age Care';
                            let clientShift = '24-Hour Shift';

                            try {
                                const [leadRes, consentRes] = await Promise.all([
                                    supabase.from('crm_leads').select('*').eq('id', service.client_id).maybeSingle(),
                                    supabase.from('client_consents').select('*').eq('lead_id', service.client_id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
                                ]);
                                if (consentRes.data?.address) {
                                    clientAddress = consentRes.data.address;
                                } else if (leadRes.data?.notes) {
                                    const locMatch = leadRes.data.notes.match(/^Location:\s*(.+)$/im);
                                    if (locMatch) clientAddress = locMatch[1].trim();
                                }
                                if (consentRes.data?.service_category) {
                                    clientServiceName = consentRes.data.service_category;
                                } else if (leadRes.data?.service_interest) {
                                    clientServiceName = leadRes.data.service_interest;
                                } else if (leadRes.data?.notes) {
                                    const sMatch = leadRes.data.notes.match(/^Service:\s*(.+)$/im);
                                    if (sMatch) clientServiceName = sMatch[1].trim();
                                }
                                if (consentRes.data?.offered_time) {
                                    clientShift = consentRes.data.offered_time;
                                } else if (leadRes.data?.notes) {
                                    const shMatch = leadRes.data.notes.match(/^Shift:\s*(.+)$/im);
                                    if (shMatch) clientShift = shMatch[1].trim();
                                }
                            } catch {
                                // fallback
                            }

                            let noteData: any = {};
                            if (bill?.notes) {
                                try { noteData = JSON.parse(bill.notes); } catch {}
                            }

                            const isEndedEarly = service.status === 'ended' || bill?.type === 'final';
                            const sStartDt = service.start_date ? new Date(`${service.start_date.split('T')[0]}T00:00:00`) : null;
                            const sEndDt = (bill?.period_end || service.end_date) ? new Date(`${(bill?.period_end || service.end_date).split('T')[0]}T00:00:00`) : null;
                            const lifetimeDays = (sStartDt && sEndDt && !isNaN(sStartDt.getTime()) && !isNaN(sEndDt.getTime()) && sEndDt >= sStartDt)
                                ? Math.round((sEndDt.getTime() - sStartDt.getTime()) / (1000 * 60 * 60 * 24)) + 1
                                : (bill?.total_days || 0);

                            const isLessThan30 = isEndedEarly && lifetimeDays > 0 && lifetimeDays < 30;
                            const applicableDefaultRate = isLessThan30
                                ? (service.incomplete_month_daily_rate || (service.complete_month_daily_rate ? service.complete_month_daily_rate * 2 : 1000))
                                : (service.complete_month_daily_rate || 500);

                            const billRate = bill?.daily_rate_used || applicableDefaultRate;
                            const billObj = {
                                id: service.id,
                                client_id: service.client_id,
                                client: service.clients?.client_name || 'Client',
                                client_phone: service.clients?.phone_number || '+91 9016116564',
                                client_address: clientAddress,
                                service_category: clientServiceName,
                                shift_duration: clientShift,
                                amount: `₹${billRate}/day`,
                                status: noteData.status === 'paid' ? 'Paid' : 'Draft',
                                month: bill?.period_start ? format(new Date(bill.period_start), 'MMMM yyyy') : new Date().toLocaleString('default', { month: 'long' }),
                                invoice_no: noteData.invoice_number || bill?.invoice_number || '',
                                invoice_pdf_url: noteData.invoice_pdf_url || '',
                                rawAssignment: {
                                    id: service.id,
                                    client_id: service.client_id,
                                    employee_id: activeWorker?.employee_id,
                                    service_name: clientServiceName,
                                    client_billing_rate: billRate,
                                    complete_month_daily_rate: service.complete_month_daily_rate || 500,
                                    incomplete_month_daily_rate: service.incomplete_month_daily_rate || 1000,
                                    deposit_amount: service.deposit_amount || 0,
                                    start_date: bill?.period_start ? bill.period_start.split('T')[0] : (service.start_date || ''),
                                    end_date: bill?.period_end ? bill.period_end.split('T')[0] : (service.end_date || ''),
                                },
                                rawService: service
                            };

                            const depositAmt = service.deposit_amount || 0;
                            setClientInvoiceBill(billObj);
                            setCiRate(billRate);
                            setCiDeposit(depositAmt);

                            let hasDepositDeducted = false;
                            if (bill?.deposit_applied && Number(bill.deposit_applied) > 0) {
                                hasDepositDeducted = true;
                            } else if (noteData.deposit && Number(noteData.deposit) > 0) {
                                hasDepositDeducted = true;
                            }
                            setCiSettleDeposit(hasDepositDeducted);
                            setCiEndService(bill?.deposit_settled === true || service.status === 'ended');

                            // 1. Determine start date:
                            let startStr = '';
                            if (bill?.period_start) {
                                const bStart = bill.period_start.split('T')[0];
                                const sStart = service.start_date ? service.start_date.split('T')[0] : '';
                                startStr = (sStart && sStart > bStart) ? sStart : bStart;
                            } else {
                                startStr = service.start_date ? service.start_date.split('T')[0] : format(new Date(), 'yyyy-MM-dd');
                            }

                            // 2. Determine end date:
                            let endStr = '';
                            if (bill?.period_end) {
                                endStr = bill.period_end.split('T')[0];
                            } else if (service.end_date) {
                                endStr = service.end_date.split('T')[0];
                            } else {
                                endStr = format(new Date(), 'yyyy-MM-dd');
                            }

                            setCiStartDate(startStr);
                            setCiEndDate(endStr);

                            let calculatedDays = (bill?.total_days !== undefined && !isNaN(bill.total_days)) ? Number(bill.total_days) : 0;
                            if (!calculatedDays && startStr && endStr) {
                                const d1 = new Date(startStr);
                                const d2 = new Date(endStr);
                                if (!isNaN(d1.getTime()) && !isNaN(d2.getTime()) && d2 >= d1) {
                                    calculatedDays = Math.max(1, Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)) + 1);
                                }
                            }
                            if (!calculatedDays) calculatedDays = 1;
                            setCiDays(calculatedDays);
                            setIsClientInvoiceOpen(true);

                            // Fetch full attendance breakdown across all assigned workers
                            fetchClientInvoiceAttendance(startStr, endStr, { ...billObj, total_days: calculatedDays });
                        }}
                        onRecordCollection={(service: any, bill?: any) => {
                            const clientName = service.clients?.client_name || 'Client';
                            const billAmount = bill?.amount || (service.complete_month_daily_rate || 500) * (bill?.total_days || 1);
                            
                            let invNo = 'Invoice';
                            if (bill?.invoice_number) {
                                invNo = bill.invoice_number;
                            } else {
                                try {
                                    const parsed = bill?.notes ? JSON.parse(bill.notes) : {};
                                    if (parsed.invoice_number) invNo = parsed.invoice_number;
                                } catch {}
                            }

                            const periodStr = bill?.period_start && bill?.period_end
                                ? `${new Date(bill.period_start).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} – ${new Date(bill.period_end).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`
                                : 'Billing Cycle';

                            const defaultRef = `UPI-${crypto.randomUUID().replace(/-/g, '').substring(0, 8).toUpperCase()}`;

                            setCollectionTarget({
                                service,
                                bill,
                                clientName,
                                invoiceNo: invNo,
                                period: periodStr,
                                amount: billAmount,
                            });
                            setCollectionAmount(billAmount);
                            setCollectionMethod('UPI');
                            setCollectionRef(defaultRef);
                            setCollectionDate(todayInputDate());
                            setIsRecordCollectionOpen(true);
                        }}
                    />
                </div>
            ) : (
                /* Collection History View */
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col">
                    <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2">
                            <History className="w-5 h-5 text-primary" />
                            <h2 className="font-semibold text-slate-900">Recorded Collection Log</h2>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            {/* Search Filter by Reference ID, Client, Amount */}
                            <div className="relative min-w-[220px]">
                                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                <input
                                    type="text"
                                    placeholder="Search Ref ID, Client, Amount..."
                                    value={historySearch}
                                    onChange={(e) => setHistorySearch(e.target.value)}
                                    className="pl-8 pr-7 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary w-full text-slate-800 placeholder:text-slate-400 font-medium transition-all"
                                />
                                {historySearch && (
                                    <button
                                        onClick={() => setHistorySearch('')}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded transition-colors"
                                        title="Clear search"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>

                            {/* Month navigator with left/right arrows */}
                            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg overflow-hidden">
                                <button
                                    onClick={() => {
                                        const [y, m] = selectedMonth.split('-').map(Number);
                                        const prev = new Date(y, m - 2);
                                        setSelectedMonth(`${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`);
                                    }}
                                    className="px-2.5 py-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors text-sm font-bold"
                                >
                                    ‹
                                </button>
                                <span className="px-3 py-1.5 text-xs font-semibold text-slate-700 min-w-[110px] text-center border-x border-slate-200">
                                    {new Date(Number(selectedMonth.split('-')[0]), Number(selectedMonth.split('-')[1]) - 1)
                                        .toLocaleString('default', { month: 'long', year: 'numeric' })}
                                </span>
                                <button
                                    onClick={() => {
                                        const [y, m] = selectedMonth.split('-').map(Number);
                                        const next = new Date(y, m);
                                        const now = new Date();
                                        const nowKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                                        const nextKey = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
                                        if (nextKey <= nowKey) setSelectedMonth(nextKey);
                                    }}
                                    className="px-2.5 py-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors text-sm font-bold disabled:opacity-30"
                                    disabled={selectedMonth === (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`; })()}
                                >
                                    ›
                                </button>
                            </div>
                            {/* Sub-tab switcher */}
                            <div className="flex items-center p-1 bg-white border border-slate-200 rounded-lg shrink-0">
                                <button
                                    onClick={() => setHistorySubTab('deposit')}
                                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${historySubTab === 'deposit' ? 'bg-blue-500 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                                >
                                    Deposit Invoice
                                </button>
                                <button
                                    onClick={() => setHistorySubTab('service')}
                                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${historySubTab === 'service' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                                >
                                    Service Invoice
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center py-20">
                                <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
                                <span className="text-slate-500 font-medium">Loading collection records...</span>
                            </div>
                        ) : payments.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-center">
                                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                                    <RupeeIcon className="w-8 h-8 text-slate-400 text-3xl" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-900 mb-1">No Payments Recorded</h3>
                                <p className="text-slate-500 max-w-xs">Use the "Record Payment" buttons in the other tabs to log collections here.</p>
                            </div>
                        ) : (() => {
                            const depositPayments = payments.filter(p => p.payment_type === 'deposit' || (!p.payment_type && (p.transaction_ref?.startsWith('ONLINE') || p.transaction_ref?.startsWith('UPI') || p.transaction_ref?.startsWith('CHEQUE') || p.transaction_ref?.startsWith('CASH') || p.transaction_ref?.startsWith('MANUAL-DEP'))));
                            const servicePayments = payments.filter(p => p.payment_type === 'service' || (!p.payment_type && p.transaction_ref?.startsWith('TXN')));

                            const allSubTabRows = historySubTab === 'deposit' ? depositPayments : servicePayments;

                            const isSearching = historySearch.trim().length > 0;
                            const searchLower = historySearch.trim().toLowerCase();

                            // If searching, search across all records in this sub-tab; otherwise filter by month
                            const rows = isSearching
                                ? allSubTabRows.filter(p =>
                                    (p.transaction_ref || '').toLowerCase().includes(searchLower) ||
                                    (p.client_name || '').toLowerCase().includes(searchLower) ||
                                    String(p.amount || '').includes(searchLower)
                                )
                                : allSubTabRows.filter(p => {
                                    const d = new Date(p.payment_date);
                                    const rowMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                                    return rowMonth === selectedMonth;
                                });

                            const color = historySubTab === 'deposit' ? 'blue' : 'emerald';

                            // Build list of available months from all payments for the nav
                            const availableMonths = [...new Set(allSubTabRows.map(p => {
                                const d = new Date(p.payment_date);
                                return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                            }))].sort((a, b) => b.localeCompare(a));

                            const monthLabel = (m: string) => {
                                const [y, mo] = m.split('-');
                                return new Date(Number(y), Number(mo) - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
                            };

                            // Total for current view
                            const viewTotal = rows.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

                            return (
                                <div>
                                    {/* Record count bar with summary */}
                                    <div className={`px-6 py-3 flex items-center gap-3 border-b flex-wrap ${color === 'blue' ? 'bg-blue-50 border-blue-100' : 'bg-emerald-50 border-emerald-100'}`}>
                                        <span className={`w-2 h-2 rounded-full inline-block shrink-0 ${color === 'blue' ? 'bg-blue-400' : 'bg-emerald-400'}`}></span>
                                        <span className={`text-xs font-bold uppercase tracking-widest ${color === 'blue' ? 'text-blue-700' : 'text-emerald-700'}`}>
                                            {historySubTab === 'deposit' ? 'Deposit Invoice History' : 'Service Invoice History'}
                                        </span>
                                        <span className="text-xs text-slate-500 font-medium">
                                            {isSearching ? `— Search results for "${historySearch.trim()}" (all months)` : `— ${monthLabel(selectedMonth)}`}
                                        </span>
                                        <span className={`ml-auto flex items-center gap-3 text-xs font-semibold ${color === 'blue' ? 'text-blue-600' : 'text-emerald-600'}`}>
                                            <span>{rows.length} record{rows.length !== 1 ? 's' : ''}</span>
                                            {rows.length > 0 && <span className="font-bold">₹{viewTotal.toLocaleString('en-IN')}</span>}
                                        </span>
                                    </div>

                                    {/* Quick month navigation pills */}
                                    {!isSearching && availableMonths.length > 1 && (
                                        <div className="px-6 py-2 flex items-center gap-2 flex-wrap border-b border-slate-100 bg-slate-50/50">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-1">Jump to:</span>
                                            {availableMonths.map(m => (
                                                <button
                                                    key={m}
                                                    onClick={() => setSelectedMonth(m)}
                                                    className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${selectedMonth === m
                                                        ? (color === 'blue' ? 'bg-blue-500 text-white' : 'bg-emerald-500 text-white')
                                                        : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
                                                    }`}
                                                >
                                                    {monthLabel(m)}
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {rows.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-20 text-center">
                                            <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-4 ${color === 'blue' ? 'bg-blue-50' : 'bg-emerald-50'}`}>
                                                <RupeeIcon className={`text-2xl ${color === 'blue' ? 'text-blue-300' : 'text-emerald-300'}`} />
                                            </div>
                                            <h3 className="text-base font-bold text-slate-900 mb-1">
                                                {isSearching ? `No records matching "${historySearch.trim()}"` : `No Records for ${monthLabel(selectedMonth)}`}
                                            </h3>
                                            <p className="text-slate-500 text-sm max-w-xs">
                                                {isSearching
                                                    ? 'Try checking for typos or searching by client name or amount.'
                                                    : availableMonths.length > 0
                                                        ? 'Try selecting a different month above.'
                                                        : historySubTab === 'deposit'
                                                            ? 'Record a deposit collection from the Deposit Entries tab.'
                                                            : 'Record a service payment from the Monthly Billing tab.'}
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="border-b border-slate-200 text-xs font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">
                                                    <th className="py-3 px-6">Date</th>
                                                    <th className="py-3 px-6">Client</th>
                                                    <th className="py-3 px-6">Reference ID</th>
                                                    <th className="py-3 px-6">Amount</th>
                                                    <th className="py-3 px-6">Status</th>
                                                    <th className="py-3 px-6 text-right">Invoice</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {rows.map(payment => (
                                                    <tr key={payment.id} className="hover:bg-slate-50/50 transition-colors">
                                                        <td className="py-4 px-6 text-sm text-slate-600 whitespace-nowrap">
                                                            {new Date(payment.payment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                        </td>
                                                        <td className="py-4 px-6">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                                                                    {(payment.client_name || '?').charAt(0)}
                                                                </div>
                                                                <span className="text-sm font-semibold text-slate-900">{payment.client_name || <span className="text-slate-400 italic">Unknown Client</span>}</span>
                                                            </div>
                                                        </td>
                                                        <td className="py-4 px-6">
                                                            <div className="inline-flex items-center gap-1.5 group">
                                                                <span className="text-sm font-bold text-slate-900 font-mono tracking-tight">{payment.transaction_ref}</span>
                                                                <button
                                                                    onClick={(e) => handleCopyRef(payment.transaction_ref, e)}
                                                                    title="Copy Reference ID"
                                                                    className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors opacity-70 group-hover:opacity-100"
                                                                >
                                                                    <Copy className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                        </td>
                                                        <td className="py-4 px-6">
                                                            <span className="text-sm font-bold text-emerald-600">₹{parseFloat(payment.amount).toLocaleString('en-IN')}</span>
                                                        </td>
                                                        <td className="py-4 px-6">
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 whitespace-nowrap">
                                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                                                Collected
                                                            </span>
                                                        </td>
                                                        <td className="py-4 px-6 text-right whitespace-nowrap">
                                                            <button
                                                                onClick={() => handleViewPaymentInvoice(payment)}
                                                                disabled={loadingInvoicePaymentId === payment.id}
                                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-primary hover:border-primary/40 shadow-sm transition-all disabled:opacity-50 active:scale-95"
                                                                title="Open Invoice PDF in new tab"
                                                            >
                                                                {loadingInvoicePaymentId === payment.id ? (
                                                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                                                                ) : (
                                                                    <FileText className="w-3.5 h-3.5 text-primary" />
                                                                )}
                                                                <span>View PDF</span>
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}
                    </div>
                </div>
            )}

            {/* Service Bill Collection Modal */}
            {isRecordCollectionOpen && collectionTarget && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 z-50 transition-all">
                    <div className="bg-white/95 backdrop-blur-xl border border-white/40 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-5 border-b border-slate-100 bg-white/50 flex justify-between items-center">
                            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                <RupeeIcon className="w-5 h-5 text-emerald-500 text-lg" /> Record Collection
                            </h2>
                            <button
                                onClick={() => {
                                    setIsRecordCollectionOpen(false);
                                    setCollectionTarget(null);
                                }}
                                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleConfirmCollection} className="p-5 space-y-4">
                            {/* Summary Details */}
                            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/70 space-y-2 text-xs">
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-500 font-medium">Client</span>
                                    <span className="font-bold text-slate-800">{collectionTarget.clientName}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-500 font-medium">Invoice No</span>
                                    <span className="font-mono font-bold text-slate-700">{collectionTarget.invoiceNo}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-500 font-medium">Period</span>
                                    <span className="font-semibold text-slate-600">{collectionTarget.period}</span>
                                </div>
                                <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
                                    <span className="font-bold text-slate-700">Amount Due</span>
                                    <span className="text-base font-extrabold text-emerald-600">
                                        ₹{collectionTarget.amount.toLocaleString('en-IN')}
                                    </span>
                                </div>
                            </div>

                            {/* Collection Date Picker */}
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                                    <span>Collection Date</span>
                                    <span className="text-[11px] font-normal text-slate-400">Date payment received</span>
                                </label>
                                <input
                                    type="date"
                                    required
                                    value={collectionDate}
                                    onChange={(e) => setCollectionDate(e.target.value)}
                                    className="w-full px-4 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm bg-white font-medium text-slate-700 cursor-pointer"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Payment Method</label>
                                <select
                                    value={collectionMethod}
                                    onChange={(e) => {
                                        const m = e.target.value;
                                        setCollectionMethod(m as any);
                                        const prefix = m === 'Online Transfer' ? 'ONLINE-TRANSFER' : m.toUpperCase().replace(/\s+/g, '-');
                                        setCollectionRef(`${prefix}-${crypto.randomUUID().replace(/-/g, '').substring(0, 8).toUpperCase()}`);
                                    }}
                                    className="w-full px-4 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm bg-white"
                                >
                                    <option value="UPI">UPI Setup</option>
                                    <option value="Online Transfer">Online Transfer (NEFT/RTGS)</option>
                                    <option value="Cash">Cash</option>
                                    <option value="Cheque">Cheque</option>
                                </select>
                            </div>

                            <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border border-slate-200/70 rounded-lg text-xs">
                                <span className="text-slate-500 font-medium">Reference ID</span>
                                <span className="font-mono font-bold text-slate-700">{collectionRef}</span>
                            </div>

                            <p className="text-xs text-slate-500">
                                Upon recording this payment, the invoice will be marked as Paid and recorded in Collection History.
                            </p>

                            <div className="pt-2 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsRecordCollectionOpen(false);
                                        setCollectionTarget(null);
                                    }}
                                    className="flex-1 py-2 rounded-lg font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmittingCollection}
                                    className="flex-1 py-2 rounded-lg font-semibold text-white bg-emerald-500 hover:bg-emerald-600 transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {isSubmittingCollection ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        'Confirm Payment'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Deposit Collection Modal */}
            {isDepositModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 z-50 transition-all">
                    <div className="bg-white/95 backdrop-blur-xl border border-white/40 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-5 border-b border-slate-100 bg-white/50 flex justify-between items-center">
                            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                <RupeeIcon className="w-5 h-5 text-emerald-500 text-lg" /> Record Deposit
                            </h2>
                        </div>
                        <form onSubmit={handleCollectDeposit} className="p-5 space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                                    <span>Deposit Date</span>
                                    <span className="text-[11px] font-normal text-slate-400">Date deposit received</span>
                                </label>
                                <input
                                    type="date"
                                    required
                                    value={depositDate}
                                    onChange={(e) => setDepositDate(e.target.value)}
                                    className="w-full px-4 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm bg-white font-medium text-slate-700 cursor-pointer"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Payment Method</label>
                                <select
                                    value={depositMethod}
                                    onChange={(e) => setDepositMethod(e.target.value)}
                                    className="w-full px-4 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm bg-white"
                                >
                                    <option value="Online Transfer">Online Transfer (NEFT/RTGS)</option>
                                    <option value="UPI">UPI Setup</option>
                                    <option value="Cheque">Cheque</option>
                                    <option value="Cash">Cash</option>
                                </select>
                            </div>
                            <p className="text-xs text-slate-500">Upon recording this payment, a formal receipt and dynamic thank-you greeting will be automatically sent to the client via Email/SMS.</p>
                            <div className="pt-2 flex gap-3">
                                <button type="button" onClick={() => setIsDepositModalOpen(false)} className="flex-1 py-2 rounded-lg font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">
                                    Cancel
                                </button>
                                <button type="submit" className="flex-1 py-2 rounded-lg font-semibold text-white bg-emerald-500 hover:bg-emerald-600 transition-colors shadow-sm">
                                    Confirm Payment
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Monthly Bill Modal */}
            {isEditBillModalOpen && editingBill && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 z-50 transition-all">
                    <div className="bg-white/95 backdrop-blur-xl border border-white/40 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-5 border-b border-slate-100 bg-white/50 flex justify-between items-center">
                            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                <Edit3 className="w-5 h-5 text-primary" /> Edit Monthly Bill
                            </h2>
                            <button onClick={() => setIsEditBillModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSaveBill} className="p-5 space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Client Name</label>
                                <input
                                    type="text"
                                    required
                                    value={editingBill.client}
                                    onChange={(e) => setEditingBill({ ...editingBill, client: e.target.value })}
                                    className="w-full px-4 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm bg-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Total Amount</label>
                                <input
                                    type="text"
                                    required
                                    value={editingBill.amount}
                                    onChange={(e) => setEditingBill({ ...editingBill, amount: e.target.value })}
                                    className="w-full px-4 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm bg-white"
                                />
                            </div>
                            <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50">
                                <span className="text-sm font-semibold text-slate-700">Attendance Verified</span>
                                <button
                                    type="button"
                                    onClick={() => setEditingBill({ ...editingBill, attendanceVerified: !editingBill.attendanceVerified, status: !editingBill.attendanceVerified ? 'Draft' : 'Pending Verification' })}
                                    className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${editingBill.attendanceVerified ? 'bg-emerald-500' : 'bg-slate-300'}`}
                                >
                                    <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 shadow-sm transition-all ${editingBill.attendanceVerified ? 'right-0.5' : 'left-0.5'}`}></div>
                                </button>
                            </div>
                            <div className="pt-2 flex gap-3">
                                <button type="button" onClick={() => setIsEditBillModalOpen(false)} className="flex-1 py-2 rounded-lg font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">
                                    Cancel
                                </button>
                                <button type="submit" className="flex-1 py-2 rounded-lg font-semibold text-white bg-primary hover:bg-primary/90 transition-colors shadow-sm">
                                    Save Bill
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* AI WhatsApp Draft Modal */}
            {isAgentModalOpen && agentTargetBill && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 z-[100] transition-all">
                    <div className="bg-white/95 backdrop-blur-xl border border-white/40 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
                        <div className="p-5 border-b border-slate-100 bg-emerald-500/10 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                                    <Bot className="w-5 h-5 text-emerald-600" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-slate-900">AI WhatsApp Agent</h2>
                                    <p className="text-xs text-slate-500 font-medium tracking-wide">BILLING: {agentTargetBill.client}</p>
                                </div>
                            </div>
                            <button onClick={() => setIsAgentModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-5 space-y-4 flex-1">
                            {agentTargetBill?.isDepositMode ? (
                                <div className="space-y-3 bg-white p-4 rounded-xl border border-emerald-200 shadow-sm relative z-10 w-full mb-4">
                                    <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100">
                                        <FileText className="w-4 h-4 text-emerald-600" />
                                        <span className="text-xs font-bold text-slate-700">Invoice Details (Auto-generated PDF)</span>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Deposit Amount (₹)</label>
                                            <input 
                                                type="number" 
                                                value={invoiceDepositAmount} 
                                                onChange={e => setInvoiceDepositAmount(e.target.value)} 
                                                className="w-full text-xs font-medium border border-slate-200 bg-slate-50 rounded px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-emerald-500" 
                                                placeholder="15000" 
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Due Date</label>
                                            <input 
                                                type="date" 
                                                value={invoiceDueDate} 
                                                onChange={e => setInvoiceDueDate(e.target.value)} 
                                                className="w-full text-xs font-medium border border-slate-200 bg-slate-50 rounded px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-emerald-500" 
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Start Date</label>
                                            <input 
                                                type="date" 
                                                value={invoiceStartDate} 
                                                onChange={e => setInvoiceStartDate(e.target.value)} 
                                                className="w-full text-xs font-medium border border-slate-200 bg-slate-50 rounded px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-emerald-500" 
                                            />
                                        </div>
                                        <div>
                                            <div className="flex items-center justify-between mb-1">
                                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide">End Date</label>
                                                <label className="inline-flex items-center gap-1.5 cursor-pointer select-none text-[11px] font-bold text-emerald-600 hover:text-emerald-700">
                                                    <input
                                                        type="checkbox"
                                                        checked={isInvoiceOngoing}
                                                        onChange={e => {
                                                            const checked = e.target.checked;
                                                            setIsInvoiceOngoing(checked);
                                                            if (checked) {
                                                                setInvoiceEndDate('');
                                                            } else {
                                                                const d = new Date(invoiceStartDate || new Date());
                                                                d.setDate(d.getDate() + 30);
                                                                setInvoiceEndDate(d.toISOString().split('T')[0]);
                                                            }
                                                        }}
                                                        className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                                    />
                                                    <span>Ongoing</span>
                                                </label>
                                            </div>
                                            {isInvoiceOngoing ? (
                                                <div 
                                                    onClick={() => setIsInvoiceOngoing(false)}
                                                    className="w-full text-xs font-semibold border-2 border-dashed border-emerald-300 bg-emerald-50/60 rounded px-2.5 py-1.5 text-emerald-800 flex items-center justify-between cursor-pointer hover:bg-emerald-100/50 transition-colors"
                                                    title="Click to specify an end date"
                                                >
                                                    <span className="flex items-center gap-1.5">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                                        Ongoing
                                                    </span>
                                                    <span className="text-[10px] font-bold uppercase tracking-wider bg-white/80 border border-emerald-200 px-1.5 py-0.5 rounded text-emerald-700">
                                                        No End Date
                                                    </span>
                                                </div>
                                            ) : (
                                                <input 
                                                    type="date" 
                                                    value={invoiceEndDate} 
                                                    onChange={e => setInvoiceEndDate(e.target.value)} 
                                                    className="w-full text-xs font-medium border border-slate-200 bg-slate-50 rounded px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-emerald-500" 
                                                />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2">Template Preview (client_monthly_invoice)</p>
                                    <p className="text-sm text-slate-700 leading-relaxed">
                                        Hello <strong>{agentTargetBill.client}</strong>,<br/><br/>
                                        Your monthly service invoice of <strong>₹{getBillPayableAmount(agentTargetBill).toLocaleString('en-IN')}</strong> has been generated by 99 Care.<br/><br/>
                                        📄 Your detailed invoice PDF is attached to this message.<br/><br/>
                                        💳 Scan the QR code or use the bank details to pay.<br/><br/>
                                        Thank you for trusting us! 🙏
                                    </p>
                                    <p className="text-[10px] text-slate-400 mt-1 italic">This message is sent via WhatsApp template and cannot be edited.</p>
                                </div>
                            )}

                            <div className="mt-3 bg-slate-50 p-3 rounded-lg border border-slate-100 flex items-start gap-3">
                                <div className="p-2 bg-white rounded shadow-sm border border-slate-200 shrink-0">
                                    <QrCode className="w-6 h-6 text-slate-700" />
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-slate-900 mb-0.5">Dynamic QR Code Attached</p>
                                    <p className="text-xs text-slate-500">
                                        The client can scan the QR code to securely pay ₹{getBillPayableAmount(agentTargetBill).toLocaleString('en-IN')} via their preferred UPI app.
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-3">
                            <button onClick={() => setIsAgentModalOpen(false)} className="px-6 py-2.5 rounded-xl font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors">
                                Cancel
                            </button>
                            <button onClick={handleDispatchMessage} className="flex-1 py-2.5 rounded-xl font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2">
                                <Send className="w-4 h-4" /> {agentTargetBill?.isDepositMode ? 'Send Deposit on WhatsApp' : 'Send Bill on WhatsApp'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Invoice Preview Modal */}
            {isInvoiceOpen && invoiceData && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col border border-slate-200 max-h-[90vh] animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                <FileText className="w-5 h-5 text-primary" />
                                Proforma Invoice
                            </h3>
                            <div className="flex gap-2">
                                <button onClick={() => window.print()} className="px-4 py-1.5 border border-slate-200 bg-white text-slate-700 text-sm font-bold rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2">
                                    <Download className="w-4 h-4" /> Download PDF
                                </button>
                                <button onClick={() => {
                                    setIsInvoiceOpen(false);
                                    
                                    // Update status to 'Invoice Sent' locally
                                    if (agentTargetBill.month) {
                                        setMonthlyBills(prev => prev.map(b => b.id === agentTargetBill.id ? { ...b, status: 'Sent', invoice_no: agentTargetBill.invoice_no } : b));
                                    } else {
                                        setDeposits(prev => prev.map(d => d.id === agentTargetBill.id ? { ...d, status: 'Invoice Sent', invoice_no: agentTargetBill.invoice_no } : d));
                                    }
                                    
                                    setIsAgentModalOpen(true);
                                }} className="px-4 py-1.5 bg-emerald-500 text-white text-sm font-bold rounded-lg shadow-sm hover:bg-emerald-600 transition-colors flex items-center gap-2">
                                    <Send className="w-4 h-4" /> Send via WhatsApp
                                </button>
                                <button onClick={() => setIsInvoiceOpen(false)} className="text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-200 rounded-md transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                        
                        <div className="p-8 overflow-y-auto bg-white custom-scrollbar">
                            {/* Invoice Header */}
                            <div className="flex justify-between items-start mb-8">
                                <div>
                                    <div className="flex flex-col">
                                        <img src="/99care-logo.png" alt="99 CARE" className="h-16 w-auto object-contain" />
                                    </div>
                                </div>
                                <div className="text-right text-xs text-slate-600 flex flex-col items-end gap-1">
                                    <p className="font-bold text-slate-800 text-lg">99 CARE</p>
                                    <p>104, FORCHUN MALL, GALAXY CIRCAL,</p>
                                    <p>PAL ADAJAN</p>
                                    <p>Surat, GUJARAT, 395007</p>
                                    <p className="mt-1"><span className="font-semibold text-slate-800">Mobile</span> +91 9016116564</p>
                                    <p><span className="font-semibold text-slate-800">Email</span> 99careforyou@gmail.com</p>
                                    <p><span className="font-semibold text-slate-800">Website</span> 99CARE.ORG</p>
                                </div>
                            </div>

                            {/* Client & Invoice Details */}
                            <div className="flex justify-between mb-8 border-t border-b border-slate-200 py-4">
                                <div className="text-sm">
                                    <p className="font-bold text-slate-800 mb-1">Bill To:</p>
                                    <p className="font-bold text-lg text-slate-900">{invoiceData.clientName}</p>
                                    <p className="text-slate-600">Ph: {invoiceData.phone}</p>
                                    {invoiceData.address && <p className="text-slate-600 max-w-xs mt-0.5">{invoiceData.address}</p>}
                                </div>
                                <div className="text-sm flex flex-col gap-2 text-right">
                                    <div className="flex justify-end gap-8"><span className="font-bold text-slate-700">Invoice #:</span> <span className="font-semibold">{invoiceData.invoiceNumber}</span></div>
                                    <div className="flex justify-end gap-8"><span className="font-bold text-slate-700">Invoice Date:</span> <span className="font-semibold">{new Date(invoiceData.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span></div>
                                </div>
                            </div>

                            {/* Items Table */}
                            <table className="w-full text-sm mb-8 border-collapse">
                                <thead>
                                    <tr className="bg-[#3B82F6] text-white">
                                        <th className="py-1 px-3 text-left w-12 border-r border-[#60A5FA]">#</th>
                                        <th className="py-1 px-3 text-left border-r border-[#60A5FA]">Item</th>
                                        <th className="py-1 px-3 text-center border-r border-[#60A5FA] w-32">HSN/SAC</th>
                                        <th className="py-1 px-3 text-right w-32">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="border-b border-slate-200">
                                        <td className="py-2 px-3 text-left">1</td>
                                        <td className="py-2 px-3 font-bold text-slate-800 uppercase">{invoiceData.service}</td>
                                        <td className="py-2 px-3 text-center text-slate-500">-</td>
                                        <td className="py-2 px-3 text-right font-semibold">{invoiceData.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                    </tr>
                                </tbody>
                            </table>

                            {/* Totals */}
                            <div className="flex justify-end mb-8">
                                <div className="w-1/2 space-y-1">
                                    {invoiceData.days > 0 && invoiceData.rate > 0 && (
                                        <div className="flex justify-between items-center py-1 text-xs text-slate-600">
                                            <span>Rate Breakdown ({invoiceData.days} day{invoiceData.days !== 1 ? 's' : ''} × ₹{invoiceData.rate?.toLocaleString('en-IN')}/day)</span>
                                            <span className="font-semibold text-slate-800">₹{(invoiceData.days * invoiceData.rate).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                        </div>
                                    )}
                                    {invoiceData.depositCollected > 0 && (
                                        <div className="flex justify-between items-center py-1.5 text-sm">
                                            <span className="text-slate-600">Deposit Collected</span>
                                            <span className="font-semibold text-emerald-600">− ₹{invoiceData.depositCollected.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                        </div>
                                    )}
                                    {invoiceData.isRefund || (invoiceData.depositCollected > (invoiceData.days * invoiceData.rate)) ? (
                                        <>
                                            <div className="flex justify-between items-center py-2 border-t border-slate-300">
                                                <span className="font-bold text-lg text-amber-800">Refund Due to Client</span>
                                                <span className="font-bold text-xl text-amber-600">₹{(invoiceData.refundAmount || (invoiceData.depositCollected - (invoiceData.days * invoiceData.rate))).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                            </div>
                                            <div className="flex justify-between items-center py-2 text-sm bg-amber-50 px-2 mt-1 rounded border border-amber-200">
                                                <span className="font-semibold text-amber-800">Amount to Return:</span>
                                                <span className="font-bold text-amber-700">₹{(invoiceData.refundAmount || (invoiceData.depositCollected - (invoiceData.days * invoiceData.rate))).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                            </div>
                                            <p className="text-[11px] text-slate-600 mt-2 text-right">
                                                Refund amount (in words): <span className="font-medium text-slate-800">INR {numberToWordsINR(invoiceData.refundAmount || (invoiceData.depositCollected - (invoiceData.days * invoiceData.rate)))} Rupees Refund Due to Client.</span>
                                            </p>
                                        </>
                                    ) : (
                                        <>
                                            <div className="flex justify-between items-center py-2 border-t border-slate-300">
                                                <span className="font-bold text-lg text-slate-800">Net Payable</span>
                                                <span className="font-bold text-xl text-slate-900">₹{invoiceData.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                            </div>
                                            <div className="flex justify-between items-center py-2 text-sm bg-slate-100 px-2 mt-1">
                                                <span className="font-semibold text-slate-700">Amount Payable:</span>
                                                <span className="font-bold text-slate-800">₹{invoiceData.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                            </div>
                                            <p className="text-[11px] text-slate-600 mt-2 text-right">
                                                Total amount (in words): <span className="font-medium text-slate-800">INR {numberToWordsINR(invoiceData.amount)} Rupees Only.</span>
                                            </p>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Payment & Sign */}
                            <div className="flex justify-between text-sm mb-12">
                                <div className="flex gap-8">
                                    <div>
                                        <p className="font-bold text-slate-800 mb-2 text-xs">Pay using UPI:</p>
                                        <div className="w-20 h-20 bg-slate-200 border border-slate-300 flex items-center justify-center rounded-md overflow-hidden p-1">
                                            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=upi://pay?pa=99careforyou@okaxis&pn=99%20CARE&am=${invoiceData.amount}&cu=INR`} alt="UPI QR" className="w-full h-full object-cover" />
                                        </div>
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-800 mb-1 text-xs">Bank Details:</p>
                                        <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-slate-700 text-[11px]">
                                            <span className="font-semibold">Bank:</span> <span>The Sutex Co-Operative Bank Ltd.</span>
                                            <span className="font-semibold">Account Holder:</span> <span>99 CARE HOME HEALTHCARE SERVICE</span>
                                            <span className="font-semibold">Account #:</span> <span>001810021002033</span>
                                            <span className="font-semibold">IFSC Code:</span> <span>SUTB0248018</span>
                                            <span className="font-semibold">Branch:</span> <span>Adajan Pal</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-center flex flex-col items-center justify-end">
                                    <p className="text-[10px] text-slate-500 mb-1">For 99 CARE</p>
                                    <img src="/Signature.png" alt="Authorized Signature" className="h-10 w-auto object-contain mb-1" />
                                    <div className="w-28 border-b border-slate-400 mb-1"></div>
                                    <p className="text-[10px] text-slate-600 font-medium">Authorized Signatory</p>
                                </div>
                            </div>

                            {/* Notes */}
                            <div className="text-[11px] text-slate-600 leading-tight border-t border-slate-200 pt-3 pb-8">
                                <p className="font-bold text-slate-800 mb-1">Notes:</p>
                                <p>Thank you So much for appoint us.</p>
                                <p>We 99 care is part of 99FAS companies based on Services provider entities. Where we can supply all Building and maintenance related work. In our 99CARE we provide best care taker and nursing services at home.</p>
                                <p>15,000/- paid in advanced before work start for more than 1 days' work. And all bill has to paid on timely based. Advanced Will Settled in Last final bill.</p>
                                <p>Please Rate us, your one vote is very important and precious for us.</p>
                                <div className="mt-3">
                                    <p>Falguni(Co-Founder)</p>
                                    <p>[99care.org]</p>
                                    <p>[+91 9016116564]</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Manual Client Service Invoice Modal */}
            {isManualInvoiceOpen && (() => {
                const invoiceDate = todayInputDate();
                const dueDate = addDaysInputDate(invoiceDate, 3);
                const calcDays = inclusiveDays(manualInvoiceForm.startDate, manualInvoiceForm.endDate);
                const days = manualInvoiceForm.customDays !== undefined && manualInvoiceForm.customDays !== '' 
                    ? parseFloat(manualInvoiceForm.customDays) || 0 
                    : calcDays;
                const isEndAndSettle = manualInvoiceForm.billingMode === 'settle_deposit_and_end';
                const rate = Number(manualInvoiceForm.ratePerDay) || 0;
                const deposit = Number(manualInvoiceForm.depositCollected) || 0;
                const gross = days * rate;
                const depositToApply = isEndAndSettle ? deposit : 0;
                const netBalance = gross - depositToApply;
                const isRefund = isEndAndSettle && netBalance < 0;
                const refundAmount = Math.abs(netBalance);
                const payable = Math.max(0, netBalance);

                return (
                    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-[80]">
                        <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col">
                            <div className="p-5 border-b border-slate-100 bg-slate-900 flex justify-between items-center shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center">
                                        <FileText className="w-5 h-5 text-white" />
                                    </div>
                                    <div>
                                        <h2 className="text-base font-bold text-white">Manual Client Service Invoice</h2>
                                        <p className="text-xs text-slate-400">Generate PDF, send WhatsApp, and add to Client Master</p>
                                    </div>
                                </div>
                                <button
                                    onClick={resetManualInvoice}
                                    className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="p-5 space-y-5 overflow-y-auto">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Client Name</label>
                                        <input
                                            type="text"
                                            value={manualInvoiceForm.clientName}
                                            onChange={e => updateManualInvoiceForm({ clientName: e.target.value })}
                                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/30"
                                            placeholder="e.g. Rajveer Kachiwala"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Phone Number</label>
                                        <input
                                            type="tel"
                                            value={manualInvoiceForm.phone}
                                            onChange={e => updateManualInvoiceForm({ phone: e.target.value })}
                                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/30"
                                            placeholder="+91 90000 00000"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Full Address</label>
                                    <textarea
                                        value={manualInvoiceForm.address}
                                        onChange={e => updateManualInvoiceForm({ address: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/30 min-h-[78px] resize-none"
                                        placeholder="Full billing address"
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Service Name</label>
                                        <input
                                            type="text"
                                            value={manualInvoiceForm.serviceName}
                                            onChange={e => updateManualInvoiceForm({ serviceName: e.target.value })}
                                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/30"
                                            placeholder="e.g. Old Age Care"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Service Hours</label>
                                        <div className="grid grid-cols-2 gap-2 bg-slate-100 rounded-lg p-1">
                                            {(['10', '24'] as const).map(hours => (
                                                <button
                                                    key={hours}
                                                    type="button"
                                                    onClick={() => updateManualInvoiceForm({ serviceHours: hours })}
                                                    className={`py-1.5 rounded-md text-xs font-bold transition-colors ${manualInvoiceForm.serviceHours === hours ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                                                >
                                                    {hours} hours
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Start Date</label>
                                        <input
                                            type="date"
                                            value={manualInvoiceForm.startDate}
                                            onChange={e => {
                                                const nextStart = e.target.value;
                                                const nextEnd = manualInvoiceForm.endDate && manualInvoiceForm.endDate < nextStart ? nextStart : manualInvoiceForm.endDate;
                                                const autoDays = inclusiveDays(nextStart, nextEnd);
                                                updateManualInvoiceForm({ startDate: nextStart, endDate: nextEnd, customDays: String(autoDays) });
                                            }}
                                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/30"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">End Date</label>
                                        <input
                                            type="date"
                                            min={manualInvoiceForm.startDate}
                                            value={manualInvoiceForm.endDate}
                                            onChange={e => {
                                                const nextEnd = e.target.value;
                                                const autoDays = inclusiveDays(manualInvoiceForm.startDate, nextEnd);
                                                updateManualInvoiceForm({ endDate: nextEnd, customDays: String(autoDays) });
                                            }}
                                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/30"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Invoice Date</label>
                                        <input value={invoiceDate} readOnly className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold bg-slate-50 text-slate-500" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Due Date</label>
                                        <input value={dueDate} readOnly className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold bg-slate-50 text-slate-500" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Days of Service</label>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const cur = Number(manualInvoiceForm.customDays || days) || 0;
                                                        const next = Math.max(0.5, cur - 0.5);
                                                        updateManualInvoiceForm({ customDays: next.toString() });
                                                    }}
                                                    className="px-1.5 py-0.5 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 rounded transition-colors"
                                                    title="Subtract Half Day (-0.5)"
                                                >
                                                    -0.5d
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const cur = Number(manualInvoiceForm.customDays || days) || 0;
                                                        const next = cur + 0.5;
                                                        updateManualInvoiceForm({ customDays: next.toString() });
                                                    }}
                                                    className="px-1.5 py-0.5 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 rounded transition-colors"
                                                    title="Add Half Day (+0.5)"
                                                >
                                                    +0.5d
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        updateManualInvoiceForm({ customDays: '0.5' });
                                                    }}
                                                    className="px-1.5 py-0.5 text-[10px] font-bold bg-teal-50 hover:bg-teal-100 text-teal-700 rounded transition-colors"
                                                    title="Set to Half Day (0.5)"
                                                >
                                                    Half (0.5)
                                                </button>
                                            </div>
                                        </div>
                                        <input
                                            type="number"
                                            min="0.5"
                                            step="0.5"
                                            value={manualInvoiceForm.customDays !== undefined ? manualInvoiceForm.customDays : days}
                                            onChange={e => updateManualInvoiceForm({ customDays: e.target.value })}
                                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/30"
                                            placeholder="e.g. 4.5 or 30.5"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Client Rate / Day (₹)</label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={manualInvoiceForm.ratePerDay}
                                            onChange={e => updateManualInvoiceForm({ ratePerDay: e.target.value })}
                                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/30"
                                            placeholder="800"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Deposit Already Collected (₹)</label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={manualInvoiceForm.depositCollected}
                                            onChange={e => updateManualInvoiceForm({ depositCollected: e.target.value })}
                                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/30"
                                        />
                                    </div>
                                </div>

                                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2.5">Invoice Billing Type</label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <button
                                            type="button"
                                            onClick={() => updateManualInvoiceForm({ billingMode: 'ongoing' })}
                                            className={`p-3 rounded-xl border text-left transition-all ${
                                                manualInvoiceForm.billingMode !== 'settle_deposit_and_end'
                                                    ? 'border-primary bg-primary/5 ring-2 ring-primary/20 shadow-xs'
                                                    : 'border-slate-200 bg-white hover:bg-slate-50'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="font-bold text-xs text-slate-900">Regular Monthly Invoice</span>
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Ongoing</span>
                                            </div>
                                            <p className="text-[11px] text-slate-500 mt-1">
                                                Deposit (₹{deposit.toLocaleString('en-IN')}) remains held in client account. Full bill: ₹{gross.toLocaleString('en-IN')}.
                                            </p>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => updateManualInvoiceForm({ billingMode: 'settle_deposit_and_end' })}
                                            className={`p-3 rounded-xl border text-left transition-all ${
                                                manualInvoiceForm.billingMode === 'settle_deposit_and_end'
                                                    ? 'border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-600/20 shadow-xs'
                                                    : 'border-slate-200 bg-white hover:bg-slate-50'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="font-bold text-xs text-slate-900">Final Settlement & End Service</span>
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Settlement</span>
                                            </div>
                                            <p className="text-[11px] text-slate-500 mt-1">
                                                Deposit (₹{deposit.toLocaleString('en-IN')}) is deducted from this bill, deposit marked settled, and service ended.
                                            </p>
                                        </button>
                                    </div>
                                </div>

                                <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">{days || 0} day{days !== 1 ? 's' : ''} x ₹{rate.toLocaleString('en-IN')}/day</span>
                                        <span className="font-semibold text-slate-800">₹{gross.toLocaleString('en-IN')}</span>
                                    </div>
                                    {isEndAndSettle ? (
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-500 flex items-center gap-1.5">
                                                Security Deposit Deducted <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-700 uppercase">Settling</span>
                                            </span>
                                            <span className="font-semibold text-emerald-600">− ₹{deposit.toLocaleString('en-IN')}</span>
                                        </div>
                                    ) : (
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-500 flex items-center gap-1.5">
                                                Security Deposit <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-200 text-slate-600 uppercase">Held In Account</span>
                                            </span>
                                            <span className="font-semibold text-slate-500">₹{deposit.toLocaleString('en-IN')} (not deducted)</span>
                                        </div>
                                    )}
                                    {isRefund ? (
                                        <div className="border-t border-amber-200 pt-2 mt-1 space-y-1">
                                            <div className="flex justify-between text-base font-bold">
                                                <span className="text-amber-800 flex items-center gap-1.5">
                                                    Refund Due to Client <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 uppercase tracking-wide">To Return</span>
                                                </span>
                                                <span className="text-amber-600 font-black text-lg">₹{refundAmount.toLocaleString('en-IN')}</span>
                                            </div>
                                            <p className="text-[11px] font-medium text-amber-700">Deposit collected (₹{deposit.toLocaleString('en-IN')}) exceeds total service charges by ₹{refundAmount.toLocaleString('en-IN')}.</p>
                                        </div>
                                    ) : (
                                        <div className="flex justify-between text-base font-bold border-t border-slate-200 pt-2 mt-1">
                                            <span className="text-slate-800">Amount Payable</span>
                                            <span className="text-primary font-black">₹{payable.toLocaleString('en-IN')}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="p-5 border-t border-slate-100 bg-slate-50 flex flex-col-reverse sm:flex-row justify-end gap-3 shrink-0">
                                <button
                                    onClick={resetManualInvoice}
                                    disabled={isManualInvoiceGenerating}
                                    className="px-5 py-2.5 rounded-xl font-semibold text-slate-600 hover:bg-slate-200 transition-colors w-full sm:w-auto text-center disabled:opacity-60"
                                >
                                    Cancel
                                </button>
                                <div className="flex gap-3 flex-1 sm:flex-none w-full sm:w-auto">
                                    <button
                                        type="button"
                                        onClick={handlePreviewManualInvoice}
                                        disabled={isManualInvoiceGenerating}
                                        className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-all shadow-sm flex items-center justify-center gap-2 whitespace-nowrap disabled:opacity-60"
                                    >
                                        <FileText className="w-4 h-4 text-slate-600" /> Preview
                                    </button>
                                    <button
                                        onClick={handleManualInvoiceGenerate}
                                        disabled={isManualInvoiceGenerating}
                                        className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
                                    >
                                        {isManualInvoiceGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                        Generate & Send WhatsApp
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Manual Invoice Duplicate Choice Modal */}
            {isDuplicateChoiceOpen && manualDuplicateMatches.length > 0 && (
                <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-[90]">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-5 border-b border-slate-100">
                            <h2 className="text-lg font-bold text-slate-900">Matching Client Found</h2>
                            <p className="text-sm text-slate-500 mt-1">This phone number already exists. Choose how to generate this invoice.</p>
                        </div>
                        <div className="p-5 space-y-3">
                            {manualDuplicateMatches.slice(0, 3).map(match => (
                                <div key={`${match.source}-${match.id}`} className="p-3 rounded-xl border border-slate-200 bg-slate-50">
                                    <p className="text-sm font-bold text-slate-900">{match.name}</p>
                                    <p className="text-xs text-slate-500 mt-0.5">{match.phone || manualInvoiceForm.phone}</p>
                                    {match.stage && <p className="text-[11px] text-primary font-semibold mt-1">Stage: {match.stage}</p>}
                                </div>
                            ))}
                        </div>
                        <div className="p-5 border-t border-slate-100 bg-slate-50 grid gap-3">
                            <button
                                onClick={() => generateManualInvoice('link', manualDuplicateMatches[0])}
                                disabled={isManualInvoiceGenerating}
                                className="w-full px-4 py-2.5 rounded-xl font-bold text-white bg-primary hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                            >
                                {isManualInvoiceGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                Link to existing client
                            </button>
                            <button
                                onClick={() => generateManualInvoice('new', manualDuplicateMatches[0])}
                                disabled={isManualInvoiceGenerating}
                                className="w-full px-4 py-2.5 rounded-xl font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-60"
                            >
                                New independent lead
                            </button>
                            <button
                                onClick={() => setIsDuplicateChoiceOpen(false)}
                                disabled={isManualInvoiceGenerating}
                                className="w-full px-4 py-2 rounded-xl font-semibold text-slate-500 hover:bg-slate-200 transition-colors disabled:opacity-60"
                            >
                                Back to edit
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Client Invoice Generator Modal */}
            {isClientInvoiceOpen && clientInvoiceBill && (() => {
                const total = ciDays * ciRate;
                const depositDeducted = ciSettleDeposit ? Math.min(total, ciDeposit) : 0;
                const netBalance = total - (ciSettleDeposit ? ciDeposit : 0);
                const isRefund = ciSettleDeposit && netBalance < 0;
                const refundAmount = Math.abs(netBalance);
                const payable = Math.max(0, netBalance);
                return (
                    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                        <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col">
                            <div className="p-5 border-b border-slate-100 bg-slate-900 flex justify-between items-center shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center">
                                        <FileText className="w-5 h-5 text-white" />
                                    </div>
                                    <div>
                                        <h2 className="text-base font-bold text-white">Client Invoice Generator</h2>
                                        <p className="text-xs text-slate-400">{clientInvoiceBill.client}</p>
                                    </div>
                                </div>
                                <button onClick={() => { setIsClientInvoiceOpen(false); setClientInvoiceBill(null); }} className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="p-5 space-y-4 overflow-y-auto flex-1">
                                {!ciAttendanceVerified && (
                                    <div className="bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2.5 rounded-lg text-xs font-medium flex items-start gap-2">
                                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                                        <p>Attendance is not yet marked or verified by HR for this period. Days of service may be inaccurate.</p>
                                    </div>
                                )}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Start Date</label>
                                        <input
                                            type="date"
                                            value={ciStartDate}
                                            onChange={e => {
                                                const val = e.target.value;
                                                setCiStartDate(val);
                                                if (val && ciEndDate) {
                                                    fetchClientInvoiceAttendance(val, ciEndDate);
                                                }
                                            }}
                                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/30"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">End Date</label>
                                        <input
                                            type="date"
                                            value={ciEndDate}
                                            onChange={e => {
                                                const val = e.target.value;
                                                setCiEndDate(val);
                                                if (ciStartDate && val) {
                                                    fetchClientInvoiceAttendance(ciStartDate, val);
                                                }
                                            }}
                                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/30"
                                        />
                                    </div>
                                </div>

                                {/* Attendance Summary */}
                                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="font-semibold text-slate-900 text-sm">Attendance Summary</h3>
                                        <button
                                            type="button"
                                            onClick={() => fetchClientInvoiceAttendance(ciStartDate, ciEndDate)}
                                            disabled={isCiLoadingAttendance}
                                            className="text-xs text-primary font-semibold hover:underline flex items-center gap-1 disabled:opacity-50"
                                        >
                                            {isCiLoadingAttendance ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                                            Refresh
                                        </button>
                                    </div>
                                    {isCiLoadingAttendance ? (
                                        <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
                                    ) : ciAttendanceSummary ? (
                                        <div className="space-y-3">
                                            <div className="grid grid-cols-4 gap-2 text-center">
                                                <div className="bg-white rounded-lg p-2.5 border border-slate-200/70 shadow-xs">
                                                    <p className="text-xl sm:text-2xl font-black text-emerald-600">{ciAttendanceSummary.fullDays}</p>
                                                    <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 font-medium leading-tight">Full Days Present</p>
                                                </div>
                                                <div className="bg-white rounded-lg p-2.5 border border-slate-200/70 shadow-xs">
                                                    <p className="text-xl sm:text-2xl font-black text-amber-600">{ciAttendanceSummary.halfDays}</p>
                                                    <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 font-medium leading-tight">Half Days (0.5d)</p>
                                                </div>
                                                <div className="bg-white rounded-lg p-2.5 border border-slate-200/70 shadow-xs">
                                                    <p className="text-xl sm:text-2xl font-black text-red-500">{ciAttendanceSummary.absentDays}</p>
                                                    <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 font-medium leading-tight">Days Absent</p>
                                                </div>
                                                <div className="bg-white rounded-lg p-2.5 border border-slate-200/70 shadow-xs">
                                                    <p className="text-xl sm:text-2xl font-black text-primary">{ciAttendanceSummary.effectiveDays}</p>
                                                    <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 font-medium leading-tight">Effective Days</p>
                                                </div>
                                            </div>

                                            {/* Date Details for Half Days & Absent Days */}
                                            {((ciAttendanceSummary.halfDayDates && ciAttendanceSummary.halfDayDates.length > 0) || (ciAttendanceSummary.absentDates && ciAttendanceSummary.absentDates.length > 0)) && (
                                                <div className="bg-white rounded-lg p-2.5 border border-slate-200/70 text-xs space-y-1.5">
                                                    {ciAttendanceSummary.halfDayDates && ciAttendanceSummary.halfDayDates.length > 0 && (
                                                        <div className="flex items-center gap-1.5 flex-wrap text-slate-600">
                                                            <span className="font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded text-[11px]">
                                                                Half Days ({ciAttendanceSummary.halfDayDates.length}):
                                                            </span>
                                                            <span className="font-medium text-slate-700">
                                                                {ciAttendanceSummary.halfDayDates.map(d => format(new Date(`${d}T00:00:00`), 'dd MMM')).join(', ')}
                                                            </span>
                                                        </div>
                                                    )}
                                                    {ciAttendanceSummary.absentDates && ciAttendanceSummary.absentDates.length > 0 && (
                                                        <div className="flex items-center gap-1.5 flex-wrap text-slate-600">
                                                            <span className="font-semibold text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded text-[11px]">
                                                                Absent Days ({ciAttendanceSummary.absentDates.length}):
                                                            </span>
                                                            <span className="font-medium text-slate-700">
                                                                {ciAttendanceSummary.absentDates.map(d => format(new Date(`${d}T00:00:00`), 'dd MMM')).join(', ')}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-slate-400 text-center py-3">No attendance data found</p>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Days of Service</label>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => handleCiDaysChange(Math.max(0.5, ciDays - 0.5))}
                                                    className="px-1.5 py-0.5 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 rounded transition-colors"
                                                    title="Subtract Half Day (-0.5)"
                                                >
                                                    -0.5d
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleCiDaysChange(ciDays + 0.5)}
                                                    className="px-1.5 py-0.5 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 rounded transition-colors"
                                                    title="Add Half Day (+0.5)"
                                                >
                                                    +0.5d
                                                </button>
                                            </div>
                                        </div>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.5"
                                            value={ciDays}
                                            onChange={e => handleCiDaysChange(parseFloat(e.target.value) || 0)}
                                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/30"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Client Rate / Day (₹)</label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={ciRate}
                                            onChange={e => setCiRate(parseFloat(e.target.value) || 0)}
                                            onBlur={async () => {
                                                if (!clientInvoiceBill || ciRate <= 0) return;
                                                try {
                                                    await persistClientBillingRate(clientInvoiceBill, ciRate);
                                                } catch {
                                                    /* ignore blur save errors */
                                                }
                                            }}
                                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/30"
                                        />
                                    </div>
                                </div>

                                {ciDeposit > 0 && (
                                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
                                        <label className="flex items-center gap-2.5 cursor-pointer select-none">
                                            <input
                                                type="checkbox"
                                                checked={ciSettleDeposit}
                                                onChange={e => {
                                                    const checked = e.target.checked;
                                                    setCiSettleDeposit(checked);
                                                    if (!checked) setCiEndService(false);
                                                }}
                                                className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                                            />
                                            <div>
                                                <span className="text-xs font-bold text-slate-800">
                                                    Settle Security Deposit (₹{ciDeposit.toLocaleString('en-IN')}) on this invoice
                                                </span>
                                                <p className="text-[11px] text-slate-500">
                                                    {ciSettleDeposit 
                                                        ? `Deducting ₹${ciDeposit.toLocaleString('en-IN')} deposit from this invoice.` 
                                                        : `Deposit is held in client account. Leave unchecked for regular monthly bill.`}
                                                </p>
                                            </div>
                                        </label>

                                        {ciSettleDeposit && (
                                            <label className="flex items-center gap-2.5 cursor-pointer select-none pl-6 border-t border-slate-200/60 pt-2">
                                                <input
                                                    type="checkbox"
                                                    checked={ciEndService}
                                                    onChange={e => setCiEndService(e.target.checked)}
                                                    className="w-4 h-4 text-primary rounded border-slate-300 focus:ring-primary"
                                                />
                                                <span className="text-xs font-semibold text-slate-700">
                                                    Mark service as ended and finalize settlement
                                                </span>
                                            </label>
                                        )}
                                    </div>
                                )}

                                <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">{ciDays} day{ciDays !== 1 ? 's' : ''} × ₹{ciRate.toLocaleString('en-IN')}/day</span>
                                        <span className="font-semibold text-slate-800">₹{total.toLocaleString('en-IN')}</span>
                                    </div>
                                    {ciSettleDeposit ? (
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-500 flex items-center gap-1.5">
                                                Deposit Deducted <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-700 uppercase">Settled</span>
                                            </span>
                                            <span className="font-semibold text-emerald-600">− ₹{ciDeposit.toLocaleString('en-IN')}</span>
                                        </div>
                                    ) : ciDeposit > 0 ? (
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-500 flex items-center gap-1.5">
                                                Deposit Held <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-200 text-slate-600 uppercase">Active</span>
                                            </span>
                                            <span className="font-semibold text-slate-500">₹{ciDeposit.toLocaleString('en-IN')} (not deducted)</span>
                                        </div>
                                    ) : null}

                                    {isRefund ? (
                                        <div className="border-t border-amber-200 pt-2 mt-1 space-y-1">
                                            <div className="flex justify-between text-base font-bold">
                                                <span className="text-amber-800 flex items-center gap-1.5">
                                                    Refund Due to Client <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 uppercase tracking-wide">To Return</span>
                                                </span>
                                                <span className="text-amber-600 font-black text-lg">₹{refundAmount.toLocaleString('en-IN')}</span>
                                            </div>
                                            <p className="text-[11px] font-medium text-amber-700">Deposit collected (₹{ciDeposit.toLocaleString('en-IN')}) exceeds total charges by ₹{refundAmount.toLocaleString('en-IN')}.</p>
                                        </div>
                                    ) : (
                                        <div className="flex justify-between text-base font-bold border-t border-slate-200 pt-2 mt-1">
                                            <span className="text-slate-800">Amount Payable</span>
                                            <span className="text-primary font-black">₹{payable.toLocaleString('en-IN')}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="p-5 border-t border-slate-100 bg-slate-50 flex flex-col-reverse sm:flex-row justify-end gap-3 rounded-b-2xl">
                                <button onClick={() => { setIsClientInvoiceOpen(false); setClientInvoiceBill(null); }} className="px-5 py-2.5 rounded-xl font-semibold text-slate-600 hover:bg-slate-200 transition-colors w-full sm:w-auto text-center">Cancel</button>
                                <div className="flex gap-3 flex-1 sm:flex-none w-full sm:w-auto">
                                    <button
                                        onClick={async () => {
                                            try {
                                                await commitClientInvoiceDraft();
                                            } catch (e: any) {
                                                toast.error(e.message || 'Failed to save rate');
                                                return;
                                            }
                                            setIsClientInvoiceOpen(false);
                                            const invoiceNo = `INV-C${Math.floor(Math.random() * 9000) + 1000}`;
                                            const formatDateStr = (ds: string) => {
                                                if (!ds) return '';
                                                const [y, m, d] = ds.split('-');
                                                return `${d}/${m}/${y}`;
                                            };
                                            const formattedPeriod = (ciStartDate && ciEndDate)
                                                ? `${formatDateStr(ciStartDate)} To ${formatDateStr(ciEndDate)}`
                                                : 'As agreed';
                                            const rawShift = (clientInvoiceBill.shift_duration || '24').toString().replace(/\D/g, '') || '24';
                                            const shiftTitle = `${rawShift}-HOUR SHIFT`;
                                            const serviceTitle = (clientInvoiceBill.service_category || clientInvoiceBill.rawAssignment?.service_name || 'OLD AGE CARE').toUpperCase();
                                            const itemDescription = `${shiftTitle} (${serviceTitle}) — ${ciDays} DAY${ciDays !== 1 ? 'S' : ''} (${formattedPeriod})`;

                                            const targetBill = {
                                                ...clientInvoiceBill,
                                                invoice_no: invoiceNo,
                                                amount: isRefund ? `₹${refundAmount} (Refund)` : payable.toString(),
                                                totalAmount: isRefund ? 0 : payable,
                                                grossAmount: total,
                                                days: ciDays,
                                                rate: ciRate,
                                                startDate: ciStartDate,
                                                endDate: ciEndDate,
                                                depositCollected: depositDeducted,
                                                isRefund: isRefund,
                                                refundAmount: refundAmount,
                                                client_address: clientInvoiceBill.client_address || '',
                                                service_category: clientInvoiceBill.service_category || 'Old Age Care',
                                                shift_duration: clientInvoiceBill.shift_duration || '24',
                                            };
                                            setAgentTargetBill(targetBill);
                                            setInvoiceData({
                                                clientName: clientInvoiceBill.client,
                                                phone: clientInvoiceBill.client_phone || '',
                                                address: clientInvoiceBill.client_address || '',
                                                service: itemDescription,
                                                amount: isRefund ? 0 : payable,
                                                totalAmount: isRefund ? 0 : payable,
                                                grossAmount: total,
                                                depositCollected: depositDeducted,
                                                isRefund: isRefund,
                                                refundAmount: refundAmount,
                                                date: new Date().toISOString(),
                                                invoiceNumber: invoiceNo,
                                                days: ciDays,
                                                rate: ciRate,
                                                startDate: ciStartDate,
                                                endDate: ciEndDate,
                                                service_name: clientInvoiceBill.service_category || 'Old Age Care',
                                                service_hours: clientInvoiceBill.shift_duration || '24',
                                            });
                                            setAgentDraftText(generateWhatsappDraft(targetBill, agentDraftLang));
                                            setInvoiceDepositAmount((isRefund ? 0 : payable).toString());
                                            setIsInvoiceOpen(true);
                                        }}
                                        className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-all shadow-sm flex items-center justify-center gap-2 whitespace-nowrap"
                                    >
                                        <FileText className="w-4 h-4" /> Preview
                                    </button>
                                    <button
                                        onClick={async () => {
                                            try {
                                                await commitClientInvoiceDraft();
                                            } catch (e: any) {
                                                toast.error(e.message || 'Failed to save rate');
                                                return;
                                            }
                                            setIsClientInvoiceOpen(false);
                                            const invoiceNo = `INV-C${Math.floor(Math.random() * 9000) + 1000}`;
                                            const formatDateStr = (ds: string) => {
                                                if (!ds) return '';
                                                const [y, m, d] = ds.split('-');
                                                return `${d}/${m}/${y}`;
                                            };
                                            const formattedPeriod = (ciStartDate && ciEndDate)
                                                ? `${formatDateStr(ciStartDate)} To ${formatDateStr(ciEndDate)}`
                                                : 'As agreed';
                                            const rawShift = (clientInvoiceBill.shift_duration || '24').toString().replace(/\D/g, '') || '24';
                                            const shiftTitle = `${rawShift}-HOUR SHIFT`;
                                            const serviceTitle = (clientInvoiceBill.service_category || clientInvoiceBill.rawAssignment?.service_name || 'OLD AGE CARE').toUpperCase();
                                            const itemDescription = `${shiftTitle} (${serviceTitle}) — ${ciDays} DAY${ciDays !== 1 ? 'S' : ''} (${formattedPeriod})`;

                                            const targetBill = {
                                                ...clientInvoiceBill,
                                                invoice_no: invoiceNo,
                                                amount: isRefund ? `₹${refundAmount} (Refund)` : payable.toString(),
                                                totalAmount: isRefund ? 0 : payable,
                                                grossAmount: total,
                                                days: ciDays,
                                                rate: ciRate,
                                                startDate: ciStartDate,
                                                endDate: ciEndDate,
                                                depositCollected: depositDeducted,
                                                isRefund: isRefund,
                                                refundAmount: refundAmount,
                                                client_address: clientInvoiceBill.client_address || '',
                                                service_category: clientInvoiceBill.service_category || 'Old Age Care',
                                                shift_duration: clientInvoiceBill.shift_duration || '24',
                                            };
                                            setAgentTargetBill(targetBill);
                                            setInvoiceData({
                                                clientName: clientInvoiceBill.client,
                                                phone: clientInvoiceBill.client_phone || '',
                                                address: clientInvoiceBill.client_address || '',
                                                service: itemDescription,
                                                amount: isRefund ? 0 : payable,
                                                totalAmount: isRefund ? 0 : payable,
                                                grossAmount: total,
                                                depositCollected: depositDeducted,
                                                isRefund: isRefund,
                                                refundAmount: refundAmount,
                                                date: new Date().toISOString(),
                                                invoiceNumber: invoiceNo,
                                                days: ciDays,
                                                rate: ciRate,
                                                startDate: ciStartDate,
                                                endDate: ciEndDate,
                                                service_name: clientInvoiceBill.service_category || 'Old Age Care',
                                                service_hours: clientInvoiceBill.shift_duration || '24',
                                            });
                                            const draft = generateWhatsappDraft(targetBill, agentDraftLang);
                                            setAgentDraftText(draft);
                                            setInvoiceDepositAmount((isRefund ? 0 : payable).toString());
                                            setIsAgentModalOpen(true);
                                        }}
                                        className="flex-[1.5] sm:flex-none px-5 py-2.5 rounded-xl font-bold text-white bg-[#25D366] hover:bg-[#1ebd5a] transition-all shadow-md flex items-center justify-center gap-2 whitespace-nowrap"
                                    >
                                        <Send className="w-4 h-4" /> Send WhatsApp
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}
