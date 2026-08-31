import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileText, CheckCircle2, AlertCircle, Building, Send, Edit3, X, Globe, QrCode, History, Search, Download, Loader2, Bot } from 'lucide-react';

const RupeeIcon = ({ className }: { className?: string }) => (
    <span className={`font-bold leading-none flex items-center justify-center ${className || ''}`} style={{ fontFamily: 'system-ui, sans-serif' }}>₹</span>
);
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { resolveClientBillingRatePerDay, numberToWordsINR } from '../utils/billingRate';
import ServicesPanel from '../components/hr/ServicesPanel';
import { recordServiceInvoice, markServiceBillPaid } from '../services/serviceLifecycle';

type ManualInvoiceForm = {
    clientName: string;
    phone: string;
    address: string;
    serviceName: string;
    startDate: string;
    endDate: string;
    ratePerDay: string;
    depositCollected: string;
    serviceHours: '10' | '24';
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
    ratePerDay: '',
    depositCollected: '0',
    serviceHours: '10',
});


export default function Billing() {
    const [searchParams] = useSearchParams();
    const currentMonthYear = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
    const [activeTab, setActiveTab] = useState<'deposits' | 'monthly' | 'history'>((searchParams.get('tab') as any) || 'deposits');
    const [historySubTab, setHistorySubTab] = useState<'deposit' | 'service'>('deposit');
    const [selectedMonth, setSelectedMonth] = useState<string>(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });
    const [payments, setPayments] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const [deposits, setDeposits] = useState<any[]>([]);
    const [monthlyBills, setMonthlyBills] = useState<any[]>([]);

    // Deposit Collect Modal State
    const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
    const [activeDepositId, setActiveDepositId] = useState<number | null>(null);
    const [depositMethod, setDepositMethod] = useState('Online');

    // Service Bill Collection Modal State
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
    const [collectionMethod, setCollectionMethod] = useState<'UPI' | 'Cash' | 'Bank Transfer' | 'Cheque'>('UPI');
    const [collectionRef, setCollectionRef] = useState<string>('');
    const [collectionDate, setCollectionDate] = useState<string>(new Date().toISOString().split('T')[0]);
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
    const [ciStartDate, setCiStartDate] = useState('');
    const [ciEndDate, setCiEndDate] = useState('');
    const [ciAttendanceVerified, setCiAttendanceVerified] = useState(true);

    // Manual Client Invoice State
    const [isManualInvoiceOpen, setIsManualInvoiceOpen] = useState(false);
    const [manualInvoiceForm, setManualInvoiceForm] = useState<ManualInvoiceForm>(() => manualInvoiceInitialForm());
    const [manualDuplicateMatches, setManualDuplicateMatches] = useState<ClientMatch[]>([]);
    const [isDuplicateChoiceOpen, setIsDuplicateChoiceOpen] = useState(false);
    const [isManualInvoiceGenerating, setIsManualInvoiceGenerating] = useState(false);

    const fetchBillingData = async () => {
        setIsLoading(true);
        try {
            // Run all 4 queries in parallel for ~3x faster load
            const [assignmentsResult, leadsResult, quotesResult, servicePaymentsResult, manualLeadsResult] = await Promise.all([
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
                        clients (client_name, phone_number, id),
                        employees (id, full_name, job_title, phone, rate_10hr, rate_24hr)
                    `)
                    .neq('assignment_status', 'cancelled')
                    .order('assigned_at', { ascending: false }),
                supabase.from('crm_leads').select('id, estimated_value_monthly'),
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
            ]);

            const { data, error } = assignmentsResult;
            if (error) throw error;
            if (manualLeadsResult.error) throw manualLeadsResult.error;

            let leadsMap: Record<string, number> = {};
            let activeLeadIds = new Set<string>();
            if (leadsResult.data) {
                leadsResult.data.forEach((l: any) => {
                    activeLeadIds.add(l.id);
                    if (l.estimated_value_monthly) leadsMap[l.id] = l.estimated_value_monthly;
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
                const paidClients = new Set<string>();
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

                // Map to deposits (deduplicated by client so we only show one deposit entry per client)
                const uniqueClientAssignments: any[] = [];
                const seenClients = new Set();
                
                // Sort assignments so we pick the most recently active one for the deposit status
                const sortedAssignments = [...activeAssignments].sort((a: any, b: any) => 
                    new Date(b.assigned_at || b.start_date).getTime() - new Date(a.assigned_at || a.start_date).getTime()
                );
                
                for (const asgn of sortedAssignments) {
                    const clientId = (asgn as any).clients?.id;
                    if (clientId && !seenClients.has(clientId)) {
                        // Prefer paid/invoiced assignments over pending ones when deduplicating
                        const existingPaid = sortedAssignments.find(a => (a as any).clients?.id === clientId && ((a as any).deposit_paid > 0 || a.deposit_invoice_sent));
                        if (existingPaid && existingPaid.id !== asgn.id) continue;
                        
                        seenClients.add(clientId);
                        uniqueClientAssignments.push(existingPaid || asgn);
                    }
                }

                const mappedDeposits = uniqueClientAssignments.map(asgn => {
                    const clientId = (asgn as any).clients?.id;
                    const depositAmt = asgn.deposit_amount || quotesMap[clientId]?.deposit || 0;
                    return {
                        id: asgn.id,
                        client_id: clientId,
                        client: (asgn as any).clients?.client_name || 'Unknown',
                        client_phone: (asgn as any).clients?.phone_number || '+91 9016116564',
                        amount: `₹${depositAmt}`,
                        status: ((asgn as any).deposit_paid && (asgn as any).deposit_paid > 0) ? "Paid" : (asgn.deposit_invoice_sent ? "Invoice Sent" : "Pending Invoice"),
                        date: new Date(asgn.assigned_at || asgn.start_date || new Date()).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
                        invoice_no: "",
                        invoice_pdf_url: asgn.invoice_pdf_url
                    };
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
    };

    const fetchPayments = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('payments')
                .select('*')
                .order('payment_date', { ascending: false });
            
            if (error) throw error;
            setPayments(data || []);
        } catch (err: any) {
            console.error('Error fetching payments:', err);
            toast.error('Failed to load payment history');
        } finally {
            setIsLoading(false);
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
                // 1. Record in Payments table
                const { error: payError } = await supabase.from('payments').insert([{
                    amount: depositAmount,
                    client_name: deposit.client,
                    recorded_by: 'admin',
                    transaction_ref: `${depositMethod.toUpperCase()}-${crypto.randomUUID().replace(/-/g, '').substring(0, 8).toUpperCase()}`,
                    payment_date: new Date().toISOString(),
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

                    await supabase
                        .from('services')
                        .update({
                            deposit_amount: depositAmount,
                            deposit_status: 'collected',
                        })
                        .or(`client_id.eq.${deposit.client_id},lead_id.eq.${deposit.client_id}`);
                }

                // 4. Update local UI immediately
                setDeposits(prev => prev.map(d => d.id === activeDepositId ? { ...d, status: 'Paid' } : d));

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
        if (!collectionTarget || collectionAmount <= 0) {
            toast.error('Please enter a valid collection amount');
            return;
        }

        setIsSubmittingCollection(true);
        try {
            const success = await markServiceBillPaid({
                billId: collectionTarget.bill?.id,
                serviceId: collectionTarget.service.id,
                clientName: collectionTarget.clientName,
                amount: Number(collectionAmount),
                paymentMethod: collectionMethod,
                transactionRef: collectionRef,
                paymentDate: collectionDate,
            });

            if (!success) throw new Error('Failed to record payment in database');

            toast.success(`Payment of ₹${Number(collectionAmount).toLocaleString('en-IN')} recorded for ${collectionTarget.clientName}!`);
            setIsRecordCollectionOpen(false);
            setCollectionTarget(null);
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

    const openInvoiceModal = (bill: any) => {
        const isMonthly = !!bill.month;
        const prefix = isMonthly ? 'INV-M' : 'INV-D';
        const billToProcess = { ...bill, invoice_no: bill.invoice_no || `${prefix}${Math.floor(Math.random() * 1000) + 100}` };
        setAgentTargetBill(billToProcess);
        
        const amountNum = typeof bill.amount === 'string' ? parseFloat(bill.amount.replace(/[^\d.-]/g, '')) : bill.amount;

        setInvoiceData({
            clientName: bill.client,
            phone: bill.client_phone || '+91 9016116564',
            service: isMonthly ? `Monthly Service - ${bill.month}` : 'Security Deposit',
            amount: amountNum,
            date: new Date().toISOString(),
            invoiceNumber: billToProcess.invoice_no
        });
        
        setAgentDraftText(generateWhatsappDraft(billToProcess, agentDraftLang));
        setIsInvoiceOpen(true);
    };

    const openAgentModal = (bill: any) => {
        const billToProcess = { ...bill, invoice_no: bill.invoice_no || `INV-M${Math.floor(Math.random() * 1000) + 100}` };
        setAgentTargetBill(billToProcess);
        if (billToProcess.isDepositMode) {
            setInvoiceDepositAmount(billToProcess.amount ? billToProcess.amount.replace(/[^0-9.]/g, '') : '');
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

                const formattedPeriod = (invoiceStartDate && invoiceEndDate)
                    ? `${formatDateStr(invoiceStartDate)} To ${formatDateStr(invoiceEndDate)}`
                    : 'As agreed';

                const invResp = await fetch(`${SUPABASE_URL}/functions/v1/generate-invoice`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                    },
                    body: JSON.stringify({
                        lead_id: agentTargetBill.client_id,
                        deposit_amount: invoiceDepositAmount || 15000,
                        service_period: formattedPeriod,
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

                await supabase
                    .from('worker_assignments')
                    .update({
                        deposit_amount: Number(invoiceDepositAmount) || 15000,
                        deposit_invoice_sent: true,
                        invoice_pdf_url: invoicePdfUrl
                    })
                    .eq('id', agentTargetBill.id);

                if (agentTargetBill.client_id) {
                    await supabase
                        .from('crm_leads')
                        .update({ pipeline_stage: 'Deposit Pending' })
                        .eq('id', agentTargetBill.client_id);
                }

                toast.success(`Deposit Invoice dispatched to ${agentTargetBill.client}!`, { id: toastId, duration: 4000 });
                
                setDeposits(prev => prev.map(d => d.id === agentTargetBill.id ? { ...d, status: 'Invoice Sent', invoice_pdf_url: invoicePdfUrl, amount: `₹${Number(invoiceDepositAmount) || 15000}` } : d));

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
            const netPayable = Number(
                invoiceDepositAmount || agentTargetBill.amount?.toString().replace(/[^0-9.]/g, '') || '0',
            );

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
        const days = inclusiveDays(f.startDate, f.endDate);
        const phoneDigits = normalizePhoneDigits(f.phone);
        const rate = Number(f.ratePerDay);
        const deposit = Number(f.depositCollected || 0);

        if (!f.clientName.trim()) return 'Client name is required.';
        if (phoneDigits.length < 10) return 'Enter a valid client phone number.';
        if (!f.address.trim()) return 'Full address is required.';
        if (!f.serviceName.trim()) return 'Service name is required.';
        if (!f.startDate || !f.endDate) return 'Start date and end date are required.';
        if (days <= 0) return 'End date must be on or after the start date.';
        if (!Number.isFinite(rate) || rate <= 0) return 'Client rate/day must be greater than 0.';
        if (!Number.isFinite(deposit) || deposit < 0) return 'Deposit already collected cannot be negative.';
        return '';
    };

    const ensureManualInvoiceClient = async (mode: 'new' | 'link', match?: ClientMatch) => {
        const f = manualInvoiceForm;
        const phoneDigits = normalizePhoneDigits(f.phone);
        const normalizedPhone = phoneDigits.length === 10 ? `91${phoneDigits}` : phoneDigits;
        const days = inclusiveDays(f.startDate, f.endDate);
        const grossAmount = days * Number(f.ratePerDay);
        const notes = buildManualInvoiceNotes(f);

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
        if (clientError) throw clientError;

        const { error: consentError } = await supabase.from('client_consents').insert([{
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
        if (consentError) throw consentError;

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
            const days = inclusiveDays(manualInvoiceForm.startDate, manualInvoiceForm.endDate);
            const grossAmount = days * Number(manualInvoiceForm.ratePerDay);
            const depositCollected = Number(manualInvoiceForm.depositCollected || 0);
            const netAmount = Math.max(0, grossAmount - depositCollected);

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
                    rate_per_day: Number(manualInvoiceForm.ratePerDay),
                    deposit_collected: Number(manualInvoiceForm.depositCollected || 0),
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
                'Amount Payable': netAmount,
                'Invoice No': invData.invoice_number || '',
                'Invoice PDF': invData.public_url,
            });

            const { error: invoiceMetaError } = await supabase
                .from('crm_leads')
                .update({
                    notes: finalNotes,
                    estimated_value_monthly: netAmount,
                    status: 'Invoice Generated',
                    pipeline_stage: 'Monthly Billing',
                })
                .eq('id', leadId);
            if (invoiceMetaError) throw invoiceMetaError;

            if (depositCollected > 0) {
                const depositRef = `MANUAL-DEP-${leadId.slice(0, 8).toUpperCase()}`;
                const { data: existingDeposit, error: existingDepositError } = await supabase
                    .from('payments')
                    .select('id')
                    .eq('transaction_ref', depositRef)
                    .limit(1);
                if (existingDepositError) throw existingDepositError;

                if (!existingDeposit || existingDeposit.length === 0) {
                    const { error: depositPaymentError } = await supabase.from('payments').insert([{
                        amount: depositCollected,
                        client_name: manualInvoiceForm.clientName.trim(),
                        recorded_by: 'admin',
                        transaction_ref: depositRef,
                        payment_date: new Date().toISOString(),
                        payment_type: 'deposit',
                    }]);
                    if (depositPaymentError) throw depositPaymentError;
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
            fetchBillingData();
        } catch (err: any) {
            console.error('Manual invoice generation failed:', err);
            toast.error(err.message || 'Failed to generate manual invoice.', { id: toastId });
        } finally {
            setIsManualInvoiceGenerating(false);
        }
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
                setManualDuplicateMatches(matches);
                setIsDuplicateChoiceOpen(true);
                return;
            }
            await generateManualInvoice('new');
        } catch (err: any) {
            toast.error(err.message || 'Failed to check existing clients.');
        }
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 h-full flex flex-col space-y-6">
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
                    <div className="p-5 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                        <h2 className="font-semibold text-slate-900">Security Deposit Management</h2>
                        <span className="text-xs bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full font-semibold px-2">Auto-Receipt Logs Active</span>
                    </div>
                    <div className="flex-1 overflow-auto p-4 space-y-4">
                        {deposits.map(dep => (
                            <div key={dep.id} className="p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:shadow-sm transition-shadow">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center shrink-0">
                                        <RupeeIcon className="w-6 h-6 text-xl" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-900 flex items-center gap-2">
                                            {dep.client}
                                        </h3>
                                        <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
                                            <span className="font-semibold text-slate-700">{dep.amount}</span>
                                            <span>•</span>
                                            <span>{dep.date}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 flex-wrap">
                                    <span className={`px-3 py-1 text-xs font-semibold rounded-full ${dep.status === 'Paid' ? 'bg-emerald-100 text-emerald-700' :
                                        dep.status === 'Invoice Sent' ? 'bg-amber-100 text-amber-700' :
                                            'bg-slate-100 text-slate-700'
                                        }`}>
                                        {dep.status}
                                    </span>

                                    {dep.status === 'Pending Invoice' && (
                                        <button onClick={() => openAgentModal({ ...dep, isDepositMode: true })} className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-2">
                                            <FileText className="w-4 h-4" /> Prepare Invoice
                                        </button>
                                    )}

                                    {(dep.status === 'Invoice Sent' || dep.status === 'Paid') && (
                                        <>
                                            {dep.invoice_pdf_url && (
                                                <button onClick={() => window.open(dep.invoice_pdf_url, '_blank')} className="px-3 py-2 border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1.5">
                                                    <FileText className="w-4 h-4 text-primary" /> View PDF
                                                </button>
                                            )}
                                            <button onClick={() => openAgentModal({ ...dep, isDepositMode: true })} className="px-3 py-2 border border-amber-200 text-amber-700 bg-amber-50 text-sm font-medium rounded-lg hover:bg-amber-100 transition-colors flex items-center gap-1.5">
                                                <Send className="w-4 h-4" /> Resend Invoice
                                            </button>
                                            {dep.status === 'Invoice Sent' && (
                                                <button onClick={() => { setActiveDepositId(dep.id); setIsDepositModalOpen(true); }} className="px-3 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 text-sm font-medium rounded-lg hover:bg-emerald-100 transition-colors flex items-center gap-1.5">
                                                    <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Record Collection
                                                </button>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : activeTab === 'monthly' ? (
                /* Unified Services & Monthly Billing Lifecycle View */
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col min-h-0">
                    <ServicesPanel
                        isEmbedded
                        onOpenManualInvoice={() => {
                            setManualInvoiceForm(manualInvoiceInitialForm());
                            setManualDuplicateMatches([]);
                            setIsDuplicateChoiceOpen(false);
                            setIsManualInvoiceOpen(true);
                        }}
                        onPrepareInvoice={async (service) => {
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

                            const billObj = {
                                id: service.id,
                                client_id: service.client_id,
                                client: service.clients?.client_name || 'Client',
                                client_phone: service.clients?.phone_number || '+91 9016116564',
                                client_address: clientAddress,
                                service_category: clientServiceName,
                                shift_duration: clientShift,
                                amount: `₹${service.complete_month_daily_rate || 500}/day`,
                                status: 'Draft',
                                month: new Date().toLocaleString('default', { month: 'long' }),
                                invoice_no: '',
                                invoice_pdf_url: '',
                                rawAssignment: {
                                    id: service.id,
                                    client_id: service.client_id,
                                    employee_id: activeWorker?.employee_id,
                                    service_name: clientServiceName,
                                    client_billing_rate: service.complete_month_daily_rate || 500,
                                    complete_month_daily_rate: service.complete_month_daily_rate || 500,
                                    incomplete_month_daily_rate: service.incomplete_month_daily_rate || 1000,
                                    deposit_amount: service.deposit_amount || 0,
                                    start_date: service.start_date || '',
                                    end_date: service.end_date || '',
                                }
                            };

                            setClientInvoiceBill(billObj);
                            setCiRate(service.complete_month_daily_rate || 500);
                            setCiDeposit(service.deposit_amount || 0);

                            // 1. Determine start date: If past bills exist, start the day after latest bill's period_end
                            let startStr = service.start_date ? service.start_date.split('T')[0] : '';
                            const pastBills = service.service_bills || [];
                            if (pastBills.length > 0) {
                                const sorted = [...pastBills].filter(b => b.period_end).sort((a, b) => new Date(b.period_end).getTime() - new Date(a.period_end).getTime());
                                if (sorted.length > 0 && sorted[0].period_end) {
                                    const nextDay = new Date(sorted[0].period_end);
                                    nextDay.setDate(nextDay.getDate() + 1);
                                    startStr = nextDay.toISOString().split('T')[0];
                                }
                            }

                            // 2. Determine end date: Service end date if specified, otherwise end of calendar month for startStr
                            let endStr = service.end_date ? service.end_date.split('T')[0] : '';
                            if (!endStr && startStr) {
                                const [y, m] = startStr.split('-').map(Number);
                                const lastDay = new Date(y, m, 0);
                                endStr = `${y}-${String(m).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;
                            } else if (!endStr) {
                                endStr = new Date().toISOString().split('T')[0];
                            }

                            setCiStartDate(startStr);
                            setCiEndDate(endStr);

                            // 3. Compute initial calendar days difference
                            let calculatedDays = 1;
                            if (startStr && endStr) {
                                const d1 = new Date(startStr);
                                const d2 = new Date(endStr);
                                if (!isNaN(d1.getTime()) && !isNaN(d2.getTime()) && d2 >= d1) {
                                    calculatedDays = Math.max(1, Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)) + 1);
                                }
                            }
                            setCiDays(calculatedDays);
                            setCiAttendanceVerified(true);
                            setIsClientInvoiceOpen(true);

                            if (activeWorker?.employee_id && startStr) {
                                supabase.from('attendance')
                                    .select('status, is_half_day')
                                    .eq('worker_id', activeWorker.employee_id)
                                    .gte('duty_date', startStr)
                                    .lte('duty_date', endStr)
                                    .then(({ data }) => {
                                        if (data && data.length > 0) {
                                            const p = data.filter((a: any) => !a.is_half_day && a.status !== 'Half Day' && (a.status === 'Present' || a.status === 'present' || a.status === 'On Duty')).length;
                                            const h = data.filter((a: any) => a.is_half_day || a.status === 'Half Day').length;
                                            const attDays = p + h * 0.5;
                                            if (attDays > 0) {
                                                setCiDays(attDays);
                                                setCiAttendanceVerified(true);
                                            }
                                        }
                                    });
                            }
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
                            setCollectionRef('');
                            setCollectionDate(new Date().toISOString().split('T')[0]);
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
                            const depositPayments = payments.filter(p => p.payment_type === 'deposit' || (!p.payment_type && p.transaction_ref?.startsWith('ONLINE') || p.transaction_ref?.startsWith('UPI') || p.transaction_ref?.startsWith('CHEQUE') || p.transaction_ref?.startsWith('CASH')));
                            const servicePayments = payments.filter(p => p.payment_type === 'service' || (!p.payment_type && p.transaction_ref?.startsWith('TXN')));

                            // Filter by selected month
                            const filterByMonth = (rows: any[]) => rows.filter(p => {
                                const d = new Date(p.payment_date);
                                const rowMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                                return rowMonth === selectedMonth;
                            });

                            const rows = filterByMonth(historySubTab === 'deposit' ? depositPayments : servicePayments);
                            const color = historySubTab === 'deposit' ? 'blue' : 'emerald';

                            // Build list of available months from all payments for the nav
                            const allRows = historySubTab === 'deposit' ? depositPayments : servicePayments;
                            const availableMonths = [...new Set(allRows.map(p => {
                                const d = new Date(p.payment_date);
                                return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                            }))].sort((a, b) => b.localeCompare(a));

                            const monthLabel = (m: string) => {
                                const [y, mo] = m.split('-');
                                return new Date(Number(y), Number(mo) - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
                            };

                            // Total for selected month
                            const monthTotal = rows.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

                            return (
                                <div>
                                    {/* Record count bar with month summary */}
                                    <div className={`px-6 py-3 flex items-center gap-3 border-b flex-wrap ${color === 'blue' ? 'bg-blue-50 border-blue-100' : 'bg-emerald-50 border-emerald-100'}`}>
                                        <span className={`w-2 h-2 rounded-full inline-block shrink-0 ${color === 'blue' ? 'bg-blue-400' : 'bg-emerald-400'}`}></span>
                                        <span className={`text-xs font-bold uppercase tracking-widest ${color === 'blue' ? 'text-blue-700' : 'text-emerald-700'}`}>
                                            {historySubTab === 'deposit' ? 'Deposit Invoice History' : 'Service Invoice History'}
                                        </span>
                                        <span className="text-xs text-slate-500 font-medium">— {monthLabel(selectedMonth)}</span>
                                        <span className={`ml-auto flex items-center gap-3 text-xs font-semibold ${color === 'blue' ? 'text-blue-600' : 'text-emerald-600'}`}>
                                            <span>{rows.length} record{rows.length !== 1 ? 's' : ''}</span>
                                            {rows.length > 0 && <span className="font-bold">₹{monthTotal.toLocaleString('en-IN')}</span>}
                                        </span>
                                    </div>

                                    {/* Quick month navigation pills */}
                                    {availableMonths.length > 1 && (
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
                                            <h3 className="text-base font-bold text-slate-900 mb-1">No Records for {monthLabel(selectedMonth)}</h3>
                                            <p className="text-slate-500 text-sm max-w-xs">
                                                {availableMonths.length > 0
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
                                                    <th className="py-3 px-6 text-right">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {rows.map(payment => (
                                                    <tr key={payment.id} className="hover:bg-slate-50/50 transition-colors">
                                                        <td className="py-4 px-6 text-sm text-slate-600">
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
                                                            <span className="text-sm font-bold text-slate-900 font-mono">{payment.transaction_ref}</span>
                                                        </td>
                                                        <td className="py-4 px-6">
                                                            <span className="text-sm font-bold text-emerald-600">₹{parseFloat(payment.amount).toLocaleString('en-IN')}</span>
                                                        </td>
                                                        <td className="py-4 px-6 text-right">
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                                                Collected
                                                            </span>
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
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition-all">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200 flex flex-col">
                        <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
                                    <RupeeIcon className="w-5 h-5 text-xl font-bold" />
                                </div>
                                <div>
                                    <h2 className="text-base font-bold text-white">Record Invoice Collection</h2>
                                    <p className="text-xs text-slate-300">
                                        {collectionTarget.clientName} • {collectionTarget.invoiceNo}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    setIsRecordCollectionOpen(false);
                                    setCollectionTarget(null);
                                }}
                                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleConfirmCollection} className="p-6 space-y-4">
                            {/* Cycle info badge */}
                            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                                <div>
                                    <span className="text-slate-500 block font-medium">Billing Period</span>
                                    <span className="text-slate-800 font-bold">{collectionTarget.period}</span>
                                </div>
                                <div className="text-right">
                                    <span className="text-slate-500 block font-medium">Billed Amount</span>
                                    <span className="text-emerald-700 font-extrabold text-sm">
                                        ₹{collectionTarget.amount.toLocaleString('en-IN')}
                                    </span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                                    Amount Received (₹) <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">₹</span>
                                    <input
                                        type="number"
                                        min="1"
                                        required
                                        value={collectionAmount || ''}
                                        onChange={(e) => setCollectionAmount(parseFloat(e.target.value) || 0)}
                                        className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 text-base font-bold text-slate-800"
                                        placeholder="2500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                                    Payment Method <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={collectionMethod}
                                    onChange={(e: any) => setCollectionMethod(e.target.value)}
                                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 text-sm font-semibold text-slate-700 bg-white"
                                >
                                    <option value="UPI">UPI (GooglePay / PhonePe / Paytm / QR)</option>
                                    <option value="Cash">Cash in Hand</option>
                                    <option value="Bank Transfer">Bank Transfer (NEFT / IMPS / RTGS)</option>
                                    <option value="Cheque">Cheque</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                                        Payment Date
                                    </label>
                                    <input
                                        type="date"
                                        value={collectionDate}
                                        onChange={(e) => setCollectionDate(e.target.value)}
                                        className="w-full px-3 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 text-xs font-medium text-slate-700"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                                        Transaction Ref / Note
                                    </label>
                                    <input
                                        type="text"
                                        value={collectionRef}
                                        onChange={(e) => setCollectionRef(e.target.value)}
                                        placeholder="e.g. UPI Ref / Cashier"
                                        className="w-full px-3 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 text-xs font-medium text-slate-700"
                                    />
                                </div>
                            </div>

                            <div className="pt-3 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsRecordCollectionOpen(false);
                                        setCollectionTarget(null);
                                    }}
                                    className="flex-1 py-2.5 rounded-xl font-bold text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmittingCollection}
                                    className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white bg-slate-900 hover:bg-slate-800 transition-colors shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {isSubmittingCollection ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                    )}
                                    Confirm Collection
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
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 z-50 transition-all">
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
                                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">End Date</label>
                                            <input 
                                                type="date" 
                                                value={invoiceEndDate} 
                                                onChange={e => setInvoiceEndDate(e.target.value)} 
                                                className="w-full text-xs font-medium border border-slate-200 bg-slate-50 rounded px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-emerald-500" 
                                            />
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2">Template Preview (client_monthly_invoice)</p>
                                    <p className="text-sm text-slate-700 leading-relaxed">
                                        Hello <strong>{agentTargetBill.client}</strong>,<br/><br/>
                                        Your monthly service invoice of <strong>₹{invoiceDepositAmount || agentTargetBill.amount?.replace(/[^0-9.]/g, '') || '0'}</strong> has been generated by 99 Care.<br/><br/>
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
                                        The client can scan the QR code to securely pay {agentTargetBill?.isDepositMode ? `₹${invoiceDepositAmount || '15000'}` : agentTargetBill.amount} via their preferred UPI app.
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
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
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
                const days = inclusiveDays(manualInvoiceForm.startDate, manualInvoiceForm.endDate);
                const rate = Number(manualInvoiceForm.ratePerDay) || 0;
                const deposit = Number(manualInvoiceForm.depositCollected) || 0;
                const gross = days * rate;
                const payable = Math.max(0, gross - deposit);

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
                                            onChange={e => updateManualInvoiceForm({ startDate: e.target.value, endDate: manualInvoiceForm.endDate && manualInvoiceForm.endDate < e.target.value ? e.target.value : manualInvoiceForm.endDate })}
                                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/30"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">End Date</label>
                                        <input
                                            type="date"
                                            min={manualInvoiceForm.startDate}
                                            value={manualInvoiceForm.endDate}
                                            onChange={e => updateManualInvoiceForm({ endDate: e.target.value })}
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
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Days of Service</label>
                                        <input value={days || ''} readOnly className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-bold bg-slate-50 text-slate-700" />
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

                                <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">{days || 0} day{days !== 1 ? 's' : ''} x ₹{rate.toLocaleString('en-IN')}/day</span>
                                        <span className="font-semibold text-slate-800">₹{gross.toLocaleString('en-IN')}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">Deposit Collected</span>
                                        <span className="font-semibold text-emerald-600">− ₹{deposit.toLocaleString('en-IN')}</span>
                                    </div>
                                    <div className="flex justify-between text-base font-bold border-t border-slate-200 pt-2 mt-1">
                                        <span className="text-slate-800">Amount Payable</span>
                                        <span className="text-primary">₹{payable.toLocaleString('en-IN')}</span>
                                    </div>
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
                                <button
                                    onClick={handleManualInvoiceGenerate}
                                    disabled={isManualInvoiceGenerating}
                                    className="px-5 py-2.5 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    {isManualInvoiceGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                    Generate & Send WhatsApp
                                </button>
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
                const net = Math.max(0, total - ciDeposit);
                return (
                    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                        <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200">
                            <div className="p-5 border-b border-slate-100 bg-slate-900 flex justify-between items-center">
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
                            <div className="p-5 space-y-4">
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
                                                    const d1 = new Date(val);
                                                    const d2 = new Date(ciEndDate);
                                                    if (!isNaN(d1.getTime()) && !isNaN(d2.getTime()) && d2 >= d1) {
                                                        setCiDays(Math.max(1, Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)) + 1));
                                                    }
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
                                                    const d1 = new Date(ciStartDate);
                                                    const d2 = new Date(val);
                                                    if (!isNaN(d1.getTime()) && !isNaN(d2.getTime()) && d2 >= d1) {
                                                        setCiDays(Math.max(1, Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)) + 1));
                                                    }
                                                }
                                            }}
                                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/30"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Days of Service</label>
                                        <input type="number" min="0" step="0.5" value={ciDays} onChange={e => setCiDays(parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/30" />
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
                                <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">{ciDays} day{ciDays !== 1 ? 's' : ''} × ₹{ciRate.toLocaleString('en-IN')}/day</span>
                                        <span className="font-semibold text-slate-800">₹{total.toLocaleString('en-IN')}</span>
                                    </div>
                                    <div className="flex justify-between text-base font-bold border-t border-slate-200 pt-2 mt-1">
                                        <span className="text-slate-800">Monthly Bill Amount</span>
                                        <span className="text-primary font-black">₹{total.toLocaleString('en-IN')}</span>
                                    </div>
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
                                                amount: total.toString(),
                                                totalAmount: total,
                                                days: ciDays,
                                                rate: ciRate,
                                                startDate: ciStartDate,
                                                endDate: ciEndDate,
                                                depositCollected: 0,
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
                                                amount: total,
                                                totalAmount: total,
                                                depositCollected: 0,
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
                                            setInvoiceDepositAmount(total.toString());
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
                                                amount: total.toString(),
                                                totalAmount: total,
                                                days: ciDays,
                                                rate: ciRate,
                                                startDate: ciStartDate,
                                                endDate: ciEndDate,
                                                depositCollected: 0,
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
                                                amount: total,
                                                totalAmount: total,
                                                depositCollected: 0,
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
                                            setInvoiceDepositAmount(net.toString());
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
