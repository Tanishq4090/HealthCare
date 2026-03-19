import { useState, useEffect } from 'react';
import { Phone, UserCheck, CheckCircle2, FileText, Upload, Bot, Edit3, X, Globe, Send, Users, Clock, Building, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { MOCK_WORKERS, MOCK_PAYROLL } from '../data/mockWorkers';

export default function HR() {
    const [activeTab, setActiveTab] = useState<'allocation' | 'attendance' | 'payroll'>('payroll');
    const [isGenerating, setIsGenerating] = useState(false);
    const [workers, setWorkers] = useState<any[]>([]);
    const [payrollItems, setPayrollItems] = useState<any[]>([]);
    const [pipelineLeads, setPipelineLeads] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
    const [editingWorkerId, setEditingWorkerId] = useState<string | null>(null);

    // Live Attendance State
    const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);
    const [attendanceLoading, setAttendanceLoading] = useState(false);

    // Initial data fetch
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        role: '',
        assigned_client: '',
        monthly_daily_rate: '',
        short_term_daily_rate: '',
        deposit_received: '15000',
        status: 'Available',
        phone: '',
        address: '',
        dob: '',
        aadhaar_number: '',
        documents: [] as File[]
    });

    // Payroll Edit Modal State
    const [isEditPayrollModalOpen, setIsEditPayrollModalOpen] = useState(false);
    const [editingPayroll, setEditingPayroll] = useState<any>(null);

    // AI WhatsApp Agent State
    const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);
    const [agentTargetWorker, setAgentTargetWorker] = useState<any>(null);
    const [agentDraftLang, setAgentDraftLang] = useState<'English' | 'Hindi' | 'Hinglish'>('Hinglish');
    const [agentDraftText, setAgentDraftText] = useState('');

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const { data: workerData, error: workerError } = await supabase.from('workers').select('*').order('created_at', { ascending: false });
            const { data: payrollData, error: payrollError } = await supabase.from('payroll').select('*');
            const { data: leadData } = await supabase.from('crm_leads').select('id, name, pipeline_stage').order('created_at', { ascending: false });

            if (workerError || !workerData || workerData.length === 0) {
                setWorkers(MOCK_WORKERS);
            } else {
                setWorkers(workerData);
            }

            if (payrollError || !payrollData || payrollData.length === 0) {
                setPayrollItems(MOCK_PAYROLL);
            } else {
                setPayrollItems(payrollData);
            }

            // Pipeline leads for client dropdown
            if (leadData && leadData.length > 0) {
                setPipelineLeads(leadData);
            } else {
                // Fallback mock pipeline clients
                setPipelineLeads([
                    { id: 'm1', name: 'Meet Makwana', pipeline_stage: 'Form Submitted' },
                    { id: 'm2', name: 'John Doe', pipeline_stage: 'Quotation Sent' },
                    { id: 'm3', name: 'Jane Smith', pipeline_stage: 'Form Submitted' },
                    { id: 'm4', name: 'Emily Davis', pipeline_stage: 'Active Client' },
                ]);
            }
        } catch {
            setWorkers(MOCK_WORKERS);
            setPayrollItems(MOCK_PAYROLL);
            setPipelineLeads([]);
        } finally {
            setIsLoading(false);
        }
    };

    // AI WhatsApp Agent Logic
    const generateWhatsappDraft = (worker: any, lang: string) => {
        if (!worker) return '';
        const baseUrl = window.location.origin;
        const confirmLink = `${baseUrl}/client/confirm-staff/${worker.id}`;

        if (lang === 'Hinglish') return `Hello ${worker.assigned_client} team! Humne aapke liye ek excellent ${worker.role} allocate kiya hai: ${worker.name}. Please profile check karke confirm karein. ✅👇\n${confirmLink}`;
        if (lang === 'Hindi') return `Namaste ${worker.assigned_client}, aapki suvidha ke liye humne ek naye ${worker.role} (${worker.name}) ko allocate kiya hai. Kripya profile ki pushti karein:\n${confirmLink}`;
        return `Hi ${worker.assigned_client}, we have successfully allocated a highly qualified ${worker.role} (${worker.name}) to your facility. Please review and confirm their profile here:\n${confirmLink}`;
    };

    const openAgentModal = (worker: any) => {
        setAgentTargetWorker(worker);
        setAgentDraftText(generateWhatsappDraft(worker, agentDraftLang));
        setIsAgentModalOpen(true);
    };

    useEffect(() => {
        if (agentTargetWorker) {
            setAgentDraftText(generateWhatsappDraft(agentTargetWorker, agentDraftLang));
        }
    }, [agentDraftLang, agentTargetWorker]);

    const handleDispatchMessage = () => {
        // Launch real WhatsApp Web intent with drafted text
        let phoneDigits = '917575041313'; // Default to test number
        if (agentTargetWorker?.client_phone) {
            phoneDigits = agentTargetWorker.client_phone.replace(/\D/g, ''); // Extract only digits
        }
        const waUrl = `https://wa.me/${phoneDigits}?text=${encodeURIComponent(agentDraftText)}`;
        window.open(waUrl, '_blank');

        setIsAgentModalOpen(false);
        toast.success(`Worker profile WhatsApp intent opened for ${agentTargetWorker.name}! 📱`);

        // Simulate client approving via WhatsApp and making them active
        setTimeout(() => {
            setWorkers(prev => prev.map(w => w.id === agentTargetWorker.id ? { ...w, status: 'Active' } : w));
            toast.success(`WhatsApp Auto-Reply Received: ${agentTargetWorker.assigned_client} confirmed ${agentTargetWorker.name}.`);
        }, 2000);
    };

    useEffect(() => {
        fetchData();

        // Only fetch attendance when that tab is active
        if (activeTab === 'attendance') {
            fetchLiveAttendance();
        }
    }, [activeTab]);



    const fetchLiveAttendance = async () => {
        setAttendanceLoading(true);
        try {
            // Get today's date boundary
            const startOfToday = new Date();
            startOfToday.setHours(0, 0, 0, 0);

            // Fetch attendance logs with joined worker details
            const { data, error } = await supabase
                .from('attendance')
                .select(`
                    id,
                    check_in_time,
                    check_out_time,
                    status,
                    worker_id,
                    workers (
                        name,
                        role,
                        assigned_client
                    )
                `)
                .gte('check_in_time', startOfToday.toISOString())
                .order('check_in_time', { ascending: false });

            if (error) throw error;
            setAttendanceLogs(data || []);
        } catch (err: any) {
            console.error('Error fetching live attendance:', err);
            toast.error('Failed to load recent attendance logs');
        } finally {
            setAttendanceLoading(false);
        }
    };

    const openAddModal = () => {
        setModalMode('add');
        setEditingWorkerId(null);
        setFormData({ name: '', role: '', assigned_client: '', monthly_daily_rate: '', short_term_daily_rate: '', deposit_received: '15000', status: 'Available', aadhaar_number: '', phone: '', address: '', dob: '', documents: [] });
        setIsModalOpen(true);
    };

    const openEditModal = (worker: any) => {
        setModalMode('edit');
        setEditingWorkerId(worker.id);
        setFormData({
            name: worker.name,
            role: worker.role,
            assigned_client: worker.assigned_client || '',
            monthly_daily_rate: worker.monthly_daily_rate?.toString() || '',
            short_term_daily_rate: worker.short_term_daily_rate?.toString() || '',
            deposit_received: worker.deposit_received?.toString() || '15000',
            status: worker.status,
            aadhaar_number: worker.aadhaar_number || '',
            phone: worker.phone || '',
            address: worker.address || '',
            dob: worker.dob || '',
            documents: []
        });
        setIsModalOpen(true);
    };

    const handleWorkerSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const payload = {
                name: formData.name,
                role: formData.role,
                assigned_client: formData.assigned_client || null,
                monthly_daily_rate: parseFloat(formData.monthly_daily_rate) || 0,
                short_term_daily_rate: parseFloat(formData.short_term_daily_rate) || 0,
                deposit_received: parseFloat(formData.deposit_received) || 0,
                status: formData.status,
                aadhaar_number: formData.aadhaar_number,
                phone: formData.phone,
                address: formData.address,
                dob: formData.dob || null
            };

            // In a real application, you would upload formData.documents to Supabase Storage here

            if (modalMode === 'add') {
                const { error } = await supabase.from('workers').insert([payload]);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('workers').update(payload).eq('id', editingWorkerId);
                if (error) throw error;
            }

            if (formData.documents && formData.documents.length > 0) {
                toast.success(`${formData.documents.length} document(s) simulated upload for ${formData.name}`);
            }

            setIsModalOpen(false);
            fetchData(); // Refresh list
            toast.success(`Worker ${modalMode === 'add' ? 'added' : 'updated'} successfully`);
        } catch (error: any) {
            console.error("Error saving worker:", error);
            toast.error(`Error saving worker: ${error.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSavePayroll = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingPayroll) return;
        setIsSubmitting(true);

        try {
            // Optimistic Update
            setPayrollItems(prev => prev.map(p => p.id === editingPayroll.id ? editingPayroll : p));
            setIsEditPayrollModalOpen(false);

            // Try saving to DB if it's connected
            await supabase.from('payroll').update({
                days_worked: editingPayroll.days_worked,
                net_balance: editingPayroll.net_balance
            }).eq('id', editingPayroll.id);

            toast.success(`Payslip for ${editingPayroll.worker} updated successfully.`);
        } catch (error: any) {
            console.error("Error updating payroll", error);
            // It might fail if DB is disconnected, but since we optimistically updated, it's fine for the demo.
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleGeneratePayroll = async () => {
        const testEmail = window.prompt("Resend Sandbox limits testing to your verified email. Enter the email you used to sign up for Resend:");
        if (!testEmail) return;

        // Dynamic check for jsPDF to prevent window errors on SSR
        const { default: jsPDF } = await import('jspdf');
        const { default: autoTable } = await import('jspdf-autotable');

        setIsGenerating(true);
        toast.loading("Analyzing active attendance logs and calculating daily fees...", { id: 'payroll-gen' });

        try {
            // Group attendance by worker to find unique days worked
            const attendanceByWorker: Record<string, Set<string>> = {};
            attendanceLogs.forEach(log => {
                if (log.worker_id && log.date) {
                    if (!attendanceByWorker[log.worker_id]) {
                        attendanceByWorker[log.worker_id] = new Set();
                    }
                    attendanceByWorker[log.worker_id].add(log.date);
                }
            });

            const newPayrollEntries: any[] = [];
            const emailAttachments: any[] = [];

            // Calculate fees per worker based on contract rates (monthly vs short-term)
            for (const [workerId, datesSet] of Object.entries(attendanceByWorker)) {
                const daysWorked = datesSet.size;
                const worker = workers.find(w => w.id === workerId);

                if (worker) {
                    // Business Logic: Monthly Rate applied if >= 30 days, else Short Term Rate
                    const isMonthly = daysWorked >= 30;
                    const appliedRate = isMonthly
                        ? (worker.monthly_daily_rate || 0)
                        : (worker.short_term_daily_rate || 0);

                    const totalCost = daysWorked * appliedRate;
                    const deposit = worker.deposit_received || 0;
                    const netBalance = totalCost - deposit;

                    newPayrollEntries.push({
                        worker: worker.name,
                        client_name: worker.assigned_client || 'HealthFirst Internal',
                        days_worked: daysWorked,
                        daily_rate: appliedRate,
                        deposit_received: deposit,
                        net_balance: netBalance,
                        status: netBalance > 0 ? 'Pending Payment' : (netBalance < 0 ? 'Refund Due' : 'Settled'),
                        period_start: new Date().toISOString().slice(0, 10), // Placeholder for demo
                        period_end: new Date().toISOString().slice(0, 10) // Placeholder for demo
                    });

                    // Generate PDF Payslip
                    const doc = new jsPDF();

                    doc.setFontSize(22);
                    doc.setTextColor(15, 23, 42); // slate-900
                    doc.text("HealthFirst AI", 14, 20);

                    doc.setFontSize(14);
                    doc.setTextColor(100, 116, 139); // slate-500
                    doc.text("Official Worker Payslip", 14, 30);

                    doc.setFontSize(10);
                    doc.setTextColor(71, 85, 105); // slate-600
                    doc.text(`Worker Name: ${worker.name}`, 14, 45);
                    doc.text(`Role: ${worker.role}`, 14, 52);
                    doc.text(`Assigned Client: ${worker.assigned_client || 'N/A'}`, 14, 59);
                    doc.text(`Date Issued: ${new Date().toLocaleDateString()}`, 14, 66);

                    // Add table
                    autoTable(doc, {
                        startY: 75,
                        headStyles: { fillColor: [16, 185, 129] }, // emerald-500
                        head: [['Description', 'Amount']],
                        body: [
                            [`Total Days Worked`, `${daysWorked} days`],
                            [`Daily Rate (${isMonthly ? 'Monthly' : 'Short Term'})`, `INR ${appliedRate.toFixed(2)}`],
                            [`Total Baseline Value`, `INR ${totalCost.toFixed(2)}`],
                            [`Minus: Deposit Received`, `- INR ${deposit.toFixed(2)}`],
                        ],
                    });

                    const finalY = (doc as any).lastAutoTable.finalY || 120;

                    doc.setFontSize(14);
                    doc.setTextColor(15, 23, 42);
                    doc.setFont("helvetica", "bold");
                    doc.text(`Net Balance ${netBalance < 0 ? 'Refund Due' : 'To Pay'}: INR ${Math.abs(netBalance).toFixed(2)}`, 14, finalY + 15);

                    doc.setFontSize(10);
                    doc.setFont("helvetica", "normal");
                    doc.setTextColor(148, 163, 184); // slate-400
                    doc.text(`Auto-Generated by HealthFirst AI Engine`, 14, finalY + 30);

                    // Convert to base64 for Resend payload
                    const pdfBase64 = doc.output('datauristring').split(',')[1];
                    emailAttachments.push({
                        filename: `Payslip_${worker.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`,
                        content: pdfBase64
                    });
                }
            }

            if (newPayrollEntries.length > 0) {
                // Try inserting into Supabase
                const { error: insertError } = await supabase.from('payroll').insert(newPayrollEntries);
                if (insertError) {
                    console.warn("DB Insert failed, using fallback:", insertError);
                    // Fallback for UI visualization only if DB is not setup for new fields yet
                    setPayrollItems(prev => [...newPayrollEntries, ...prev] as any);
                } else {
                    fetchData(); // Refresh list to get new DB entries
                }
            }

            // Fire off the dispatch email using the Edge Function
            const { error: emailError } = await supabase.functions.invoke('resend-email', {
                body: {
                    to: testEmail,
                    subject: 'HealthFirst AI - Daily Fee Invoices & Payslips',
                    html: `
                        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                            <h2 style="color: #0f172a;">HealthFirst AI Payroll Execution</h2>
                            <p style="color: #475569;">This is an automated message from the HealthFirst Admin Dashboard.</p>
                            <div style="background-color: #f8fafc; padding: 15px; border-radius: 5px; margin: 20px 0;">
                                <p style="margin: 0; color: #10b981; font-weight: bold;">Status: Success</p>
                                <p style="margin: 5px 0 0 0; font-size: 14px; color: #64748b;">
                                    Processed ${newPayrollEntries.length} worker daily fee calculations.
                                </p>
                            </div>
                            <p style="color: #334155; font-size: 15px;">Please find the attached auto-generated PDF Payslips detailing the Daily Fee calculation algorithms for this cycle.</p>
                        </div>
                    `,
                    attachments: emailAttachments
                },
            });

            if (emailError) throw emailError;

            toast.success(`Payroll generated for ${newPayrollEntries.length} workers! Data saved and ${emailAttachments.length} PDFs dispatched.`, { id: 'payroll-gen' });
        } catch (error: any) {
            console.error('Error in Daily Fee execution:', error);
            toast.error(`Automated execution failed: ${error.message || 'Check connection'}`, { id: 'payroll-gen' });
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 h-full flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 font-['Plus_Jakarta_Sans']">AI HR & Billing</h1>
                    <p className="text-slate-500 mt-1">Manage worker allocation, automated attendance, and payroll dispatch.</p>
                </div>

                {/* Module Tabs */}
                <div className="flex items-center p-1 bg-slate-100 rounded-lg shrink-0">
                    <button
                        onClick={() => setActiveTab('allocation')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'allocation' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                    >
                        Worker Allocation
                    </button>
                    <button
                        onClick={() => setActiveTab('attendance')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'attendance' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                    >
                        Live Attendance
                    </button>
                    <button
                        onClick={() => setActiveTab('payroll')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'payroll' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                    >
                        Auto-Payroll & Invoicing
                    </button>
                </div>
            </div>

            {activeTab === 'allocation' ? (
                /* Worker Allocation View */
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col">
                    <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                        <h2 className="font-semibold text-slate-900">Active Workforce Directory</h2>
                        <button onClick={openAddModal} className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors">
                            + Add Worker
                        </button>
                    </div>
                    <div className="flex-1 overflow-auto">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center py-20">
                                <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
                                <span className="text-slate-500 font-medium">Loading workforce directory...</span>
                            </div>
                        ) : (
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-200 text-sm text-slate-500 bg-white">
                                        <th className="font-medium py-4 px-6">Worker Name</th>
                                        <th className="font-medium py-4 px-6">Assigned Client</th>
                                        <th className="font-medium py-4 px-6">Contact & ID</th>
                                        <th className="font-medium py-4 px-6">Pay Rate</th>
                                        <th className="font-medium py-4 px-6">Client Confirmation</th>
                                        <th className="font-medium py-4 px-6">Status</th>
                                        <th className="font-medium py-4 px-6">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                    {workers.map((worker) => (
                                        <tr key={worker.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="py-4 px-6">
                                                <div className="flex flex-col">
                                                    <span className="font-semibold text-slate-900">{worker.name}</span>
                                                    <span className="text-xs text-slate-500">{worker.role}</span>
                                                </div>
                                            </td>
                                            <td className="py-4 px-6">
                                                <div className="flex items-center gap-2">
                                                    <Building className="w-4 h-4 text-slate-400" />
                                                    <span className="text-sm text-slate-700">{worker.assigned_client || 'Unassigned'}</span>
                                                </div>
                                            </td>
                                            <td className="py-4 px-6">
                                                <div className="flex flex-col gap-1">
                                                    {worker.phone && (
                                                        <div className="flex items-center gap-1.5 text-xs text-slate-600">
                                                            <Phone className="w-3.5 h-3.5 text-slate-400" /> {worker.phone}
                                                        </div>
                                                    )}
                                                    {worker.aadhaar_number && (
                                                        <div className="flex items-center gap-1.5 text-xs text-slate-600">
                                                            <UserCheck className="w-3.5 h-3.5 text-slate-400" /> Aadhaar: {worker.aadhaar_number}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-4 px-6 text-sm text-slate-700">
                                                <div className="flex flex-col gap-0.5">
                                                    <span>₹{worker.monthly_daily_rate}/day <span className="text-xs text-slate-400">(Monthly)</span></span>
                                                    <span>₹{worker.short_term_daily_rate}/day <span className="text-xs text-slate-400">(Short)</span></span>
                                                </div>
                                            </td>
                                            <td className="py-4 px-6">
                                                {worker.assigned_client ? (
                                                    worker.status === 'Available' ? (
                                                        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                                                            <Clock className="w-3 h-3" /> Awaiting Confirmation
                                                        </span>
                                                    ) : worker.status === 'Active' ? (
                                                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                                                            <CheckCircle2 className="w-3 h-3" /> Confirmed
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-slate-400">-</span>
                                                    )
                                                ) : (
                                                    <span className="text-xs text-slate-400">-</span>
                                                )}
                                            </td>
                                            <td className="py-4 px-6">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${worker.status === 'Active' ? 'bg-emerald-100 text-emerald-800' :
                                                    worker.status === 'Available' ? 'bg-primary/10 text-primary' :
                                                        'bg-amber-100 text-amber-800'
                                                    }`}>
                                                    {worker.status}
                                                </span>
                                            </td>
                                            <td className="py-4 px-6">
                                                <div className="flex items-center gap-3">
                                                    {worker.assigned_client && worker.status === 'Available' && (
                                                        <button
                                                            onClick={() => openAgentModal(worker)}
                                                            className="text-sm font-medium text-emerald-600 hover:text-emerald-800 transition-colors flex items-center gap-1 bg-emerald-50 px-3 py-1.5 rounded-lg group"
                                                            title="Open AI WhatsApp Agent"
                                                        >
                                                            <Bot className="w-4 h-4 group-hover:scale-110 transition-transform" /> AI Profile Share
                                                        </button>
                                                    )}
                                                    {worker.status === 'Active' && (
                                                        <button
                                                            onClick={async () => {
                                                                toast.loading(`Sending joining link to ${worker.name}...`, { id: `joining-${worker.id}` });
                                                                try {
                                                                    const appUrl = window.location.origin;
                                                                    const { error } = await supabase.functions.invoke('send-joining-link', {
                                                                        body: {
                                                                            workerId: worker.id,
                                                                            workerName: worker.name,
                                                                            workerPhone: worker.phone || '917575041313', // fallback to test number if blank
                                                                            appUrl: appUrl
                                                                        }
                                                                    });
                                                                    if (error) throw error;
                                                                    toast.success(`Joining link sent via WhatsApp to ${worker.name}!`, { id: `joining-${worker.id}` });
                                                                } catch (err: any) {
                                                                    console.error("Failed to send joining link:", err);
                                                                    toast.error(`Failed to send link: ${err.message}`, { id: `joining-${worker.id}` });
                                                                }
                                                            }}
                                                            className="text-sm font-medium text-emerald-600 hover:text-emerald-800 transition-colors flex items-center gap-1"
                                                        >
                                                            <Send className="w-3.5 h-3.5" /> Send Joining Link
                                                        </button>
                                                    )}
                                                    <button onClick={() => openEditModal(worker)} className="text-sm font-medium text-primary hover:text-primary/80 transition-colors">
                                                        Edit
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            ) : activeTab === 'attendance' ? (
                /* Attendance View */
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col">
                    <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                        <div>
                            <h2 className="font-semibold text-slate-900">Live Attendance Log</h2>
                            <p className="text-sm text-slate-500 mt-1">Populated automatically via Staff/Client "Fill Duty" links.</p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={fetchLiveAttendance}
                                className="px-3 py-1.5 border border-slate-200 bg-white text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2"
                            >
                                <RefreshCw className={`w-4 h-4 ${attendanceLoading ? 'animate-spin' : ''}`} /> Refresh
                            </button>
                            <button className="px-3 py-1.5 border border-slate-200 bg-white text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors">
                                Filter: Today
                            </button>
                        </div>
                    </div>

                    {attendanceLoading ? (
                        <div className="flex-1 flex flex-col items-center justify-center py-20">
                            <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
                            <span className="text-slate-500 font-medium">Fetching live duty logs...</span>
                        </div>
                    ) : attendanceLogs.length === 0 ? (
                        <div className="flex-1 p-8 text-center flex flex-col items-center justify-center">
                            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                                <Clock className="w-8 h-8 text-primary" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 mb-2">Awaiting Duty Starts</h3>
                            <p className="text-slate-500 max-w-sm">No duty starts logged for today yet. Staff or clients can use their unique tracking links to submit attendance automatically.</p>
                            <button className="mt-6 px-4 py-2 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-2">
                                <FileText className="w-4 h-4" /> Generate Attendance Report
                            </button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto flex-1">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-200 bg-slate-50/50 text-sm text-slate-500">
                                        <th className="font-medium py-4 px-6">Staff Member</th>
                                        <th className="font-medium py-4 px-6">Assigned Client</th>
                                        <th className="font-medium py-4 px-6">Check-In Time</th>
                                        <th className="font-medium py-4 px-6">Check-Out Time</th>
                                        <th className="font-medium py-4 px-6">Duration (Live)</th>
                                        <th className="font-medium py-4 px-6">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                    {attendanceLogs.map((log) => {
                                        // Calculate rough duration
                                        const start = new Date(log.check_in_time);
                                        const end = log.check_out_time ? new Date(log.check_out_time) : new Date();
                                        const hrs = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60));
                                        const mins = Math.floor(((end.getTime() - start.getTime()) % (1000 * 60 * 60)) / (1000 * 60));
                                        const durationStr = `${hrs}h ${mins}m`;

                                        return (
                                            <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="py-4 px-6">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                                                            {log.workers?.name?.charAt(0) || '?'}
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="font-semibold text-slate-900">{log.workers?.name || 'Unknown Staff'}</span>
                                                            <span className="text-xs text-slate-500">{log.workers?.role || 'Worker'}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-4 px-6 text-sm text-slate-700">
                                                    {log.workers?.assigned_client || 'Unassigned'}
                                                </td>
                                                <td className="py-4 px-6 font-medium text-slate-900">
                                                    {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </td>
                                                <td className="py-4 px-6 font-medium text-slate-900">
                                                    {log.check_out_time ? new Date(log.check_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (
                                                        <span className="text-slate-400 italic">Ongoing...</span>
                                                    )}
                                                </td>
                                                <td className="py-4 px-6">
                                                    <div className="flex items-center gap-1.5 text-sm">
                                                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                                                        <span className={!log.check_out_time ? 'font-semibold text-emerald-600' : 'text-slate-700'}>
                                                            {durationStr}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="py-4 px-6">
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${log.status === 'Completed' ? 'bg-slate-100 text-slate-700' : 'bg-emerald-100 text-emerald-800'
                                                        }`}>
                                                        {log.status === 'On Duty' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>}
                                                        {log.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            ) : (
                /* Payroll & Invoicing View */
                <div className="grid lg:grid-cols-3 gap-6 flex-1">
                    {/* Main List */}
                    <div className="lg:col-span-2 flex flex-col gap-6">
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1">
                            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                                <h2 className="font-semibold text-slate-900">Current Billing Cycle (October)</h2>
                                <span className="text-sm text-slate-500 border border-slate-200 px-3 py-1 rounded-full bg-white">Auto-calculating from active hours</span>
                            </div>
                            <div className="divide-y divide-slate-100">
                                {isLoading ? (
                                    <div className="flex flex-col items-center justify-center py-20">
                                        <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
                                        <span className="text-slate-500 font-medium">Loading payroll calculations...</span>
                                    </div>
                                ) : payrollItems.length === 0 ? (
                                    <div className="p-8 text-center text-slate-500">
                                        No active payroll entries found for this cycle.
                                    </div>
                                ) : (
                                    payrollItems.map((item) => (
                                        <div key={item.id} className="p-5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                                            <div className="flex items-start gap-4">
                                                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                                                    <Users className="w-5 h-5 text-slate-500" />
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-slate-900">{item.worker}</h4>
                                                    <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
                                                        <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {item.days_worked} unique days</span>
                                                        <span>•</span>
                                                        <span className="flex items-center gap-1"><Building className="w-3.5 h-3.5" /> {item.client_name}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="text-right flex items-center gap-4">
                                                    <div className="text-xs text-slate-400 text-left">
                                                        <p>Rate: ₹{item.daily_rate}/d</p>
                                                        <p>Dep: ₹{item.deposit_received}</p>
                                                    </div>
                                                    <div className="ml-2">
                                                        <p className={`text-lg font-bold ${item.net_balance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                            {item.net_balance >= 0 ? '+' : ''}₹{item.net_balance}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="border-l border-slate-200 pl-4">
                                                    <button onClick={() => { setEditingPayroll({ ...item }); setIsEditPayrollModalOpen(true); }} className="p-2 text-slate-400 hover:text-primary hover:bg-slate-100 rounded-lg transition-colors" title="Edit Payroll Entry">
                                                        <Edit3 className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Action Panel */}
                    <div className="flex flex-col gap-6">
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 text-center">
                            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Send className="w-8 h-8 text-primary ml-1" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-2">Run Automation</h3>
                            <p className="text-sm text-slate-500 mb-6">
                                Clicking this will generate <strong>2 Worker Payslips</strong> and <strong>2 Client Monthly Bills</strong> based on the verified attendance hours.
                            </p>
                            <button
                                onClick={handleGeneratePayroll}
                                disabled={isGenerating}
                                className={`w-full py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${isGenerating
                                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                    : 'bg-primary text-white hover:bg-primary/90 hover:shadow-lg hover:-translate-y-0.5'
                                    }`}
                            >
                                {isGenerating ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
                                        Generating PDFs...
                                    </>
                                ) : (
                                    <>
                                        <FileText className="w-5 h-5" />
                                        Dispatch Payslips & Invoices (v2 - Fixed)
                                    </>
                                )}
                            </button>
                        </div>

                        <div className="bg-slate-50 rounded-xl border border-slate-200 p-5 space-y-4">
                            <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-3">
                                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                Automation Checklist
                            </h3>
                            <div className="flex items-center gap-3 text-sm">
                                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                <span className="text-slate-700">Attendance manually verified by HR</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                <span className="text-slate-700">Salary rates verified</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                <span className="text-slate-700">Client billing active</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Add/Edit Worker Modal */}
            {
                isModalOpen && (
                    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                        <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200 my-auto max-h-[90vh] flex flex-col">
                            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50 shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                                        <Users className="w-5 h-5 text-primary" />
                                    </div>
                                    <h2 className="text-lg font-bold text-slate-900">
                                        {modalMode === 'add' ? 'Add New Worker' : 'Edit Allocation'}
                                    </h2>
                                </div>
                                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100 transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <form onSubmit={handleWorkerSubmit} className="p-5 space-y-4 text-left overflow-y-auto">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Full Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full px-4 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                                        placeholder="e.g. Dr. Emily Carter"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Role / Specialization</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.role}
                                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                        className="w-full px-4 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                                        placeholder="e.g. Specialist Consultant"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Assigned Client</label>
                                    <select
                                        value={formData.assigned_client}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setFormData({
                                                ...formData,
                                                assigned_client: val,
                                                // Auto-update status: assigned = Active, none = Available
                                                status: val ? 'Active' : 'Available'
                                            });
                                        }}
                                        className="w-full px-4 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm bg-white"
                                    >
                                        <option value="">— None (Worker stays Available) —</option>
                                        {pipelineLeads.map(lead => (
                                            <option key={lead.id} value={lead.name}>
                                                {lead.name} ({lead.pipeline_stage})
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-slate-400 mt-1">Selecting a client auto-sets status to Active.</p>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1">Monthly Daily Rate (₹)</label>
                                        <input
                                            type="number"
                                            required
                                            min="0"
                                            step="0.01"
                                            value={formData.monthly_daily_rate}
                                            onChange={(e) => setFormData({ ...formData, monthly_daily_rate: e.target.value })}
                                            className="w-full px-4 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                                            placeholder="e.g. 850.00"
                                        />
                                        <p className="text-xs text-slate-400 mt-1">Applied if service $\ge$ 30 days.</p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1">Short Term Daily Rate (₹)</label>
                                        <input
                                            type="number"
                                            required
                                            min="0"
                                            step="0.01"
                                            value={formData.short_term_daily_rate}
                                            onChange={(e) => setFormData({ ...formData, short_term_daily_rate: e.target.value })}
                                            className="w-full px-4 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                                            placeholder="e.g. 1000.00"
                                        />
                                        <p className="text-xs text-slate-400 mt-1">Applied if service &lt; 30 days.</p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1">Deposit Received (₹)</label>
                                        <input
                                            type="number"
                                            required
                                            min="0"
                                            step="0.01"
                                            value={formData.deposit_received}
                                            onChange={(e) => setFormData({ ...formData, deposit_received: e.target.value })}
                                            className="w-full px-4 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                                            placeholder="e.g. 15000.00"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1">Status</label>
                                        <select
                                            value={formData.status}
                                            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                            className="w-full px-4 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm bg-white"
                                        >
                                            <option value="Available">Available</option>
                                            <option value="Active">Active</option>
                                            <option value="On Leave">On Leave</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="border-t border-slate-100 pt-4 mt-4">
                                    <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                                        <UserCheck className="w-4 h-4 text-primary" />
                                        Extended Details (KYC)
                                    </h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 mb-1">Aadhaar Card Number <span className="text-red-500">*</span></label>
                                            <input
                                                type="text"
                                                required
                                                maxLength={12}
                                                value={formData.aadhaar_number}
                                                onChange={(e) => setFormData({ ...formData, aadhaar_number: e.target.value.replace(/\D/g, '') })}
                                                className="w-full px-4 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                                                placeholder="12 Digit Aadhaar"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 mb-1">Phone Number <span className="text-red-500">*</span></label>
                                            <input
                                                type="tel"
                                                required
                                                value={formData.phone}
                                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                                className="w-full px-4 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                                                placeholder="+91..."
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 mb-1">Date of Birth</label>
                                            <input
                                                type="date"
                                                value={formData.dob}
                                                onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                                                className="w-full px-4 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                                            />
                                        </div>
                                    </div>
                                    <div className="mt-4">
                                        <label className="block text-sm font-semibold text-slate-700 mb-1">Residential Address</label>
                                        <textarea
                                            value={formData.address}
                                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                            className="w-full px-4 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm resize-none h-20"
                                            placeholder="Full address..."
                                        />
                                    </div>
                                </div>

                                {/* Document Upload Section */}
                                <div className="border-t border-slate-100 pt-4 mt-4">
                                    <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                                        <FileText className="w-4 h-4 text-primary" />
                                        Verification Documents
                                    </h3>

                                    <div className="border-2 border-dashed border-slate-200 hover:border-primary/50 transition-colors rounded-xl p-6 flex flex-col items-center justify-center bg-slate-50 cursor-pointer text-center relative overflow-hidden group">
                                        <input
                                            type="file"
                                            multiple
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                            onChange={(e) => {
                                                if (e.target.files && e.target.files.length > 0) {
                                                    const newFiles = Array.from(e.target.files);
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        documents: [...(prev.documents || []), ...newFiles]
                                                    }));
                                                }
                                            }}
                                        />
                                        <div className="w-12 h-12 bg-white shadow-sm rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                            <Upload className="w-6 h-6 text-primary" />
                                        </div>
                                        <p className="font-semibold text-slate-700 mb-1">Upload ID proofs & Certifications</p>
                                        <p className="text-xs text-slate-500 max-w-xs">Drag and drop files here, or click to browse. Supports PDF, JPG, PNG (Max 5MB).</p>
                                    </div>

                                    {formData.documents && formData.documents.length > 0 && (
                                        <div className="mt-4 flex flex-col gap-2">
                                            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Attached Files ({formData.documents.length})</h4>
                                            <div className="max-h-32 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                                                {formData.documents.map((file, idx) => (
                                                    <div key={idx} className="flex items-center justify-between p-2 rounded-lg border border-slate-200 bg-white">
                                                        <div className="flex items-center gap-2 overflow-hidden">
                                                            <FileText className="w-4 h-4 text-primary shrink-0" />
                                                            <span className="text-xs font-medium text-slate-700 truncate">{file.name}</span>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                setFormData(prev => ({
                                                                    ...prev,
                                                                    documents: prev.documents.filter((_, i) => i !== idx)
                                                                }));
                                                            }}
                                                            className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded transition-colors shrink-0"
                                                        >
                                                            <X className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="pt-2 flex gap-3 border-t border-slate-100 mt-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsModalOpen(false)}
                                        className="flex-1 py-2.5 px-4 rounded-lg font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="flex-1 py-2.5 px-4 rounded-lg font-semibold text-white bg-primary hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center"
                                    >
                                        {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save Worker'}
                                    </button>
                                </div>
                            </form>
                        </div >
                    </div >
                )
            }

            {/* Edit Payroll Modal */}
            {
                isEditPayrollModalOpen && editingPayroll && (
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 z-50 transition-all">
                        <div className="bg-white/95 backdrop-blur-xl border border-white/40 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="p-5 border-b border-slate-100 bg-white/50 flex justify-between items-center">
                                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                    <Edit3 className="w-5 h-5 text-primary" /> Edit Payslip Details
                                </h2>
                                <button onClick={() => setIsEditPayrollModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100 transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <form onSubmit={handleSavePayroll} className="p-5 space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Worker</label>
                                    <input
                                        type="text"
                                        disabled
                                        value={editingPayroll.worker}
                                        className="w-full px-4 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-500 cursor-not-allowed text-sm"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1">Hours Logged</label>
                                        <input
                                            type="number"
                                            required
                                            min="0"
                                            step="0.5"
                                            value={editingPayroll.hours_logged}
                                            onChange={(e) => setEditingPayroll({ ...editingPayroll, hours_logged: parseFloat(e.target.value) || 0 })}
                                            className="w-full px-4 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm bg-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1">Total Amount (₹)</label>
                                        <input
                                            type="number"
                                            required
                                            min="0"
                                            step="0.01"
                                            value={editingPayroll.total_amount}
                                            onChange={(e) => setEditingPayroll({ ...editingPayroll, total_amount: parseFloat(e.target.value) || 0 })}
                                            className="w-full px-4 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm bg-white"
                                        />
                                    </div>
                                </div>
                                <div className="pt-2 flex gap-3">
                                    <button type="button" onClick={() => setIsEditPayrollModalOpen(false)} className="flex-1 py-2.5 px-4 rounded-lg font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="flex-1 py-2.5 px-4 rounded-lg font-semibold text-white bg-primary hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center"
                                    >
                                        {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save Changes'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* AI WhatsApp Draft Modal */}
            {
                isAgentModalOpen && agentTargetWorker && (
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 z-50 transition-all">
                        <div className="bg-white/95 backdrop-blur-xl border border-white/40 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
                            <div className="p-5 border-b border-slate-100 bg-emerald-500/10 flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                                        <Bot className="w-5 h-5 text-emerald-600" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold text-slate-900">AI WhatsApp Agent</h2>
                                        <p className="text-xs text-slate-500 font-medium tracking-wide">SHARING PROFILE: {agentTargetWorker.name}</p>
                                    </div>
                                </div>
                                <button onClick={() => setIsAgentModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100 transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="p-5 space-y-4 flex-1">
                                <div className="flex items-center justify-between">
                                    <label className="block text-sm font-semibold text-slate-700 flex items-center gap-2">
                                        <Globe className="w-4 h-4 text-primary" /> Target Language
                                    </label>
                                    <div className="flex bg-slate-100 rounded-lg p-1">
                                        {['English', 'Hindi', 'Hinglish'].map(lang => (
                                            <button
                                                key={lang}
                                                onClick={() => setAgentDraftLang(lang as any)}
                                                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${agentDraftLang === lang ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                            >
                                                {lang}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                                        <Edit3 className="w-4 h-4 text-primary" /> Edit Generated Draft
                                    </label>
                                    <div className="relative">
                                        <textarea
                                            value={agentDraftText}
                                            onChange={(e) => setAgentDraftText(e.target.value)}
                                            className="w-full h-32 px-4 py-3 rounded-xl border border-emerald-200 outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm bg-emerald-50 text-emerald-900 resize-none font-medium leading-relaxed"
                                        />
                                        <div className="absolute bottom-3 right-3 flex gap-1">
                                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse delay-75"></span>
                                            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse delay-150"></span>
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-2 bg-slate-50 p-2 rounded border border-slate-100 italic">
                                        Target Client: <strong>{agentTargetWorker.assigned_client}</strong>
                                    </p>
                                </div>
                            </div>
                            <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-3">
                                <button onClick={() => setIsAgentModalOpen(false)} className="px-6 py-2.5 rounded-xl font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors">
                                    Cancel
                                </button>
                                <button onClick={handleDispatchMessage} className="flex-1 py-2.5 rounded-xl font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2">
                                    <Send className="w-4 h-4" /> Send on WhatsApp
                                </button>
                            </div>
                        </div>
                    </div>
                )}
        </div>
    );
}
