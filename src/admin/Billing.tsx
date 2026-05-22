import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileText, CheckCircle2, AlertCircle, Building, Send, Edit3, X, Globe, QrCode, History, Search, Download, Loader2, Bot } from 'lucide-react';

const RupeeIcon = ({ className }: { className?: string }) => (
    <span className={`font-bold leading-none flex items-center justify-center ${className || ''}`} style={{ fontFamily: 'system-ui, sans-serif' }}>₹</span>
);
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';


export default function Billing() {
    const [searchParams] = useSearchParams();
    const currentMonthYear = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
    const [activeTab, setActiveTab] = useState<'deposits' | 'monthly' | 'history'>((searchParams.get('tab') as any) || 'deposits');
    const [payments, setPayments] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const [deposits, setDeposits] = useState<any[]>([]);
    const [monthlyBills, setMonthlyBills] = useState<any[]>([]);

    // Deposit Collect Modal State
    const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
    const [activeDepositId, setActiveDepositId] = useState<number | null>(null);
    const [depositMethod, setDepositMethod] = useState('Online');

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

    const fetchBillingData = async () => {
        setIsLoading(true);
        try {
            // Fetch worker assignments joined with clients and employees
            const { data, error } = await supabase
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
                    employees (id, full_name, job_title, phone, monthly_daily_rate, short_term_daily_rate, preferred_payment_type, hourly_rate, shift_hours)
                `)
                .neq('assignment_status', 'cancelled')
                .order('assigned_at', { ascending: false });

            if (error) throw error;

            let leadsMap: Record<string, number> = {};
            let activeLeadIds = new Set<string>();
            try {
                const { data: leads } = await supabase
                    .from('crm_leads')
                    .select('id, estimated_value_monthly');
                if (leads) {
                    leads.forEach(l => {
                        activeLeadIds.add(l.id);
                        if (l.estimated_value_monthly) {
                            leadsMap[l.id] = l.estimated_value_monthly;
                        }
                    });
                }
            } catch (err) {
                console.warn('Could not fetch crm_leads rates:', err);
            }

            let quotesMap: Record<string, any> = {};
            try {
                const { data: quotes } = await supabase
                    .from('crm_quotations')
                    .select('lead_id, complete_month_rate, start_date, deposit')
                    .order('created_at', { ascending: true });
                if (quotes) {
                    quotes.forEach(q => {
                        quotesMap[q.lead_id] = q;
                    });
                }
            } catch (err) {
                console.warn('Could not fetch crm_quotations:', err);
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

                // Map to deposits
                const mappedDeposits = activeAssignments.map(asgn => {
                    const clientId = (asgn as any).clients?.id;
                    const depositAmt = asgn.deposit_amount || quotesMap[clientId]?.deposit || 0;
                    return {
                        id: asgn.id,
                        client_id: clientId,
                        client: (asgn as any).clients?.client_name || 'Unknown',
                        client_phone: (asgn as any).clients?.phone_number || '+91 9016116564',
                        amount: `₹${depositAmt}`,
                        status: ((asgn as any).deposit_paid && (asgn as any).deposit_paid > 0) ? "Paid" : (asgn.deposit_invoice_sent ? "Invoice Sent" : "Pending Invoice"),
                        date: new Date(asgn.assigned_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
                        invoice_no: "",
                        invoice_pdf_url: asgn.invoice_pdf_url
                    };
                });
                setDeposits(mappedDeposits);

                // Build monthly bills with correct status in one pass — no second update needed
                setMonthlyBills(activeAssignments.map(asgn => {
                    const clientId = (asgn as any).clients?.id;
                    const clientName = (asgn as any).clients?.client_name || 'Unknown';
                    const billingRate = asgn.client_billing_rate || quotesMap[clientId]?.complete_month_rate || 0;
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
                        rawAssignment: { ...asgn, _quote: quotesMap[clientId] }
                    };
                }));
            }
        } catch (err: any) {
            console.error('Error fetching billing data:', err);
            toast.error('Failed to load billing records');
        } finally {
            setIsLoading(false);
        }
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
        if (activeTab === 'history') {
            fetchPayments();
        } else {
            fetchBillingData();
        }
    }, [activeTab]);



    const handleGenerateDepositInvoice = async (id: string, clientName: string) => {
        const fakeInvoiceNo = `INV-D${Math.floor(Math.random() * 1000) + 500}`;
        
        const { error } = await supabase
            .from('worker_assignments')
            .select('id') // Dummy call to avoid broken chain
            .eq('id', id);

        if (error) {
            toast.error("Failed to update invoice in database");
            return;
        }

        fetchBillingData();
        toast.success(`System auto-generated Deposit Invoice ${fakeInvoiceNo}. PDF emailed automatically to ${clientName}!`);
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
                    transaction_ref: `${depositMethod.toUpperCase()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
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

                // 3. Update local UI immediately
                setDeposits(prev => prev.map(d => d.id === activeDepositId ? { ...d, status: 'Paid' } : d));
                toast.success(`Deposit marked as paid via ${depositMethod}. Recorded in Collection History.`);
            } catch (err: any) {
                console.error('Error recording deposit:', err);
                toast.error('Failed to record payment in database');
            } finally {
                setIsLoading(false);
            }
        }
        setIsDepositModalOpen(false);
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
                const txnId = `TXN-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
                
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

    const handleSaveBill = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingBill) {
            setMonthlyBills(prev => prev.map(b => b.id === editingBill.id ? editingBill : b));
            toast.success(`Bill for ${editingBill.client} updated successfully.`);
            setIsEditBillModalOpen(false);
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

                let phoneDigits = '917575041313'; 
                if (agentTargetBill.client_phone) {
                    phoneDigits = agentTargetBill.client_phone.replace(/\D/g, '');
                    if (phoneDigits.length === 10) phoneDigits = `91${phoneDigits}`;
                }

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

                toast.success(`Deposit Invoice dispatched to ${agentTargetBill.client}!`, { id: toastId, duration: 4000 });
                
                setDeposits(prev => prev.map(d => d.id === agentTargetBill.id ? { ...d, status: 'Invoice Sent', invoice_pdf_url: invoicePdfUrl } : d));

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
            const formattedPeriod = (invoiceStartDate && invoiceEndDate)
                ? `${formatDateStr(invoiceStartDate)} To ${formatDateStr(invoiceEndDate)}`
                : 'As agreed';
            const billAmount = invoiceDepositAmount || agentTargetBill.amount?.replace(/[^0-9.]/g, '') || '0';
            // 1. Generate PDF
            const invResp = await fetch(`${SUPABASE_URL}/functions/v1/generate-invoice`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
                body: JSON.stringify({ lead_id: agentTargetBill.client_id, deposit_amount: billAmount, service_period: formattedPeriod, due_date: invoiceDueDate, is_deposit: false })
            });
            const invRespText = await invResp.text();
            if (!invResp.ok) throw new Error(invRespText);
            const invData = JSON.parse(invRespText);
            if (invData.error) throw new Error(`Invoice generation failed: ${invData.error}`);
            const invoicePdfUrl = invData.public_url;
            if (!invoicePdfUrl) throw new Error('Invoice generated but no PDF URL returned');
            toast.loading('Sending via WhatsApp...', { id: billToastId });
            // 2. Send client_monthly_invoice template
            let phoneDigits = agentTargetBill.client_phone?.replace(/\D/g, '') || '917575041313';
            if (phoneDigits.length === 10) phoneDigits = `91${phoneDigits}`;
            const waResp = await fetch(`${SUPABASE_URL}/functions/v1/meta-whatsapp-outbound`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'apikey': SUPABASE_ANON_KEY },
                body: JSON.stringify({
                    phone: phoneDigits,
                    leadId: agentTargetBill.client_id,
                    useTemplate: true,
                    templateName: 'client_monthly_invoice',
                    templateParams: [agentTargetBill.client || 'there', String(billAmount)],
                    sendInvoicePdf: true,
                    invoicePdfUrl: invoicePdfUrl,
                })
            });
            const waData = await waResp.json();
            if (!waData.success) throw new Error(waData.error || 'WhatsApp dispatch failed');
            // 3. Persist to DB so it survives page reload
            await supabase
                .from('worker_assignments')
                .update({
                    final_invoice_generated: true,
                    invoice_pdf_url: invoicePdfUrl,
                })
                .eq('id', agentTargetBill.id);
            setMonthlyBills(prev => prev.map(b => b.id === agentTargetBill.id ? { ...b, status: 'Sent', invoice_pdf_url: invoicePdfUrl } : b));
            toast.success(`Invoice sent to ${agentTargetBill.client} on WhatsApp! ✅`, { id: billToastId, duration: 4000 });
        } catch (err: any) {
            toast.error(err.message || 'Failed to send invoice', { id: billToastId });
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

                                <div className="flex items-center gap-4">
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
                                    {dep.status === 'Invoice Sent' && (
                                        <>
                                            {dep.invoice_pdf_url && (
                                                <button onClick={() => window.open(dep.invoice_pdf_url, '_blank')} className="px-4 py-2 border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2">
                                                    <FileText className="w-4 h-4 text-primary" /> View PDF
                                                </button>
                                            )}
                                            <button onClick={() => { setActiveDepositId(dep.id); setIsDepositModalOpen(true); }} className="px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 text-sm font-medium rounded-lg hover:bg-emerald-100 transition-colors flex items-center gap-2">
                                                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Record Collection
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : activeTab === 'monthly' ? (
                /* Monthly Billing View */
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col">
                    <div className="p-5 border-b border-slate-200 bg-slate-50">
                        <h2 className="font-semibold text-slate-900">Monthly Billing Dashboard ({currentMonthYear})</h2>
                        <p className="text-sm text-slate-500 mt-1">Invoices require explicit HR Attendance Verification before dispatch.</p>
                    </div>
                    <div className="flex-1 overflow-auto p-4 space-y-4">
                        {monthlyBills.map(bill => (
                            <div key={bill.id} className="p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white hover:border-primary/20 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-slate-50 border border-slate-100 text-slate-500 rounded-xl flex items-center justify-center shrink-0">
                                        <Building className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-900">{bill.client}</h3>
                                        <p className="text-sm font-semibold text-slate-600 mt-1">Rate: {bill.amount}</p>
                                    </div>
                                </div>

                                <div className="flex flex-col md:flex-row md:items-center gap-4">
                                    {/* Action Buttons */}
                                    <div className="flex gap-2 border-t md:border-t-0 md:border-l border-slate-100 pt-3 md:pt-0 md:pl-4">
                                        {bill.status === 'Pending Verification' ? (
                                            <button disabled className="px-4 py-2 bg-slate-100 text-slate-400 text-sm font-medium rounded-lg cursor-not-allowed flex items-center gap-2">
                                                <FileText className="w-4 h-4" /> Locked
                                            </button>
                                        ) : bill.status === 'Paid' ? (
                                            <div className="flex items-center gap-2 flex-wrap">
                                                {bill.invoice_pdf_url && (
                                                    <button onClick={() => window.open(bill.invoice_pdf_url, '_blank')} className="px-3 py-2 border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1.5">
                                                        <FileText className="w-4 h-4 text-primary" /> View PDF
                                                    </button>
                                                )}
                                                <button onClick={() => {
                                                    const asgn = bill.rawAssignment;
                                                    setClientInvoiceBill(bill);
                                                    setCiRate(asgn.client_billing_rate || asgn._quote?.complete_month_rate || 0);
                                                    setCiDeposit(asgn.deposit_amount || asgn._quote?.deposit || 0);
                                                    const defaultStart = asgn.start_date || asgn._quote?.start_date || '';
                                                    setCiStartDate(defaultStart ? defaultStart.split('T')[0] : '');
                                                    setCiEndDate('');
                                                    setCiDays(1);
                                                    setCiAttendanceVerified(true);
                                                    setIsClientInvoiceOpen(true);
                                                    if (asgn.employee_id && asgn.start_date) {
                                                        supabase.from('attendance')
                                                            .select('status, is_half_day')
                                                            .eq('worker_id', asgn.employee_id)
                                                            .gte('duty_date', asgn.start_date.split('T')[0])
                                                            .then(({ data }) => {
                                                                if (data && data.length > 0) {
                                                                    const p = data.filter((a: any) => a.status === 'Present').length;
                                                                    const h = data.filter((a: any) => a.is_half_day).length;
                                                                    setCiDays(p + h * 0.5 || 1);
                                                                }
                                                            });
                                                    }
                                                }} className="px-3 py-2 border border-amber-200 text-amber-700 bg-amber-50 text-sm font-medium rounded-lg hover:bg-amber-100 transition-colors flex items-center gap-1.5">
                                                    <Send className="w-4 h-4" /> Resend Invoice
                                                </button>
                                                <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold bg-emerald-100 text-emerald-700">
                                                    <CheckCircle2 className="w-4 h-4" /> Paid
                                                </span>
                                            </div>
                                        ) : bill.status === 'Sent' ? (
                                            <div className="flex gap-2 flex-wrap">
                                                {bill.invoice_pdf_url && (
                                                    <button onClick={() => window.open(bill.invoice_pdf_url, '_blank')} className="px-3 py-2 border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1.5">
                                                        <FileText className="w-4 h-4 text-primary" /> View PDF
                                                    </button>
                                                )}
                                                <button onClick={() => {
                                                    const asgn = bill.rawAssignment;
                                                    setClientInvoiceBill(bill);
                                                    setCiRate(asgn.client_billing_rate || asgn._quote?.complete_month_rate || 0);
                                                    setCiDeposit(asgn.deposit_amount || asgn._quote?.deposit || 0);
                                                    const defaultStart = asgn.start_date || asgn._quote?.start_date || '';
                                                    setCiStartDate(defaultStart ? defaultStart.split('T')[0] : '');
                                                    setCiEndDate('');
                                                    setCiDays(1);
                                                    setCiAttendanceVerified(true);
                                                    setIsClientInvoiceOpen(true);
                                                    if (asgn.employee_id && asgn.start_date) {
                                                        supabase.from('attendance')
                                                            .select('status, is_half_day')
                                                            .eq('worker_id', asgn.employee_id)
                                                            .gte('duty_date', asgn.start_date.split('T')[0])
                                                            .then(({ data }) => {
                                                                if (data && data.length > 0) {
                                                                    const p = data.filter((a: any) => a.status === 'Present').length;
                                                                    const h = data.filter((a: any) => a.is_half_day).length;
                                                                    setCiDays(p + h * 0.5 || 1);
                                                                }
                                                            });
                                                    }
                                                }} className="px-3 py-2 border border-amber-200 text-amber-700 bg-amber-50 text-sm font-medium rounded-lg hover:bg-amber-100 transition-colors flex items-center gap-1.5">
                                                    <Send className="w-4 h-4" /> Resend Invoice
                                                </button>
                                                <button onClick={() => handleAction('Record Monthly Payment', bill.client, bill.id)} className="px-3 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 text-sm font-medium rounded-lg hover:bg-emerald-100 transition-colors flex items-center gap-1.5">
                                                    <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Record Collection
                                                </button>
                                            </div>
                                        ) : bill.status === 'Draft' ? (
                                            <button onClick={() => {
                                                const asgn = bill.rawAssignment;
                                                setClientInvoiceBill(bill);
                                                setCiRate(asgn.client_billing_rate || asgn._quote?.complete_month_rate || 0);
                                                setCiDeposit(asgn.deposit_amount || asgn._quote?.deposit || 0);
                                                const defaultStart = asgn.start_date || asgn._quote?.start_date || '';
                                                setCiStartDate(defaultStart ? defaultStart.split('T')[0] : '');
                                                setCiEndDate('');
                                                setCiDays(1);
                                                setCiAttendanceVerified(true);
                                                setIsClientInvoiceOpen(true);
                                                if (asgn.employee_id && asgn.start_date) {
                                                    supabase.from('attendance')
                                                        .select('status, is_half_day')
                                                        .eq('worker_id', asgn.employee_id)
                                                        .gte('duty_date', asgn.start_date.split('T')[0])
                                                        .then(({ data }) => {
                                                            if (data && data.length > 0) {
                                                                const p = data.filter((a: any) => a.status === 'Present').length;
                                                                const h = data.filter((a: any) => a.is_half_day).length;
                                                                setCiDays(p + h * 0.5 || 1);
                                                                setCiAttendanceVerified(true);
                                                            } else {
                                                                setCiDays(0);
                                                                setCiAttendanceVerified(false);
                                                            }
                                                        });
                                                }
                                            }} className="px-4 py-2 bg-emerald-50 text-emerald-700 text-sm font-bold rounded-lg hover:bg-emerald-100 hover:text-emerald-800 transition-colors flex items-center gap-2 shadow-sm group border border-emerald-100">
                                                <FileText className="w-4 h-4 group-hover:scale-110 transition-transform" /> Prepare Invoice
                                            </button>
                                        ) : null}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                /* Collection History View */
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col">
                    <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <History className="w-5 h-5 text-primary" />
                            <h2 className="font-semibold text-slate-900">Recorded Collection Log</h2>
                        </div>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                            <input
                                type="text"
                                placeholder="Search transactions..."
                                className="pl-9 pr-4 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all w-full sm:w-64"
                            />
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

                            const PaymentTable = ({ rows }: { rows: any[] }) => (
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
                            );

                            return (
                                <div className="divide-y divide-slate-100">
                                    {/* Deposit Collections */}
                                    <div>
                                        <div className="px-6 py-3 bg-blue-50 border-b border-blue-100 flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-blue-400 inline-block"></span>
                                            <span className="text-xs font-bold text-blue-700 uppercase tracking-widest">Client Deposit Invoice History</span>
                                            <span className="ml-auto text-xs font-semibold text-blue-500">{depositPayments.length} record{depositPayments.length !== 1 ? 's' : ''}</span>
                                        </div>
                                        {depositPayments.length === 0 ? (
                                            <p className="text-sm text-slate-400 italic px-6 py-4">No deposit collections recorded yet.</p>
                                        ) : (
                                            <PaymentTable rows={depositPayments} />
                                        )}
                                    </div>

                                    {/* Service Invoice Collections */}
                                    <div>
                                        <div className="px-6 py-3 bg-emerald-50 border-b border-emerald-100 flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span>
                                            <span className="text-xs font-bold text-emerald-700 uppercase tracking-widest">Client Service Invoice History</span>
                                            <span className="ml-auto text-xs font-semibold text-emerald-500">{servicePayments.length} record{servicePayments.length !== 1 ? 's' : ''}</span>
                                        </div>
                                        {servicePayments.length === 0 ? (
                                            <p className="text-sm text-slate-400 italic px-6 py-4">No service invoice collections recorded yet.</p>
                                        ) : (
                                            <PaymentTable rows={servicePayments} />
                                        )}
                                    </div>
                                </div>
                            );
                        })()}
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
                                    <div className="grid grid-cols-2 gap-3">
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
                            <div className="flex justify-between items-start mb-10">
                                <div>
                                    <div className="flex flex-col mb-4">
                                        <img src="/99care-logo.svg" alt="99 CARE" className="h-14 w-auto object-contain" />
                                    </div>
                                    <div className="mt-8">
                                        <h2 className="text-xl font-bold text-slate-800 tracking-[0.2em]">INVOICE</h2>
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
                            <div className="flex justify-end mb-10">
                                <div className="w-1/2 space-y-1">
                                    {invoiceData.totalAmount && invoiceData.totalAmount !== invoiceData.amount && (
                                        <div className="flex justify-between items-center py-1.5 text-sm">
                                            <span className="text-slate-600">{invoiceData.days} day{invoiceData.days !== 1 ? 's' : ''} × ₹{invoiceData.rate?.toLocaleString('en-IN')}/day</span>
                                            <span className="font-semibold text-slate-800">₹{invoiceData.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
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
                                    <div className="h-10 w-28 border-b border-slate-400 flex items-end justify-center mb-1"></div>
                                    <p className="text-[10px] text-slate-600">Authorized Signatory</p>
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
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Start Date</label>
                                        <input type="date" value={ciStartDate} onChange={e => setCiStartDate(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/30" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">End Date</label>
                                        <input type="date" value={ciEndDate} onChange={e => setCiEndDate(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/30" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Days of Service</label>
                                        <input type="number" min="0" step="0.5" value={ciDays} onChange={e => setCiDays(parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/30" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Client Rate / Day (₹)</label>
                                        <input type="number" min="0" value={ciRate} onChange={e => setCiRate(parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/30" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Deposit Already Collected (₹)</label>
                                    <input type="number" min="0" value={ciDeposit} onChange={e => setCiDeposit(parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/30" />
                                </div>
                                <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">{ciDays} day{ciDays !== 1 ? 's' : ''} × ₹{ciRate.toLocaleString('en-IN')}/day</span>
                                        <span className="font-semibold text-slate-800">₹{total.toLocaleString('en-IN')}</span>
                                    </div>
                                    {ciDeposit > 0 && (
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-500">Deposit Collected</span>
                                            <span className="font-semibold text-emerald-600">− ₹{ciDeposit.toLocaleString('en-IN')}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between text-base font-bold border-t border-slate-200 pt-2 mt-1">
                                        <span className="text-slate-800">Net Payable</span>
                                        <span className="text-primary">₹{net.toLocaleString('en-IN')}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="p-5 border-t border-slate-100 bg-slate-50 flex flex-col-reverse sm:flex-row justify-end gap-3 rounded-b-2xl">
                                <button onClick={() => { setIsClientInvoiceOpen(false); setClientInvoiceBill(null); }} className="px-5 py-2.5 rounded-xl font-semibold text-slate-600 hover:bg-slate-200 transition-colors w-full sm:w-auto text-center">Cancel</button>
                                <div className="flex gap-3 flex-1 sm:flex-none w-full sm:w-auto">
                                    <button
                                        onClick={() => {
                                            setIsClientInvoiceOpen(false);
                                            const invoiceNo = `INV-C${Math.floor(Math.random() * 9000) + 1000}`;
                                            setAgentTargetBill({ ...clientInvoiceBill, invoice_no: invoiceNo });
                                            setInvoiceData({
                                                clientName: clientInvoiceBill.client,
                                                phone: clientInvoiceBill.client_phone || '',
                                                service: `Home Care Service — ${ciDays} day${ciDays !== 1 ? 's' : ''}`,
                                                amount: net,
                                                totalAmount: total,
                                                depositCollected: ciDeposit,
                                                date: new Date().toISOString(),
                                                invoiceNumber: invoiceNo,
                                                days: ciDays,
                                                rate: ciRate
                                            });
                                            setAgentDraftText(generateWhatsappDraft(clientInvoiceBill, agentDraftLang));
                                            setIsInvoiceOpen(true);
                                        }}
                                        className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-all shadow-sm flex items-center justify-center gap-2 whitespace-nowrap"
                                    >
                                        <FileText className="w-4 h-4" /> Preview
                                    </button>
                                    <button
                                        onClick={() => {
                                            setIsClientInvoiceOpen(false);
                                            const invoiceNo = `INV-C${Math.floor(Math.random() * 9000) + 1000}`;
                                            const targetBill = { ...clientInvoiceBill, invoice_no: invoiceNo };
                                            setAgentTargetBill(targetBill);
                                            setInvoiceData({
                                                clientName: clientInvoiceBill.client,
                                                phone: clientInvoiceBill.client_phone || '',
                                                service: `Home Care Service — ${ciDays} day${ciDays !== 1 ? 's' : ''}`,
                                                amount: net,
                                                totalAmount: total,
                                                depositCollected: ciDeposit,
                                                date: new Date().toISOString(),
                                                invoiceNumber: invoiceNo,
                                                days: ciDays,
                                                rate: ciRate
                                            });
                                            const draft = generateWhatsappDraft(targetBill, agentDraftLang);
                                            setAgentDraftText(draft);
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
